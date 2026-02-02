// User Roles
export type UserRole = 'admin' | 'secretary' | 'member';

// Member Status
export type MemberStatus = 'active' | 'irregular' | 'at-risk' | 'inactive';

// Attendance Status
export type AttendanceStatus = 'early' | 'on-time' | 'late' | 'excused' | 'absent';

// Check-in Method
export type CheckInMethod = 'qr-scan' | 'manual' | 'self-checkin';

// Sync Status
export type SyncStatus = 'synced' | 'pending' | 'conflict' | 'error';

// Member Interface
export interface Member {
  id?: string;
  localId?: number;
  full_name: string;
  phone: string;
  email?: string;
  qr_code: string;
  role: UserRole;
  status: MemberStatus;
  registered_by?: string;
  created_at?: string;
  updated_at?: string;
  syncStatus?: SyncStatus;
  tempPassword?: string;
}

// Event Interface
export interface Event {
  id?: string;
  localId?: number;
  title: string;
  event_date: string;
  start_time: string;
  location?: string;
  status: 'upcoming' | 'active' | 'closed';
  created_by?: string;
  created_at?: string;
  syncStatus?: SyncStatus;
}

// Attendance Interface
export interface Attendance {
  id?: string;
  localId?: number;
  member_id: string;
  member_local_id?: number;
  event_id: string;
  event_local_id?: number;
  check_in_at: string;
  status: AttendanceStatus;
  method: CheckInMethod;
  is_excused?: boolean;
  notes?: string;
  recorded_by?: string;
  created_at?: string;
  updated_at?: string;
  syncStatus?: SyncStatus;
}

// Sync Queue Item
export interface SyncQueueItem {
  id?: number;
  table: 'members' | 'events' | 'attendance';
  action: 'create' | 'update' | 'delete';
  payload: Member | Event | Attendance;
  timestamp: number;
  retryCount: number;
  error?: string;
}

// User Profile
export interface UserProfile {
  id: string;
  email: string;
  full_name: string;
  role: UserRole;
  phone?: string;
  qr_code?: string;
  status: MemberStatus;
  created_at: string;
}

// Attendance Stats
export interface AttendanceStats {
  totalEvents: number;
  attended: number;
  early: number;
  onTime: number;
  late: number;
  excused: number;
  absent: number;
  punctualityRate: number;
  currentStreak: number;
  longestStreak: number;
}

// Dashboard Stats (Admin)
export interface DashboardStats {
  totalMembers: number;
  activeMembers: number;
  irregularMembers: number;
  atRiskMembers: number;
  todayAttendance: {
    present: number;
    expected: number;
    early: number;
    onTime: number;
    late: number;
  };
  recentEvents: Event[];
}

// Check-in Result
export interface CheckInResult {
  success: boolean;
  member?: Member;
  status?: AttendanceStatus;
  message: string;
  alreadyCheckedIn?: boolean;
  previousCheckIn?: string;
}

// Offline Queue Status
export interface QueueStatus {
  pendingCount: number;
  syncing: boolean;
  lastSync?: string;
  isOnline: boolean;
}
