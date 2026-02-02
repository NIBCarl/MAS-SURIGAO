'use client';

import { useEffect, useState, useCallback, useRef } from 'react';
import { BrowserMultiFormatReader } from '@zxing/browser';
import { useAuth } from '@/hooks/useAuth';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Search, Camera, Plus, Users, Check, AlertCircle, WifiOff, CalendarPlus, ChevronDown, Calendar, ClipboardList } from 'lucide-react';
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

  return (
    <div className="max-w-4xl mx-auto px-4 pb-8">
      {/* Header with Live Counter */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-[#0F2C59]">Check-In Hub</h1>
            {/* Event Selector Dropdown */}
            {allEvents.length > 0 ? (
              <Select
                value={selectedEventId || ''}
                onValueChange={(value) => {
                  setSelectedEventId(value);
                  // Find and set the selected event
                  const selected = allEvents.find(e => e.id === value || e.localId?.toString() === value);
                  setTodayEvent(selected || null);
                  // Load attendance for selected event (support both server and local IDs)
                  if (selected) {
                    const eventId = selected.id || `local-${selected.localId}`;
                    db.getEventAttendance(eventId, selected.localId).then(setTodayAttendance);
                  } else {
                    setTodayAttendance([]);
                  }
                }}
              >
                <SelectTrigger className="w-[240px] mt-1 border-[#D4AF37]/30 text-[#0F2C59]">
                  <SelectValue placeholder="Select an event" />
                </SelectTrigger>
                <SelectContent>
                  {allEvents.map((event) => (
                    <SelectItem
                      key={event.id || event.localId}
                      value={event.id || event.localId?.toString() || ''}
                    >
                      {event.title} - {event.event_date}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            ) : (
              <p className="text-[#0F2C59]/60">
                No events available - Create one to start!
              </p>
            )}
          </div>
          <div className="flex items-center gap-4">
            <Button
              onClick={() => setShowCreateEventDialog(true)}
              variant="outline"
              className="border-[#D4AF37] text-[#D4AF37] hover:bg-[#D4AF37]/10"
            >
              <CalendarPlus className="w-4 h-4 mr-2" />
              Create Event
            </Button>
            <div className="text-right">
              <div className="text-3xl font-bold text-[#1E5AA8]">
                {presentCount}
                <span className="text-lg text-[#0F2C59]/40">/{members.length}</span>
              </div>
              <div className="text-sm text-[#0F2C59]/60">Present</div>
            </div>
          </div>
        </div>

        {/* Status Pills */}
        <div className="flex gap-2 flex-wrap items-center">
          <Badge className="bg-green-100 text-green-800">
            Early: {earlyCount}
          </Badge>
          <Badge className="bg-blue-100 text-blue-800">
            On-time: {onTimeCount}
          </Badge>
          <Badge className="bg-yellow-100 text-yellow-800">
            Late: {lateCount}
          </Badge>

          <Button
            variant="outline"
            size="sm"
            onClick={handleManualSync}
            disabled={!isOnline || isSyncing}
            className={`ml-2 h-6 text-xs px-2 ${isSyncing ? 'animate-pulse' : ''} ${!isOnline ? 'border-dashed text-gray-400' : 'border-[#1E5AA8] text-[#1E5AA8]'}`}
          >
            {isSyncing ? (
              <RefreshCw className="w-3 h-3 mr-1 animate-spin" />
            ) : isOnline ? (
              <Cloud className="w-3 h-3 mr-1" />
            ) : (
              <CloudOff className="w-3 h-3 mr-1" />
            )}
            {isSyncing ? 'Syncing...' : isOnline ? 'Sync Now' : 'Offline'}
          </Button>

          {!isOnline && (
            <Badge variant="outline" className="border-yellow-400 text-yellow-700">
              <WifiOff className="w-3 h-3 mr-1" />
              Offline Mode
            </Badge>
          )}
        </div>
      </div>

      {/* Check-in Result Overlay */}
      {showResult && checkInResult && (
        <div className={`fixed inset-0 z-50 flex items-center justify-center p-4 ${checkInResult.success ? 'bg-green-500/90' : checkInResult.alreadyCheckedIn ? 'bg-yellow-500/90' : 'bg-red-500/90'
          }`}>
          <div className="bg-white rounded-2xl p-8 text-center max-w-sm w-full animate-check-in">
            <div className={`w-20 h-20 rounded-full mx-auto mb-4 flex items-center justify-center ${checkInResult.success ? 'bg-green-100' : checkInResult.alreadyCheckedIn ? 'bg-yellow-100' : 'bg-red-100'
              }`}>
              {checkInResult.success ? (
                <Check className="w-10 h-10 text-green-600" />
              ) : (
                <AlertCircle className="w-10 h-10 text-red-600" />
              )}
            </div>
            <h2 className="text-2xl font-bold text-[#0F2C59] mb-2">
              {checkInResult.success ? 'Success!' : checkInResult.alreadyCheckedIn ? 'Already Checked In' : 'Error'}
            </h2>
            <p className="text-[#0F2C59]/70">{checkInResult.message}</p>
          </div>
        </div>
      )}

      {/* Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-4">
        <TabsList className="grid w-full grid-cols-5 bg-[#FDF8F3] border border-[#D4AF37]/20">
          <TabsTrigger value="scan" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white text-xs sm:text-sm">
            <Camera className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Scan</span>
          </TabsTrigger>
          <TabsTrigger value="search" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white text-xs sm:text-sm">
            <Search className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Search</span>
          </TabsTrigger>
          <TabsTrigger value="add" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white text-xs sm:text-sm">
            <Plus className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Add</span>
          </TabsTrigger>
          <TabsTrigger value="attendance" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white text-xs sm:text-sm">
            <ClipboardList className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Attendance</span>
          </TabsTrigger>
          <TabsTrigger value="events" className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white text-xs sm:text-sm">
            <Calendar className="w-4 h-4 mr-1 sm:mr-2" />
            <span className="hidden sm:inline">Events</span>
          </TabsTrigger>
        </TabsList>

        {/* Scan Tab */}
        <TabsContent value="scan">
          <Card className="border-[#D4AF37]/20">
            <CardContent className="p-6">
              {isScanning ? (
                <div className="space-y-4">
                  <div className="relative aspect-video bg-black rounded-lg overflow-hidden">
                    <video ref={videoRef} className="w-full h-full object-cover" />
                    <div className="absolute inset-0 border-2 border-[#D4AF37] m-8 rounded-lg" />
                  </div>
                  <Button
                    onClick={stopScanning}
                    variant="outline"
                    className="w-full border-[#1E5AA8] text-[#1E5AA8]"
                  >
                    Stop Scanning
                  </Button>
                </div>
              ) : (
                <div className="text-center py-12">
                  <div className="w-20 h-20 rounded-full bg-[#1E5AA8]/10 flex items-center justify-center mx-auto mb-4">
                    <Camera className="w-10 h-10 text-[#1E5AA8]" />
                  </div>
                  <h3 className="text-lg font-semibold text-[#0F2C59] mb-2">
                    QR Scanner
                  </h3>
                  <p className="text-[#0F2C59]/60 mb-4">
                    Point camera at member&apos;s QR code
                  </p>
                  <Button
                    onClick={startScanning}
                    className="bg-[#1E5AA8] hover:bg-[#154785]"
                  >
                    Start Scanning
                  </Button>
                </div>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        {/* Search Tab */}
        <TabsContent value="search">
          <Card className="border-[#D4AF37]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                <Users className="w-5 h-5 text-[#D4AF37]" />
                Find Member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <Input
                placeholder="Search by name or phone..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="border-[#1E5AA8]/20"
              />

              <div className="space-y-2 max-h-96 overflow-y-auto">
                {filteredMembers.map((member) => {
                  const isCheckedIn = todayAttendance.some(
                    (a) => a.member_id === member.id || a.member_local_id === member.localId
                  );

                  return (
                    <div
                      key={member.localId}
                      className="flex items-center justify-between p-3 bg-white rounded-lg border border-[#D4AF37]/10"
                    >
                      <div>
                        <div className="font-medium text-[#0F2C59]">{member.full_name}</div>
                        <div className="text-sm text-[#0F2C59]/60">{member.phone}</div>
                      </div>
                      {isCheckedIn ? (
                        <Badge className="bg-green-100 text-green-800">
                          <Check className="w-3 h-3 mr-1" />
                          Checked In
                        </Badge>
                      ) : (
                        <Button
                          size="sm"
                          onClick={() => handleManualCheckIn(member)}
                          className="bg-[#1E5AA8] hover:bg-[#154785]"
                        >
                          Check In
                        </Button>
                      )}
                    </div>
                  );
                })}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Add Member Tab */}
        <TabsContent value="add">
          <Card className="border-[#D4AF37]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                <Plus className="w-5 h-5 text-[#D4AF37]" />
                Quick Add Member
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {!generatedQR ? (
                <>
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F2C59]">Full Name *</label>
                    <Input
                      value={newMember.full_name}
                      onChange={(e) => setNewMember({ ...newMember, full_name: e.target.value })}
                      placeholder="Enter full name"
                      className="border-[#1E5AA8]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F2C59]">Phone *</label>
                    <Input
                      value={newMember.phone}
                      onChange={(e) => setNewMember({ ...newMember, phone: e.target.value })}
                      placeholder="09XX XXX XXXX"
                      className="border-[#1E5AA8]/20"
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-sm font-medium text-[#0F2C59]">Email (Optional)</label>
                    <Input
                      type="email"
                      value={newMember.email}
                      onChange={(e) => setNewMember({ ...newMember, email: e.target.value })}
                      placeholder="email@example.com"
                      className="border-[#1E5AA8]/20"
                    />
                  </div>

                  <Button
                    onClick={handleCreateMember}
                    disabled={!newMember.full_name || !newMember.phone}
                    className="w-full bg-[#D4AF37] hover:bg-[#B8860B] text-white"
                  >
                    Generate QR Code
                  </Button>
                </>
              ) : (
                <div className="text-center space-y-4">
                  <Alert className="bg-green-50 border-green-200">
                    <Check className="h-4 w-4 text-green-600" />
                    <AlertDescription className="text-green-800">
                      Member created successfully!
                    </AlertDescription>
                  </Alert>

                  <div className="p-4 bg-white rounded-xl border-2 border-[#D4AF37]/20 inline-block">
                    {/* QR Code would be rendered here */}
                    <div className="w-48 h-48 bg-gray-100 flex items-center justify-center text-gray-400">
                      QR: {generatedQR.slice(0, 8)}...
                    </div>
                  </div>

                  <div className="flex gap-2">
                    <Button
                      onClick={() => setGeneratedQR(null)}
                      variant="outline"
                      className="flex-1 border-[#1E5AA8]"
                    >
                      Add Another
                    </Button>
                    <Button
                      onClick={() => setActiveTab('scan')}
                      className="flex-1 bg-[#1E5AA8] hover:bg-[#154785]"
                    >
                      Scan Now
                    </Button>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>
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
