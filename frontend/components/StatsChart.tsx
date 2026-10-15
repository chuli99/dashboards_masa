'use client';

import { useEffect, useRef } from 'react';
import type { Stats } from '@/lib/api';
import { AXIS, Chart, LEGEND_LABELS, TOOLTIP } from '@/lib/chart';

const SERIES = [
  { key: 'bajo', label: 'Bajo', color: '#ef4444' },
  { key: 'medio', label: 'Medio', color: '#22c55e' },
  { key: 'alto', label: 'Alto', color: '#f97316' },
] as const;

export default function StatsChart({ data, line }: { data: Stats; line: boolean }) {
  const ref = useRef<HTMLCanvasElement>(null);

  useEffect(() => {
    const chart = new Chart(ref.current!, {
      type: line ? 'line' : 'bar',
      data: {
        labels: data.labels,
        datasets: SERIES.map(({ key, label, color }) =>
          line
            ? {
                label,
                data: data[key],
                borderColor: color,
                backgroundColor: color + '18',
                borderWidth: 1.5,
                pointRadius: 0,
                pointHoverRadius: 3,
                tension: 0,
                fill: false,
                spanGaps: false,
              }
            : {
                label,
                data: data[key],
                backgroundColor: color + 'cc',
                borderColor: color,
                borderWidth: 1,
                borderRadius: 3,
              },
        ),
      },
      options: {
        responsive: true,
        aspectRatio: line ? 3.75 : 2,
        plugins: {
          legend: {
            position: 'top',
            labels: { ...LEGEND_LABELS, boxWidth: line ? 16 : 12, usePointStyle: line },
          },
          tooltip: {
            ...TOOLTIP,
            filter: (item) => item.raw != null,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(4)}` },
          },
        },
        scales: { x: AXIS, y: AXIS },
        ...(line && { interaction: { mode: 'index', intersect: false } }),
      },
    });
    return () => chart.destroy();
  }, [data, line]);

  return <canvas ref={ref} />;
}
