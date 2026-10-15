'use client';

import { useEffect, useRef } from 'react';
import type { Capacidad } from '@/lib/api';
import { AXIS, Chart, LEGEND_LABELS, TOOLTIP } from '@/lib/chart';

const linea = (label: string, valor: number, color: string, length: number) => ({
  label,
  data: Array(length).fill(valor),
  borderColor: color,
  borderWidth: 1.5,
  borderDash: [6, 4],
  pointRadius: 0,
  pointHoverRadius: 0,
});

/** Valores agregados con LSL/USL y media como referencias horizontales. */
export default function CapacidadChart({ data }: { data: Capacidad }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const n = data.labels.length;
    const chart = new Chart(ref.current!, {
      type: 'line',
      data: {
        labels: data.labels,
        datasets: [
          {
            label: 'Valor',
            data: data.valores,
            borderColor: '#10b981',
            backgroundColor: '#10b98118',
            borderWidth: 1.5,
            pointRadius: 0,
            pointHoverRadius: 3,
          },
          ...(data.media != null ? [linea('Media', data.media, '#94a3b8', n)] : []),
          linea('LSL', data.lsl, '#ef4444', n),
          linea('USL', data.usl, '#ef4444', n),
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { ...LEGEND_LABELS, boxWidth: 16 } },
          tooltip: { ...TOOLTIP, callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(2)}` } },
        },
        scales: { x: { ...AXIS, ticks: { ...AXIS.ticks, maxTicksLimit: 12 } }, y: AXIS },
        interaction: { mode: 'index', intersect: false },
      },
    });
    return () => chart.destroy();
  }, [data]);

  // Alto fijo: los dos gráficos (24 h y semana) entran juntos en pantalla
  return (
    <div className="relative h-[max(200px,calc((100svh-21rem)/2))]">
      <canvas ref={ref} />
    </div>
  );
}
