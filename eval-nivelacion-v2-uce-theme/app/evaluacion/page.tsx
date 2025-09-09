'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ===== Tipos ===== */
type Rol = 'estudiante' | 'auto_docente' | 'coord_asignatura' | 'coord_nivelacion';
type Item = {
  item_id: number;
  categoria: string;
  pregunta: string;
  orden: number;
  escala_min: number;
  escala_max: number;
};

/** ===== Formulario genérico por rol ===== */
function FormByRole({
  role,
  slug, // ← ya no se usa, lo dejamos para no romper llamadas existentes
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
  const [vals, setVals] = useState<Record<number, number>>({});
  const [modalidad, setModalidad] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [coordAsigId, setCoordAsigId] = useState('');
  const [loMejor, setLoMejor] = useState('');
  const [aMejorar, setAMejorar] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Carga preguntas SOLO por rol (sin slug) + LOG de depuración
  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('api_items_por_rol', { p_rol: role });

      // 🔎 LOG: mira la consola del navegador (F12 → Console)
      console.log('RPC api_items_por_rol →', {
        role,
        len: Array.isArray(data) ? data.length : null,
        error,
        sample: Array.isArray(data) ? data.slice(0, 3) : null
      });

      if (!on) return;
      if (error) {
        console.error(error);
        setItems([]);
      } else {
        setItems((data ?? []) as Item[]);
      }
      setLoading(false);
    })();
    return () => { on = false; };
  }, [role]);

  const porCategoria = useMemo(() => {
    const g: Record<string, Item[]> = {};
    (items ?? []).forEach((it) => { (g[it.categoria] ||= []).push(it); });
    return g;
  }, [items]);

  const setValor = (id: number, v: number | string) =>
    setVals((p) => ({ ...p, [id]: Number(v) }));

  const onSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setMsg(null);
    const payload: any = {
      rol: role,
      modalidad: modalidad || null,
      curso_id: cursoId || null,
      docente_id: target === 'docente' ? (docenteId ? Number(docenteId) : null) : null,
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
    }
  };

  if (loading) return <div className="p-4">Cargando preguntas…</div>;
  if (!items || items.length === 0)
    return <div className="p-4">No hay preguntas para este instrumento.</div>;

  return (
    <section className="card space-y-6">
      <h2 className="text-xl font-semibold">{title}</h2>

      <form onSubmit={onSubmit} className="space-y-6">
        <div className="grid sm:grid-cols-2 gap-3">
          <div>
            <label className="label">Modalidad</label>
            <input
              className="input"
              value={modalidad}
              onChange={(e) => setModalidad(e.target.value)}
              placeholder="Presencial / Distancia"
            />
          </div>
          <div>
            <label className="label">Curso ID</label>
            <input
              className="input"
              value={cursoId}
              onChange={(e) => setCursoId(e.target.value)}
              placeholder="FAC-ADM-..."
            />
          </div>

          {target === 'docente' && (
            <div className="sm:col-span-2">
              <label className="label">Docente ID</label>
              <input
                className="input"
                value={docenteId}
                onChange={(e) => setDocenteId(e.target.value)}
                placeholder="ID numérico del docente"
              />
            </div>
          )}

          {target === 'coord' && (
            <div className="sm:col-span-2">
              <label className="label">Coordinador/a de asignatura ID</label>
              <input
                className="input"
                value={coordAsigId}
                onChange={(e) => setCoordAsigId(e.target.value)}
                placeholder="ID numérico de coordinador/a"
              />
            </div>
          )}
        </div>

        {Object.entries(porCategoria).map(([cat, arr]) => (
          <div key={cat} className="rounded-2xl border bg-white p-4 shadow-sm">
            <h3 className="font-semibold mb-3">{cat}</h3>
            <div className="space-y-3">
              {arr.map((it) => (
                <div key={it.item_id} className="grid md:grid-cols-2 gap-2 items-center">
                  <div className="text-sm">{it.pregunta}</div>
                  <div className="flex gap-3 justify-start md:justify-end">
                    {Array.from({ length: it.escala_max - it.escala_min + 1 }).map((_, i) => {
                      const v = it.escala_min + i;
                      return (
                        <label key={v} className="inline-flex items-center gap-1">
                          <input
                            type="radio"
                            name={`item-${it.item_id}`}
                            value={v}
                            checked={vals[it.item_id] === v}
                            onChange={(e) => setValor(it.item_id, e.target.value)}
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

      // 🔒 Si NO es @uce.edu.ec ⇒ solo Estudiantes
      if (email && !email.endsWith('@uce.edu.ec')) {
        setRoles(['estudiante']);
        return;
      }

      // Institucional: pide roles reales
      const { data, error } = await supabase.rpc<Rol[]>('api_current_roles');
      if (!alive) return;
      if (error) {
        console.error(error);
        setRoles(['estudiante']);
      } else {
        setRoles((data ?? []) as Rol[]);
      }
    })();
    return () => {
      alive = false;
    };
  }, []);

  if (!roles) return <main className="p-6">Cargando…</main>;
  const onlyStudent = roles.length === 1 && roles[0] === 'estudiante';
  const showDebug = process.env.NEXT_PUBLIC_SHOW_ROLE_DEBUG === '1';

  // 👇 Debug del proyecto de Supabase que usa el front
  const supaUrl = process.env.NEXT_PUBLIC_SUPABASE_URL || '';
  const supaRef = supaUrl.match(/https:\/\/([a-z0-9-]+)\.supabase\.co/)?.[1] ?? '(desconocido)';

  return (
    <main className="space-y-10">
      {showDebug && (
        <div className="p-3 rounded-lg border bg-yellow-50 text-sm space-y-1">
          <div><b>DEBUG</b></div>
          <div>Email: {userEmail || '(sin sesión)'}</div>
          <div>Roles: {roles.join(', ') || '(vacío)'}</div>
          <div>Supabase ref: <code>{supaRef}</code></div>
        </div>
      )}

      {/* Estudiantes */}
      {roles.includes('estudiante') && (
        <FormByRole
          role="estudiante"
          slug="estudiante" // (no se usa)
          title="EVALUACIÓN DE ESTUDIANTES"
        />
      )}

      {/* Autoevaluación */}
      {!onlyStudent && roles.includes('auto_docente') && (
        <FormByRole role="auto_docente" slug="auto" title="AUTOEVALUACIÓN" />
      )}

      {/* Coord. Asignatura */}
      {!onlyStudent && roles.includes('coord_asignatura') && (
        <FormByRole
          role="coord_asignatura"
          slug="coord-asig"
          target="docente"
          title="EVALUACIÓN (Coordinador/a de Asignatura → docentes)"
        />
      )}

      {/* Coord. Nivelación */}
      {!onlyStudent && roles.includes('coord_nivelacion') && (
        <>
          <FormByRole
            role="coord_nivelacion"
            slug="coord-nivel-docentes"
            target="docente"
            title="EVALUACIÓN (Coordinación de Nivelación → docentes)"
          />
          <FormByRole
            role="coord_nivelacion"
            slug="coord-nivel-coord"
            target="coord"
            title="EVALUACIÓN (Coordinación de Nivelación → coordinadores de asignatura)"
          />
        </>
      )}
    </main>
  );
}
