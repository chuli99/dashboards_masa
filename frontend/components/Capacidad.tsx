'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import useSWR from 'swr';
import CapacidadChart from './CapacidadChart';
import { FLOWSHEETS, type FlowsheetButton } from '@/flowsheets';
import { fetcher, formatVal, type Capacidad as CapacidadData, type Variable } from '@/lib/api';
import s from './Capacidad.module.css';

const VENTANAS = [
  { horas: 24, titulo: 'Últimas 24 horas', refresh: 5 * 60000 },
  { horas: 168, titulo: 'Última semana', refresh: 30 * 60000 },
];

// Variables analógicas de los flowsheets (Cp/Cpk no aplica a On/Off), sin repetir, agrupadas por flowsheet
const vistos = new Set<number>();
const GRUPOS = Object.values(FLOWSHEETS)
  .map((fs) => ({
    titulo: fs.title,
    botones: fs.buttons.filter((b) => b.unit !== 'bool' && !vistos.has(b.codigo) && vistos.add(b.codigo)),
  }))
  .filter((g) => g.botones.length);
const BOTONES = new Map<number, FlowsheetButton>(GRUPOS.flatMap((g) => g.botones.map((b) => [b.codigo, b])));

const useCapacidad = (codigo: number, horas: number, refresh: number) =>
  useSWR<CapacidadData>(`/api/variables/${codigo}/capacidad?horas=${horas}`, fetcher, { refreshInterval: refresh });

const fmt = (n: number | null | undefined, d = 2) => (n == null ? '–' : n.toFixed(d));

// ≥ 1,33 capaz · ≥ 1 marginal · < 1 no capaz
const nivel = (v: number | null) => (v == null ? '' : v >= 1.33 ? s.ok : v >= 1 ? s.warn : s.bad);

function VentanaCard({ codigo, horas, titulo, refresh }: { codigo: number } & (typeof VENTANAS)[number]) {
  const { data, error } = useCapacidad(codigo, horas, refresh);
  return (
    <div className={s.card}>
      <h2>{titulo}</h2>
      {error ? (
        <div className={s.loading}>Error: {error.message}</div>
      ) : !data ? (
        <div className={s.loading}>Cargando...</div>
      ) : data.labels.length ? (
        <CapacidadChart data={data} />
      ) : (
        <p className={s.noData}>Sin datos para el período.</p>
      )}
    </div>
  );
}

function FilaCapacidad({ codigo, horas, titulo, refresh }: { codigo: number } & (typeof VENTANAS)[number]) {
  const { data } = useCapacidad(codigo, horas, refresh);
  return (
    <tr>
      <th>{titulo.replace('Últimas ', '').replace('Última ', '')}</th>
      <td className={nivel(data?.cp ?? null)}>{fmt(data?.cp)}</td>
      <td className={nivel(data?.cpk ?? null)}>{fmt(data?.cpk)}</td>
      <td>{fmt(data?.media)}</td>
      <td>{fmt(data?.sigma)}</td>
    </tr>
  );
}

export default function Capacidad() {
  const router = useRouter();
  const codigo = Number(useSearchParams().get('codigo')) || 0;
  const boton = BOTONES.get(codigo);
  const { data: variable, error } = useSWR<Variable>(codigo ? `/api/variables/${codigo}` : null, fetcher);
  const { data: last } = useSWR<{ valor: number }>(codigo ? `/api/variables/${codigo}/last` : null, fetcher, {
    refreshInterval: 60000,
  });

  const valor = last && (boton ? formatVal(last.valor, boton.decimals, boton.unit) : last.valor.toFixed(2));

  return (
    <div className={s.page}>
      <div className={s.header}>
        <div className={s.info}>
          <span className={s.title}>Capacidad de proceso</span>
          <span className={s.sub}>
            {variable
              ? `${variable.nombre} · LSL ${variable.valormin} · USL ${variable.valormax}`
              : 'Cp y Cpk con los límites VALORMIN / VALORMAX de la variable'}
          </span>
        </div>
        <select value={codigo || ''} onChange={(e) => router.replace(`/capacidad/?codigo=${e.target.value}`)}>
          <option value="" disabled>
            Elegir variable…
          </option>
          {GRUPOS.map((g) => (
            <optgroup key={g.titulo} label={g.titulo}>
              {g.botones.map((b) => (
                <option key={b.codigo} value={b.codigo}>
                  {b.tag}
                </option>
              ))}
            </optgroup>
          ))}
        </select>
      </div>

      {!codigo ? (
        <p className={s.noData}>Elegí una variable para ver su capacidad.</p>
      ) : error ? (
        <div className={s.error}>{`Variable ${codigo}: ${error.message}`}</div>
      ) : (
        <div className={s.grid}>
          <div className={s.charts}>
            {VENTANAS.map((v) => (
              <VentanaCard key={v.horas} codigo={codigo} {...v} />
            ))}
          </div>

          <aside className={s.side}>
            <div className={s.tag}>
              <span className={s.tagNombre}>{boton?.tag ?? `Variable ${codigo}`}</span>
              <span className={s.tagValor}>{valor ?? '–'}</span>
              <span className={s.tagDesc}>{variable?.nombre}</span>
            </div>

            <div className={s.card}>
              <h2>Índices</h2>
              <table className={s.tabla}>
                <thead>
                  <tr>
                    <th />
                    <th>Cp</th>
                    <th>Cpk</th>
                    <th>Media</th>
                    <th>σ</th>
                  </tr>
                </thead>
                <tbody>
                  {VENTANAS.map((v) => (
                    <FilaCapacidad key={v.horas} codigo={codigo} {...v} />
                  ))}
                </tbody>
              </table>
              <p className={s.leyenda}>
                <span className={s.ok}>≥ 1,33 capaz</span> · <span className={s.warn}>1 – 1,33 marginal</span> ·{' '}
                <span className={s.bad}>&lt; 1 no capaz</span>
              </p>
            </div>
          </aside>
        </div>
      )}
    </div>
  );
}
