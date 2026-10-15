'use client';

import { useEffect, useRef, useState } from 'react';
import { FLOWSHEETS, IMG_BASE, type FlowsheetData } from '@/flowsheets';
import s from './Editor.module.css';

const round = (n: number) => Math.round(n * 100) / 100;

// Mismo formato que flowsheets/*.json: un botón por línea
const toJson = (fs: FlowsheetData) =>
  JSON.stringify(fs, null, 2).replace(/\{\s+("codigo"[^}]+?)\s+\}/g, (_, inner) => `{ ${inner.replace(/\s*\n\s*/g, ' ')} }`);

export default function Editor() {
  const [slug, setSlug] = useState(Object.keys(FLOWSHEETS)[0]);
  const original = FLOWSHEETS[slug];
  const [image, setImage] = useState(IMG_BASE + original.image);
  const [imgInput, setImgInput] = useState(image);
  const [buttons, setButtons] = useState(original.buttons);
  const [selected, setSelected] = useState<number | null>(null);
  const [status, setStatus] = useState('');
  const [copied, setCopied] = useState(false);
  const wrap = useRef<HTMLDivElement>(null);
  const output = useRef<HTMLTextAreaElement>(null);

  const load = (key: string) => {
    const url = IMG_BASE + FLOWSHEETS[key].image;
    setSlug(key);
    setImage(url);
    setImgInput(url);
    setButtons(FLOWSHEETS[key].buttons);
    setSelected(null);
  };

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.key === 'Delete' || e.key === 'Backspace') && selected !== null && !(e.target instanceof HTMLInputElement)) {
        setButtons((bs) => bs.filter((_, i) => i !== selected));
        setSelected(null);
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [selected]);

  const startDrag = (e: React.MouseEvent, i: number) => {
    e.preventDefault();
    setSelected(i);
    const rect = wrap.current!.getBoundingClientRect();
    const { left, top } = buttons[i];
    const onMove = (ev: MouseEvent) =>
      setButtons((bs) =>
        bs.map((b, j) =>
          j === i
            ? {
                ...b,
                left: round(left + ((ev.clientX - e.clientX) / rect.width) * 100),
                top: round(top + ((ev.clientY - e.clientY) / rect.height) * 100),
              }
            : b,
        ),
      );
    const onUp = () => {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
    };
    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
  };

  const json = toJson({ title: original.title, image: image.replace(IMG_BASE, ''), buttons });
  const dirty = buttons !== original.buttons || image !== IMG_BASE + original.image;

  const copy = async () => {
    // navigator.clipboard solo existe en contextos seguros (https/localhost)
    if (navigator.clipboard) await navigator.clipboard.writeText(json);
    else {
      output.current!.select();
      document.execCommand('copy');
    }
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div className={s.page}>
      <div className={s.toolbar}>
        <label>Flowsheet:</label>
        <select value={slug} onChange={(e) => load(e.target.value)}>
          {Object.entries(FLOWSHEETS).map(([key, fs]) => (
            <option key={key} value={key}>
              {fs.title}
            </option>
          ))}
        </select>
        <label>URL imagen:</label>
        <input type="text" value={imgInput} onChange={(e) => setImgInput(e.target.value)} />
        <button onClick={() => setImage(imgInput.trim())}>Cargar imagen</button>
        <button className={copied ? s.copied : s.copy} onClick={copy}>
          {copied ? '✓ Copiado' : `Copiar JSON (flowsheets/${slug}.json)`}
        </button>
        <span className={s.status}>{status}</span>
        <span className={s.hint}>Arrastrá · Click = seleccionar · Supr = eliminar seleccionado</span>
      </div>

      <div className={s.workspace}>
        <div className={s.canvas} ref={wrap}>
          <img
            src={image}
            alt="Flowsheet"
            className={s.bg}
            onLoad={(e) =>
              setStatus(`${buttons.length} botones — ${e.currentTarget.naturalWidth}×${e.currentTarget.naturalHeight}`)
            }
            onError={() => setStatus('Error al cargar imagen — CORS o URL inválida')}
          />
          {buttons.map((b, i) => (
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

      {dirty && (
        <div className={s.outputWrap}>
          <textarea ref={output} className={s.output} value={json} readOnly />
        </div>
      )}
    </div>
  );
}
