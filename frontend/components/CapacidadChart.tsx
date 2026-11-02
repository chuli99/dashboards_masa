'use client';

import { useEffect, useRef, useState } from 'react';
import { FitToScreenIcon, RefreshIcon } from '@hugeicons/core-free-icons';
import { HugeiconsIcon } from '@hugeicons/react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Slider } from '@/components/ui/slider';
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

type Rango = [number, number];

/** Rango de los valores con 5 % de margen (o 1 % del valor si es constante). */
const conMargen = (valores: number[]): Rango => {
  const min = Math.min(...valores);
  const max = Math.max(...valores);
  const m = (max - min) * 0.05 || Math.abs(max) * 0.01 || 1;
  return [min - m, max + m];
};

// Paso del slicer según la amplitud: ~200 pasos, redondeado a potencia de 10
const paso = ([min, max]: Rango) => 10 ** Math.floor(Math.log10((max - min) / 200));

/** Una o más variables alineadas por tiempo, con su media y los límites LSL/USL como referencias. */
export default function CapacidadChart({ series, horas }: { series: Serie[]; horas: number }) {
  const ref = useRef<HTMLCanvasElement>(null);
  const chartRef = useRef<Chart<'line', (number | null)[], string>>(null);
  // null = eje Y automático; se conserva al refrescar los datos
  const [rangoY, setRangoY] = useState<Rango | null>(null);
  const rangoRef = useRef(rangoY);
  rangoRef.current = rangoY;

  // Extremos del slicer: todo lo que dibuja el gráfico (valores, medias y límites)
  const limites = conMargen(
    series.flatMap(({ data }) => [...data.valores, data.lsl, data.usl, ...(data.media != null ? [data.media] : [])]),
  );
  const step = paso(limites);
  const [min, max] = rangoY ?? limites;
  const decimales = Math.max(0, -Math.log10(step));

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
        scales: {
          x: { ...AXIS, ticks: { ...AXIS.ticks, maxTicksLimit: 12 } },
          y: { ...AXIS, min: rangoRef.current?.[0], max: rangoRef.current?.[1] },
        },
        interaction: { mode: 'index', intersect: false },
      },
    });
    chartRef.current = chart;
    return () => chart.destroy();
  }, [series, horas]);

  useEffect(() => {
    const chart = chartRef.current;
    if (!chart) return;
    Object.assign(chart.options.scales!.y!, { min: rangoY?.[0], max: rangoY?.[1] });
    chart.update('none');
  }, [rangoY]);

  // Se confirma al salir o con Enter: escribir dígito a dígito no pelea con la validación mín < máx
  const campo = (i: 0 | 1, label: string) => {
    const valor = (i ? max : min).toFixed(decimales);
    const confirmar = (e: React.SyntheticEvent<HTMLInputElement>) => {
      const r: Rango = [min, max];
      r[i] = e.currentTarget.valueAsNumber;
      if (r[0] < r[1]) setRangoY(r);
      else e.currentTarget.value = valor;
    };
    return (
      <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
        {label}
        <Input
          key={valor}
          type="number"
          step={step}
          className="h-7 w-24 px-2 text-xs tabular-nums"
          defaultValue={valor}
          onBlur={confirmar}
          onKeyDown={(e) => e.key === 'Enter' && confirmar(e)}
        />
      </label>
    );
  };

  // Alto fijo: los dos gráficos (24 h y semana) entran juntos en pantalla
  return (
    <>
      <div className="mb-2 flex flex-wrap items-center justify-end gap-2">
        <span className="mr-auto text-xs font-medium text-muted-foreground">Eje Y</span>
        {campo(1, 'Máx')}
        {campo(0, 'Mín')}
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Ajustar eje Y a los datos"
          title="Ajustar eje Y a los datos"
          onClick={() => setRangoY(conMargen(series.flatMap((s) => s.data.valores)))}
        >
          <HugeiconsIcon icon={FitToScreenIcon} strokeWidth={2} />
        </Button>
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label="Restablecer eje Y"
          title="Restablecer eje Y"
          disabled={!rangoY}
          onClick={() => setRangoY(null)}
        >
          <HugeiconsIcon icon={RefreshIcon} strokeWidth={2} />
        </Button>
      </div>
      <div className="flex h-[max(200px,calc((100svh-23rem)/2))] gap-3">
        <Slider
          orientation="vertical"
          aria-label="Rango del eje Y"
          min={limites[0]}
          max={limites[1]}
          step={step}
          minStepsBetweenValues={1}
          value={[Math.max(min, limites[0]), Math.min(max, limites[1])]}
          onValueChange={(v) => setRangoY(v as Rango)}
          className="w-auto py-2"
        />
        <div className="relative min-w-0 flex-1">
          <canvas ref={ref} />
        </div>
      </div>
    </>
  );
}
