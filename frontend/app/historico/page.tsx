import { Suspense } from 'react';
import type { Metadata } from 'next';
import Dashboard from '@/components/Dashboard';

export const metadata: Metadata = { title: 'PLC Dashboard — Vista Histórica' };

export default function Page() {
  return (
    <Suspense>
      <Dashboard historico />
    </Suspense>
  );
}
