'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import Image from 'next/image';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@/hooks/useAuth';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Camera, Plus, Users, Check, AlertCircle, WifiOff, CalendarPlus, Calendar, ClipboardList, QrCode, UserPlus, TrendingUp, X } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import db from '@/lib/db';
import syncEngine from '@/lib/sync/engine';
import { supabase } from '@/lib/supabase';
import { processCheckIn, generateQRCode, playCheckInSound, formatCheckInTime } from '@/lib/utils/checkin';
import { Member, Event, Attendance, CheckInResult } from '@/types';
import { IScannerControls } from '@zxing/browser';
import { CreateEventDialog } from '@/components/secretary/CreateEventDialog';
import { AttendanceList } from '@/components/secretary/AttendanceList';
import { EventManagement } from '@/components/secretary/EventManagement';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { RefreshCw, CloudOff, Cloud } from 'lucide-react';

// Enhanced Color System - 6 shades with proper hierarchy
const colors = {
  // Darkest - Page background
  darkest: '#0F2C59',
  // Dark - Cards/containers  
  dark: '#1E5AA8',
  // Base - Default surfaces
  base: '#2B6CB0',
  // Light - Interactive elements
  light: '#4299E1',
  // Lighter - Elevated elements
  lighter: '#63B3ED',
  // Lightest - Highlights
  lightest: '#90CDF4',
  // Gold accent
  gold: '#D4AF37',
  goldDark: '#B8860B',
  // Semantic
  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
};

export default function SecretaryCheckInPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('scan');
  const [isScanning, setIsScanning] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [members, setMembers] = useState<Member[]>([]);
  const [filteredMembers, setFilteredMembers] = useState<Member[]>([]);
  const [todayEvent, setTodayEvent] = useState<Event | null>(null);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [selectedEventId, setSelectedEventId] = useState<string | null>(null);
  const [todayAttendance, setTodayAttendance] = useState<Attendance[]>([]);
  const [checkInResult, setCheckInResult] = useState<CheckInResult | null>(null);
  const [showResult, setShowResult] = useState(false);
  const [isOnline, setIsOnline] = useState(true);
  const [isSyncing, setIsSyncing] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const codeReader = useRef<BrowserMultiFormatReader | null>(null);
  const stopScanRef = useRef<IScannerControls | null>(null);

  // New member form state
  const [newMember, setNewMember] = useState({
    full_name: '',
    phone: '',
    email: '',
  });
  const [generatedQR, setGeneratedQR] = useState<string | null>(null);
  const [showCreateEventDialog, setShowCreateEventDialog] = useState(false);

  // Load initial data
  useEffect(() => {
    loadData();
    setIsOnline(syncEngine.isOnline());

    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const loadData = async () => {
    // Load members
    const allMembers = await db.members.toArray();
    setMembers(allMembers);
    setFilteredMembers(allMembers);

    // Load all events (most recent first)
    const events = await db.events.orderBy('event_date').reverse().toArray();
    setAllEvents(events);

    // Load today's event or use selected event
    const todayEvt = await db.getTodayEvent();

    // If we have a selected event, use that, otherwise use today's event
    const activeEvent = selectedEventId
      ? events.find(e => e.id === selectedEventId || e.localId?.toString() === selectedEventId) || todayEvt
      : todayEvt;

    setTodayEvent(activeEvent || null);
    if (!selectedEventId && activeEvent) {
      setSelectedEventId(activeEvent.id || activeEvent.localId?.toString() || null);
    }

    // Load attendance for active event (use either server ID or local ID)
    if (activeEvent) {
      const eventId = activeEvent.id || `local-${activeEvent.localId}`;
      const attendance = await db.getEventAttendance(eventId, activeEvent.localId);
      setTodayAttendance(attendance);
    } else {
      setTodayAttendance([]);
    }

  };

  const handleManualSync = async () => {
    if (!isOnline) return;

    setIsSyncing(true);
    try {
      await syncEngine.sync();
      await loadData();
    } catch (error) {
      console.error('Manual sync failed:', error);
    } finally {
      setIsSyncing(false);
    }
  };

  // Search members
  useEffect(() => {
    if (searchQuery) {
      const filtered = members.filter(
        (m) =>
          m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
          m.phone.includes(searchQuery)
      );
      setFilteredMembers(filtered);
    } else {
      setFilteredMembers(members);
    }
  }, [searchQuery, members]);

  // Start QR scanning
  const startScanning = useCallback(async () => {
    if (!videoRef.current) return;

    setIsScanning(true);
    codeReader.current = new BrowserMultiFormatReader();

    try {
      const result = await codeReader.current.decodeFromVideoDevice(
        undefined,
        videoRef.current,
        (result, error) => {
          if (result) {
            const qrCode = result.getText();
            handleQRScan(qrCode);
          }
        }
      );
      stopScanRef.current = result;
    } catch (err) {
      console.error('Error starting scanner:', err);
    }
  }, []);

  // Stop QR scanning
  const stopScanning = useCallback(() => {
    if (stopScanRef.current) {
      stopScanRef.current.stop();
      stopScanRef.current = null;
    }
    codeReader.current = null;
    setIsScanning(false);
  }, []);

  // Handle QR scan
  const handleQRScan = async (qrCode: string) => {
    stopScanning();

    const member = await db.getMemberByQR(qrCode);
    if (!member) {
      setCheckInResult({
        success: false,
        message: 'QR code not recognized',
      });
      setShowResult(true);
      return;
    }

    await processMemberCheckIn(member);
  };

  // Process check-in for a member
  const processMemberCheckIn = async (member: Member) => {
    if (!todayEvent) {
      setCheckInResult({
        success: false,
        message: 'No active event today',
      });
      setShowResult(true);
      return;
    }

    // Check if already checked in
    const existingCheckIn = await db.hasCheckedIn(
      member.id || `local-${member.localId}`,
      todayEvent.id || `local-${todayEvent.localId}`
    );

    if (existingCheckIn) {
      setCheckInResult({
        success: false,
        alreadyCheckedIn: true,
        previousCheckIn: formatCheckInTime(existingCheckIn.check_in_at),
        message: `Already checked in at ${formatCheckInTime(existingCheckIn.check_in_at)}`,
      });
      setShowResult(true);
      return;
    }

    // Process check-in
    const eventStart = new Date(`${todayEvent.event_date}T${todayEvent.start_time}`);
    const result = processCheckIn({
      member,
      eventStartTime: eventStart,
    });

    if (result.success && result.status) {
      // Save to local DB
      const now = new Date().toISOString();
      const attendance: Attendance = {
        member_id: member.id || '',
        member_local_id: member.localId,
        event_id: todayEvent.id || '',
        event_local_id: todayEvent.localId,
        check_in_at: now,
        status: result.status,
        method: 'qr-scan',
        recorded_by: user?.id,
        created_at: now,
        updated_at: now,
        syncStatus: 'pending',
      };

      const localId = await db.attendance.add(attendance);

      // Add to sync queue
      await db.addToSyncQueue('attendance', 'create', { ...attendance, localId });

      // Update today's attendance
      setTodayAttendance((prev) => [...prev, { ...attendance, localId }]);

      // Play sound
      playCheckInSound(result.status);
    }

    setCheckInResult(result);
    setShowResult(true);

    // Auto-hide result after 3 seconds
    setTimeout(() => {
      setShowResult(false);
    }, 3000);
  };

  // Manual check-in for a member
  const handleManualCheckIn = async (member: Member) => {
    await processMemberCheckIn(member);
  };

  // Mark member as absent
  const handleMarkAbsent = async (member: Member) => {
    if (!todayEvent) {
      setCheckInResult({
        success: false,
        message: 'No active event today',
      });
      setShowResult(true);
      return;
    }

    // Check if already has attendance record
    const existingCheckIn = await db.hasCheckedIn(
      member.id || `local-${member.localId}`,
      todayEvent.id || `local-${todayEvent.localId}`
    );

    if (existingCheckIn) {
      setCheckInResult({
        success: false,
        alreadyCheckedIn: true,
        previousCheckIn: formatCheckInTime(existingCheckIn.check_in_at),
        message: `Already recorded at ${formatCheckInTime(existingCheckIn.check_in_at)}`,
      });
      setShowResult(true);
      return;
    }

    // Create absent attendance record
    const now = new Date().toISOString();
    const attendance: Attendance = {
      member_id: member.id || '',
      member_local_id: member.localId,
      event_id: todayEvent.id || '',
      event_local_id: todayEvent.localId,
      check_in_at: now,
      status: 'absent',
      method: 'manual',
      notes: 'Marked absent by secretary',
      recorded_by: user?.id,
      created_at: now,
      updated_at: now,
      syncStatus: 'pending',
    };

    const localId = await db.attendance.add(attendance);
    await db.addToSyncQueue('attendance', 'create', { ...attendance, localId });
    setTodayAttendance((prev) => [...prev, { ...attendance, localId }]);

    setCheckInResult({
      success: true,
      member,
      status: 'absent',
      message: `${member.full_name} - Marked as Absent`,
    });
    setShowResult(true);

    // Auto-hide result after 3 seconds
    setTimeout(() => {
      setShowResult(false);
    }, 3000);
  };

  // Create new member
  const handleCreateMember = async () => {
    const qrCode = generateQRCode();

    const member: Member = {
      full_name: newMember.full_name,
      phone: newMember.phone,
      email: newMember.email || undefined,
      qr_code: qrCode,
      role: 'member',
      status: 'inactive',
      registered_by: user?.id,
      syncStatus: 'pending',
    };

    const localId = await db.members.add(member);
    await db.addToSyncQueue('members', 'create', { ...member, localId });

    setGeneratedQR(qrCode);

    // Refresh member list
    await loadData();

    // Reset form
    setNewMember({ full_name: '', phone: '', email: '' });
  };

  // Create new event
  const handleCreateEvent = async (eventData: {
    title: string;
    event_date: string;
    start_time: string;
    location?: string;
  }) => {
    const event: Event = {
      ...eventData,
      status: 'active',
      created_by: user?.id,
      syncStatus: 'pending',
    };

    // Save to local DB
    const localId = await db.events.add(event);

    // Add to sync queue
    await db.addToSyncQueue('events', 'create', { ...event, localId });

    // Try to sync immediately if online
    try {
      const { error } = await supabase.from('events').insert({
        title: event.title,
        event_date: event.event_date,
        start_time: event.start_time,
        location: event.location,
        status: event.status,
        created_by: event.created_by,
      });

      if (!error) {
        await db.events.update(localId, { syncStatus: 'synced' });
      }
    } catch (err) {
      console.error('Failed to sync new event:', err);
    }

    // Refresh data to show the new event
    await loadData();
  };

  const presentCount = todayAttendance.length;
  const earlyCount = todayAttendance.filter((a) => a.status === 'early').length;
  const onTimeCount = todayAttendance.filter((a) => a.status === 'on-time').length;
  const lateCount = todayAttendance.filter((a) => a.status === 'late').length;
  const absentCount = todayAttendance.filter((a) => a.status === 'absent').length;

  // Calculate attendance rate
  const attendanceRate = members.length > 0 
    ? Math.round((presentCount / members.length) * 100) 
    : 0;

  return (
    <div className="min-h-screen pb-8" style={{ background: `linear-gradient(180deg, ${colors.darkest} 0%, #1a365d 100%)` }}>
      {/* Enhanced Header with Layering */}
      <header 
        className="sticky top-0 z-40 px-4 py-4 mb-6"
        style={{ 
          background: `linear-gradient(180deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
          boxShadow: '0 4px 20px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.1)'
        }}
      >
        <div className="max-w-5xl mx-auto">
          {/* Top Row: Logo, Title, Counter */}
          <div className="flex items-center justify-between mb-4 gap-3">
            <div className="flex items-center gap-2 sm:gap-3 min-w-0 flex-1">
              <div 
                className="p-1.5 sm:p-2 rounded-xl shrink-0"
                style={{ 
                  background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}
              >
                <Image
                  src="/mas-logo.jpg"
                  alt="MAS-AMICUS"
                  width={36}
                  height={36}
                  className="rounded-lg w-8 h-8 sm:w-10 sm:h-10"
                />
              </div>
              <div className="min-w-0">
                <h1 className="text-lg sm:text-xl lg:text-2xl font-bold text-white whitespace-nowrap">Check-In Hub</h1>
                <p className="text-xs sm:text-sm" style={{ color: colors.lighter }}>Secretary</p>
              </div>
            </div>

            {/* Live Counter Card - Elevated */}
            <div 
              className="flex items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-3 rounded-xl sm:rounded-2xl shrink-0"
              style={{ 
                background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                boxShadow: '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.15)'
              }}
            >
              <div className="text-right">
                <div className="flex items-baseline gap-0.5 sm:gap-1">
                  <span className="text-2xl sm:text-3xl font-bold text-white">{presentCount}</span>
                  <span className="text-sm sm:text-lg text-white/60">/{members.length}</span>
                </div>
                <div className="text-[10px] sm:text-xs text-white/80 font-medium uppercase tracking-wider">Present</div>
              </div>
              <div 
                className="w-9 h-9 sm:w-12 sm:h-12 rounded-lg sm:rounded-xl flex items-center justify-center"
                style={{ 
                  background: 'rgba(255,255,255,0.15)',
                  boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.1)'
                }}
              >
                <TrendingUp className="w-4 h-4 sm:w-6 sm:h-6 text-white" />
              </div>
            </div>
          </div>

          {/* Middle Row: Event Selector & Create Button */}
          <div className="flex flex-col sm:flex-row gap-2 sm:gap-3 mb-4">
            {allEvents.length > 0 ? (
              <Select
                value={selectedEventId || ''}
                onValueChange={(value) => {
                  setSelectedEventId(value);
                  const selected = allEvents.find(e => e.id === value || e.localId?.toString() === value);
                  setTodayEvent(selected || null);
                  if (selected) {
                    const eventId = selected.id || `local-${selected.localId}`;
                    db.getEventAttendance(eventId, selected.localId).then(setTodayAttendance);
                  } else {
                    setTodayAttendance([]);
                  }
                }}
              >
                <SelectTrigger 
                  className="flex-1 h-11 sm:h-12 rounded-xl border-0 text-white text-sm sm:text-base"
                  style={{ 
                    background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)'
                  }}
                >
                  <Calendar className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" style={{ color: colors.gold }} />
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent 
                  className="rounded-xl border-0"
                  style={{ 
                    background: colors.dark,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                  }}
                >
                  {allEvents.map((event) => (
                    <SelectItem
                      key={event.id || event.localId}
                      value={event.id || event.localId?.toString() || ''}
                      className="text-white hover:bg-white/10 rounded-lg"
                    >
                      {event.title} - {event.event_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <div 
                className="flex-1 h-11 sm:h-12 flex items-center px-4 rounded-xl text-white/60 text-sm sm:text-base"
                style={{ background: 'rgba(0,0,0,0.2)' }}
              >
                No events available
              </div>
            )}

            <Button
              onClick={() => setShowCreateEventDialog(true)}
              className="h-11 sm:h-12 px-4 sm:px-6 rounded-xl font-semibold text-white border-0 text-sm sm:text-base"
              style={{ 
                background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                boxShadow: '0 4px 12px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
              }}
            >
              <CalendarPlus className="w-4 h-4 sm:w-5 sm:h-5 mr-2 shrink-0" />
              <span className="hidden sm:inline">Create Event</span>
              <span className="sm:hidden">Create</span>
            </Button>
          </div>

          {/* Bottom Row: Status Pills & Sync */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Status Pills - Light elevated style */}
            <div 
              className="flex flex-wrap items-center gap-2 px-3 py-2 rounded-xl"
              style={{ 
                background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <span className="text-xs font-semibold text-white/80 uppercase tracking-wider mr-1">Status:</span>
              <Badge 
                className="bg-emerald-400/20 text-emerald-100 border-0 font-semibold"
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                Early: {earlyCount}
              </Badge>
              <Badge 
                className="bg-blue-400/20 text-blue-100 border-0 font-semibold"
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                On-time: {onTimeCount}
              </Badge>
              <Badge 
                className="bg-amber-400/20 text-amber-100 border-0 font-semibold"
                style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
              >
                Late: {lateCount}
              </Badge>
              {absentCount > 0 && (
                <Badge 
                  className="bg-red-400/20 text-red-100 border-0 font-semibold"
                  style={{ boxShadow: '0 2px 4px rgba(0,0,0,0.1)' }}
                >
                  Absent: {absentCount}
                </Badge>
              )}
            </div>

            <div className="flex-1" />

            {/* Sync Button - Dark recessed style */}
            <Button
              variant="outline"
              size="sm"
              onClick={handleManualSync}
              disabled={!isOnline || isSyncing}
              className={`h-10 px-4 rounded-xl border-0 text-white transition-all ${
                isSyncing ? 'animate-pulse' : ''
              } ${!isOnline ? 'opacity-50' : ''}`}
              style={{ 
                background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)'
              }}
            >
              {isSyncing ? (
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
              ) : isOnline ? (
                <Cloud className="w-4 h-4 mr-2" style={{ color: colors.lighter }} />
              ) : (
                <CloudOff className="w-4 h-4 mr-2 text-gray-400" />
              )}
              <span className="hidden sm:inline">
                {isSyncing ? 'Syncing...' : isOnline ? 'Sync Now' : 'Offline'}
              </span>
            </Button>

            {!isOnline && (
              <Badge 
                variant="outline" 
                className="h-10 px-3 rounded-xl border-amber-400/50 text-amber-300 bg-amber-400/10"
              >
                <WifiOff className="w-4 h-4 mr-2" />
                <span className="hidden sm:inline">Offline Mode</span>
              </Badge>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-4">
        {/* Check-in Result Overlay */}
        {showResult && checkInResult && (
          <div
            className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${
              checkInResult.success 
                ? 'bg-emerald-500/95' 
                : checkInResult.alreadyCheckedIn 
                  ? 'bg-amber-500/95' 
                  : 'bg-red-500/95'
            }`}
            onClick={() => setShowResult(false)}
          >
            <div
              className="rounded-3xl p-8 text-center max-w-sm w-full animate-check-in relative"
              style={{ 
                background: `linear-gradient(145deg, ${colors.lightest} 0%, white 100%)`,
                boxShadow: '0 20px 60px rgba(0,0,0,0.3), inset 0 1px 0 rgba(255,255,255,0.5)'
              }}
              onClick={(e) => e.stopPropagation()}
            >
              {/* Close Button */}
              <button
                onClick={() => setShowResult(false)}
                className="absolute top-4 right-4 w-10 h-10 rounded-full flex items-center justify-center transition-colors"
                style={{ 
                  background: colors.darkest,
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2)'
                }}
                aria-label="Close"
              >
                <svg xmlns="http://www.w3.org/2000/svg" width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round">
                  <line x1="18" y1="6" x2="6" y2="18" />
                  <line x1="6" y1="6" x2="18" y2="18" />
                </svg>
              </button>

              <div 
                className="w-24 h-24 rounded-2xl mx-auto mb-6 flex items-center justify-center"
                style={{ 
                  background: checkInResult.success 
                    ? `linear-gradient(145deg, #10B981 0%, #059669 100%)`
                    : checkInResult.alreadyCheckedIn
                      ? `linear-gradient(145deg, #F59E0B 0%, #D97706 100%)`
                      : `linear-gradient(145deg, #EF4444 0%, #DC2626 100%)`,
                  boxShadow: '0 8px 24px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.3)'
                }}
              >
                {checkInResult.success ? (
                  <Check className="w-12 h-12 text-white" />
                ) : (
                  <AlertCircle className="w-12 h-12 text-white" />
                )}
              </div>
              
              <h2 className="text-2xl font-bold mb-2" style={{ color: colors.darkest }}>
                {checkInResult.success ? 'Success!' : checkInResult.alreadyCheckedIn ? 'Already Checked In' : 'Error'}
              </h2>
              <p className="text-lg" style={{ color: colors.dark }}>{checkInResult.message}</p>
            </div>
          </div>
        )}

        {/* Enhanced Tabs with Better Styling */}
        <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
          <TabsList 
            className="grid w-full grid-cols-5 h-16 p-1.5 rounded-2xl border-0"
            style={{ 
              background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
              boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3), 0 1px 0 rgba(255,255,255,0.05)'
            }}
          >
            {[
              { value: 'scan', icon: Camera, label: 'Scan' },
              { value: 'search', icon: Search, label: 'Search' },
              { value: 'add', icon: UserPlus, label: 'Add' },
              { value: 'attendance', icon: ClipboardList, label: 'List' },
              { value: 'events', icon: Calendar, label: 'Events' },
            ].map((tab) => (
              <TabsTrigger
                key={tab.value}
                value={tab.value}
                className="rounded-xl transition-all duration-200 data-[state=active]:shadow-lg"
                style={{ 
                  color: colors.lighter,
                }}
                data-state-active-style={{
                  background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                  color: 'white',
                  boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                }}
              >
                <tab.icon className="w-5 h-5 sm:mr-2" />
                <span className="hidden sm:inline text-sm font-semibold">{tab.label}</span>
              </TabsTrigger>
            ))}
          </TabsList>

          {/* Scan Tab - Enhanced */}
          <TabsContent value="scan">
            <div 
              className="rounded-3xl overflow-hidden"
              style={{ 
                background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div className="p-6 sm:p-8">
                {isScanning ? (
                  <div className="space-y-6">
                    <div 
                      className="relative aspect-video rounded-2xl overflow-hidden"
                      style={{ 
                        background: '#000',
                        boxShadow: 'inset 0 4px 20px rgba(0,0,0,0.5)'
                      }}
                    >
                      <video ref={videoRef} className="w-full h-full object-cover" />
                      {/* Scanner frame overlay */}
                      <div 
                        className="absolute inset-8 border-2 rounded-2xl pointer-events-none"
                        style={{ 
                          borderColor: colors.gold,
                          boxShadow: '0 0 0 4px rgba(212,175,55,0.2), inset 0 0 20px rgba(212,175,55,0.1)'
                        }}
                      >
                        {/* Corner markers */}
                        <div className="absolute top-0 left-0 w-8 h-8 border-t-4 border-l-4 border-white -mt-1 -ml-1" />
                        <div className="absolute top-0 right-0 w-8 h-8 border-t-4 border-r-4 border-white -mt-1 -mr-1" />
                        <div className="absolute bottom-0 left-0 w-8 h-8 border-b-4 border-l-4 border-white -mb-1 -ml-1" />
                        <div className="absolute bottom-0 right-0 w-8 h-8 border-b-4 border-r-4 border-white -mb-1 -mr-1" />
                      </div>
                    </div>
                    <Button
                      onClick={stopScanning}
                      className="w-full h-14 rounded-xl font-semibold text-white border-0"
                      style={{ 
                        background: `linear-gradient(145deg, ${colors.error} 0%, #DC2626 100%)`,
                        boxShadow: '0 4px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                      }}
                    >
                      Stop Scanning
                    </Button>
                  </div>
                ) : (
                  <div className="text-center py-12 sm:py-16">
                    <div 
                      className="w-28 h-28 rounded-3xl flex items-center justify-center mx-auto mb-8"
                      style={{ 
                        background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                      }}
                    >
                      <QrCode className="w-14 h-14 text-white" />
                    </div>
                    <h3 className="text-2xl sm:text-3xl font-bold text-white mb-3">
                      QR Scanner
                    </h3>
                    <p className="text-lg mb-8" style={{ color: colors.lighter }}>
                      Point camera at member&apos;s QR code to check in
                    </p>
                    <Button
                      onClick={startScanning}
                      className="h-14 px-10 rounded-xl font-semibold text-white text-lg border-0"
                      style={{ 
                        background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                        boxShadow: '0 8px 24px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                      }}
                    >
                      <Camera className="w-6 h-6 mr-3" />
                      Start Scanning
                    </Button>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Search Tab - Enhanced */}
          <TabsContent value="search">
            <div 
              className="rounded-3xl overflow-hidden"
              style={{ 
                background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                    }}
                  >
                    <Users className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Find Member</h2>
                    <p className="text-sm" style={{ color: colors.lighter }}>Search by name or phone number</p>
                  </div>
                </div>

                {/* Search Input - Recessed style */}
                <div className="relative mb-6">
                  <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5" style={{ color: colors.lighter }} />
                  <Input
                    placeholder="Search members..."
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    className="h-14 pl-12 rounded-xl border-0 text-white text-lg"
                    style={{ 
                      background: `linear-gradient(145deg, ${colors.darkest} 0%, #0a1f3d 100%)`,
                      boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)'
                    }}
                  />
                </div>

                {/* Member List */}
                <div className="space-y-3 max-h-96 overflow-y-auto pr-2">
                  {filteredMembers.length === 0 ? (
                    <div className="text-center py-8" style={{ color: colors.lighter }}>
                      <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
                      <p>No members found</p>
                    </div>
                  ) : (
                    filteredMembers.map((member) => {
                      const isCheckedIn = todayAttendance.some(
                        (a) => a.member_id === member.id || a.member_local_id === member.localId
                      );

                      return (
                        <div
                          key={member.localId}
                          className="flex flex-col sm:flex-row sm:items-center justify-between p-4 rounded-xl transition-all gap-3"
                          style={{ 
                            background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                            boxShadow: '0 4px 12px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.1)'
                          }}
                        >
                          {/* Member Info - Always visible */}
                          <div className="flex items-center gap-3 sm:gap-4 min-w-0 flex-1">
                            <div 
                              className="w-10 h-10 sm:w-12 sm:h-12 rounded-xl flex items-center justify-center text-lg sm:text-xl font-bold shrink-0"
                              style={{ 
                                background: 'rgba(255,255,255,0.15)',
                                color: 'white'
                              }}
                            >
                              {member.full_name.charAt(0).toUpperCase()}
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="font-semibold text-white text-base sm:text-lg truncate">{member.full_name}</div>
                              <div className="text-xs sm:text-sm truncate" style={{ color: colors.lighter }}>{member.phone}</div>
                            </div>
                          </div>
                          
                          {/* Action Button/Badge - Full width on mobile, auto on desktop */}
                          {isCheckedIn ? (
                            <Badge 
                              className="h-10 px-4 rounded-lg text-sm font-semibold border-0 w-full sm:w-auto justify-center"
                              style={{ 
                                background: 'rgba(16,185,129,0.2)',
                                color: '#10B981',
                                boxShadow: '0 2px 8px rgba(16,185,129,0.2)'
                              }}
                            >
                              <Check className="w-4 h-4 mr-2 shrink-0" />
                              <span className="hidden sm:inline">Checked In</span>
                              <span className="sm:hidden">Checked</span>
                            </Badge>
                          ) : (
                            <div className="flex gap-2 w-full sm:w-auto">
                              <Button
                                size="sm"
                                onClick={() => handleManualCheckIn(member)}
                                className="h-10 px-4 rounded-lg font-semibold text-white border-0 flex-1 sm:flex-none"
                                style={{ 
                                  background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                                  boxShadow: '0 4px 12px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                                }}
                              >
                                <span className="hidden sm:inline">Check In</span>
                                <span className="sm:hidden">Check In</span>
                              </Button>
                              <Button
                                size="sm"
                                onClick={() => handleMarkAbsent(member)}
                                className="h-10 px-3 rounded-lg font-semibold border-0 text-white flex-none"
                                style={{ 
                                  background: `linear-gradient(145deg, ${colors.error} 0%, #DC2626 100%)`,
                                  boxShadow: '0 4px 12px rgba(239,68,68,0.3), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                              >
                                <span className="hidden sm:inline">Absent</span>
                                <span className="sm:hidden">✕</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })
                  )}
                </div>
              </div>
            </div>
          </TabsContent>

          {/* Add Member Tab - Enhanced */}
          <TabsContent value="add">
            <div 
              className="rounded-3xl overflow-hidden"
              style={{ 
                background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
              }}
            >
              <div className="p-6 sm:p-8">
                <div className="flex items-center gap-3 mb-6">
                  <div 
                    className="w-12 h-12 rounded-xl flex items-center justify-center"
                    style={{ 
                      background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                      boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                    }}
                  >
                    <UserPlus className="w-6 h-6 text-white" />
                  </div>
                  <div>
                    <h2 className="text-xl font-bold text-white">Quick Add Member</h2>
                    <p className="text-sm" style={{ color: colors.lighter }}>Register new member and generate QR</p>
                  </div>
                </div>

                {!generatedQR ? (
                  <div className="space-y-5">
                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white/80 uppercase tracking-wider">Full Name *</label>
                      <Input
                        value={newMember.full_name}
                        onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                        placeholder="Enter full name"
                        className="h-14 rounded-xl border-0 text-white text-lg"
                        style={{ 
                          background: `linear-gradient(145deg, ${colors.darkest} 0%, #0a1f3d 100%)`,
                          boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)'
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white/80 uppercase tracking-wider">Phone *</label>
                      <Input
                        value={newMember.phone}
                        onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                        placeholder="09XX XXX XXXX"
                        className="h-14 rounded-xl border-0 text-white text-lg"
                        style={{ 
                          background: `linear-gradient(145deg, ${colors.darkest} 0%, #0a1f3d 100%)`,
                          boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)'
                        }}
                      />
                    </div>

                    <div className="space-y-2">
                      <label className="text-sm font-semibold text-white/80 uppercase tracking-wider">Email (Optional)</label>
                      <Input
                        type="email"
                        value={newMember.email}
                        onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                        placeholder="email@example.com"
                        className="h-14 rounded-xl border-0 text-white text-lg"
                        style={{ 
                          background: `linear-gradient(145deg, ${colors.darkest} 0%, #0a1f3d 100%)`,
                          boxShadow: 'inset 0 3px 6px rgba(0,0,0,0.4), 0 1px 0 rgba(255,255,255,0.05)'
                        }}
                      />
                    </div>

                    <Button
                      onClick={handleCreateMember}
                      disabled={!newMember.full_name || !newMember.phone}
                      className="w-full h-14 rounded-xl font-semibold text-white text-lg border-0 disabled:opacity-50"
                      style={{ 
                        background: `linear-gradient(145deg, ${colors.gold} 0%, ${colors.goldDark} 100%)`,
                        boxShadow: '0 8px 24px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                      }}
                    >
                      <QrCode className="w-6 h-6 mr-3" />
                      Generate QR Code
                    </Button>
                  </div>
                ) : (
                  <div className="text-center space-y-6">
                    <Alert 
                      className="rounded-xl border-0"
                      style={{ 
                        background: 'rgba(16,185,129,0.15)',
                        boxShadow: '0 4px 12px rgba(16,185,129,0.1)'
                      }}
                    >
                      <Check className="h-5 w-5 text-emerald-400" />
                      <AlertDescription className="text-emerald-100 font-medium">
                        Member created successfully!
                      </AlertDescription>
                    </Alert>

                    <div 
                      className="p-6 rounded-2xl inline-block"
                      style={{ 
                        background: `linear-gradient(145deg, ${colors.lightest} 0%, white 100%)`,
                        boxShadow: '0 12px 32px rgba(0,0,0,0.15), inset 0 1px 0 rgba(255,255,255,0.5)'
                      }}
                    >
                      <div 
                        className="w-48 h-48 rounded-xl flex items-center justify-center text-gray-400"
                        style={{ background: '#f3f4f6' }}
                      >
                        QR: {generatedQR.slice(0, 8)}...
                      </div>
                    </div>

                    <div className="flex gap-3">
                      <Button
                        onClick={() => setGeneratedQR(null)}
                        variant="outline"
                        className="flex-1 h-14 rounded-xl font-semibold border-2 text-white hover:bg-white/10"
                        style={{ borderColor: colors.lighter }}
                      >
                        Add Another
                      </Button>
                      <Button
                        onClick={() => setActiveTab('scan')}
                        className="flex-1 h-14 rounded-xl font-semibold text-white border-0"
                        style={{ 
                          background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                          boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                        }}
                      >
                        Scan Now
                      </Button>
                    </div>
                  </div>
                )}
              </div>
            </div>
          </TabsContent>

          {/* Attendance Tab */}
          <TabsContent value="attendance">
            <AttendanceList
              event={todayEvent}
              members={members}
              attendance={todayAttendance}
              onRefresh={loadData}
            />
          </TabsContent>

          {/* Events Tab */}
          <TabsContent value="events">
            <EventManagement
              events={allEvents}
              onRefresh={loadData}
              onSelectEvent={(event) => {
                setSelectedEventId(event.id || event.localId?.toString() || null);
                setTodayEvent(event);
                const eventId = event.id || `local-${event.localId}`;
                db.getEventAttendance(eventId, event.localId).then(setTodayAttendance);
                setActiveTab('attendance');
              }}
            />
          </TabsContent>
        </Tabs>
      </main>

      {/* Create Event Dialog */}
      <CreateEventDialog
        open={showCreateEventDialog}
        onOpenChange={setShowCreateEventDialog}
        onSubmit={handleCreateEvent}
        createdBy={user?.id}
      />
    </div>
  );
}
