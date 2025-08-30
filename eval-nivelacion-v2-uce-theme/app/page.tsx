'use client';
import { useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Page() {
  const [email, setEmail] = useState('');
  const [sent, setSent] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function signIn(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!email.endsWith('@uce.edu.ec')) {
      setError('Usa tu correo institucional @uce.edu.ec');
      return;
    }
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${location.origin}/evaluacion` }
    });
    if (error) setError(error.message);
    else setSent(true);
  }

  return (
    <main className="grid md:grid-cols-2 gap-8 items-center">
      <div className="space-y-4">
        <div className="kicker">Encuesta de satisfacción académica</div>
        <h1>Evalúa a tus docentes del curso de nivelación</h1>
        <p className="text-gray-700">Tu opinión es anónima y ayuda a mejorar la calidad académica. Inicia sesión con tu correo institucional <b>@uce.edu.ec</b> para ingresar.</p>
        <div className="card max-w-md">
          {sent ? (
            <div className="space-y-2">
              <h2>Revisa tu correo</h2>
              <p className="text-gray-600">Te enviamos un enlace de acceso. Si no llega, revisa tu carpeta de spam o intenta nuevamente.</p>
            </div>
          ) : (
            <form onSubmit={signIn} className="space-y-3">
              <label className="label">Correo institucional</label>
              <input className="input" placeholder="tu_usuario@uce.edu.ec" value={email} onChange={e=>setEmail(e.target.value)} type="email" required />
              {error && <small className="muted">{error}</small>}
              <button className="btn btn-primary w-full">Enviar enlace</button>
            </form>
          )}
        </div>
        <div className="text-sm text-gray-500">El sistema usa enlaces mágicos (Magic Link) enviados desde <b>evaluacionesnivelacion@gmail.com</b>.</div>
      </div>
      <div className="card">
        <h2 className="mb-3">¿Cómo funciona?</h2>
        <ol className="list-decimal pl-5 space-y-2 text-gray-700">
          <li>Inicia sesión con tu correo UCE.</li>
          <li>Elige modalidad → curso → docentes.</li>
          <li>Responde 15 preguntas por docente o marca “No aplica”.</li>
          <li>Opcional: agrega comentarios (Lo mejor / Aspectos a mejorar).</li>
          <li>Envía. El resultado solo lo ve el administrador.</li>
        </ol>
      </div>
    </main>
  );
}
