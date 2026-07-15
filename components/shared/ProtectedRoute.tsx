'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { usePermissions } from '@/hooks/use-permissions';
import type { ModuleName, PermissionAction } from '@/lib/permissions';

export function ProtectedRoute({ children, module, action = 'read' }: { children: React.ReactNode; module: ModuleName; action?: PermissionAction }) {
  const { canPerform, isLoading, isAuthenticated } = usePermissions();
  const router = useRouter();

  useEffect(() => {
    if (isLoading) {
      return;
    }

    if (!isAuthenticated) {
      router.replace('/login');
      return;
    }

    if (!canPerform(module, action)) {
      router.replace('/dashboard?unauthorized=1');
    }
  }, [action, canPerform, isAuthenticated, isLoading, module, router]);

  if (isLoading) {
    return null;
  }

  if (!isAuthenticated || !canPerform(module, action)) {
    return null;
  }

  return <>{children}</>;
}
