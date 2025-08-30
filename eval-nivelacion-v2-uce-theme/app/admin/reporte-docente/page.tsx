'use client';
export const dynamic = 'force-dynamic';
export const fetchCache = 'force-no-store';

import { Suspense, useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { supabase } from '@/lib/supabaseClient';

export default function ReporteDocentePage() {
  // ⬇️ La página se limita a mostrar un Suspense que envuelve al componente que usa useSearchParams
  return (
    <Suspense fallback={<main className="py-10">Cargando…</main>}>
      <ReporteDocenteInner />
    </Suspense>
  );
}

function ReporteDocenteInner() {
  const search = useSearchParams();
  const nombre = decodeURIComponent(search.get('nombre') ?? '');
  const autoPrint = search.get('print') === '1';

  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [row, setRow] = useState<any>(null);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? '';
      const admins = ['msaltos@uce.edu.ec', 'gghermosa@uce.edu.ec'];
      const ok = admins.includes(email);
      setAllowed(ok);

      if (ok && nombre) {
        const { data } = await supabase
          .from('reporte_docente_detallado')
          .select('*')
          .ilike('nombre', nombre) // tolerante a mayúsculas/tildes
          .limit(1)
          .maybeSingle();
        setRow(data);
      }
    })();
  }, [nombre]);

  useEffect(() => {
    if (autoPrint) {
      const t = setTimeout(() => window.print(), 400);
      return () => clearTimeout(t);
    }
  }, [autoPrint]);

  if (allowed === null) return <main className="py-10">Cargando…</main>;
  if (!allowed) return <main className="py-10">Acceso restringido.</main>;
  if (!nombre) return <main className="py-10">Falta el parámetro <b>nombre</b>.</main>;
  if (!row) return <main className="py-10">Sin datos…</main>;

  const fmt = (x: number | undefined | null) => (x ?? 0).toFixed(2);

  return (
    <main className="p-8 space-y-6">
      <div className="flex items-start justify-between">
        <div>
          <h1 className="text-2xl font-bold">Reporte de {row.nombre}</h1>
          <p className="text-sm text-gray-600">Promedio (1–4): <b>{fmt(row.promedio)}</b></p>
          <p className="text-sm text-gray-600">Calificación /100: <b>{fmt(row.calificacion_100)}</b></p>
        </div>
        <button onClick={() => window.print()} className="border rounded px-3 py-2 no-print">
          Descargar PDF
        </button>
      </div>

      <section>
        <h2 className="text-lg font-semibold">Fortalezas (Top 3)</h2>
        <ul className="list-disc pl-6 text-sm">
          {(row.fortalezas ?? []).map((t: string, i: number) => <li key={i}>{t}</li>)}
        </ul>
      </section>

      <section>
        <h2 className="text-lg font-semibold mt-4">Aspectos a mejorar (Bottom 3)</h2>
        <ul className="list-disc pl-6 text-sm
