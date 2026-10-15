import tk1 from './tk1.json';
import tk1rica from './tk1rica.json';
import tanques from './tanques.json';
import cal from './cal.json';
import adr from './adr.json';
import adorcion from './adorcion.json';
import ampliacion from './ampliacion.json';
import desadsorcion from './desadsorcion.json';
import reactivos from './reactivos.json';
import cianuro from './cianuro.json';
import naoh from './naoh.json';
import servicios from './servicios.json';

export type FlowsheetButton = {
  codigo: number;
  unit: string;
  decimals: number;
  left: number;
  top: number;
  tag: string;
};

export type FlowsheetData = { title: string; image: string; buttons: FlowsheetButton[] };

export const IMG_BASE = process.env.NEXT_PUBLIC_IMG_BASE ?? 'http://10.91.1.229:88/images/';

export const FLOWSHEETS: Record<string, FlowsheetData> = {
  tk1,
  tk1rica,
  tanques,
  cal,
  adr,
  adorcion,
  ampliacion,
  desadsorcion,
  reactivos,
  cianuro,
  naoh,
  servicios,
};
