/**
 * Vistas fijas de cada proceso para la capacidad Cp/Cpk. Una vista puede graficar varias variables juntas.
 * lsl/usl: límites de especificación; si se omiten se usan VALORMIN/VALORMAX de la tabla Variables.
 */
export type VariableCapacidad = {
  codigo: number;
  nombre: string;
  unit: string;
  decimals: number;
  lsl?: number;
  usl?: number;
};

export type Vista = { nombre: string; variables: VariableCapacidad[] };

export type Proceso = { titulo: string; vistas: Vista[] };

export const PROCESOS: Record<string, Proceso> = {
  adsorcion: {
    titulo: 'Adsorción',
    vistas: [
      { nombre: 'Caudal A+B', variables: [{ codigo: 364, nombre: 'Caudal A+B', unit: 'm3', decimals: 2 }] },
      { nombre: 'Caudal C+D', variables: [{ codigo: 10, nombre: 'Caudal C+D', unit: 'm3', decimals: 3 }] },
    ],
  },
  elucion: {
    titulo: 'Elución',
    vistas: [
      { nombre: 'Caudal TK7', variables: [{ codigo: 272, nombre: 'Caudal TK7', unit: 'm3', decimals: 2 }] },
      { nombre: 'pH TK7', variables: [{ codigo: 269, nombre: 'pH TK7', unit: 'ph', decimals: 2 }] },
      {
        nombre: 'Temperatura PV1 / PV2',
        variables: [
          { codigo: 259, nombre: 'Temperatura PV1', unit: 'degC', decimals: 2 },
          { codigo: 260, nombre: 'Temperatura PV2', unit: 'degC', decimals: 2 },
        ],
      },
      {
        nombre: 'Presión PV1 / PV2',
        variables: [
          { codigo: 262, nombre: 'Presión PV1', unit: 'psi', decimals: 2 },
          { codigo: 263, nombre: 'Presión PV2', unit: 'psi', decimals: 2 },
        ],
      },
    ],
  },
  electrodeposicion: {
    titulo: 'Electrodeposición',
    vistas: [
      { nombre: 'pH TK10', variables: [{ codigo: 370, nombre: 'pH TK10', unit: 'ph', decimals: 2 }] },
      { nombre: 'Caudal TK10', variables: [{ codigo: 13, nombre: 'Caudal TK10', unit: 'm3', decimals: 3 }] },
    ],
  },
};

/** Proceso al que pertenece una variable (para enlazar desde la vista de la variable). */
export const procesoDe = (codigo: number) =>
  Object.keys(PROCESOS).find((p) =>
    PROCESOS[p].vistas.some((vista) => vista.variables.some((v) => v.codigo === codigo)),
  );
