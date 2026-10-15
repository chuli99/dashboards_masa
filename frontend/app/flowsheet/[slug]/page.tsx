import type { Metadata } from 'next';
import Flowsheet from '@/components/Flowsheet';
import { FLOWSHEETS } from '@/flowsheets';

export const dynamicParams = false;

export const generateStaticParams = () => Object.keys(FLOWSHEETS).map((slug) => ({ slug }));

export async function generateMetadata({ params }: PageProps<'/flowsheet/[slug]'>): Promise<Metadata> {
  const { slug } = await params;
  return { title: `Flowsheet – ${FLOWSHEETS[slug].title}` };
}

export default async function Page({ params }: PageProps<'/flowsheet/[slug]'>) {
  const { slug } = await params;
  return <Flowsheet fs={FLOWSHEETS[slug]} />;
}
