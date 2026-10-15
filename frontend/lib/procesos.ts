/**
 * Variables fijas de cada proceso para la vista de capacidad Cp/Cpk.
 * lsl/usl: límites de especificación; si se omiten se usan VALORMIN/VALORMAX de la tabla Variables.
 */
export type VariableCapacidad = {
  codigo: number;
  nombre: string;
  tag: string;
  unit: string;
  decimals: number;
  lsl?: number;
  usl?: number;
};

export type Proceso = { titulo: string; variables: VariableCapacidad[] };

export const PROCESOS: Record<string, Proceso> = {
  adsorcion: { titulo: 'Adsorción', variables: [] },
  elucion: {
    titulo: 'Elución',
    variables: [{ codigo: 272, nombre: 'Caudal TK7', tag: 'FI1067', unit: 'm3', decimals: 2 }],
  },
  electrodeposicion: { titulo: 'Electrodeposición', variables: [] },
};

/** Proceso al que pertenece una variable (para enlazar desde la vista de la variable). */
export const procesoDe = (codigo: number) =>
  Object.keys(PROCESOS).find((p) => PROCESOS[p].variables.some((v) => v.codigo === codigo));
