'use client';

import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import {
  Users,
  Calendar,
  Clock,
  TrendingUp,
  Download,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  LayoutDashboard,
  UserCog,
  ClipboardList
} from 'lucide-react';
import db from '@/lib/db';
import syncEngine from '@/lib/sync/engine';
import { Member, Event, Attendance, DashboardStats } from '@/types';
import { format } from 'date-fns';
import { useAuth } from '@/hooks/useAuth';
import { MemberManagement } from '@/components/admin/MemberManagement';
import { AttendanceList } from '@/components/secretary/AttendanceList';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';

// Format time from 24-hour to 12-hour format
const formatTime12Hour = (time: string) => {
  const [hours, minutes] = time.split(':');
  const hour = parseInt(hours, 10);
  const ampm = hour >= 12 ? 'PM' : 'AM';
  const hour12 = hour % 12 || 12;
  return `${hour12}:${minutes} ${ampm}`;
};

export default function AdminDashboardPage() {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState('overview');
  const [stats, setStats] = useState<DashboardStats>({
    totalMembers: 0,
    activeMembers: 0,
    irregularMembers: 0,
    atRiskMembers: 0,
    todayAttendance: {
      present: 0,
      expected: 0,
      early: 0,
      onTime: 0,
      late: 0,
    },
    recentEvents: [],
  });
  const [members, setMembers] = useState<Member[]>([]);
  const [atRiskMembers, setAtRiskMembers] = useState<Member[]>([]);
  const [allEvents, setAllEvents] = useState<Event[]>([]);
  const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
  const [eventAttendance, setEventAttendance] = useState<Attendance[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Initial load
    loadDashboardData();

    // Trigger sync
    syncEngine.sync().then(() => {
      // Reload after sync completes to show new data
      loadDashboardData();
    });
  }, []);

  const loadDashboardData = async () => {
    try {
      // Load all members
      const allMembers = await db.members.toArray();
      setMembers(allMembers);

      // Calculate member stats
      const activeCount = allMembers.filter((m) => m.status === 'active').length;
      const irregularCount = allMembers.filter((m) => m.status === 'irregular').length;
      const atRiskCount = allMembers.filter((m) => m.status === 'at-risk').length;

      setAtRiskMembers(allMembers.filter((m) => m.status === 'at-risk'));



      // Load all events
      const allEventsData = await db.events
        .orderBy('event_date')
        .reverse()
        .toArray();

      setAllEvents(allEventsData);

      // Find best match for "Today's Event" (handling duplicates)
      const today = new Date().toISOString().split('T')[0];
      const todaysEvents = allEventsData.filter(e =>
        e.event_date === today && (e.status === 'active' || e.status === 'upcoming')
      );

      let bestTodayEvent: Event | null = null;
      let bestTodayAttendance: Attendance[] = [];

      if (todaysEvents.length > 0) {
        // Check attendance for all checking duplicates
        for (const evt of todaysEvents) {
          const evtId = evt.id || `local-${evt.localId}`;
          const att = await db.getEventAttendance(evtId, evt.localId);

          // If this event has more attendance, or it's the first one and we have nothing yet
          if (att.length > bestTodayAttendance.length || !bestTodayEvent) {
            bestTodayEvent = evt;
            bestTodayAttendance = att;
          }
        }
      }

      // Use the best match found
      const todayAttendance = bestTodayAttendance;

      // Recent events for dashboard (limit to 5)
      const recentEvents = allEventsData.slice(0, 5);

      setStats({
        totalMembers: allMembers.length,
        activeMembers: activeCount,
        irregularMembers: irregularCount,
        atRiskMembers: atRiskCount,
        todayAttendance: {
          present: todayAttendance.length,
          expected: allMembers.length,
          early: todayAttendance.filter((a) => a.status === 'early').length,
          onTime: todayAttendance.filter((a) => a.status === 'on-time').length,
          late: todayAttendance.filter((a) => a.status === 'late').length,
        },
        recentEvents,
      });
    } catch (error) {
      console.error('Error loading dashboard:', error);
    } finally {
      setLoading(false);
    }
  };

  const exportToCSV = () => {
    // Create CSV content
    const headers = ['Name', 'Phone', 'Email', 'Status', 'Role'];
    const rows = members.map((m) => [m.full_name, m.phone, m.email || '', m.status, m.role]);
    const csvContent = [headers, ...rows].map((row) => row.join(',')).join('\n');

    // Download
    const blob = new Blob([csvContent], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `mas-amicus-members-${format(new Date(), 'yyyy-MM-dd')}.csv`;
    a.click();
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="text-center py-12">Loading dashboard...</div>
      </div>
    );
  }

  const attendanceRate = stats.todayAttendance.expected > 0
    ? Math.round((stats.todayAttendance.present / stats.todayAttendance.expected) * 100)
    : 0;

  return (
    <div className="max-w-7xl mx-auto px-4 pb-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-[#0F2C59]">Admin Dashboard</h1>
          <p className="text-[#0F2C59]/60">Overview of MAS-AMICUS attendance</p>
        </div>
        <Button
          onClick={exportToCSV}
          variant="outline"
          className="border-[#1E5AA8] text-[#1E5AA8]"
        >
          <Download className="w-4 h-4 mr-2" />
          Export Data
        </Button>
      </div>

      {/* Tabs for Overview and Members */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-[#FDF8F3] border border-[#D4AF37]/20">
          <TabsTrigger
            value="overview"
            className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
          >
            <LayoutDashboard className="w-4 h-4 mr-2" />
            Overview
          </TabsTrigger>
          <TabsTrigger
            value="members"
            className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
          >
            <UserCog className="w-4 h-4 mr-2" />
            Members
          </TabsTrigger>
          <TabsTrigger
            value="attendance"
            className="data-[state=active]:bg-[#1E5AA8] data-[state=active]:text-white"
          >
            <ClipboardList className="w-4 h-4 mr-2" />
            Attendance
          </TabsTrigger>
        </TabsList>

        {/* Overview Tab */}
        <TabsContent value="overview" className="space-y-6">
          {/* Stats Grid */}
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <Card className="border-[#D4AF37]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0F2C59]/60">Total Members</p>
                    <p className="text-2xl font-bold text-[#0F2C59]">{stats.totalMembers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-[#1E5AA8]/10 flex items-center justify-center">
                    <Users className="w-5 h-5 text-[#1E5AA8]" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D4AF37]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0F2C59]/60">Active</p>
                    <p className="text-2xl font-bold text-green-600">{stats.activeMembers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-green-100 flex items-center justify-center">
                    <CheckCircle2 className="w-5 h-5 text-green-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D4AF37]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0F2C59]/60">Irregular</p>
                    <p className="text-2xl font-bold text-yellow-600">{stats.irregularMembers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-yellow-100 flex items-center justify-center">
                    <AlertTriangle className="w-5 h-5 text-yellow-600" />
                  </div>
                </div>
              </CardContent>
            </Card>

            <Card className="border-[#D4AF37]/20">
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="text-sm text-[#0F2C59]/60">At Risk</p>
                    <p className="text-2xl font-bold text-red-600">{stats.atRiskMembers}</p>
                  </div>
                  <div className="w-10 h-10 rounded-full bg-red-100 flex items-center justify-center">
                    <XCircle className="w-5 h-5 text-red-600" />
                  </div>
                </div>
              </CardContent>
            </Card>
          </div>

          {/* Today's Attendance */}
          <Card className="border-[#D4AF37]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#D4AF37]" />
                Today&apos;s Attendance
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-[#1E5AA8]">{stats.todayAttendance.present}</div>
                  <div className="text-sm text-[#0F2C59]/60">Present</div>
                </div>
                <div className="text-center p-4 bg-green-50 rounded-lg">
                  <div className="text-3xl font-bold text-green-600">{stats.todayAttendance.early}</div>
                  <div className="text-sm text-[#0F2C59]/60">Early</div>
                </div>
                <div className="text-center p-4 bg-blue-50 rounded-lg">
                  <div className="text-3xl font-bold text-blue-600">{stats.todayAttendance.onTime}</div>
                  <div className="text-sm text-[#0F2C59]/60">On-time</div>
                </div>
                <div className="text-center p-4 bg-yellow-50 rounded-lg">
                  <div className="text-3xl font-bold text-yellow-600">{stats.todayAttendance.late}</div>
                  <div className="text-sm text-[#0F2C59]/60">Late</div>
                </div>
              </div>

              {/* Progress Bar */}
              <div className="space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-[#0F2C59]">Attendance Rate</span>
                  <span className="font-medium text-[#1E5AA8]">{attendanceRate}%</span>
                </div>
                <div className="h-3 bg-gray-100 rounded-full overflow-hidden">
                  <div
                    className="h-full bg-gradient-to-r from-[#1E5AA8] to-[#D4AF37] transition-all duration-500"
                    style={{ width: `${attendanceRate}%` }}
                  />
                </div>
                <p className="text-sm text-[#0F2C59]/60">
                  {stats.todayAttendance.present} of {stats.todayAttendance.expected} expected members
                </p>
              </div>
            </CardContent>
          </Card>

          {/* At-Risk Members */}
          {atRiskMembers.length > 0 && (
            <Card className="border-red-200">
              <CardHeader>
                <CardTitle className="text-red-700 flex items-center gap-2">
                  <AlertTriangle className="w-5 h-5" />
                  Members At Risk ({atRiskMembers.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-2">
                  {atRiskMembers.slice(0, 5).map((member) => (
                    <div
                      key={member.localId}
                      className="flex items-center justify-between p-3 bg-red-50 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-red-900">{member.full_name}</div>
                        <div className="text-sm text-red-700">{member.phone}</div>
                      </div>
                      <Badge variant="outline" className="border-red-300 text-red-700">
                        At Risk
                      </Badge>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {/* Recent Events */}
          <Card className="border-[#D4AF37]/20">
            <CardHeader>
              <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                <Clock className="w-5 h-5 text-[#D4AF37]" />
                Recent Events
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-2">
                {stats.recentEvents.length === 0 ? (
                  <p className="text-center text-gray-500 py-4">No events yet</p>
                ) : (
                  stats.recentEvents.map((event) => (
                    <div
                      key={event.localId}
                      className="flex items-center justify-between p-3 bg-white border border-[#D4AF37]/10 rounded-lg"
                    >
                      <div>
                        <div className="font-medium text-[#0F2C59]">{event.title}</div>
                        <div className="text-sm text-[#0F2C59]/60">
                          {format(new Date(event.event_date), 'MMM dd, yyyy')} at {formatTime12Hour(event.start_time)}
                        </div>
                      </div>
                      <Badge
                        className={
                          event.status === 'active'
                            ? 'bg-green-100 text-green-800'
                            : event.status === 'upcoming'
                              ? 'bg-blue-100 text-blue-800'
                              : 'bg-gray-100 text-gray-800'
                        }
                      >
                        {event.status}
                      </Badge>
                    </div>
                  ))
                )}
              </div>
            </CardContent>
          </Card>
        </TabsContent>

        {/* Members Tab */}
        <TabsContent value="members">
          <MemberManagement
            members={members}
            onRefresh={loadDashboardData}
            currentUserId={user?.id}
          />
        </TabsContent>

        {/* Attendance Tab */}
        <TabsContent value="attendance">
          <Card className="border-[#D4AF37]/20 mb-4">
            <CardHeader>
              <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                <Calendar className="w-5 h-5 text-[#D4AF37]" />
                Select Event
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Select
                value={selectedEvent?.id || selectedEvent?.localId?.toString() || ''}
                onValueChange={(value) => {
                  const event = allEvents.find(e => e.id === value || e.localId?.toString() === value);
                  setSelectedEvent(event || null);
                  if (event) {
                    const eventId = event.id || `local-${event.localId}`;
                    db.getEventAttendance(eventId, event.localId).then(setEventAttendance);
                  } else {
                    setEventAttendance([]);
                  }
                }}
              >
                <SelectTrigger className="w-full max-w-md border-[#D4AF37]/30">
                  <SelectValue placeholder="Choose an event to view attendance" />
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
            </CardContent>
          </Card>

          <AttendanceList
            event={selectedEvent}
            members={members}
            attendance={eventAttendance}
            onRefresh={() => {
              if (selectedEvent) {
                const eventId = selectedEvent.id || `local-${selectedEvent.localId}`;
                db.getEventAttendance(eventId, selectedEvent.localId).then(setEventAttendance);
              }
            }}
          />
        </TabsContent>
      </Tabs>
    </div>
  );
}
