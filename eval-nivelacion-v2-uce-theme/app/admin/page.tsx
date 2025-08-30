'use client';
import { useEffect, useState, useMemo } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Detalle = {
  nombre: string;
  promedio: number | null;         // 1–4
  calificacion_100: number | null; // 0–100
  fortalezas: string[] | null;     // top-3
  aspectos_mejora: string[] | null;// bottom-3
};

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Detalle[]>([]);
  const [q, setQ] = useState('');

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? '';
      // deja tu validación como la tienes
      setAllowed(email === 'msaltos@uce.edu.ec');

      if (email === 'msaltos@uce.edu.ec') {
        // ⚠️ Esta vista debe existir por el SQL que te pasé
        const { data, error } = await supabase
          .from('reporte_docente_detallado')
          .select('*')
          .order('calificacion_100', { ascending: false });

        if (error) {
          console.error(error);
          setRows([]);
        } else {
          setRows((data ?? []) as Detalle[]);
        }
      }
    })();
  }, []);

  const filtered = useMemo(
    () => rows.filter(r => r.nombre.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );
  const fmt = (x: number | null | undefined) => (x ?? 0).toFixed(2);

  if (allowed === null) return <main className="py-10">Cargando…</main>;
  if (!allowed) return <main className="py-10">Acceso restringido.</main>;

  return (
    <main className="space-y-6">
      <div>
        <div className="kicker">Panel de administración</div>
        <h1>Calificación por Docente (/100)</h1>
      </div>

      <div className="flex gap-3">
        <input
          className="border rounded p-2 flex-1"
          placeholder="Buscar docente…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">Docente</th>
              <th className="border-b p-2">Promedio (1–4)</th>
              <th className="border-b p-2">Calificación /100</th>
              <th className="border-b p-2">Reporte</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.nombre} className="odd:bg-gray-50">
                <td className="p-2">{r.nombre}</td>
                <td className="p-2">{fmt(r.promedio)}</td>
                <td className="p-2 font-semibold">{fmt(r.calificacion_100)}</td>
                <td className="p-2">
                  <a
                    href={`/admin/reporte-docente/${encodeURIComponent(r.nombre)}`}
                    className="underline"
                  >
                    Ver
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr><td className="p-2 text-sm text-gray-500" colSpan={4}>Sin resultados</td></tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}

