'use client';

import { useState } from 'react';
import { useSearchParams } from 'next/navigation';
import useSWR, { useSWRConfig } from 'swr';
import StatsChart from './StatsChart';
import { fetcher, type Stats, type Variable } from '@/lib/api';
import s from './Dashboard.module.css';

const PERIODS = [
  { period: '30d', title: ['Últimos 30 días', '30 días desde último dato'] },
  { period: '7d', title: ['Últimos 7 días', '7 días desde último dato'] },
  { period: '12h', title: ['Últimas 12 horas', '12 horas desde último dato'] },
];

const formatValUnit = (val: number, unit: string) =>
  !unit || /bool/i.test(unit) ? (val >= 1 ? 'On' : 'Off') : `${val.toFixed(2)} ${unit}`;

type CardProps = { codigo: string; variable?: Variable; historico: boolean; index: number };

function PeriodCard({ codigo, variable, historico, index }: CardProps) {
  const { period, title } = PERIODS[index];
  const params =
    variable &&
    new URLSearchParams({
      period,
      valormin: String(variable.valormin),
      valormax: String(variable.valormax),
      from_last_data: String(historico),
    });
  const { data, error } = useSWR<Stats>(params && `/api/variables/${codigo}/stats?${params}`, fetcher);

  return (
    <div className={s.card}>
      <h2>{title[+historico]}</h2>
      {error ? (
        <div className={s.loading}>Error: {error.message}</div>
      ) : !variable ? null : !data ? (
        <div className={s.loading}>Cargando...</div>
      ) : data.labels.length ? (
        <StatsChart data={data} line={period === '30d'} />
      ) : (
        <p className={s.noData}>Sin datos para el período.</p>
      )}
    </div>
  );
}

export default function Dashboard({ historico = false }: { historico?: boolean }) {
  const params = useSearchParams();
  const codigo = params.get('codigo') ?? '';
  const base = `/api/variables/${codigo}`;
  const { data: variable, error } = useSWR<Variable>(codigo && base, fetcher);
  const { data: last } = useSWR<{ valor: number }>(codigo && `${base}/last`, fetcher);
  const { mutate } = useSWRConfig();
  const [refreshing, setRefreshing] = useState(false);

  const refresh = async () => {
    setRefreshing(true);
    await mutate((key) => typeof key === 'string' && key.startsWith(base));
    setRefreshing(false);
  };

  const nombre = variable?.nombre || `Variable ${codigo}`;
  const card = (index: number) => <PeriodCard codigo={codigo} variable={variable} historico={historico} index={index} />;

  return (
    <div className={s.page}>
      <header className={historico ? s.headerHist : s.header}>
        <div className={s.info}>
          <span className={s.title}>{variable ? nombre : 'PLC Dashboard'}</span>
          <span className={s.sub}>
            {variable && `Código ${codigo}  ·  Min: ${variable.valormin}  ·  Max: ${variable.valormax}`}
          </span>
        </div>
        <div className={s.headerRight}>
          {historico && <span className={s.badge}>Desde último dato</span>}
          <button onClick={refresh} disabled={!variable || refreshing}>
            Actualizar
          </button>
        </div>
      </header>

      <main className={s.main}>
        {!codigo ? (
          <div className={s.error}>Falta el parámetro ?codigo= en la URL.</div>
        ) : (
          error && <div className={s.error}>{`Variable ${codigo}: ${error.message}`}</div>
        )}

        <div className={s.row30d}>
          {card(0)}
          {variable && (
            <div className={`${s.card} ${s.current}`}>
              <h2>Valor actual</h2>
              <div className={s.currentNombre}>{nombre}</div>
              <div className={s.currentValor}>
                {last ? formatValUnit(last.valor, variable.unidad || (params.get('unit') ?? '')) : '–'}
              </div>
            </div>
          )}
        </div>

        <div className={s.chartsRow}>
          {card(1)}
          {card(2)}
        </div>
      </main>
    </div>
  );
}
