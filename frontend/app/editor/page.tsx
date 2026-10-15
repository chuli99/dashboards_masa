import type { Metadata } from 'next';
import Editor from '@/components/Editor';

export const metadata: Metadata = { title: 'Flowsheet Editor' };

export default function Page() {
  return <Editor />;
}
