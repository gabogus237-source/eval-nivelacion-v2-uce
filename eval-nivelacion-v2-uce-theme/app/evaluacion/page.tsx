'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/* ===== Tipos ===== */
type Rol = 'estudiante' | 'auto_docente' | 'coord_asignatura' | 'coord_nivelacion';

type Item = {
  pregunta_id: number;
  categoria: string;
  pregunta: string;
  orden: number;
  escala_min: number;
  escala_max: number;
};

type Curso = {
  curso_id: string;
  modalidad: string | null;
  nombre: string | null;
};

type Docente = { id: number; display: string };

/* ===== Helpers ===== */
function normMod(raw: string | null | undefined): '' | 'presencial' | 'distancia' {
  const s = (raw ?? '').toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').trim();
  if (s.includes('presen')) return 'presencial';
  if (s.includes('dist')) return 'distancia';
  // Cualquier otro valor (virtual, mixta, etc.) no participa
  return '';
}

/* ===== Magic Link ===== */
function InlineMagicLink() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (!/@uce\.edu\.ec$/i.test(email.trim())) {
      setError('Usa tu correo institucional @uce.edu.ec');
      return;
    }
    const redirectTo = window.location.origin;
    const { error } = await supabase.auth.signInWithOtp({
      email: email.trim().toLowerCase(),
      options: { emailRedirectTo: redirectTo },
    });
    if (error) setError(error.message);
    else setSent(true);
  };

  if (sent) {
    return (
      <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow">
        <h1 className="text-xl font-semibold mb-2">Revisa tu correo</h1>
        <p>Te enviamos un enlace a tu <b>@uce.edu.ec</b>. Ábrelo para iniciar sesión.</p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow">
      <h1 className="text-xl font-semibold mb-4">Inicia sesión</h1>
      <p className="text-sm mb-4">Usa tu correo institucional <b>@uce.edu.ec</b>.</p>
      <form onSubmit={submit} className="space-y-3">
        <input
          type="email"
          placeholder="tu_correo@uce.edu.ec"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="w-full border rounded-xl p-3"
          required
        />
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" className="w-full rounded-xl p-3 bg-black text-white">
          Enviarme enlace mágico
        </button>
      </form>
    </div>
  );
}

/* ===== Formulario por rol ===== */
function FormByRole({
  role,
  slug, // no usado (compat)
  target = null,
  title,
}: {
  role: Rol;
  slug: string;
  target?: 'docente' | 'coord' | null;
  title: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);

  // Catálogo y selección
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [modalidad, setModalidad] = useState(''); // Presencial | Distancia
  const [cursoId, setCursoId] = useState('');

  // Docentes
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [docenteId, setDocenteId] = useState<string>('');

  // Para target="coord"
  const [coordAsigId, setCoordAsigId] = useState('');

  // Respuestas y comentarios
  const [vals, setVals] = useState<Record<number, number>>({});
  const [loMejor, setLoMejor] = useState('');
  const [aMejorar, setAMejorar] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Carga preguntas + catálogo (solo con sesión)
  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);

      const { data: s } = await supabase.auth.getSession();
      if (!on) return;
      if (!s?.session) {
        setShowLogin(true);
        setItems(null);
        setCursos([]);
        setLoading(false);
        return;
      }

      // Preguntas
      const periodo = '2025-2025';
      const { data, error } = await supabase.rpc('get_preguntas_para', {
        rol_in: role,
        periodo_in: periodo,
      });
      if (!on) return;
      if (error) setItems([]);
      else setItems((data ?? []) as Item[]);

      // Catálogo de cursos (todos; filtramos en cliente con normalización)
      const { data: cat, error: errCat } = await supabase
        .from('catalogo_cursos')
        .select('curso_id, modalidad, nombre')
        .order('curso_id', { ascending: true });

      if (!on) return;
      if (errCat) setCursos([]);
      else setCursos((cat ?? []) as Curso[]);

      setLoading(false);
    })();
    return () => { on = false; };
  }, [role]);

  // Cursos filtrados por modalidad elegida (con normalización)
  const cursosFiltrados = useMemo(() => {
    const pick = normMod(modalidad);
    if (!pick) return [];
    return cursos.filter((c) => normMod(c.modalidad) === pick);
  }, [cursos, modalidad]);

  // Al cambiar modalidad, reiniciar curso/docentes
  useEffect(() => {
    setCursoId('');
    setDocentes([]);
    setDocenteId('');
  }, [modalidad]);

  // Al elegir curso: cargar docentes del curso
  useEffect(() => {
    if (!cursoId) {
      setDocentes([]);
      setDocenteId('');
      return;
    }
    (async () => {
      // 1) ids de la tabla de mapeo
      const { data: mapRows, error: mapErr } = await supabase
        .from('coordinadores_docentes')
        .select('docente_id')
        .eq('curso_id', cursoId);

      if (!mapErr && Array.isArray(mapRows) && mapRows.length > 0) {
        const ids = Array.from(
          new Set(
            (mapRows as any[])
              .map((r) => Number(r.docente_id))
              .filter((n) => Number.isFinite(n))
          )
        );
        if (ids.length > 0) {
          const { data: docs, error: docsErr } = await supabase
            .from('docentes')
            .select('id, nombre, nombres, apellidos')
            .in('id', ids)
            .order('id', { ascending: true });

          if (!docsErr && Array.isArray(docs)) {
            setDocentes(
              (docs as any[]).map((d) => ({
                id: Number(d.id),
                display:
                  d.nombre ||
                  [d.nombres, d.apellidos].filter(Boolean).join(' ') ||
                  `Docente #${d.id}`,
              }))
            );
            setDocenteId('');
            return;
          }
        }
      }

      // 2) Fallback: todos los docentes
      const { data: all, error: errAll } = await supabase
        .from('docentes')
        .select('id, nombre, nombres, apellidos')
        .order('id', { ascending: true });

      if (!errAll && Array.isArray(all)) {
        setDocentes(
          (all as any[]).map((d) => ({
            id: Number(d.id),
            display:
              d.nombre ||
              [d.nombres, d.apellidos].filter(Boolean).join(' ') ||
              `Docente #${d.id}`,
          }))
        );
      } else {
        setDocentes([]);
      }
      setDocenteId('');
    })();
  }, [cursoId]);

  // Agrupar preguntas
  const porCategoria = useMemo(() => {
    const g: Record<string, Item[]> = {};
    (items ?? []).forEach((it) => {
      (g[it.categoria] ||= []).push(it);
    });
    Object.values(g).forEach((arr) => arr.sort((a, b) => a.orden - b.orden));
    return g;
  }, [items]);

  const setValor = (id: number, v: number | string) =>
    setVals((p) => ({ ...p, [id]: Number(v) }));

  const requiereDocente = role === 'estudiante' || target === 'docente';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    if (!modalidad) { setMsg('⚠ Selecciona la modalidad.'); return; }
    if (!cursoId) { setMsg('⚠ Selecciona el curso.'); return; }
    if (requiereDocente && !docenteId) { setMsg('⚠ Selecciona el docente.'); return; }
    if (target === 'coord' && !coordAsigId.trim()) { setMsg('⚠ Ingresa el ID del coordinador/a.'); return; }

    const payload: any = {
      rol: role,
      modalidad,
      curso_id: cursoId,
      docente_id: requiereDocente ? Number(docenteId) : null,
      coord_asignatura_id: target === 'coord' ? (coordAsigId ? Number(coordAsigId) : null) : null,
      no_aplica: false,
      respuestas: vals,
      lo_mejor: loMejor || null,
      a_mejorar: aMejorar || null,
    };

    const { error } = await supabase.from('eval_nivelacion').insert([payload]);
    if (error) setMsg('❌ Error al guardar: ' + (error.message || 'ver consola'));
    else {
      setMsg('✅ ¡Guardado con éxito!');
      setVals({});
      setLoMejor('');
      setAMejorar('');
      setDocenteId('');
      setCoordAsigId('');
    }
  };

  if (loading) return <div className="p-4">Cargando preguntas…</div>;
  if (showLogin) return <InlineMagicLink />;
  if (!items || items.length === 0) return <div className="p-4">No hay preguntas para este instrumento.</div>;

  return (
    <section className="card space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* 1) Modalidad — SOLO estas dos opciones */}
          <div>
            <label className="label">Modalidad</label>
            <select
              className="input"
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
              required
            >
              <option value="">Seleccione…</option>
              <option value="Presencial">Presencial</option>
              <option value="Distancia">Distancia</option>
            </select>
          </div>

          {/* 2) Curso (filtrado por modalidad con normalización) */}
          <div>
            <label className="label">Curso</label>
            <select
              className="input"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              required
              disabled={!modalidad}
            >
              <option value="">
                {modalidad ? 'Seleccione…' : 'Elija modalidad primero'}
              </option>
              {cursosFiltrados.map((c) => (
                <option key={c.curso_id} value={c.curso_id}>
                  {c.curso_id}{c.nombre ? ` — ${c.nombre}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* 3) Docente del curso */}
          {requiereDocente && (
            <div className="sm:col-span-2">
              <label className="label">Docente</label>
              <select
                className="input"
                value={docenteId}
                onChange={(e) => setDocenteId(e.target.value)}
                required
                disabled={!cursoId}
              >
                <option value="">
                  {cursoId ? 'Seleccione…' : 'Elija un curso primero'}
                </option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>{d.display}</option>
                ))}
              </select>
            </div>
          )}

          {/* ID de coord (solo target="coord") */}
          {target === 'coord' && (
            <div className="sm:col-span-2">
              <label className="label">Coordinador/a de asignatura ID</label>
              <input
                className="input"
                value={coordAsigId}
                onChange={(e) => setCoordAsigId(e.target.value)}
                placeholder="ID numérico de coordinador/a"
                required
              />
            </div>
          )}
        </div>

        {Object.entries(porCategoria).map(([cat, arr]) => (
          <div key={cat} className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold mb-3">{cat}</h3>
            <div className="space-y-3">
              {arr.map((it) => (
                <div key={it.pregunta_id} className="grid md:grid-cols-2 gap-2 items-center">
                  <div className="text-sm">{it.pregunta}</div>
                  <div className="flex gap-3 justify-start md:justify-end">
                    {Array.from({ length: it.escala_max - it.escala_min + 1 }).map((_, i) => {
                      const v = it.escala_min + i;
                      return (
                        <label key={v} className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`item-${it.pregunta_id}`}
                            value={v}
                            checked={vals[it.pregunta_id] === v}
                            onChange={(e) => setValor(it.pregunta_id, e.target.value)}
                            required
                          />
                          <span className="text-xs">{v}</span>
                        </label>
                      );
                    })}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}

        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Lo mejor</label>
            <textarea
              className="input"
              rows={3}
              value={loMejor}
              onChange={(e) => setLoMejor(e.target.value)}
            />
          </div>
          <div>
            <label className="label">Aspectos a mejorar</label>
            <textarea
              className="input"
              rows={3}
              value={aMejorar}
              onChange={(e) => setAMejorar(e.target.value)}
            />
          </div>
        </div>

        <button className="btn btn-primary">Guardar</button>
        {msg && <div className="text-sm mt-2">{msg}</div>}
      </form>
    </section>
  );
}

/* ===== Página ===== */
const LABELS: Record<Rol, string> = {
  estudiante: 'Estudiante',
  auto_docente: 'Docente',
  coord_asignatura: 'Coordinador de Asignatura',
  coord_nivelacion: 'Coordinadora de Nivelación',
};

function mapWhitelistToApp(r: string): Rol {
  return (r === 'docente' ? 'auto_docente' : r) as Rol;
}

export default function Page() {
  const [roles, setRoles] = useState<Rol[] | null>(null);
  const [selected, setSelected] = useState<Rol | ''>('');

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error } = await supabase
        .from('vw_roles_permitidos')
        .select('rol');

      if (!alive) return;

      const fromDB = !error ? (data ?? []) : [];
      const normalized = fromDB.map((r: any) => mapWhitelistToApp(String(r.rol))) as Rol[];

      // Si la vista no devolvió nada por algún motivo, fallback a estudiante
      const finalRoles = normalized.length > 0 ? normalized : (['estudiante'] as Rol[]);
      setRoles(finalRoles);
      if (finalRoles.length === 1) setSelected(finalRoles[0]); // auto-selecciona si hay solo uno
    })();
    return () => { alive = false; };
  }, []);

  if (roles === null) return <div className="p-6">Cargando roles…</div>;

  const target =
    selected === 'coord_asignatura' ? 'coord'
    : selected === 'auto_docente'   ? 'docente'
    : null;

  return (
    <main className="max-w-4xl mx-auto p-6 space-y-6">
      <h1 className="text-2xl font-bold">Evaluación Docente – FCA</h1>

      {/* Paso 1: Selección de rol (solo los permitidos) */}
      <section className="space-y-2">
        <label className="font-medium">1) Selecciona tu rol</label>
        <select
          className="w-full border rounded p-2"
          value={selected}
          onChange={(e) => setSelected(e.target.value as Rol)}
        >
          <option value="">— Elige —</option>
          {roles.map((r) => (
            <option key={r} value={r}>{LABELS[r]}</option>
          ))}
        </select>
      </section>

      {/* Paso 2+: Formulario según rol */}
      {selected && (
        <FormByRole
          role={selected}
          slug=""
          target={target}
          title={`Instrumento – ${LABELS[selected]}`}
        />
      )}
    </main>
  );
}
