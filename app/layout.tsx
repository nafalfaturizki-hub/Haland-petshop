import './globals.css';
import type { Metadata } from 'next';
import { auth } from '@/lib/auth';
import { AuthSessionProvider } from '@/components/shared/auth-session-provider';
import { Toaster } from 'sonner';

export const metadata: Metadata = {
  title: 'Haland Petcare',
  description: 'Haland Petcare foundation setup',
};

export default async function RootLayout({ children }: { children: React.ReactNode }) {
  const session = await auth();

  return (
    <html lang="en">
      <body>
        <AuthSessionProvider session={session}>
          {children}
          <Toaster richColors position="top-right" />
        </AuthSessionProvider>
      </body>
    </html>
  );
}
