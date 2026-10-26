'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { fetcher } from '@/lib/api';
import { FLOWSHEETS, IMG_BASE, type FlowsheetData } from '@/flowsheets';
import s from './Editor.module.css';

const round = (n: number) => Math.round(n * 100) / 100;

export default function Editor() {
  const [slug, setSlug] = useState(Object.keys(FLOWSHEETS)[0]);
  const key = `/api/flowsheets/${slug}`;
  // El JSON del bundle puede estar desactualizado en prod (export estático): manda el del servidor
  const { data: fs = FLOWSHEETS[slug], mutate } = useSWR<FlowsheetData>(key, fetcher, { revalidateOnFocus: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const wrap = useRef<HTMLDivElement>(null);
  const imgInput = useRef<HTMLInputElement>(null);

  // Cambio local inmediato; con persist escribe frontend/flowsheets/<slug>.json vía backend
  const update = async (fn: (fs: FlowsheetData) => FlowsheetData, persist = true) => {
    const next = await mutate((cur) => fn(cur ?? FLOWSHEETS[slug]), { revalidate: false });
    if (!persist) return;
    setStatus('Guardando…');
    const res = await fetch(key, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(next),
    });
    setStatus(res.ok ? `✓ Guardado ${new Date().toLocaleTimeString()}` : `Error al guardar (${res.status})`);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (
        (e.key === 'Delete' || e.key === 'Backspace') &&
        selected !== null &&
        !(e.target instanceof HTMLInputElement)
      ) {
        update((f) => ({ ...f, buttons: f.buttons.filter((_, i) => i !== selected) }));
        setSelected(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  });

  const startDrag = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    setSelected(i);
    const rect = wrap.current!.getBoundingClientRect();
    const { left, top } = fs.buttons[i];
    let moved = false;
    const onMove = (ev: MouseEvent) => {
      moved = true;
      update(
        (f) => ({
          ...f,
          buttons: f.buttons.map((b, j) =>
            j === i
              ? {
                  ...b,
                  left: round(left + ((ev.clientX - e.clientX) / rect.width) * 100),
                  top: round(top + ((ev.clientY - e.clientY) / rect.height) * 100),
                }
              : b,
          ),
        }),
        false,
      );
    };
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      if (moved) update((f) => f);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <label>Flowsheet:</label>
        <select
          value={slug}
          onChange={(e) => {
            setSlug(e.target.value);
            setSelected(null);
            setStatus('');
          }}
        >
          {Object.entries(FLOWSHEETS).map(([key, fs]) => (
            <option key={key} value={key}>
              {fs.title}
            </option>
          ))}
        </select>
        <label>URL imagen:</label>
        <input key={fs.image} ref={imgInput} type="text" defaultValue={IMG_BASE + fs.image} />
        <button onClick={() => update((f) => ({ ...f, image: imgInput.current!.value.trim().replace(IMG_BASE, '') }))}>
          Cargar imagen
        </button>
        <span className={s.status}>{status}</span>
        <span className={s.hint}>Arrastrá · Click = seleccionar · Supr = eliminar · Se guarda solo</span>
      </div>

      <div className={s.workspace}>
        <div className={s.canvas} ref={wrap}>
          <img
            src={IMG_BASE + fs.image}
            alt="Flowsheet"
            className={s.bg}
            onLoad={(e) =>
              setStatus(
                `${fs.buttons.length} botones — ${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`,
              )
            }
            onError={() => setStatus('Error al cargar imagen — CORS o URL inválida')}
          />
          {fs.buttons.map((b, i) => (
            <div
              key={i}
              className={[s.btn, b.unit === 'bool' && s.bool, i === selected && s.selected].filter(Boolean).join(' ')}
              style={{ left: `${b.left}%`, top: `${b.top}%` }}
              title={b.tag}
              onMouseDown={(e) => startDrag(e, i)}
            >
              {b.tag}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
