import { redirect } from 'next/navigation';

export default function SubmitInvoiceRedirectPage() {
  redirect('/dashboard/submissions/new');
}
