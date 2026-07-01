import { notFound } from 'next/navigation';
import { ENABLE_TRANSFERRED_SUBMISSIONS } from '@/lib/shared/feature-flags';
import TransferredSubmissionsClient from './transferred-submissions-client';

export default function TransferredSubmissionsPage() {
  if (!ENABLE_TRANSFERRED_SUBMISSIONS) notFound();
  return <TransferredSubmissionsClient />;
}
