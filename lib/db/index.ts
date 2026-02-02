import Dexie, { Table } from 'dexie';
import { Member, Event, Attendance, SyncQueueItem } from '@/types';

export class MASAmicusDB extends Dexie {
  members!: Table<Member, number>;
  events!: Table<Event, number>;
  attendance!: Table<Attendance, number>;
  syncQueue!: Table<SyncQueueItem, number>;
  settings!: Table<{ key: string; value: any }, string>;

  constructor() {
    super('MASAmicusLocal');

    this.version(1).stores({
      members: '++localId, id, qr_code, full_name, phone, syncStatus',
      events: '++localId, id, event_date, start_time, syncStatus',
      attendance: '++localId, id, member_id, event_id, check_in_at, syncStatus',
      syncQueue: '++id, table, action, timestamp, retryCount',
      settings: 'key, value',
    });
  }

  // Initialize default settings
  async initializeSettings() {
    const defaults = [
      { key: 'lastSync', value: null },
      { key: 'deviceId', value: this.generateUUID() },
      { key: 'offlineMode', value: false },
    ];

    for (const setting of defaults) {
      const exists = await this.settings.get(setting.key);
      if (!exists) {
        await this.settings.add(setting);
      }
    }
  }

  // Generate UUID (fallback for older browsers)
  private generateUUID(): string {
    if (typeof crypto !== 'undefined' && crypto.randomUUID) {
      return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
      const r = Math.random() * 16 | 0;
      const v = c === 'x' ? r : (r & 0x3 | 0x8);
      return v.toString(16);
    });
  }

  // Get setting value
  async getSetting(key: string): Promise<any> {
    const setting = await this.settings.get(key);
    return setting?.value;
  }

  // Set setting value
  async setSetting(key: string, value: any): Promise<void> {
    await this.settings.put({ key, value });
  }

  // Add to sync queue
  async addToSyncQueue(
    table: 'members' | 'events' | 'attendance',
    action: 'create' | 'update' | 'delete',
    payload: Member | Event | Attendance
  ): Promise<void> {
    await this.syncQueue.add({
      table,
      action,
      payload,
      timestamp: Date.now(),
      retryCount: 0,
    });
  }

  // Get pending sync items
  async getPendingSyncItems(): Promise<SyncQueueItem[]> {
    return await this.syncQueue.orderBy('timestamp').toArray();
  }

  // Remove from sync queue
  async removeFromSyncQueue(id: number): Promise<void> {
    await this.syncQueue.delete(id);
  }

  // Update retry count
  async updateRetryCount(id: number, error?: string): Promise<void> {
    const item = await this.syncQueue.get(id);
    if (item) {
      await this.syncQueue.update(id, {
        retryCount: item.retryCount + 1,
        error,
      });
    }
  }

  // Clear sync queue
  async clearSyncQueue(): Promise<void> {
    await this.syncQueue.clear();
  }

  // Get members with pending sync
  async getPendingMembers(): Promise<Member[]> {
    return await this.members.where('syncStatus').equals('pending').toArray();
  }

  // Get attendance with pending sync
  async getPendingAttendance(): Promise<Attendance[]> {
    return await this.attendance.where('syncStatus').equals('pending').toArray();
  }

  // Search members by name or phone
  async searchMembers(query: string): Promise<Member[]> {
    const lowerQuery = query.toLowerCase();
    return await this.members
      .filter((member) =>
        member.full_name.toLowerCase().includes(lowerQuery) ||
        member.phone.includes(lowerQuery)
      )
      .toArray();
  }

  // Get member by QR code
  async getMemberByQR(qrCode: string): Promise<Member | undefined> {
    return await this.members.where('qr_code').equals(qrCode).first();
  }

  // Check if member already checked in for event
  async hasCheckedIn(memberId: string, eventId: string): Promise<Attendance | undefined> {
    // Try with server ID first
    let attendance = await this.attendance
      .where({ member_id: memberId, event_id: eventId })
      .first();

    if (attendance) return attendance;

    // Try with local IDs if not found
    const member = await this.members.where('id').equals(memberId).first();
    const event = await this.events.where('id').equals(eventId).first();

    if (member?.localId && event?.localId) {
      attendance = await this.attendance
        .filter((a) =>
          a.member_local_id === member.localId &&
          a.event_local_id === event.localId
        )
        .first();
    }

    return attendance;
  }

  // Get today's event
  async getTodayEvent(): Promise<Event | undefined> {
    const today = new Date().toISOString().split('T')[0];
    return await this.events
      .where('event_date')
      .equals(today)
      .and((e) => e.status === 'active' || e.status === 'upcoming')
      .first();
  }

  // Get attendance for event (supports both server ID and local ID)
  async getEventAttendance(eventId: string, eventLocalId?: number): Promise<Attendance[]> {
    // First try by server event_id
    let attendance = await this.attendance.where('event_id').equals(eventId).toArray();

    // If no results and we have a local ID, try by event_local_id
    if (attendance.length === 0 && eventLocalId) {
      attendance = await this.attendance
        .filter((a) => a.event_local_id === eventLocalId)
        .toArray();
    }

    // Also try with local prefix for backwards compatibility
    if (attendance.length === 0 && eventId.startsWith('local-')) {
      const localIdNum = parseInt(eventId.replace('local-', ''), 10);
      if (!isNaN(localIdNum)) {
        attendance = await this.attendance
          .filter((a) => a.event_local_id === localIdNum)
          .toArray();
      }
    }

    return attendance;
  }

  // Get member attendance history
  async getMemberAttendance(memberId: string): Promise<Attendance[]> {
    return await this.attendance
      .where('member_id')
      .equals(memberId)
      .reverse()
      .sortBy('check_in_at');
  }

  // Calculate member stats
  async calculateMemberStats(memberId: string): Promise<{
    totalEvents: number;
    attended: number;
    early: number;
    onTime: number;
    late: number;
    punctualityRate: number;
  }> {
    const attendance = await this.getMemberAttendance(memberId);
    const attended = attendance.filter((a) =>
      a.status === 'early' || a.status === 'on-time' || a.status === 'late'
    );

    const early = attended.filter((a) => a.status === 'early').length;
    const onTime = attended.filter((a) => a.status === 'on-time').length;
    const late = attended.filter((a) => a.status === 'late').length;

    const totalAttended = attended.length;
    const punctualityRate = totalAttended > 0
      ? Math.round(((early + onTime) / totalAttended) * 100)
      : 0;

    return {
      totalEvents: attendance.length,
      attended: totalAttended,
      early,
      onTime,
      late,
      punctualityRate,
    };
  }
}

// Create and export database instance
export const db = new MASAmicusDB();

// Initialize database
export async function initializeDB() {
  await db.initializeSettings();
  console.log('Database initialized');
}

// Export for use in components
export default db;
