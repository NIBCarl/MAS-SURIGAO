'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { Loader2 } from 'lucide-react';

export default function SecretaryLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const { user, loading, isAuthenticated } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !isAuthenticated) {
      router.push('/auth/login');
    }
    if (!loading && user?.role !== 'secretary' && user?.role !== 'admin') {
      if (user?.role === 'member') {
        router.push('/member/qr');
      }
    }
  }, [user, loading, isAuthenticated, router]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#FDF8F3]">
        <Loader2 className="h-8 w-8 animate-spin text-[#1E5AA8]" />
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'secretary' && user?.role !== 'admin')) {
    return null;
  }

  return (
    <div className="min-h-screen bg-[#FDF8F3]">
      <OfflineIndicator />
      <main className="pt-8">{children}</main>
    </div>
  );
}
