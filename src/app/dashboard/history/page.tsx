import { redirect } from 'next/navigation';

export default function HistoryPage() {
  // Redirect to main dashboard since history is shown there
  redirect('/dashboard');
}
