'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { AlertCircle, Loader2 } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';

export default function LoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const { signIn, loading, error, getRedirectPath } = useAuth();
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    const result = await signIn(email, password);

    if (result.success && result.profile) {
      // Redirect based on role from the returned profile (not stale state)
      window.location.href = getRedirectPath(result.profile.role);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#FDF8F3] p-4">
      <Card className="w-full max-w-md border-[#D4AF37]/20">
        <CardHeader className="text-center space-y-2">
          <div className="mx-auto w-16 h-16 rounded-full bg-[#1E5AA8] flex items-center justify-center mb-4">
            <span className="text-2xl font-bold text-white">MAS</span>
          </div>
          <CardTitle className="text-2xl text-[#0F2C59]">
            MAS-AMICUS
          </CardTitle>
          <CardDescription className="text-[#0F2C59]/70">
            Attendance Tracking System
          </CardDescription>
        </CardHeader>

        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <Alert variant="destructive" className="bg-red-50 border-red-200">
                <AlertCircle className="h-4 w-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-[#0F2C59]">
                Email
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="Enter your email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                className="border-[#1E5AA8]/20 focus:border-[#1E5AA8] focus:ring-[#1E5AA8]"
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-[#0F2C59]">
                Password
              </Label>
              <Input
                id="password"
                type="password"
                placeholder="Enter your password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                className="border-[#1E5AA8]/20 focus:border-[#1E5AA8] focus:ring-[#1E5AA8]"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full bg-[#1E5AA8] hover:bg-[#154785] text-white"
            >
              {loading ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Signing in...
                </>
              ) : (
                'Sign In'
              )}
            </Button>
          </form>

          <div className="mt-6 text-center text-sm text-[#0F2C59]/60">
            <p>First time? Contact your secretary for account setup.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
