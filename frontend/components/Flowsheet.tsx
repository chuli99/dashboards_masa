'use client';

import Link from 'next/link';
import useSWR from 'swr';
import { fetcher, formatVal } from '@/lib/api';
import { IMG_BASE, type FlowsheetData } from '@/flowsheets';
import s from './Flowsheet.module.css';

export default function Flowsheet({ fs }: { fs: FlowsheetData }) {
  const codigos = [...new Set(fs.buttons.map((b) => b.codigo))].join(',');
  const { data } = useSWR<Record<string, number>>(`/api/variables/last?codigos=${codigos}`, fetcher, {
    refreshInterval: 60000,
  });

  return (
    <div className={s.page}>
      <div className={s.container}>
        <img src={IMG_BASE + fs.image} alt={`Flowsheet ${fs.title}`} className={s.bg} />
        {fs.buttons.map((b, i) => {
          const val = data?.[b.codigo];
          return (
            <Link
              key={i}
              href={`/?codigo=${b.codigo}&unit=${b.unit}`}
              prefetch={false}
              className={s.btn}
              style={{ left: `${b.left}%`, top: `${b.top}%` }}
              title={b.tag}
            >
              {val === undefined ? '–' : formatVal(val, b.decimals, b.unit)}
            </Link>
          );
        })}
      </div>
    </div>
  );
}
