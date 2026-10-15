'use client';

import { useEffect, useRef } from 'react';
import type { Capacidad } from '@/lib/api';
import { AXIS, Chart, LEGEND_LABELS, TOOLTIP } from '@/lib/chart';

export const COLORES = ['#10b981', '#3b82f6', '#f59e0b', '#a855f7'];

export type Serie = { nombre: string; data: Capacidad };

const linea = (label: string, valor: number, color: string, length: number) => ({
  label,
  data: Array(length).fill(valor),
  borderColor: color,
  borderWidth: 1.5,
  borderDash: [6, 4],
  pointRadius: 0,
  pointHoverRadius: 0,
});

// ISO "2026-10-15T15:45:00" → "15:45" (24 h) o "15-10 15:45" (semana)
const etiqueta = (iso: string, horas: number) =>
  horas === 24 ? iso.slice(11, 16) : `${iso.slice(8, 10)}-${iso.slice(5, 7)} ${iso.slice(11, 16)}`;

/** Una o más variables alineadas por tiempo, con su media y los límites LSL/USL como referencias. */
export default function CapacidadChart({ series, horas }: { series: Serie[]; horas: number }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const tiempos = [...new Set(series.flatMap((s) => s.data.tiempos))].sort();
    const n = tiempos.length;
    const multi = series.length > 1;
    // Límites iguales entre variables (p. ej. misma especificación de temperatura) se dibujan una sola vez
    const dibujados = new Set<string>();

    const chart = new Chart(ref.current!, {
      type: 'line',
      data: {
        labels: tiempos.map((t) => etiqueta(t, horas)),
        datasets: series.flatMap(({ nombre, data }, i) => {
          const color = COLORES[i % COLORES.length];
          const porTiempo = new Map(data.tiempos.map((t, j) => [t, data.valores[j]]));
          const limites = (
            [
              ['LSL', data.lsl],
              ['USL', data.usl],
            ] as const
          ).filter(([label, v]) => !dibujados.has(label + v) && dibujados.add(label + v));
          return [
            {
              label: multi ? nombre : 'Valor',
              data: tiempos.map((t) => porTiempo.get(t) ?? null),
              borderColor: color,
              backgroundColor: color + '18',
              borderWidth: 1.5,
              pointRadius: 0,
              pointHoverRadius: 3,
              spanGaps: true,
            },
            ...(data.media != null
              ? [linea(multi ? `Media ${nombre}` : 'Media', data.media, multi ? color + '99' : '#94a3b8', n)]
              : []),
            ...limites.map(([label, v]) => linea(label, v, '#ef4444', n)),
          ];
        }),
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { position: 'top', labels: { ...LEGEND_LABELS, boxWidth: 16 } },
          tooltip: {
            ...TOOLTIP,
            filter: (item) => item.raw != null,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(2)}` },
          },
        },
        scales: { x: { ...AXIS, ticks: { ...AXIS.ticks, maxTicksLimit: 12 } }, y: AXIS },
        interaction: { mode: 'index', intersect: false },
      },
    });
    return () => chart.destroy();
  }, [series, horas]);

  // Alto fijo: los dos gráficos (24 h y semana) entran juntos en pantalla
  return (
    <div className="relative h-[max(200px,calc((100svh-21rem)/2))]">
      <canvas ref={ref} />
    </div>
  );
}
