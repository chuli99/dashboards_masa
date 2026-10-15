import { Suspense } from 'react';
import type { Metadata } from 'next';
import Capacidad from '@/components/Capacidad';

export const metadata: Metadata = { title: 'Capacidad Cp/Cpk' };

export default function Page() {
  return (
    <Suspense>
      <Capacidad />
    </Suspense>
  );
}
