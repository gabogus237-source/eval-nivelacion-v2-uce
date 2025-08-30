'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Docente = { docente_id: number; nombre: string };
type Pregunta = { pregunta_id: number; categoria: string; texto: string };

export default function Evaluacion() {
  const [userEmail, setUserEmail] = useState<string | null>(null);
  const [modalidad, setModalidad] = useState<'Presencial'|'Distancia'|''>('');
  const [curso, setCurso] = useState<string>('');
  const [cursos, setCursos] = useState<string[]>([]);
  const [docentes, setDocentes] = useState<Docente[]>([]);
  const [preguntas, setPreguntas] = useState<Pregunta[]>([]);
  const [respuestas, setRespuestas] = useState<Record<number, any>>({}); // por docente_id
  const [msg, setMsg] = useState<string>('');

  useEffect(() => {
    supabase.auth.getUser().then(({ data }) => setUserEmail(data.user?.email ?? null));
    supabase.from('preguntas').select('*').order('pregunta_id').then(({ data }) => setPreguntas((data ?? []) as Pregunta[]));
  }, []);

  useEffect(() => {
    if (!modalidad) return;
    setCurso(''); setDocentes([]);
    supabase.from('catalogo_cursos').select('curso_id').eq('modalidad', modalidad).order('curso_id')
      .then(({ data }) => setCursos((data ?? []).map((r:any)=>r.curso_id)));
  }, [modalidad]);

  useEffect(() => {
    if (!curso) return;
    supabase.from('ofertas_docentes').select('docente_id, docentes(nombre)').eq('curso_id', curso)
      .then(({ data }) => {
        const ds = (data ?? []).map((r:any)=>({ docente_id: r.docente_id, nombre: r.docentes?.nombre }));
        setDocentes(ds);
        const next = { ...respuestas };
        ds.forEach(d => { if (!next[d.docente_id]) next[d.docente_id] = { no_aplica:false, respuestas:{}, lo_mejor:'', a_mejorar:'' }; });
        setRespuestas(next);
      });
  }, [curso]);

  function setNA(docente_id:number, val:boolean) {
    setRespuestas(prev => ({ ...prev, [docente_id]: { ...prev[docente_id], no_aplica: val } }));
  }
  function setQ(docente_id: number, q: number, v: number) {
  setRespuestas(prev => ({
    ...prev,
    [docente_id]: {
      ...prev[docente_id],
      respuestas: {
        ...(prev[docente_id]?.respuestas ?? {}),
        ['q' + q]: v
      }
    }
  }));
}
  function validoTodo(): { ok:boolean, msg?:string } {
    if (!modalidad) return { ok:false, msg:'Selecciona modalidad' };
    if (!curso) return { ok:false, msg:'Selecciona curso' };
    if (!docentes.length) return { ok:false, msg:'No hay docentes para este curso' };
    for (const d of docentes) {
      const pack = respuestas[d.docente_id];
      if (!pack) return { ok:false, msg:`Faltan respuestas para ${d.nombre}` };
      if (!pack.no_aplica) {
        for (let i=1; i<=15; i++) {
          const v = pack.respuestas?.['q'+i];
          if (![1,2,3,4].includes(v)) return { ok:false, msg:`Falta q${i} para ${d.nombre}` };
        }
      }
    }
    return { ok:true };
  }

  async function enviar() {
    setMsg('');
    const check = validoTodo();
    if (!check.ok) { setMsg(check.msg!); return; }
    const payload = docentes.map(d => ({
      docente_id: d.docente_id,
      no_aplica: !!respuestas[d.docente_id].no_aplica,
      respuestas: respuestas[d.docente_id].no_aplica ? null : respuestas[d.docente_id].respuestas,
      lo_mejor: respuestas[d.docente_id].lo_mejor || null,
      a_mejorar: respuestas[d.docente_id].a_mejorar || null
    }));
    const { error } = await supabase.rpc('submit_eval_curso', {
      p_curso_id: curso,
      p_modalidad: modalidad,
      p_payload: payload
    });
    if (error) setMsg(error.message);
    else { alert('¡Evaluación enviada!'); location.href = '/'; }
  }

  if (!userEmail) return <main className="container py-10">Debes iniciar sesión con tu correo UCE.</main>;

  const escala = [
    { label:'S (Siempre)', value:4 },
    { label:'CS (Casi siempre)', value:3 },
    { label:'EAO (En algunas ocasiones)', value:2 },
    { label:'N (Nunca)', value:1 },
  ];

  return (
    <main className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <div className="kicker">Encuesta</div>
          <h1>Completa tu evaluación</h1>
        </div>
        <div className="badge">Sesión: {userEmail}</div>
      </div>

      <div className="grid md:grid-cols-3 gap-4">
        <div className="card">
          <label className="label">Modalidad</label>
          <div className="flex gap-4">
            {(['Presencial','Distancia'] as const).map(m => (
              <label key={m} className="inline-flex items-center gap-2">
                <input type="radio" name="modalidad" checked={modalidad===m} onChange={()=>setModalidad(m)} />
                {m}
              </label>
            ))}
          </div>
        </div>
        <div className="card md:col-span-2">
          <label className="label">Curso</label>
          <select className="input" value={curso} onChange={e=>setCurso(e.target.value)}>
            <option value="">— Selecciona —</option>
            {cursos.map(c => <option key={c} value={c}>{c}</option>)}
          </select>
          <small className="muted">Solo aparecen cursos de la modalidad elegida.</small>
        </div>
      </div>

      {curso && docentes.length>0 && (
        <section className="space-y-6">
          {docentes.map(d => {
            const pack = respuestas[d.docente_id] ?? {};
            return (
              <div key={d.docente_id} className="card">
                <div className="flex items-center justify-between">
                  <h2>{d.nombre}</h2>
                  <label className="inline-flex items-center gap-2">
                    <input type="checkbox" checked={!!pack.no_aplica} onChange={e=>setNA(d.docente_id, e.target.checked)} />
                    No aplica
                  </label>
                </div>

                {!pack.no_aplica && (
                  <div className="mt-4 space-y-4">
                    {preguntas.map(p => (
                      <div key={p.pregunta_id} className="border-t pt-3">
                        <div className="text-sm text-gray-600">{p.categoria}</div>
                        <div className="font-medium">{p.texto}</div>
                        <div className="flex flex-wrap gap-4 mt-2">
                          {escala.map(opt => (
                            <label key={opt.value} className="inline-flex items-center gap-2">
                              <input
                                type="radio"
                                name={`d${d.docente_id}-q${p.pregunta_id}`}
                                checked={(pack.respuestas?.['q'+p.pregunta_id] ?? null) === opt.value}
                                onChange={()=>setQ(d.docente_id, p.pregunta_id, opt.value)}
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
                        <textarea className="input" rows={3}
                          value={pack.lo_mejor ?? ''} onChange={e=>setText(d.docente_id,'lo_mejor', e.target.value)} />
                      </div>
                      <div>
                        <label className="label">Aspectos a mejorar</label>
                        <textarea className="input" rows={3}
                          value={pack.a_mejorar ?? ''} onChange={e=>setText(d.docente_id,'a_mejorar', e.target.value)} />
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
    </main>
  );
}
