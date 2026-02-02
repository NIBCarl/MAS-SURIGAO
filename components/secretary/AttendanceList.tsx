'use client';

import { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
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
import { Users, Pencil, Clock, CheckCircle, AlertCircle, MessageSquare } from 'lucide-react';
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
        switch (status) {
            case 'early':
                return <Badge className="bg-green-100 text-green-800">Early</Badge>;
            case 'on-time':
                return <Badge className="bg-blue-100 text-blue-800">On-time</Badge>;
            case 'late':
                return <Badge className="bg-yellow-100 text-yellow-800">Late</Badge>;
            case 'excused':
                return <Badge className="bg-purple-100 text-purple-800">Excused</Badge>;
            case 'absent':
                return <Badge className="bg-red-100 text-red-800">Absent</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
        }
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

    return (
        <>
            <Card className="border-[#D4AF37]/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#D4AF37]" />
                            Attendance ({attendance.length})
                        </CardTitle>
                        <div className="flex gap-2">
                            <Badge className="bg-green-100 text-green-800">Early: {earlyCount}</Badge>
                            <Badge className="bg-blue-100 text-blue-800">On-time: {onTimeCount}</Badge>
                            <Badge className="bg-yellow-100 text-yellow-800">Late: {lateCount}</Badge>
                            {excusedCount > 0 && (
                                <Badge className="bg-purple-100 text-purple-800">Excused: {excusedCount}</Badge>
                            )}
                        </div>
                    </div>
                </CardHeader>
                <CardContent>
                    {!event ? (
                        <div className="text-center py-8 text-gray-500">
                            Select an event to view attendance
                        </div>
                    ) : attendance.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <CheckCircle className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            No attendance recorded yet
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Name</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead>Notes</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {attendanceWithMembers.map((att) => (
                                        <TableRow key={att.localId || att.id}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-[#0F2C59]">
                                                        {att.memberInfo?.full_name || 'Unknown'}
                                                    </div>
                                                    <div className="text-sm text-gray-500">
                                                        {att.memberInfo?.phone}
                                                    </div>
                                                </div>
                                            </TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-gray-600">
                                                    <Clock className="w-4 h-4" />
                                                    {formatTime(att.check_in_at)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(att.status)}</TableCell>
                                            <TableCell>
                                                {att.notes ? (
                                                    <div className="flex items-center gap-1 text-sm text-gray-600 max-w-[200px] truncate">
                                                        <MessageSquare className="w-4 h-4 shrink-0" />
                                                        {att.notes}
                                                    </div>
                                                ) : (
                                                    <span className="text-gray-400">-</span>
                                                )}
                                            </TableCell>
                                            <TableCell className="text-right">
                                                <Button
                                                    variant="ghost"
                                                    size="sm"
                                                    onClick={() => handleEdit(att)}
                                                >
                                                    <Pencil className="w-4 h-4" />
                                                </Button>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

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
