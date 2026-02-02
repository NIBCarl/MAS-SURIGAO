import { AttendanceStatus, CheckInResult, Member } from '@/types';

// Check-in window in minutes
const EARLY_THRESHOLD = 15; // minutes before start
const LATE_THRESHOLD = 15; // minutes after start
const CHECKIN_WINDOW = 60; // minutes after start (for late check-ins)

export interface CheckInParams {
  member: Member;
  eventStartTime: Date;
  checkInTime?: Date;
  alreadyCheckedIn?: boolean;
  previousCheckInTime?: string;
}

export function processCheckIn({
  member,
  eventStartTime,
  checkInTime = new Date(),
  alreadyCheckedIn = false,
  previousCheckInTime,
}: CheckInParams): CheckInResult {
  // Check for duplicate
  if (alreadyCheckedIn) {
    return {
      success: false,
      alreadyCheckedIn: true,
      previousCheckIn: previousCheckInTime,
      message: `Already checked in at ${previousCheckInTime}`,
    };
  }

  // Calculate time difference in minutes
  const diffMs = checkInTime.getTime() - eventStartTime.getTime();
  const diffMinutes = Math.floor(diffMs / (1000 * 60));

  let status: AttendanceStatus;
  let message: string;

  if (diffMinutes < -EARLY_THRESHOLD) {
    status = 'early';
    message = `${member.full_name} - Early ✓`;
  } else if (diffMinutes <= LATE_THRESHOLD) {
    status = 'on-time';
    message = `${member.full_name} - On-time ✓`;
  } else {
    // All check-ins after LATE_THRESHOLD are marked as late (no window restriction)
    status = 'late';
    message = `${member.full_name} - Late (${diffMinutes} mins)`;
  }

  return {
    success: true,
    member,
    status,
    message,
  };
}

// Generate QR code data
export function generateQRCode(): string {
  // Use crypto.randomUUID if available, otherwise use a simple fallback
  if (typeof crypto !== 'undefined' && crypto.randomUUID) {
    return crypto.randomUUID();
  }
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

// Generate temporary PIN
export function generateTempPIN(): string {
  return Math.floor(100000 + Math.random() * 900000).toString();
}

// Format check-in time
export function formatCheckInTime(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleTimeString('en-US', {
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  });
}

// Format date for display
export function formatEventDate(date: Date | string): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString('en-US', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

// Get status color
export function getStatusColor(status: AttendanceStatus): string {
  switch (status) {
    case 'early':
      return 'text-green-600 bg-green-100';
    case 'on-time':
      return 'text-blue-600 bg-blue-100';
    case 'late':
      return 'text-yellow-600 bg-yellow-100';
    case 'excused':
      return 'text-purple-600 bg-purple-100';
    case 'absent':
      return 'text-red-600 bg-red-100';
    default:
      return 'text-gray-600 bg-gray-100';
  }
}

// Get status label
export function getStatusLabel(status: AttendanceStatus): string {
  switch (status) {
    case 'early':
      return 'Early';
    case 'on-time':
      return 'On-time';
    case 'late':
      return 'Late';
    case 'excused':
      return 'Excused';
    case 'absent':
      return 'Absent';
    default:
      return 'Unknown';
  }
}

// Calculate punctuality rate
export function calculatePunctualityRate(
  early: number,
  onTime: number,
  late: number,
  total: number
): number {
  if (total === 0) return 0;
  return Math.round(((early + onTime) / total) * 100);
}

// Determine member status based on attendance
export function determineMemberStatus(
  attendanceCount: number,
  last30Days: number
): 'active' | 'irregular' | 'at-risk' | 'inactive' {
  if (attendanceCount >= 3) {
    return 'active';
  } else if (attendanceCount >= 1) {
    return 'irregular';
  } else if (last30Days > 14) {
    return 'at-risk';
  } else {
    return 'inactive';
  }
}

// Play sound effect (for successful check-in)
export function playCheckInSound(status: AttendanceStatus): void {
  // Simple beep using Web Audio API
  try {
    const AudioContextClass = window.AudioContext || (window as any).webkitAudioContext;
    if (!AudioContextClass) return;

    const audioContext = new AudioContextClass();
    const oscillator = audioContext.createOscillator();
    const gainNode = audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(audioContext.destination);

    // Different tones for different statuses
    switch (status) {
      case 'early':
        oscillator.frequency.value = 880; // High A
        break;
      case 'on-time':
        oscillator.frequency.value = 659; // E
        break;
      case 'late':
        oscillator.frequency.value = 523; // C
        break;
      default:
        oscillator.frequency.value = 440; // A
    }

    gainNode.gain.value = 0.1;
    oscillator.start();
    oscillator.stop(audioContext.currentTime + 0.15);
  } catch (error) {
    console.warn('Could not play sound:', error);
  }
}
