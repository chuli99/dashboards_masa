'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import Dashboard from './Dashboard';
import { FLOWSHEETS } from '@/flowsheets';
import s from './Home.module.css';

// "/?codigo=X" mantiene la URL histórica del dashboard; sin codigo muestra el índice de flowsheets
export default function Home() {
  if (useSearchParams().has('codigo')) return <Dashboard />;

  return (
    <main className={s.main}>
      <h1>Flowsheets</h1>
      <div className={s.grid}>
        {Object.entries(FLOWSHEETS).map(([slug, fs]) => (
          <Link key={slug} href={`/flowsheet/${slug}`} className={s.item}>
            {fs.title}
            <span>{fs.buttons.length} variables</span>
          </Link>
        ))}
      </div>
    </main>
  );
}
