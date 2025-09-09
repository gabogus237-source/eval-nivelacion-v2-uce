'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Rol = 'estudiante' | 'auto_docente' | 'coord_asignatura' | 'coord_nivelacion';
type Docente = { docente_id: number; nombre: string };
type Pregunta = { pregunta_id: number; categoria: string; texto: string };

export default function Evaluacion() {
  // sesión + roles
  const [email, setEmail] = useState<string | null>(null);
  const [roles, setRoles] = useState<Rol[] | null>(null);

  // estado UI
  const [modalidad, setModalidad] = useState<'Presencial' | 'Distancia' | ''>('');
  const [curso, setCurso] = useState<string>('');
  const [cursos, setCursos] = useState<string[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, any>>({});
  const [msg, setMsg] = useState<string>('');

  // ===== 1) Sesión + roles (clamp: si NO es @uce.edu.ec => solo estudiante) =====
  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const e = data.user?.email?.toLowerCase() ?? null;
      setEmail(e);

      if (!e) {
        setRoles([]);
        return;
      }
      if (!e.endsWith('@uce.edu.ec')) {
        // correos externos de prueba
        setRoles(['estudiante']);
        return;
      }
      const { data: r, error } = await supabase.rpc<Rol[]>('api_current_roles');
      if (error) {
        console.error(error);
        setRoles(['estudiante']); // fallback seguro
      } else {
        setRoles((r ?? []) as Rol[]);
      }
    })();
  }, []);

  // ===== 2) Banco de preguntas (solo estudiantes: tabla public.preguntas) =====
  useEffect(() => {
    if (!roles || !roles.includes('estudiante')) return;
    supabase
      .from('preguntas')
      .select('pregunta_id,categoria,texto')
      .order('pregunta_id', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setPreguntas(((data ?? []) as any[]).map(r => ({
          pregunta_id: Number(r.pregunta_id),
          categoria: r.categoria ?? 'Sección única',
          texto: r.texto ?? '',
        })));
      });
  }, [roles]);

  // ===== 3) Modalidad => cursos =====
  useEffect(() => {
    if (!modalidad) return;
    setCurso('');
    setDocentes([]);
    supabase
      .from('catalogo_cursos')
      .select('curso_id')
      .eq('modalidad', modalidad)
      .order('curso_id', { ascending: true })
      .then(({ data, error }) => {
        if (error) console.error(error);
        setCursos(((data ?? []) as any[]).map(r => String(r.curso_id)));
      });
  }, [modalidad]);

  // ===== 4) Curso => docentes + preparar respuestas =====
  useEffect(() => {
    if (!curso) return;
    supabase
      // requiere FK ofertas_docentes.docente_id -> docentes.id
      .from('ofertas_docentes')
      .select('docente_id, docentes(nombre)')
      .eq('curso_id', curso)
      .then(({ data, error }) => {
        if (error) console.error(error);
        const ds: Docente[] = ((data ?? []) as any[]).map(r => ({
          docente_id: Number(r.docente_id),
          nombre: (r.docentes?.nombre as string) ?? 'Docente',
        }));
        setDocentes(ds);
        setRespuestas(prev => {
          const next = { ...prev };
          ds.forEach(d => {
            if (!next[d.docente_id]) {
              next[d.docente_id] = {
                no_aplica: false,
                respuestas: {},
                lo_mejor: '',
                a_mejorar: '',
              };
            }
          });
          return next;
        });
      });
  }, [curso]);

  // ===== Handlers =====
  function setNA(docente_id: number, val: boolean) {
    setRespuestas(prev => ({ ...prev, [docente_id]: { ...prev[docente_id], no_aplica: val } }));
  }
  function setQ(docente_id: number, q: number, v: number) {
    setRespuestas(prev => ({
      ...prev,
      [docente_id]: {
        ...prev[docente_id],
        respuestas: { ...(prev[docente_id]?.respuestas ?? {}), ['q' + q]: v },
      },
    }));
  }
  function setText(docente_id: number, field: 'lo_mejor' | 'a_mejorar', v: string) {
    setRespuestas(prev => ({ ...prev, [docente_id]: { ...prev[docente_id], [field]: v } }));
  }

  // ===== Validación =====
  function validoTodo(): { ok: boolean; msg?: string } {
    if (!roles?.includes('estudiante')) return { ok: false, msg: 'No tienes acceso a esta encuesta.' };
    if (!modalidad) return { ok: false, msg: 'Selecciona modalidad' };
    if (!curso) return { ok: false, msg: 'Selecciona curso' };
    if (!docentes.length) return { ok: false, msg: 'No hay docentes para este curso' };
    if (!preguntas.length) return { ok: false, msg: 'No hay preguntas cargadas' };

    for (const d of docentes) {
      const pack = respuestas[d.docente_id];
      if (!pack) return { ok: false, msg: `Faltan respuestas para ${d.nombre}` };
      if (!pack.no_aplica) {
        for (const p of preguntas) {
          const v = pack.respuestas?.['q' + p.pregunta_id];
          if (![1, 2, 3, 4].includes(v)) return { ok: false, msg: `Falta Q${p.pregunta_id} para ${d.nombre}` };
        }
      }
    }
    return { ok: true };
  }

  // ===== Envío =====
  async function enviar() {
    setMsg('');
    const check = validoTodo();
    if (!check.ok) { setMsg(check.msg!); return; }

    const payload = docentes.map(d => ({
      docente_id: d.docente_id,
      no_aplica: !!respuestas[d.docente_id].no_aplica,
      respuestas: respuestas[d.docente_id].no_aplica ? null : respuestas[d.docente_id].respuestas,
      lo_mejor: respuestas[d.docente_id].lo_mejor || null,
      a_mejorar: respuestas[d.docente_id].a_mejorar || null,
    }));

    // Usa tu RPC si existe, si no, te dejo un INSERT de respaldo (comenta el que no uses)
    const { error } = await supabase.rpc('submit_eval_curso', {
      p_curso_id: curso,
      p_modalidad: modalidad,
      p_payload: payload,
    });

    // // Alternativa: inserción directa (activa solo si NO tienes el RPC):
    // const { error } = await supabase.from('eval_nivelacion').insert(
    //   payload.map((row: any) => ({
    //     rol: 'estudiante',
    //     modalidad,
    //     curso_id: curso,
    //     docente_id: row.docente_id,
    //     no_aplica: row.no_aplica,
    //     respuestas: row.respuestas,
    //     lo_mejor: row.lo_mejor,
    //     a_mejorar: row.a_mejorar,
    //   }))
    // );

    if (error) setMsg(error.message);
    else {
      alert('¡Evaluación enviada!');
      location.href = '/';
    }
  }

  // ===== Renders =====
  if (!email) return <main className="container py-10">Debes iniciar sesión con tu correo UCE.</main>;
  if (!roles) return <main className="container py-10">Cargando…</main>;
  if (!roles.includes('estudiante')) {
    return (
      <main className="container py-10">
        <h2 className="mb-2">Acceso restringido</h2>
        <p>Esta vista es solo para <b>Estudiantes</b>.</p>
      </main>
    );
  }

  const escala = [
    { label: 'S (Siempre)', value: 4 },
    { label: 'CS (Casi siempre)', value: 3 },
    { label: 'EAO (En algunas ocasiones)', value: 2 },
    { label: 'N (Nunca)', value: 1 },
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Encuesta</div>
          <h1>Evalúa a tus docentes</h1>
        </div>
        <div className="badge">Sesión: {email}</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <label className="label">Modalidad</label>
          <div className="flex gap-4">
            {(['Presencial', 'Distancia'] as const).map((m) => (
              <label key={m} className="inline-flex items-center gap-2">
                <input type="radio" name="modalidad" checked={modalidad === m} onChange={() => setModalidad(m)} />
                {m}
              </label>
            ))}
          </div>
        </div>

        <div className="card md:col-span-2">
          <label className="label">Curso</label>
          <select className="input" value={curso} onChange={(e) => setCurso(e.target.value)}>
            <option value="">— Selecciona —</option>
            {cursos.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
          <small className="muted">Solo aparecen cursos de la modalidad elegida.</small>
        </div>
      </div>

      {curso && docentes.length > 0 && (
        <section className="space-y-6">
          {docentes.map((d) => {
            const pack = respuestas[d.docente_id] ?? {};
            return (
              <div key={d.docente_id} className="card">
                <div className="flex items-center justify-between">
                  <h2>{d.nombre}</h2>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!pack.no_aplica} onChange={(e) => setNA(d.docente_id, e.target.checked)} />
                    No aplica
                  </label>
                </div>

                {!pack.no_aplica && (
                  <div className="mt-4 space-y-4">
                    {preguntas.map((p) => (
                      <div key={p.pregunta_id} className="border-t pt-3">
                        <div className="text-sm text-gray-600">{p.categoria}</div>
                        <div className="font-medium">{p.texto}</div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {escala.map((opt) => (
                            <label key={opt.value} className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                name={`d${d.docente_id}-q${p.pregunta_id}`}
                                checked={(pack.respuestas?.['q' + p.pregunta_id] ?? null) === opt.value}
                                onChange={() => setQ(d.docente_id, p.pregunta_id, opt.value)}
                              />
                              {opt.label}
                            </label>
                          ))}
                        </div>
                      </div>
                    ))}
                    <div className="grid md:grid-cols-2 gap-4">
                      <div>
                        <label className="label">Lo mejor de este docente</label>
                        <textarea
                          className="input"
                          rows={3}
                          value={pack.lo_mejor ?? ''}
                          onChange={(e) => setText(d.docente_id, 'lo_mejor', e.target.value)}
                        />
                      </div>
                      <div>
                        <label className="label">Aspectos a mejorar</label>
                        <textarea
                          className="input"
                          rows={3}
                          value={pack.a_mejorar ?? ''}
                          onChange={(e) => setText(d.docente_id, 'a_mejorar', e.target.value)}
                        />
                      </div>
                    </div>
                  </div>
                )}
              </div>
            );
          })}
          <div className="flex items-center gap-3">
            <button onClick={enviar} className="btn btn-primary">Enviar evaluación</button>
            {msg && <small className="muted">{msg}</small>}
          </div>
        </section>
      )}

      {curso && docentes.length === 0 && (
        <div className="muted">No hay docentes para este curso.</div>
      )}
    </main>
  );
}
