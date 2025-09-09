'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

/** ===== Tipos ===== */
type Rol = 'estudiante' | 'auto_docente' | 'coord_asignatura' | 'coord_nivelacion';
type Item = {
  pregunta_id: number; // la RPC devuelve pregunta_id
  categoria: string;
  pregunta: string;
  orden: number;
  escala_min: number;
  escala_max: number;
};

type VoidArgs = Record<string, never>; // para RPC sin argumentos

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
        <p>
          Te enviamos un enlace a tu <b>@uce.edu.ec</b>. Ábrelo para iniciar sesión.
        </p>
      </div>
    );
  }

  return (
    <div className="max-w-md mx-auto p-6 bg-white rounded-2xl shadow">
      <h1 className="text-xl font-semibold mb-4">Inicia sesión</h1>
      <p className="text-sm mb-4">
        Usa tu correo institucional <b>@uce.edu.ec</b>.
      </p>
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
  _slug, // ← (no usado) se deja por compatibilidad para no romper llamadas externas
  target = null,
  title,
}: {
  role: Rol;
  _slug: string;
  target?: 'docente' | 'coord' | null;
  title: string;
}) {
  const [items, setItems] = useState<Item[] | null>(null);
  const [loading, setLoading] = useState(true);
  const [showLogin, setShowLogin] = useState(false);
  const [vals, setVals] = useState<Record<number, number>>({});
  const [modalidad, setModalidad] = useState('');
  const [cursoId, setCursoId] = useState('');
  const [docenteId, setDocenteId] = useState('');
  const [coordAsigId, setCoordAsigId] = useState('');
  const [loMejor, setLoMejor] = useState('');
  const [aMejorar, setAMejorar] = useState('');
  const [msg, setMsg] = useState<string | null>(null);

  // ✅ Carga preguntas SOLO por rol, y SOLO si hay sesión
  useEffect(() => {
    let on = true;
    (async () => {
      setLoading(true);

      // 1) verificar sesión
      const { data: s } = await supabase.auth.getSession();
      if (!on) return;
      if (!s?.session) {
        setShowLogin(true);
        setItems(null);
        setLoading(false);
        return;
      }

      // 2) traer preguntas por rol/periodo desde la RPC tipada
      const periodo = '2025-2025';
      const { data, error } = await supabase.rpc<
        Item[],
        { rol_in: Rol; periodo_in: string }
      >('get_preguntas_para', {
        rol_in: role,
        periodo_in: periodo,
      });

      if (!on) return;
      if (error) {
        console.error('RPC get_preguntas_para error:', error);
        setItems([]);
      } else {
        setItems(data ?? []);
      }
      setLoading(false);
    })();
    return () => {
      on = false;
    };
  }, [role]);

  const porCategoria = useMemo(() => {
    const g: Record<string, Item[]> = {};
    (items ?? []).forEach((it) => {
      (g[it.categoria] ||= []).push(it);
    });
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

  // ===== Render =====
  if (loading) return <div className="p-4">Cargando preguntas…</div>;
  if (showLogin) return <InlineMagicLink />; // si no hay sesión, mostramos login
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
      // Importante: no forzamos roles si no hay sesión. Deja que FormByRole muestre login.
      const { data: u } = await supabase.auth.getUser();
      const email = u?.user?.email?.toLowerCase() ?? '';
      if (!alive) return;
      setUserEmail(email);

      if (!email) {
        // Sin sesión: muestra solo estudiantes
        setRoles(['estudiante']);
        return;
      }

      // Si no es institucional, restringe a estudiantes
      if (!email.endsWith('@uce.edu.ec')) {
        setRoles(['estudiante']);
        return;
      }

      // Institucional: intenta leer roles reales (si falla, cae a estudiante)
      const { data, error } = await supabase.rpc<Rol[], VoidArgs>('api_current_roles', {});
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

  return (
    <main className="space-y-10">
      {showDebug && (
        <div className="p-3 rounded-lg border bg-yellow-50 text-sm">
          <div>
            <b>DEBUG</b>
          </div>
          <div>Email: {userEmail || '(sin sesión)'}</div>
          <div>Roles: {roles.join(', ') || '(vacío)'}</div>
        </div>
      )}

      {/* Estudiantes */}
      {roles.includes('estudiante') && (
        <FormByRole role="estudiante" _slug="estudiante" title="EVALUACIÓN DE ESTUDIANTES" />
      )}

      {/* Autoevaluación */}
      {!onlyStudent && roles.includes('auto_docente') && (
        <FormByRole role="auto_docente" _slug="auto" title="AUTOEVALUACIÓN" />
      )}

      {/* Coord. Asignatura */}
      {!onlyStudent && roles.includes('coord_asignatura') && (
        <FormByRole
          role="coord_asignatura"
          _slug="coord-asig"
          target="docente"
          title="EVALUACIÓN (Coordinador/a de Asignatura → docentes)"
        />
      )}

      {/* Coord. Nivelación */}
      {!onlyStudent && roles.includes('coord_nivelacion') && (
        <>
          <FormByRole
            role="coord_nivelacion"
            _slug="coord-nivel-docentes"
            target="docente"
            title="EVALUACIÓN (Coordinación de Nivelación → docentes)"
          />
          <FormByRole
            role="coord_nivelacion"
            _slug="coord-nivel-coord"
            target="coord"
            title="EVALUACIÓN (Coordinación de Nivelación → coordinadores de asignatura)"
          />
        </>
      )}
    </main>
  );
}

