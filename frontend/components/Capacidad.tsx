'use client';

import { useState } from 'react';
import useSWR from 'swr';
import CapacidadChart, { COLORES } from './CapacidadChart';
import { fetcher, formatVal, type Capacidad as CapacidadData } from '@/lib/api';
import type { Proceso, VariableCapacidad, Vista } from '@/lib/procesos';
import s from './Capacidad.module.css';

const VENTANAS = [
  { horas: 24, titulo: 'Últimas 24 horas', corto: '24 horas', refresh: 5 * 60000 },
  { horas: 168, titulo: 'Última semana', corto: 'Semana', refresh: 30 * 60000 },
];

type Ventana = (typeof VENTANAS)[number];

const url = (v: VariableCapacidad, horas: number) => {
  const q = new URLSearchParams({ horas: String(horas) });
  if (v.lsl != null) q.set('lsl', String(v.lsl));
  if (v.usl != null) q.set('usl', String(v.usl));
  return `/api/variables/${v.codigo}/capacidad?${q}`;
};

/** Capacidad de todas las variables de la vista en una ventana (una clave SWR: gráfico y tabla comparten caché). */
const useCapacidades = (vista: Vista, { horas, refresh }: Ventana) =>
  useSWR<CapacidadData[]>(
    vista.variables.map((v) => url(v, horas)),
    (urls: string[]) => Promise.all(urls.map((u) => fetcher<CapacidadData>(u))),
    { refreshInterval: refresh },
  );

const fmt = (n: number | null | undefined, d = 2) => (n == null ? '–' : n.toFixed(d));

// ≥ 1,33 capaz · ≥ 1 marginal · < 1 no capaz
const nivel = (v: number | null | undefined) => (v == null ? '' : v >= 1.33 ? s.ok : v >= 1 ? s.warn : s.bad);

function VentanaCard({ vista, ventana }: { vista: Vista; ventana: Ventana }) {
  const { data, error } = useCapacidades(vista, ventana);
  return (
    <div className={s.card}>
      <h2>{ventana.titulo}</h2>
      {error ? (
        <div className={s.loading}>Error: {error.message}</div>
      ) : !data ? (
        <div className={s.loading}>Cargando...</div>
      ) : data.some((d) => d.tiempos.length) ? (
        <CapacidadChart series={data.map((d, i) => ({ nombre: vista.variables[i].nombre, data: d }))} horas={ventana.horas} />
      ) : (
        <p className={s.noData}>Sin datos para el período.</p>
      )}
    </div>
  );
}

/** Cp/Cpk por variable y ventana; con varias variables, una fila de título (con su color) por variable. */
function TablaIndices({ vista }: { vista: Vista }) {
  const datos = [useCapacidades(vista, VENTANAS[0]).data, useCapacidades(vista, VENTANAS[1]).data];
  const multi = vista.variables.length > 1;
  return (
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
        {vista.variables.flatMap((v, i) => [
          multi && (
            <tr key={v.codigo} className={s.subfila}>
              <th colSpan={5} style={{ color: COLORES[i % COLORES.length] }}>
                {v.nombre}
              </th>
            </tr>
          ),
          ...VENTANAS.map((w, k) => {
            const d = datos[k]?.[i];
            return (
              <tr key={`${v.codigo}-${w.horas}`}>
                <th>{w.corto}</th>
                <td className={nivel(d?.cp)}>{fmt(d?.cp)}</td>
                <td className={nivel(d?.cpk)}>{fmt(d?.cpk)}</td>
                <td>{fmt(d?.media)}</td>
                <td>{fmt(d?.sigma)}</td>
              </tr>
            );
          }),
        ])}
      </tbody>
    </table>
  );
}

function ValorActual({ v, color }: { v: VariableCapacidad; color?: string }) {
  const { data: last } = useSWR<{ valor: number }>(`/api/variables/${v.codigo}/last`, fetcher, {
    refreshInterval: 60000,
  });
  return (
    <div className={s.actualItem}>
      <span className={s.actualNombre} style={{ color }}>
        {v.nombre}
      </span>
      <span className={s.actualValor}>{last ? formatVal(last.valor, v.decimals, v.unit) : '–'}</span>
    </div>
  );
}

function SeccionVista({ vista }: { vista: Vista }) {
  // Límites efectivos (config o tabla Variables), tal como los usa el cálculo
  const { data: caps } = useCapacidades(vista, VENTANAS[0]);
  const multi = vista.variables.length > 1;

  return (
    <section className={s.seccion}>
      <div className={s.info}>
        <span className={s.title}>{vista.nombre}</span>
        <span className={s.sub}>
          {vista.variables
            .map((v, i) => {
              const cap = caps?.[i];
              return `${multi ? `${v.nombre}: ` : ''}Código ${v.codigo}${cap ? ` · LSL ${cap.lsl} · USL ${cap.usl}` : ''}`;
            })
            .join('   |   ')}
        </span>
      </div>
      {caps?.some((c) => c.usl <= c.lsl) && (
        <p className={s.aviso}>
          Sin límites de especificación válidos: definí lsl/usl en lib/procesos.ts o VALORMIN/VALORMAX en la tabla
          Variables.
        </p>
      )}

      <div className={s.grid}>
        <div className={s.charts}>
          {VENTANAS.map((w) => (
            <VentanaCard key={w.horas} vista={vista} ventana={w} />
          ))}
        </div>

        <aside className={s.side}>
          <div className={`${s.card} ${s.actual}`}>
            <h2>Valor actual</h2>
            {vista.variables.map((v, i) => (
              <ValorActual key={v.codigo} v={v} color={multi ? COLORES[i % COLORES.length] : undefined} />
            ))}
          </div>

          <div className={s.card}>
            <h2>Índices</h2>
            <TablaIndices vista={vista} />
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
  const [indice, setIndice] = useState(0);
  const actual = proceso.vistas[indice];

  return (
    <div className={s.page}>
      <div className={s.barra}>
        <h1 className={s.proceso}>Capacidad de proceso · {proceso.titulo}</h1>
        {proceso.vistas.length > 1 && (
          <div className={s.selector} role="tablist">
            {proceso.vistas.map((vista, i) => (
              <button
                key={vista.nombre}
                role="tab"
                aria-selected={i === indice}
                className={i === indice ? s.activo : undefined}
                onClick={() => setIndice(i)}
              >
                {vista.nombre}
              </button>
            ))}
          </div>
        )}
      </div>
      {actual ? (
        <SeccionVista key={actual.nombre} vista={actual} />
      ) : (
        <p className={s.noData}>Todavía no hay variables definidas para {proceso.titulo}.</p>
      )}
    </div>
  );
}
