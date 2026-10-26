'use client';

import { useEffect, useRef, useState } from 'react';
import useSWR from 'swr';
import { PlusSignIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { fetcher } from '@/lib/api';
import { FLOWSHEETS, IMG_BASE, type FlowsheetData } from '@/flowsheets';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import AgregarBoton from './AgregarBoton';
import s from './Editor.module.css';

const round = (n: number) => Math.round(n * 100) / 100;

export default function Editor() {
  const [slug, setSlug] = useState(Object.keys(FLOWSHEETS)[0]);
  const key = `/api/flowsheets/${slug}`;
  // El JSON del bundle puede estar desactualizado en prod (export estático): manda el del servidor
  const { data: fs = FLOWSHEETS[slug], mutate } = useSWR<FlowsheetData>(key, fetcher, { revalidateOnFocus: false });
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [agregando, setAgregando] = useState(false);
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
        !(e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement)
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
    // preventDefault evita que el foco salga de un input: sin esto Supr no borraría
    (document.activeElement as HTMLElement | null)?.blur();
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
      <div className={s.barra}>
        <div className={s.info}>
          <span className={s.seccion}>Herramientas</span>
          <h1 className={s.title}>Editor de flowsheets</h1>
          <span className={`${s.sub} ${status.startsWith('✓') ? s.ok : status.startsWith('Error') ? s.error : ''}`}>
            {status || 'Arrastrá para mover · Click = seleccionar · Supr = eliminar · Se guarda solo'}
          </span>
        </div>
        <div className={s.controles}>
          <select
            className={`${s.select} ${s.flowsheet}`}
            aria-label="Flowsheet"
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
          <Input
            key={fs.image}
            ref={imgInput}
            className={s.url}
            aria-label="URL imagen"
            defaultValue={IMG_BASE + fs.image}
          />
          <Button
            variant="outline"
            onClick={() => update((f) => ({ ...f, image: imgInput.current!.value.trim().replace(IMG_BASE, '') }))}
          >
            Cargar imagen
          </Button>
          {!agregando && (
            <Button onClick={() => setAgregando(true)}>
              <HugeiconsIcon icon={PlusSignIcon} strokeWidth={2} />
              Agregar botón
            </Button>
          )}
        </div>
      </div>

      {agregando && (
        <AgregarBoton
          existentes={fs.buttons}
          onAgregar={async (b) => {
            setSelected(fs.buttons.length);
            await update((f) => ({ ...f, buttons: [...f.buttons, b] }));
          }}
          onCerrar={() => setAgregando(false)}
        />
      )}

      <div className={s.card}>
        <div className={s.canvas} ref={wrap}>
          <img
            src={IMG_BASE + fs.image}
            alt={`Flowsheet ${fs.title}`}
            className={s.bg}
            onLoad={(e) =>
              setStatus(
                `${fs.buttons.length} botones · ${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`,
              )
            }
            onError={() => setStatus('Error al cargar imagen: CORS o URL inválida')}
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
