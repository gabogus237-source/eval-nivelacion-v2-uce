'use client';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabaseClient';

export default function Admin() {
  const [allowed, setAllowed] = useState<boolean | null>(null);
  const [rows, setRows] = useState<any[]>([]);

  useEffect(() => {
    (async () => {
      const { data } = await supabase.auth.getUser();
      const email = data.user?.email ?? '';
      setAllowed(email === 'msaltos@uce.edu.ec');
      if (email === 'msaltos@uce.edu.ec') {
        const { data } = await supabase.from('eval_promedios_docente').select('*').order('curso_id');
        setRows(data ?? []);
      }
    })();
  }, []);

  if (allowed === null) return <main className="py-10">Cargando…</main>;
  if (!allowed) return <main className="py-10">Acceso restringido.</main>;

  return (
    <main className="space-y-6">
      <div>
        <div className="kicker">Panel de administración</div>
        <h1>Promedios por docente</h1>
      </div>

      <div className="card overflow-x-auto">
        <table className="min-w-[800px] w-full">
          <thead>
            <tr className="text-left">
              <th className="border-b p-2">Curso</th>
              <th className="border-b p-2">Docente</th>
              {Array.from({length:15},(_,i)=>i+1).map(i=>(
                <th key={i} className="border-b p-2 text-center">q{i}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((r,i)=>(
              <tr key={i} className="odd:bg-gray-50">
                <td className="p-2">{r.curso_id}</td>
                <td className="p-2">{r.docente}</td>
                {Array.from({length:15},(_,k)=>k+1).map(iq=>{
                  const v = r['q'+iq];
                  // @ts-ignore
                  return <td key={iq} className="p-2 text-center">{typeof v === 'number' ? v.toFixed(2) : '-'}</td>
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </main>
  );
}
