'use client';

import { Cancel01Icon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { useState } from 'react';
import useSWR from 'swr';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import type { FlowsheetButton } from '@/flowsheets';
import { fetcher, formatVal, UNIT_SUFFIX, type Variable } from '@/lib/api';
import s from './Editor.module.css';

const UNIDADES = [
  ['bool', 'On / Off'],
  ...Object.entries(UNIT_SUFFIX).map(([k, v]) => [k, v.trim()]),
  ['', 'Sin unidad'],
];

const DECIMALES = 2;

type Props = {
  existentes: FlowsheetButton[];
  onAgregar: (b: FlowsheetButton) => Promise<void>;
  onCerrar: () => void;
};

/** Alta de un botón: valida el código contra Variables y muestra cómo se va a ver en el flowsheet. */
export default function AgregarBoton({ existentes, onAgregar, onCerrar }: Props) {
  const [codigo, setCodigo] = useState('');
  const [tag, setTag] = useState('');
  const [unit, setUnit] = useState('m3');
  const [guardando, setGuardando] = useState(false);

  const {
    data: v,
    error,
    isLoading,
  } = useSWR<Variable>(/^\d+$/.test(codigo) ? `/api/variables/${codigo}` : null, fetcher, {
    shouldRetryOnError: false,
  });
  const { data: ultimo } = useSWR<Record<string, number>>(v ? `/api/variables/last?codigos=${codigo}` : null, fetcher);
  const valor = ultimo?.[codigo];
  const repetidos = existentes.filter((b) => b.codigo === Number(codigo)).length;
  const etiqueta = tag.trim() || v?.nombre || codigo;

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!v) return;
    setGuardando(true);
    await onAgregar({ codigo: Number(codigo), unit, decimals: DECIMALES, left: 50, top: 50, tag: etiqueta });
    setGuardando(false);
    setCodigo('');
    setTag('');
  };

  return (
    <form
      className={`${s.panel} animate-in fade-in-0 slide-in-from-top-2 motion-reduce:animate-none`}
      onSubmit={submit}
    >
      <div className={s.panelHeader}>
        <h2>Agregar botón</h2>
        <Button type="button" variant="ghost" size="icon-sm" aria-label="Cerrar" onClick={onCerrar}>
          <HugeiconsIcon icon={Cancel01Icon} strokeWidth={2} />
        </Button>
      </div>

      <div className={s.campos}>
        <label className={s.campo}>
          <span className={s.label}>Código de variable *</span>
          <Input
            type="number"
            min={1}
            required
            autoFocus
            placeholder="Ej: 13"
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            aria-invalid={!!error}
          />
          <span className={`${s.ayuda} ${error ? s.error : v ? s.ok : ''}`} aria-live="polite">
            {!codigo
              ? 'El CODIGO de la tabla Variables'
              : isLoading
                ? 'Buscando…'
                : error
                  ? error.message
                  : v && `✓ ${v.nombre ?? 'Sin nombre'}${v.unidad ? ` · ${v.unidad} en la base` : ''}`}
          </span>
          {repetidos > 0 && (
            <span className={`${s.ayuda} ${s.aviso}`}>
              Ya está {repetidos === 1 ? 'una vez' : `${repetidos} veces`} en este flowsheet
            </span>
          )}
        </label>

        <label className={s.campo}>
          <span className={s.label}>Tag</span>
          <Input placeholder={v?.nombre ?? 'Ej: FI1087'} value={tag} onChange={(e) => setTag(e.target.value)} />
          <span className={s.ayuda}>Nombre en el editor y al pasar el mouse. Vacío = nombre de la variable</span>
        </label>

        <label className={s.campo}>
          <span className={s.label}>Unidad</span>
          <select className={s.select} value={unit} onChange={(e) => setUnit(e.target.value)}>
            {UNIDADES.map(([k, label]) => (
              <option key={k} value={k}>
                {label}
              </option>
            ))}
          </select>
          <span className={s.ayuda}>On / Off para bombas, válvulas y estados</span>
        </label>

        <div className={s.campo}>
          <span className={s.label}>Vista previa</span>
          <span className={s.preview} title={etiqueta}>
            {valor === undefined ? '–' : formatVal(valor, DECIMALES, unit)}
          </span>
          <span className={s.ayuda}>{valor === undefined ? 'Sin valor actual' : 'Con el último valor registrado'}</span>
        </div>
      </div>

      <div className={s.panelFooter}>
        <span className={s.ayuda}>Aparece en el centro de la imagen, seleccionado: arrastralo a su lugar.</span>
        <Button type="submit" disabled={!v || guardando}>
          {guardando ? 'Agregando…' : 'Agregar al flowsheet'}
        </Button>
      </div>
    </form>
  );
}
