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
    const body = filtered.map(r => [r.nombre, fmt(r.promedio), fmt(r]()
