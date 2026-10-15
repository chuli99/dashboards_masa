'use client';

import { useEffect, useRef } from 'react';
import {
  BarController,
  BarElement,
  CategoryScale,
  Chart,
  Legend,
  LinearScale,
  LineController,
  LineElement,
  PointElement,
  Tooltip,
} from 'chart.js';
import type { Stats } from '@/lib/api';

Chart.register(BarController, BarElement, CategoryScale, Legend, LinearScale, LineController, LineElement, PointElement, Tooltip);

const SERIES = [
  { key: 'bajo', label: 'Bajo', color: '#ef4444' },
  { key: 'medio', label: 'Medio', color: '#22c55e' },
  { key: 'alto', label: 'Alto', color: '#f97316' },
] as const;

const AXIS = {
  grid: { color: '#f1f5f9' },
  ticks: { font: { size: 11 }, color: '#94a3b8' },
  border: { color: '#e2e8f0' },
};

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
            labels: { boxWidth: line ? 16 : 12, font: { size: 11 }, usePointStyle: line },
          },
          tooltip: {
            filter: (item) => item.raw != null,
            callbacks: { label: (ctx) => `${ctx.dataset.label}: ${(ctx.raw as number).toFixed(4)}` },
            backgroundColor: '#0f172a',
            titleColor: '#94a3b8',
            bodyColor: '#f1f5f9',
            padding: 10,
            cornerRadius: 6,
            boxWidth: 8,
            boxHeight: 8,
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
