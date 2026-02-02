'use client';

import { useEffect, useState } from 'react';
import Image from 'next/image';
import { QRCodeSVG } from 'qrcode.react';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Download, Share2, User, Calendar, Clock } from 'lucide-react';
import db from '@/lib/db';
import { AttendanceStats } from '@/types';
import Link from 'next/link';

export default function MemberQRPage() {
  const { user } = useAuth();
  const [stats, setStats] = useState<AttendanceStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (user?.id) {
      loadStats();
    }
  }, [user]);

  const loadStats = async () => {
    try {
      const memberStats = await db.calculateMemberStats(user!.id);
      setStats({
        ...memberStats,
        excused: 0,
        absent: memberStats.totalEvents - memberStats.attended,
        currentStreak: 0,
        longestStreak: 0,
      });
    } catch (error) {
      console.error('Error loading stats:', error);
    } finally {
      setLoading(false);
    }
  };

  const downloadQR = () => {
    const svg = document.getElementById('member-qr-code') as HTMLElement;
    if (!svg) return;

    const svgData = new XMLSerializer().serializeToString(svg);
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    const img = new window.Image();

    img.onload = () => {
      canvas.width = img.width;
      canvas.height = img.height;
      ctx?.drawImage(img, 0, 0);
      const pngFile = canvas.toDataURL('image/png');
      const downloadLink = document.createElement('a');
      downloadLink.download = `mas-amicus-qr-${user?.full_name}.png`;
      downloadLink.href = pngFile;
      downloadLink.click();
    };

    img.src = 'data:image/svg+xml;base64,' + btoa(svgData);
  };

  const shareQR = async () => {
    if (navigator.share) {
      try {
        await navigator.share({
          title: 'My MAS-AMICUS QR Code',
          text: `QR Code for ${user?.full_name}`,
        });
      } catch (error) {
        console.log('Error sharing:', error);
      }
    }
  };

  const getStatusColor = (status?: string) => {
    switch (status) {
      case 'active':
        return 'bg-green-100 text-green-800 border-green-300';
      case 'irregular':
        return 'bg-yellow-100 text-yellow-800 border-yellow-300';
      case 'at-risk':
        return 'bg-orange-100 text-orange-800 border-orange-300';
      default:
        return 'bg-gray-100 text-gray-800 border-gray-300';
    }
  };

  return (
    <div className="max-w-md mx-auto px-4 pb-8">
      {/* Header */}
      <div className="text-center mb-6">
        <div className="mx-auto mb-3">
          <Image
            src="/mas-logo.jpg"
            alt="MAS-AMICUS Logo"
            width={80}
            height={80}
            className="mx-auto rounded-full"
          />
        </div>
        <h1 className="text-xl font-bold text-[#0F2C59]">{user?.full_name}</h1>
        <Badge variant="outline" className={`mt-2 ${getStatusColor(user?.status)}`}>
          {user?.status === 'active' ? 'Active Member' : user?.status}
        </Badge>
      </div>

      {/* QR Code Card */}
      <Card className="border-[#D4AF37]/30 shadow-lg mb-6">
        <CardHeader className="bg-gradient-to-r from-[#1E5AA8] to-[#154785] text-white rounded-t-lg">
          <CardTitle className="text-center text-lg">My QR Code</CardTitle>
        </CardHeader>
        <CardContent className="p-8">
          <div className="flex justify-center mb-6">
            {user?.qr_code && (
              <div className="p-4 bg-white rounded-xl shadow-inner border-2 border-[#D4AF37]/20">
                <QRCodeSVG
                  id="member-qr-code"
                  value={user.qr_code}
                  size={200}
                  level="H"
                  includeMargin={true}
                  fgColor="#0F2C59"
                  bgColor="#FFFFFF"
                />
              </div>
            )}
          </div>

          <div className="flex gap-3">
            <Button
              onClick={downloadQR}
              className="flex-1 bg-[#1E5AA8] hover:bg-[#154785]"
            >
              <Download className="w-4 h-4 mr-2" />
              Save
            </Button>
            <Button
              onClick={shareQR}
              variant="outline"
              className="flex-1 border-[#D4AF37] text-[#B8860B] hover:bg-[#D4AF37]/10"
            >
              <Share2 className="w-4 h-4 mr-2" />
              Share
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* Stats Card */}
      <Card className="border-[#D4AF37]/20">
        <CardHeader>
          <CardTitle className="text-[#0F2C59] flex items-center gap-2">
            <Calendar className="w-5 h-5 text-[#D4AF37]" />
            My Stats
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="text-center py-4 text-[#0F2C59]/60">Loading...</div>
          ) : stats ? (
            <div className="space-y-4">
              {/* Punctuality Ring */}
              <div className="flex items-center justify-center py-4">
                <div className="relative w-32 h-32">
                  <svg className="w-full h-full transform -rotate-90">
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke="#E5E7EB"
                      strokeWidth="12"
                      fill="none"
                    />
                    <circle
                      cx="64"
                      cy="64"
                      r="56"
                      stroke={stats.punctualityRate >= 80 ? '#10B981' : stats.punctualityRate >= 60 ? '#D4AF37' : '#EF4444'}
                      strokeWidth="12"
                      fill="none"
                      strokeDasharray={`${(stats.punctualityRate / 100) * 351.86} 351.86`}
                      strokeLinecap="round"
                      className="transition-all duration-1000"
                    />
                  </svg>
                  <div className="absolute inset-0 flex flex-col items-center justify-center">
                    <span className="text-2xl font-bold text-[#0F2C59]">{stats.punctualityRate}%</span>
                    <span className="text-xs text-[#0F2C59]/60">Punctuality</span>
                  </div>
                </div>
              </div>

              {/* Stats Grid */}
              <div className="grid grid-cols-3 gap-4 text-center">
                <div className="bg-green-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-green-700">{stats.early}</div>
                  <div className="text-xs text-green-600">Early</div>
                </div>
                <div className="bg-blue-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-blue-700">{stats.onTime}</div>
                  <div className="text-xs text-blue-600">On-time</div>
                </div>
                <div className="bg-yellow-50 rounded-lg p-3">
                  <div className="text-lg font-bold text-yellow-700">{stats.late}</div>
                  <div className="text-xs text-yellow-600">Late</div>
                </div>
              </div>

              {/* Total */}
              <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                <div className="flex items-center gap-2 text-[#0F2C59]">
                  <Clock className="w-4 h-4 text-[#D4AF37]" />
                  <span>Total Attendance</span>
                </div>
                <span className="font-bold text-[#1E5AA8]">{stats.attended}/{stats.totalEvents}</span>
              </div>
            </div>
          ) : (
            <div className="text-center py-4 text-[#0F2C59]/60">
              No attendance data yet
            </div>
          )}
        </CardContent>
      </Card>

      {/* View Full Stats Link */}
      <div className="mt-4 text-center">
        <Link
          href="/member/stats"
          className="text-[#1E5AA8] hover:text-[#154785] text-sm underline"
        >
          View Full Statistics →
        </Link>
      </div>
    </div>
  );
}
