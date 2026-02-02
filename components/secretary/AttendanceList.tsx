'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import {
    Table,
    TableBody,
    TableCell,
    TableHead,
    TableHeader,
    TableRow,
} from '@/components/ui/table';
import { Users, Pencil, Clock, CheckCircle, MessageSquare, Calendar, MapPin } from 'lucide-react';
import { Attendance, AttendanceStatus, Member, Event } from '@/types';
import { EditAttendanceDialog } from './EditAttendanceDialog';
import db from '@/lib/db';
import { supabase } from '@/lib/supabase';

interface AttendanceListProps {
    event: Event | null;
    members: Member[];
    attendance: Attendance[];
    onRefresh: () => void;
}

// Enhanced color system
const colors = {
    darkest: '#0F2C59',
    dark: '#1E5AA8',
    base: '#2B6CB0',
    light: '#4299E1',
    lighter: '#63B3ED',
    lightest: '#90CDF4',
    gold: '#D4AF37',
    success: '#10B981',
    warning: '#F59E0B',
    error: '#EF4444',
};

export function AttendanceList({ event, members, attendance, onRefresh }: AttendanceListProps) {
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [selectedAttendance, setSelectedAttendance] = useState<Attendance | null>(null);
    const [selectedMember, setSelectedMember] = useState<Member | undefined>();

    // Get member info for each attendance
    const getAttendanceWithMember = () => {
        return attendance.map((a) => {
            const member = members.find(
                (m) => m.id === a.member_id || m.localId === a.member_local_id
            );
            return { ...a, memberInfo: member };
        });
    };

    const attendanceWithMembers = getAttendanceWithMember();

    const getStatusBadge = (status: AttendanceStatus) => {
        const styles: Record<AttendanceStatus, { bg: string; text: string; label: string }> = {
            early: { bg: 'rgba(16,185,129,0.15)', text: '#10B981', label: 'Early' },
            'on-time': { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6', label: 'On Time' },
            late: { bg: 'rgba(245,158,11,0.15)', text: '#F59E0B', label: 'Late' },
            excused: { bg: 'rgba(139,92,246,0.15)', text: '#8B5CF6', label: 'Excused' },
            absent: { bg: 'rgba(239,68,68,0.15)', text: '#EF4444', label: 'Absent' },
        };
        
        const style = styles[status];
        
        return (
            <Badge 
                className="h-8 px-3 rounded-lg font-semibold border-0"
                style={{ 
                    background: style.bg,
                    color: style.text,
                    boxShadow: `0 2px 8px ${style.bg}`
                }}
            >
                {style.label}
            </Badge>
        );
    };

    const formatTime = (dateStr: string) => {
        return new Date(dateStr).toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
        });
    };

    const handleEdit = (att: Attendance & { memberInfo?: Member }) => {
        setSelectedAttendance(att);
        setSelectedMember(att.memberInfo);
        setShowEditDialog(true);
    };

    const handleSave = async (updates: { status: AttendanceStatus; notes?: string }) => {
        if (!selectedAttendance?.localId) return;

        // Update local DB
        const now = new Date().toISOString();
        await db.attendance.update(selectedAttendance.localId, {
            status: updates.status,
            notes: updates.notes,
            updated_at: now,
            syncStatus: 'pending',
        });

        // Add to sync queue
        const updated = await db.attendance.get(selectedAttendance.localId);
        if (updated) {
            await db.addToSyncQueue('attendance', 'update', updated);

            // Try to sync if has server ID
            if (updated.id) {
                try {
                    await supabase
                        .from('attendance')
                        .update({ status: updates.status, notes: updates.notes })
                        .eq('id', updated.id);

                    await db.attendance.update(selectedAttendance.localId, { syncStatus: 'synced' });
                } catch (err) {
                    console.error('Failed to sync attendance update:', err);
                }
            }
        }

        onRefresh();
    };

    const handleDelete = async () => {
        if (!selectedAttendance?.localId) return;

        // Delete from local DB
        await db.attendance.delete(selectedAttendance.localId);

        // Add to sync queue if has server ID
        if (selectedAttendance.id) {
            await db.addToSyncQueue('attendance', 'delete', selectedAttendance);

            try {
                await supabase.from('attendance').delete().eq('id', selectedAttendance.id);
            } catch (err) {
                console.error('Failed to sync attendance delete:', err);
            }
        }

        onRefresh();
    };

    // Stats
    const earlyCount = attendance.filter((a) => a.status === 'early').length;
    const onTimeCount = attendance.filter((a) => a.status === 'on-time').length;
    const lateCount = attendance.filter((a) => a.status === 'late').length;
    const excusedCount = attendance.filter((a) => a.status === 'excused').length;
    const absentCount = attendance.filter((a) => a.status === 'absent').length;

    return (
        <>
            <div 
                className="rounded-3xl overflow-hidden"
                style={{ 
                    background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
            >
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ 
                                    background: `linear-gradient(145deg, ${colors.gold} 0%, #B8860B 100%)`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                            >
                                <Users className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Attendance</h2>
                                <p className="text-sm" style={{ color: colors.lighter }}>
                                    {attendance.length} members checked in
                                </p>
                            </div>
                        </div>
                        
                        {/* Event Info - Responsive Layout */}
                        {event && (
                            <div 
                                className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 px-3 sm:px-4 py-2 sm:py-2 rounded-xl"
                                style={{ 
                                    background: 'rgba(0,0,0,0.2)',
                                    boxShadow: 'inset 0 2px 4px rgba(0,0,0,0.2)'
                                }}
                            >
                                {/* Event Title - Always visible */}
                                <div className="flex items-center gap-2 min-w-0">
                                    <Calendar className="w-4 h-4 shrink-0" style={{ color: colors.gold }} />
                                    <span className="text-white text-sm font-medium truncate">{event.title}</span>
                                </div>
                                
                                {/* Divider - Horizontal on mobile, vertical on desktop */}
                                <div className="hidden sm:block w-px h-4 bg-white/20 shrink-0" />
                                <div className="sm:hidden h-px w-full bg-white/10" />
                                
                                {/* Time & Location Row */}
                                <div className="flex items-center gap-3 sm:gap-4 flex-wrap">
                                    <div className="flex items-center gap-1.5 shrink-0">
                                        <Clock className="w-4 h-4" style={{ color: colors.lighter }} />
                                        <span className="text-white/80 text-xs sm:text-sm">{event.start_time}</span>
                                    </div>
                                    {event.location && (
                                        <>
                                            <div className="hidden sm:block w-px h-4 bg-white/20" />
                                            <div className="flex items-center gap-1.5 min-w-0 flex-1">
                                                <MapPin className="w-4 h-4 shrink-0" style={{ color: colors.lighter }} />
                                                <span className="text-white/80 text-xs sm:text-sm truncate">{event.location}</span>
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        )}

                        {/* Status Pills */}
                        <div className="flex flex-wrap gap-2">
                            <Badge 
                                className="h-8 px-3 rounded-lg font-semibold border-0"
                                style={{ 
                                    background: 'rgba(16,185,129,0.15)',
                                    color: '#10B981',
                                    boxShadow: '0 2px 8px rgba(16,185,129,0.2)'
                                }}
                            >
                                Early: {earlyCount}
                            </Badge>
                            <Badge 
                                className="h-8 px-3 rounded-lg font-semibold border-0"
                                style={{ 
                                    background: 'rgba(59,130,246,0.15)',
                                    color: '#3B82F6',
                                    boxShadow: '0 2px 8px rgba(59,130,246,0.2)'
                                }}
                            >
                                On-time: {onTimeCount}
                            </Badge>
                            <Badge 
                                className="h-8 px-3 rounded-lg font-semibold border-0"
                                style={{ 
                                    background: 'rgba(245,158,11,0.15)',
                                    color: '#F59E0B',
                                    boxShadow: '0 2px 8px rgba(245,158,11,0.2)'
                                }}
                            >
                                Late: {lateCount}
                            </Badge>
                            {excusedCount > 0 && (
                                <Badge 
                                    className="h-8 px-3 rounded-lg font-semibold border-0"
                                    style={{ 
                                        background: 'rgba(139,92,246,0.15)',
                                        color: '#8B5CF6',
                                        boxShadow: '0 2px 8px rgba(139,92,246,0.2)'
                                    }}
                                >
                                    Excused: {excusedCount}
                                </Badge>
                            )}
                            {absentCount > 0 && (
                                <Badge 
                                    className="h-8 px-3 rounded-lg font-semibold border-0"
                                    style={{ 
                                        background: 'rgba(239,68,68,0.15)',
                                        color: '#EF4444',
                                        boxShadow: '0 2px 8px rgba(239,68,68,0.2)'
                                    }}
                                >
                                    Absent: {absentCount}
                                </Badge>
                            )}
                        </div>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {!event ? (
                        <div 
                            className="text-center py-16 rounded-2xl"
                            style={{ background: 'rgba(0,0,0,0.2)' }}
                        >
                            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: colors.lighter }} />
                            <p className="text-lg mb-2" style={{ color: colors.light }}>No Event Selected</p>
                            <p className="text-sm" style={{ color: colors.lighter }}>Select an event to view attendance</p>
                        </div>
                    ) : attendance.length === 0 ? (
                        <div 
                            className="text-center py-16 rounded-2xl"
                            style={{ background: 'rgba(0,0,0,0.2)' }}
                        >
                            <CheckCircle className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: colors.lighter }} />
                            <p className="text-lg mb-2" style={{ color: colors.light }}>No Attendance Yet</p>
                            <p className="text-sm" style={{ color: colors.lighter }}>Start scanning QR codes to record attendance</p>
                        </div>
                    ) : (
                        <div 
                            className="rounded-2xl overflow-hidden"
                            style={{ 
                                boxShadow: 'inset 0 2px 8px rgba(0,0,0,0.3)'
                            }}
                        >
                            <div className="overflow-x-auto">
                                <Table>
                                    <TableHeader>
                                        <TableRow 
                                            className="border-0"
                                            style={{ background: 'rgba(0,0,0,0.3)' }}
                                        >
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Member</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Time</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Notes</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {attendanceWithMembers.map((att) => (
                                            <TableRow 
                                                key={att.localId || att.id}
                                                className="border-0 transition-colors hover:bg-white/5"
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-10 h-10 rounded-xl flex items-center justify-center text-lg font-bold text-white"
                                                            style={{ 
                                                                background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                                                            }}
                                                        >
                                                            {att.memberInfo?.full_name.charAt(0).toUpperCase() || '?'}
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-white">
                                                                {att.memberInfo?.full_name || 'Unknown'}
                                                            </div>
                                                            <div className="text-sm" style={{ color: colors.lighter }}>
                                                                {att.memberInfo?.phone}
                                                            </div>
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-white/80">
                                                        <Clock className="w-4 h-4" style={{ color: colors.lighter }} />
                                                        {formatTime(att.check_in_at)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(att.status)}</TableCell>
                                                <TableCell>
                                                    {att.notes ? (
                                                        <div className="flex items-center gap-2 text-sm" style={{ color: colors.lighter }}>
                                                            <MessageSquare className="w-4 h-4 shrink-0" />
                                                            <span className="max-w-[200px] truncate">{att.notes}</span>
                                                        </div>
                                                    ) : (
                                                        <span className="text-white/40">-</span>
                                                    )}
                                                </TableCell>
                                                <TableCell className="text-right">
                                                    <Button
                                                        variant="ghost"
                                                        size="sm"
                                                        onClick={() => handleEdit(att)}
                                                        className="h-10 w-10 rounded-xl p-0 text-white hover:bg-white/10"
                                                    >
                                                        <Pencil className="w-4 h-4" />
                                                    </Button>
                                                </TableCell>
                                            </TableRow>
                                        ))}
                                    </TableBody>
                                </Table>
                            </div>
                        </div>
                    )}
                </div>
            </div>

            <EditAttendanceDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                attendance={selectedAttendance}
                member={selectedMember}
                onSave={handleSave}
                onDelete={handleDelete}
            />
        </>
    );
}
