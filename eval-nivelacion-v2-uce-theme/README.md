# Evaluación de Docentes — UCE (Tema UCE)

Proyecto listo para subir a **Vercel**.

## Variables de entorno
Configura en Vercel → Project → Settings → Environment Variables:
- `NEXT_PUBLIC_SUPABASE_URL` = `https://dzwfkombscqqytwjoknx.supabase.co`
- `NEXT_PUBLIC_SUPABASE_ANON_KEY` = tu anon key

## Despliegue
1. Ir a https://vercel.com/import → **Upload** y subir este ZIP.
2. Agregar las Environment Variables anteriores.
3. Deploy.

## Rutas
- `/` — login por magic link (solo correos `@uce.edu.ec`)
- `/evaluacion` — formulario completo (modalidad → curso → docentes, 15 preguntas + abiertos)
- `/admin` — promedios (solo `msaltos@uce.edu.ec`)

## Backend (Supabase)
Ejecutar el SQL `schema_evaluaciones_v2.sql` en tu proyecto para crear tablas, RLS y RPC.
