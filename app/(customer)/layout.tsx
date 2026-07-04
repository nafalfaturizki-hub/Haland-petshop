import { redirect } from 'next/navigation';
import { auth } from '@/lib/auth';
import { PortalNav } from '@/components/layout/portal-nav';
import { Navbar } from '@/components/layout/navbar';
import { isCustomerRole } from '@/lib/permissions';

export default async function CustomerLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();
  const role = (session?.user as { role?: string } | undefined)?.role;

  if (!session?.user?.id) {
    redirect('/login');
  }

  if (!isCustomerRole(role as any)) {
    redirect('/dashboard');
  }

  if ((session.user as { mustChangePin?: boolean }).mustChangePin) {
    redirect('/change-pin');
  }

  return (
    <div className="min-h-screen bg-[#fafafa] text-zinc-900">
      <div className="mx-auto flex min-h-screen max-w-6xl flex-col">
        <Navbar />
        <main className="flex-1 px-4 pb-24 pt-2 sm:px-6">{children}</main>
        <PortalNav />
      </div>
    </div>
  );
}
