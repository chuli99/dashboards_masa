import type { Metadata } from 'next';
import Capacidad from '@/components/Capacidad';
import { PROCESOS } from '@/lib/procesos';

export const dynamicParams = false;

export const generateStaticParams = () => Object.keys(PROCESOS).map((proceso) => ({ proceso }));

export async function generateMetadata({ params }: PageProps<'/capacidad/[proceso]'>): Promise<Metadata> {
  const { proceso } = await params;
  return { title: `Cp/Cpk – ${PROCESOS[proceso].titulo}` };
}

export default async function Page({ params }: PageProps<'/capacidad/[proceso]'>) {
  const { proceso } = await params;
  return <Capacidad proceso={PROCESOS[proceso]} />;
}
