'use client';
import { useEffect, useMemo, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

type Row = {
  nombre: string;
  promedio: number | null;         // 1–4
  calificacion_100: number | null; // 0–100
};

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<Row[]>([]);
  const [q, setQ] = useState('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const { data: auth } = await supabase.auth.getUser();
      const email = auth.user?.email ?? '';
      const admins = ['msaltos@uce.edu.ec', 'gghermosa@uce.edu.ec'];
      const isAdmin = admins.includes(email);
      setAllowed(isAdmin);

      if (isAdmin) {
        const { data, error } = await supabase
          .from('reporte_docente_detallado')
          .select('nombre,promedio,calificacion_100')
          .order('calificacion_100', { ascending: false });
        if (error) {
          console.error(error);
          setRows([]);
        } else {
          setRows((data ?? []) as Row[]);
        }
      }
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(
    () => rows.filter(r => r.nombre.toLowerCase().includes(q.toLowerCase())),
    [rows, q]
  );

  const fmt = (x: number | null | undefined) => (x ?? 0).toFixed(2);

  const exportCSV = () => {
    const headers = ['Docente', 'Promedio_1_4', 'Calificacion_100'];
    const lines = [
      headers.join(','),
      ...filtered.map(r =>
        [r.nombre, fmt(r.promedio), fmt(r.calificacion_100)].join(',')
      ),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'reporte_docente.csv';
    a.click();
    URL.revokeObjectURL(url);
  };

  if (allowed === null || loading) return <main className="py-10">Cargando…</main>;
  if (!allowed) return <main className="py-10">Acceso restringido.</main>;

  return (
    <main className="space-y-6 p-6">
      <div>
        <div className="kicker">Panel de administración</div>
        <h1 className="text-2xl font-bold">Calificación por Docente (/100)</h1>
      </div>

      <div className="flex gap-3">
        <input
          className="border rounded p-2 flex-1"
          placeholder="Buscar docente…"
          value={q}
          onChange={e => setQ(e.target.value)}
        />
        <button onClick={exportCSV} className="border rounded px-3">Exportar CSV</button>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-[760px] w-full">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">Docente</th>
              <th className="border-b p-2">Promedio (1–4)</th>
              <th className="border-b p-2">Calificación /100</th>
              <th className="border-b p-2">Acciones</th>
            </tr>
          </thead>
          <tbody>
            {filtered.map((r) => (
              <tr key={r.nombre} className="odd:bg-gray-50">
                <td className="p-2">{r.nombre}</td>
                <td className="p-2">{fmt(r.promedio)}</td>
                <td className="p-2 font-semibold">{fmt(r.calificacion_100)}</td>
                <td className="p-2 flex gap-3">
                  {/* ⬇️ enlaces actualizados */}
                  <a
                    href={`/admin/reporte-docente?nombre=${encodeURIComponent(r.nombre)}`}
                    className="underline"
                  >
                    Ver
                  </a>
                  <a
                    href={`/admin/reporte-docente?nombre=${encodeURIComponent(r.nombre)}&print=1`}
                    target="_blank"
                    rel="noopener"
                    className="underline"
                  >
                    Descargar
                  </a>
                </td>
              </tr>
            ))}
            {filtered.length === 0 && (
              <tr>
                <td className="p-2 text-sm text-gray-500" colSpan={4}>Sin resultados</td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </main>
  );
}
