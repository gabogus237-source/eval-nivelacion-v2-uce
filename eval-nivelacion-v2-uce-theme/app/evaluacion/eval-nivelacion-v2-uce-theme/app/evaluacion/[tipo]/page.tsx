'use client'

import { useEffect, useMemo, useState } from 'react'
// OJO: si tu supabaseClient.ts está en eval-nivelacion-v2-uce-theme/lib,
// este import funciona tal cual. Si no existe, créalo (paso 3).
import { supabase } from '@/lib/supabaseClient'

type Pregunta = {
  pregunta_codigo: string
  etiqueta: string
  instrumento_codigo: string
  seccion_orden: number | null
  pregunta_orden: number | null
  seccion_titulo: string | null
}

const OPCIONES = [
  { value: 'S',  label: 'S (Siempre)' },
  { value: 'CS', label: 'CS (Casi siempre)' },
  { value: 'EAO',label: 'EAO (En algunas ocasiones)' },
  { value: 'N',  label: 'N (Nunca)' },
]

export default function EvaluacionPage({ params }: { params: { tipo: string } }) {
  const tipo = (params?.tipo ?? '').toLowerCase()
  const [preguntas, setPreguntas] = useState<Pregunta[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [respuestas, setRespuestas] = useState<Record<string,string>>({})

  useEffect(() => {
    let alive = true
    const fetchPreguntas = async () => {
      setLoading(true); setError(null)
      const { data, error } = await supabase
        .from('v_preguntas_por_instrumento')
        .select('*')
        .eq('instrumento_codigo', tipo)
        .order('seccion_orden', { ascending: true, nullsFirst: false })
        .order('pregunta_orden', { ascending: true, nullsFirst: false })
      if (!alive) return
      if (error) setError(error.message)
      else setPreguntas((data ?? []) as Pregunta[])
      setLoading(false)
    }
    if (tipo) fetchPreguntas()
    return () => { alive = false }
  }, [tipo])

  const secciones = useMemo(() => {
    const map = new Map<string, Pregunta[]>()
    for (const p of preguntas) {
      const key = `${p.seccion_orden ?? 9999}|${p.seccion_titulo ?? 'Sección'}`
      if (!map.has(key)) map.set(key, [])
      map.get(key)!.push(p)
    }
    return [...map.entries()]
      .sort((a,b) => {
        const [oa] = a[0].split('|').map(Number); const [ob] = b[0].split('|').map(Number)
        return (oa ?? 9999) - (ob ?? 9999)
      })
      .map(([, items]) => items)
  }, [preguntas])

  const onChange = (codigo: string, value: string) =>
    setRespuestas(prev => ({ ...prev, [codigo]: value }))

  const onSubmit = async () => {
    const { data: userData } = await supabase.auth.getUser()
    const user_id = userData?.user?.id ?? null
    if (!user_id) return alert('Debes iniciar sesión')

    /*  ☆ DEJA SOLO UNO DE ESTOS BLOQUES ☆
     *
     *  A) Tabla con UNA FILA POR PREGUNTA:
     *     (user_id, instrumento_codigo, pregunta_codigo, respuesta)
     */

    // const rows = Object.entries(respuestas).map(([pregunta_codigo, respuesta]) => ({
    //   user_id,
    //   instrumento_codigo: tipo,
    //   pregunta_codigo,
    //   respuesta,
    // }))
    // const { error } = await supabase.from('eval_nivelacion').insert(rows)
    // if (error) return alert('Error al guardar: ' + error.message)

    /*
     *  B) Tabla con UNA FILA ANCHA (q1..q15):
     *     (user_id, instrumento_codigo, q1..q15)
     */
    const payload: Record<string, any> = { user_id, instrumento_codigo: tipo }
    for (const [k,v] of Object.entries(respuestas)) payload[k] = v
    const { error } = await supabase.from('eval_nivelacion').insert([payload])
    if (error) return alert('Error al guardar: ' + error.message)

    alert('¡Respuestas enviadas!')
  }

  if (loading) return <div className="p-6">Cargando preguntas…</div>
  if (error)   return <div className="p-6 text-red-600">Error: {error}</div>
  if (!preguntas.length) return <div className="p-6">No hay preguntas para “{tipo}”.</div>

  return (
    <div className="max-w-3xl mx-auto p-6 space-y-8">
      <header>
        <h1 className="text-2xl font-semibold">Evaluación — {tipo.replace('_',' ')}</h1>
        <p className="text-sm text-gray-500">Selecciona una opción por pregunta.</p>
      </header>

      {secciones.map((items, idx) => {
        const titulo = items[0].seccion_titulo ?? `Sección ${idx+1}`
        return (
          <section key={idx} className="space-y-4">
            <h2 className="text-lg font-medium">{titulo}</h2>
            <div className="space-y-3">
              {items.map((p) => (
                <div key={p.pregunta_codigo} className="p-4 rounded border">
                  <div className="mb-2 font-medium">{p.etiqueta}</div>
                  <div className="flex flex-wrap gap-4">
                    {OPCIONES.map(opt => (
                      <label key={opt.value} className="flex items-center gap-2 cursor-pointer">
                        <input
                          type="radio"
                          name={p.pregunta_codigo}
                          value={opt.value}
                          checked={respuestas[p.pregunta_codigo] === opt.value}
                          onChange={(e) => onChange(p.pregunta_codigo, e.target.value)}
                        />
                        <span>{opt.label}</span>
                      </label>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </section>
        )
      })}

      <div className="pt-4">
        <button onClick={onSubmit} className="px-4 py-2 rounded bg-black text-white">
          Enviar
        </button>
      </div>
    </div>
  )
}
