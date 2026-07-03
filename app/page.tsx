import { redirect } from 'next/navigation';
import { auth } from '../lib/auth';
import { getDefaultRedirectPath } from '@/lib/permissions';

export default async function HomePage() {
  const session = await auth();

  if (!session) {
    redirect('/login');
  }

  const role = (session.user as { role?: string } | undefined)?.role;

  redirect(getDefaultRedirectPath(role));
}
