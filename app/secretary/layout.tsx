'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { OfflineIndicator } from '@/components/shared/OfflineIndicator';
import { Loader2 } from 'lucide-react';

// Enhanced color system
const colors = {
  darkest: '#0F2C59',
  dark: '#1E5AA8',
  base: '#2B6CB0',
  light: '#4299E1',
  lighter: '#63B3ED',
  lightest: '#90CDF4',
  gold: '#D4AF37',
};

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
      <div 
        className="min-h-screen flex items-center justify-center"
        style={{ 
          background: `linear-gradient(180deg, ${colors.darkest} 0%, #1a365d 100%)`
        }}
      >
        <div 
          className="p-8 rounded-2xl flex flex-col items-center gap-4"
          style={{ 
            background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
            boxShadow: '0 12px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
          }}
        >
          <Loader2 className="h-10 w-10 animate-spin" style={{ color: colors.gold }} />
          <p className="text-white font-medium">Loading Secretary Dashboard...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || (user?.role !== 'secretary' && user?.role !== 'admin')) {
    return null;
  }

  return (
    <div 
      className="min-h-screen"
      style={{ 
        background: `linear-gradient(180deg, ${colors.darkest} 0%, #1a365d 100%)`
      }}
    >
      <OfflineIndicator />
      {children}
    </div>
  );
}
