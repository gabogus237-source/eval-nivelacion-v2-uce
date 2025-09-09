'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ===== Tipos ===== */
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

type Docente = {
  id: number;
  display: string;
};

/** ===== Login inline (Magic Link) ===== */
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

/** ===== Formulario genérico por rol ===== */
function FormByRole({
  role,
  slug, // compatibilidad con tu código original
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

  // Catálogo de cursos
  const [cursos, setCursos] = useState<Curso[]>([]);
  const [cursoId, setCursoId] = useState('');
  const [modalidad, setModalidad] = useState(''); // solo Presencial | Distancia

  // Docentes por curso
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [docenteId, setDocenteId] = useState<string>(''); // string para el select

  // Campo para coord asignatura (cuando target="coord")
  const [coordAsigId, setCoordAsigId] = useState('');

  // Respuestas y comentarios
  const [vals, setVals] = useState<Record<number, number>>({});
  const [loMejor, setLoMejor] = useState('');
  const [aMejorar, setAMejorar] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // Carga preguntas + catálogo de cursos (solo con sesión)
  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);

      // 1) sesión
      const { data: s } = await supabase.auth.getSession();
      if (!on) return;
      if (!s?.session) {
        setShowLogin(true);
        setItems(null);
        setCursos([]);
        setLoading(false);
        return;
      }

      // 2) preguntas por rol/periodo
      const periodo = '2025-2025';
      const { data, error } = await supabase.rpc('get_preguntas_para', {
        rol_in: role,
        periodo_in: periodo,
      });

      if (!on) return;
      if (error) {
        console.error('RPC get_preguntas_para error:', error);
        setItems([]);
      } else {
        setItems(((data ?? []) as Item[]));
      }

      // 3) catálogo de cursos
      const { data: cat, error: errCat } = await supabase
        .from('catalogo_cursos')
        .select('curso_id, modalidad, nombre')
        .order('curso_id', { ascending: true });

      if (!on) return;
      if (errCat) {
        console.error('catalogo_cursos error:', errCat);
        setCursos([]);
      } else {
        setCursos((cat ?? []) as Curso[]);
      }

      setLoading(false);
    })();
    return () => { on = false; };
  }, [role]);

  // Al elegir curso: autocompletar modalidad (solo 'Presencial' | 'Distancia') y cargar docentes
  useEffect(() => {
    if (!cursoId) {
      setModalidad('');
      setDocentes([]);
      setDocenteId('');
      return;
    }
    const c = cursos.find((x) => x.curso_id === cursoId);
    if (c) {
      const m = (c.modalidad || '').toLowerCase();
      setModalidad(m.includes('presencial') ? 'Presencial' : 'Distancia');
    }

    // Cargar docentes del curso
    (async () => {
      // 1) Intento preferido: tabla de mapeo coordinadores_docentes con relación a docentes
      const { data, error } = await supabase
        .from('coordinadores_docentes')
        .select(`
          docente_id,
          docentes:docente_id ( id, nombre, nombres, apellidos )
        `)
        .eq('curso_id', cursoId);

      if (!error && Array.isArray(data)) {
        const list: Docente[] = (data as any[]).map((row) => {
          const d = row.docentes || {};
          const id = Number(row.docente_id ?? d.id);
          const display =
            d.nombre ||
            [d.nombres, d.apellidos].filter(Boolean).join(' ') ||
            `Docente #${id}`;
        return { id, display };
        }).filter((d) => Number.isFinite(d.id));
        // Si no trajo nada, cae al fallback más abajo
        if (list.length > 0) {
          setDocentes(list);
          setDocenteId(''); // forzar selección
          return;
        }
      }

      // 2) Fallback: listar todos los docentes
      const { data: all, error: errAll } = await supabase
        .from('docentes')
        .select('id, nombre, nombres, apellidos')
        .order('id', { ascending: true });

      if (!errAll && Array.isArray(all)) {
        const list: Docente[] = (all as any[]).map((d: any) => ({
          id: Number(d.id),
          display:
            d.nombre ||
            [d.nombres, d.apellidos].filter(Boolean).join(' ') ||
            `Docente #${d.id}`,
        }));
        setDocentes(list);
        setDocenteId('');
      } else {
        console.error('No fue posible cargar docentes:', errAll);
        setDocentes([]);
        setDocenteId('');
      }
    })();
  }, [cursoId, cursos]);

  const porCategoria = useMemo(() => {
    const g: Record<string, Item[]> = {};
    (items ?? []).forEach((it) => { (g[it.categoria] ||= []).push(it); });
    Object.values(g).forEach(arr => arr.sort((a, b) => a.orden - b.orden));
    return g;
  }, [items]);

  const setValor = (id: number, v: number | string) =>
    setVals((p) => ({ ...p, [id]: Number(v) }));

  // Reglas: cuándo exigir docente
  const requiereDocente =
    role === 'estudiante' || target === 'docente';

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);

    // Validaciones mínimas
    if (!cursoId) { setMsg('⚠ Selecciona el curso.'); return; }
    if (!modalidad) { setMsg('⚠ Selecciona la modalidad.'); return; }
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
    if (error) {
      console.error(error);
      setMsg('❌ Error al guardar: ' + (error.message || 'ver consola'));
    } else {
      setMsg('✅ ¡Guardado con éxito!');
      setVals({});
      setLoMejor('');
      setAMejorar('');
      setDocenteId('');
      setCoordAsigId('');
      // Mantengo curso y modalidad
    }
  };

  // ===== Render =====
  if (loading) return <div className="p-4">Cargando preguntas…</div>;
  if (showLogin) return <InlineMagicLink />;
  if (!items || items.length === 0)
    return <div className="p-4">No hay preguntas para este instrumento.</div>;

  return (
    <section className="card space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          {/* Curso desde catálogo */}
          <div>
            <label className="label">Curso</label>
            <select
              className="input"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              required
            >
              <option value="">Seleccione…</option>
              {cursos.map((c) => (
                <option key={c.curso_id} value={c.curso_id}>
                  {c.curso_id}{c.nombre ? ` — ${c.nombre}` : ''}
                </option>
              ))}
            </select>
          </div>

          {/* Modalidad solo Presencial | Distancia */}
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

          {/* Docente (según curso) */}
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
                <option value="">{cursoId ? 'Seleccione…' : 'Elija un curso primero'}</option>
                {docentes.map((d) => (
                  <option key={d.id} value={d.id}>{d.display}</option>
                ))}
              </select>
            </div>
          )}

          {/* Coordinador/a de asignatura ID (solo cuando target="coord") */}
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

/** ===== Página (clamp por email) ===== */
export default function Page() {
  const [userEmail, setUserEmail] = useState<string>('');
  const [roles, setRoles] = useState<Rol[] | null>(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email?.toLowerCase() ?? '';
      if (!alive) return;
      setUserEmail(email);

      if (!email) {
        setRoles(['estudiante']);
        return;
      }

      if (!email.endsWith('@uce.edu.ec')) {
        setRoles(['estudiante']);
        return;
      }

      const { data, error } = await supabase.rpc('api_current_roles');
      if (!alive) return;
      if (error) {
        console.error(error);
        setRoles(['estudiante']);
      } else {
        setRoles(((data ?? []) as Rol[]));
      }
    })();
    return () => { alive = false;

