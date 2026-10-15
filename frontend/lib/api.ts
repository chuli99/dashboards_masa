export type Variable = {
  codigo: number;
  nombre: string;
  valormin: number;
  valormax: number;
  unidad: string;
};

export type Stats = {
  labels: string[];
  bajo: (number | null)[];
  medio: (number | null)[];
  alto: (number | null)[];
};

export async function fetcher<T>(url: string): Promise<T> {
  const res = await fetch(url);
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.detail || `Error ${res.status}`);
  }
  return res.json();
}

const UNIT_SUFFIX: Record<string, string> = {
  m3: ' m³',
  ph: ' pH',
  pct: ' %',
  bar: ' bar',
  degC: ' °C',
  psi: ' psi',
  ntu: ' NTU',
  min: ' min',
  seg: ' s',
  lpm: ' lpm',
};

export const formatVal = (val: number, decimals: number, unit: string) =>
  unit === 'bool' ? (val >= 1 ? 'On' : 'Off') : val.toFixed(decimals) + (UNIT_SUFFIX[unit] ?? '');
