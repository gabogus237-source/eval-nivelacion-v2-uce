const onSubmit = async () => {
  const { data: { user }, error: authError } = await supabase.auth.getUser()
  if (authError) return alert(authError.message)
  if (!user) return alert('Debes iniciar sesión')

  // Validación por constraint: si no_aplica es false, deben venir q1..q15
  if (!noAplica) {
    const faltantes = Array.from({ length: 15 }, (_, i) => `q${i + 1}`)
      .filter(k => !respuestas[k])
    if (faltantes.length) {
      alert(`Faltan preguntas: ${faltantes.join(', ')}`)
      return
    }
  }

  // Construye el payload con tus campos obligatorios:
  const payload = {
    // user_id y email los pone Supabase por DEFAULT, no hace falta pasarlos
    modalidad,           // string (de catálogo), ej: 'P-03'
    curso_id,            // string (de catálogo), ej: 'N-07'
    docente_id,          // bigint (FK a docentes.docente_id)
    no_aplica: noAplica, // boolean

    respuestas: noAplica ? null : respuestas, // objeto { q1:'S', q2:'CS', ... }
    lo_mejor: loMejor || null,                // opcional
    a_mejorar: aMejorar || null               // opcional
  }

  // Si quieres permitir re-enviar y que reemplace (por la UNIQUE):
  // usa upsert con onConflict
  const { error } = await supabase
    .from('eval_nivelacion')
    .upsert([payload], { onConflict: 'user_id,curso_id,docente_id', ignoreDuplicates: false }) // <-- IMPORTANTE

  // Si prefieres que lance error al duplicar (y no reemplace), usa insert():
  // const { error } = await supabase.from('eval_nivelacion').insert([payload])

  if (error) {
    if (error.code === '23505') {
      alert('Ya enviaste esta evaluación para ese curso/docente.')
    } else {
      alert('Error al guardar: ' + error.message)
    }
    return
  }

  alert('¡Gracias! Tus respuestas fueron registradas.')
}

