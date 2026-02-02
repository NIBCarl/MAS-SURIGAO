import { supabase } from '@/lib/supabase';
import db from '@/lib/db';
import { SyncQueueItem, Member, Event, Attendance } from '@/types';

export class SyncEngine {
  private isSyncing = false;
  private abortController: AbortController | null = null;

  // Check if online
  isOnline(): boolean {
    return typeof navigator !== 'undefined' && navigator.onLine;
  }

  // Start sync process
  async sync(): Promise<{ success: boolean; processed: number; errors: string[] }> {
    if (this.isSyncing || !this.isOnline()) {
      return { success: false, processed: 0, errors: ['Sync already in progress or offline'] };
    }

    this.isSyncing = true;
    this.abortController = new AbortController();
    const errors: string[] = [];
    let processed = 0;

    try {
      // Get pending items from queue
      const pendingItems = await db.getPendingSyncItems();

      for (const item of pendingItems) {
        if (this.abortController.signal.aborted) {
          break;
        }

        try {
          await this.processSyncItem(item);
          await db.removeFromSyncQueue(item.id!);
          processed++;
        } catch (error) {
          const errorMessage = error instanceof Error ? error.message : 'Unknown error';
          await db.updateRetryCount(item.id!, errorMessage);

          if ((item.retryCount || 0) >= 5) {
            errors.push(`Failed to sync ${item.table} after 5 retries: ${errorMessage}`);
          }
        }
      }

      // Sync down from server (bi-directional)
      await this.syncDown();

      // Update last sync time
      await db.setSetting('lastSync', new Date().toISOString());

      return {
        success: errors.length === 0,
        processed,
        errors
      };
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      return { success: false, processed, errors: [errorMessage] };
    } finally {
      this.isSyncing = false;
      this.abortController = null;
    }
  }

  // Process a single sync item
  private async processSyncItem(item: SyncQueueItem): Promise<void> {
    const { table, action, payload } = item;

    switch (table) {
      case 'members':
        await this.syncMember(action, payload as Member);
        break;
      case 'events':
        await this.syncEvent(action, payload as Event);
        break;
      case 'attendance':
        await this.syncAttendance(action, payload as Attendance);
        break;
      default:
        throw new Error(`Unknown table: ${table}`);
    }
  }

  // Sync member to server
  private async syncMember(action: string, member: Member): Promise<void> {
    const { localId, syncStatus, tempPassword, ...memberData } = member;

    if (action === 'create') {
      const { data, error } = await supabase
        .from('members')
        .insert([memberData as any])
        .select()
        .single();

      if (error) throw error;

      // Update local record with server ID
      if (localId && data && (data as any).id) {
        await db.members.update(localId, {
          id: (data as any).id,
          syncStatus: 'synced',
        });
      }
    } else if (action === 'update' && member.id) {
      const { error } = await supabase
        .from('members')
        .update(memberData as any)
        .eq('id', member.id);

      if (error) throw error;

      if (localId) {
        await db.members.update(localId, { syncStatus: 'synced' });
      }
    }
  }

  // Sync event to server
  private async syncEvent(action: string, event: Event): Promise<void> {
    const { localId, syncStatus, ...eventData } = event;

    if (action === 'create') {
      const { data, error } = await supabase
        .from('events')
        .insert([eventData as any])
        .select()
        .single();

      if (error) throw error;

      if (localId && data && (data as any).id) {
        await db.events.update(localId, {
          id: (data as any).id,
          syncStatus: 'synced',
        });
      }
    }
  }

  // Sync attendance to server
  private async syncAttendance(action: string, attendance: Attendance): Promise<void> {
    const { localId, syncStatus, member_local_id, event_local_id, ...attendanceData } = attendance;

    // Resolve local IDs to server IDs if needed
    let resolvedMemberId = attendanceData.member_id;
    let resolvedEventId = attendanceData.event_id;

    if (member_local_id && !resolvedMemberId) {
      const member = await db.members.get(member_local_id);
      if (member?.id) {
        resolvedMemberId = member.id;
      } else {
        throw new Error(`Member with localId ${member_local_id} not synced yet`);
      }
    }

    if (event_local_id && !resolvedEventId) {
      const event = await db.events.get(event_local_id);
      if (event?.id) {
        resolvedEventId = event.id;
      } else {
        throw new Error(`Event with localId ${event_local_id} not synced yet`);
      }
    }

    if (action === 'create') {
      const now = new Date().toISOString();
      const { data, error } = await supabase
        .from('attendance')
        .insert([{
          ...attendanceData,
          member_id: resolvedMemberId,
          event_id: resolvedEventId,
          created_at: attendanceData.created_at || now,
          updated_at: attendanceData.updated_at || now,
        } as any])
        .select()
        .single();

      if (error) {
        // Handle duplicate check-in
        if (error.code === '23505') {
          console.log('Attendance already exists, marking as synced');
          if (localId) {
            await db.attendance.update(localId, { syncStatus: 'synced' });
          }
          return;
        }
        throw error;
      }

      if (localId && data && (data as any).id) {
        await db.attendance.update(localId, {
          id: (data as any).id,
          member_id: resolvedMemberId,
          event_id: resolvedEventId,
          syncStatus: 'synced',
        });
      }
    } else if (action === 'update' && attendance.id) {
      const now = new Date().toISOString();
      const { error } = await supabase
        .from('attendance')
        .update({
          status: attendanceData.status,
          notes: attendanceData.notes,
          updated_at: now,
        })
        .eq('id', attendance.id);

      if (error) throw error;

      if (localId) {
        await db.attendance.update(localId, { syncStatus: 'synced' });
      }
    } else if (action === 'delete' && attendance.id) {
      const { error } = await supabase
        .from('attendance')
        .delete()
        .eq('id', attendance.id);

      if (error) throw error;
      // Local delete is already done, no need to update
    }
  }

  // Sync down from server (get latest data)
  private async syncDown(): Promise<void> {
    const lastSync = await db.getSetting('lastSync');
    const lastSyncDate = lastSync ? new Date(lastSync).toISOString() : new Date(0).toISOString();
    
    // Check if this is a fresh sync (no local data)
    const localAttendanceCount = await db.attendance.count();
    const isFreshSync = localAttendanceCount === 0;

    // Fetch updated members
    const { data: members, error: membersError } = await supabase
      .from('members')
      .select('*')
      .gt('updated_at', lastSyncDate);

    if (!membersError && members) {
      for (const member of members as Member[]) {
        const existing = await db.members.where('id').equals(member.id!).first();
        if (existing?.localId) {
          await db.members.update(existing.localId, {
            ...member,
            syncStatus: 'synced',
          });
        } else if (!existing) {
          await db.members.add({
            ...member,
            syncStatus: 'synced',
          });
        }
      }
    }

    // Fetch updated events
    const { data: events, error: eventsError } = await supabase
      .from('events')
      .select('*')
      .gt('updated_at', lastSyncDate);

    if (!eventsError && events) {
      for (const event of events as Event[]) {
        const existing = await db.events.where('id').equals(event.id!).first();
        if (existing?.localId) {
          await db.events.update(existing.localId, {
            ...event,
            syncStatus: 'synced',
          });
        } else if (!existing) {
          await db.events.add({
            ...event,
            syncStatus: 'synced',
          });
        }
      }
    }

    // Fetch updated attendance
    // For fresh sync, fetch all attendance from last 30 days to avoid loading too much data
    let attendanceQuery = supabase.from('attendance').select('*');
    
    if (isFreshSync) {
      // For fresh sync, fetch attendance from last 30 days
      const thirtyDaysAgo = new Date();
      thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
      attendanceQuery = attendanceQuery.gte('updated_at', thirtyDaysAgo.toISOString());
    } else {
      // For incremental sync, use lastSync date
      attendanceQuery = attendanceQuery.gt('updated_at', lastSyncDate);
    }
    
    const { data: attendance, error: attendanceError } = await attendanceQuery;

    if (!attendanceError && attendance) {
      for (const record of attendance as Attendance[]) {
        const existing = await db.attendance.where('id').equals(record.id!).first();
        
        // Resolve member_id to local member ID
        let memberLocalId: number | undefined;
        if (record.member_id) {
          const member = await db.members.where('id').equals(record.member_id).first();
          memberLocalId = member?.localId;
        }
        
        // Resolve event_id to local event ID
        let eventLocalId: number | undefined;
        if (record.event_id) {
          const event = await db.events.where('id').equals(record.event_id).first();
          eventLocalId = event?.localId;
        }
        
        if (existing?.localId) {
          await db.attendance.update(existing.localId, {
            ...record,
            member_local_id: memberLocalId,
            event_local_id: eventLocalId,
            syncStatus: 'synced',
          });
        } else if (!existing) {
          await db.attendance.add({
            ...record,
            member_local_id: memberLocalId,
            event_local_id: eventLocalId,
            syncStatus: 'synced',
          });
        }
      }
    }
  }

  // Abort current sync
  abort(): void {
    if (this.abortController) {
      this.abortController.abort();
    }
  }

  // Get sync status
  get isCurrentlySyncing(): boolean {
    return this.isSyncing;
  }
}

// Create singleton instance
export const syncEngine = new SyncEngine();

export default syncEngine;
