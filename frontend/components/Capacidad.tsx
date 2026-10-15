'use client';

import useSWR from 'swr';
import CapacidadChart from './CapacidadChart';
import { fetcher, formatVal, type Capacidad as CapacidadData } from '@/lib/api';
import type { Proceso, VariableCapacidad } from '@/lib/procesos';
import s from './Capacidad.module.css';

const VENTANAS = [
  { horas: 24, titulo: 'Últimas 24 horas', corto: '24 horas', refresh: 5 * 60000 },
  { horas: 168, titulo: 'Última semana', corto: 'Semana', refresh: 30 * 60000 },
];

type VentanaProps = { v: VariableCapacidad } & (typeof VENTANAS)[number];

const useCapacidad = ({ v, horas, refresh }: VentanaProps) => {
  const q = new URLSearchParams({ horas: String(horas) });
  if (v.lsl != null) q.set('lsl', String(v.lsl));
  if (v.usl != null) q.set('usl', String(v.usl));
  return useSWR<CapacidadData>(`/api/variables/${v.codigo}/capacidad?${q}`, fetcher, { refreshInterval: refresh });
};

const fmt = (n: number | null | undefined, d = 2) => (n == null ? '–' : n.toFixed(d));

// ≥ 1,33 capaz · ≥ 1 marginal · < 1 no capaz
const nivel = (v: number | null | undefined) => (v == null ? '' : v >= 1.33 ? s.ok : v >= 1 ? s.warn : s.bad);

function VentanaCard(props: VentanaProps) {
  const { data, error } = useCapacidad(props);
  return (
    <div className={s.card}>
      <h2>{props.titulo}</h2>
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

function FilaCapacidad(props: VentanaProps) {
  const { data } = useCapacidad(props);
  return (
    <tr>
      <th>{props.corto}</th>
      <td className={nivel(data?.cp)}>{fmt(data?.cp)}</td>
      <td className={nivel(data?.cpk)}>{fmt(data?.cpk)}</td>
      <td>{fmt(data?.media)}</td>
      <td>{fmt(data?.sigma)}</td>
    </tr>
  );
}

function SeccionVariable({ v }: { v: VariableCapacidad }) {
  // Límites efectivos (config o tabla Variables), tal como los usa el cálculo
  const { data: cap } = useCapacidad({ v, ...VENTANAS[0] });
  const { data: last } = useSWR<{ valor: number }>(`/api/variables/${v.codigo}/last`, fetcher, {
    refreshInterval: 60000,
  });
  const sinLimites = cap && cap.usl <= cap.lsl;

  return (
    <section className={s.seccion}>
      <div className={s.info}>
        <span className={s.title}>{v.nombre}</span>
        <span className={s.sub}>
          {v.tag} · Código {v.codigo}
          {cap && ` · LSL ${cap.lsl} · USL ${cap.usl}`}
        </span>
      </div>
      {sinLimites && (
        <p className={s.aviso}>
          Sin límites de especificación válidos: definí lsl/usl en lib/procesos.ts o VALORMIN/VALORMAX en la tabla
          Variables.
        </p>
      )}

      <div className={s.grid}>
        <div className={s.charts}>
          {VENTANAS.map((w) => (
            <VentanaCard key={w.horas} v={v} {...w} />
          ))}
        </div>

        <aside className={s.side}>
          <div className={s.tag}>
            <span className={s.tagNombre}>{v.tag}</span>
            <span className={s.tagValor}>{last ? formatVal(last.valor, v.decimals, v.unit) : '–'}</span>
            <span className={s.tagDesc}>{v.nombre}</span>
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
                {VENTANAS.map((w) => (
                  <FilaCapacidad key={w.horas} v={v} {...w} />
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
    </section>
  );
}

export default function Capacidad({ proceso }: { proceso: Proceso }) {
  return (
    <div className={s.page}>
      <h1 className={s.proceso}>Capacidad de proceso · {proceso.titulo}</h1>
      {proceso.variables.length ? (
        proceso.variables.map((v) => <SeccionVariable key={v.codigo} v={v} />)
      ) : (
        <p className={s.noData}>Todavía no hay variables definidas para {proceso.titulo}.</p>
      )}
    </div>
  );
}
