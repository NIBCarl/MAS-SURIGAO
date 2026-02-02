'use client';

import { useState } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Attendance, AttendanceStatus, Member } from '@/types';
import { Clock, AlertCircle } from 'lucide-react';

interface EditAttendanceDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    attendance: Attendance | null;
    member?: Member;
    onSave: (updates: { status: AttendanceStatus; notes?: string }) => Promise<void>;
    onDelete?: () => Promise<void>;
}

export function EditAttendanceDialog({
    open,
    onOpenChange,
    attendance,
    member,
    onSave,
    onDelete,
}: EditAttendanceDialogProps) {
    const [status, setStatus] = useState<AttendanceStatus>(attendance?.status || 'on-time');
    const [notes, setNotes] = useState(attendance?.notes || '');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Reset form when dialog opens
    useState(() => {
        if (open && attendance) {
            setStatus(attendance.status);
            setNotes(attendance.notes || '');
        }
    });

    const handleSave = async () => {
        setError(null);

        // Require notes for excused or absent status
        if ((status === 'excused' || status === 'absent') && !notes.trim()) {
            setError(`Please provide a reason for ${status} status`);
            return;
        }

        setLoading(true);
        try {
            await onSave({ status, notes: notes.trim() || undefined });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        if (!onDelete) return;
        setLoading(true);
        try {
            await onDelete();
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to delete');
        } finally {
            setLoading(false);
        }
    };

    const getStatusColor = (s: AttendanceStatus) => {
        switch (s) {
            case 'early': return 'text-green-600';
            case 'on-time': return 'text-blue-600';
            case 'late': return 'text-yellow-600';
            case 'excused': return 'text-purple-600';
            case 'absent': return 'text-red-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-[#0F2C59] flex items-center gap-2">
                        <Clock className="w-5 h-5 text-[#D4AF37]" />
                        Edit Attendance
                    </DialogTitle>
                    <DialogDescription>
                        {member?.full_name || 'Member'} - Update status or mark as excused
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg flex items-center gap-2">
                            <AlertCircle className="w-4 h-4" />
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label>Attendance Status</Label>
                        <Select value={status} onValueChange={(v) => setStatus(v as AttendanceStatus)}>
                            <SelectTrigger className="border-[#1E5AA8]/20">
                                <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="early">
                                    <span className="text-green-600">● Early</span>
                                </SelectItem>
                                <SelectItem value="on-time">
                                    <span className="text-blue-600">● On-time</span>
                                </SelectItem>
                                <SelectItem value="late">
                                    <span className="text-yellow-600">● Late</span>
                                </SelectItem>
                                <SelectItem value="excused">
                                    <span className="text-purple-600">● Excused</span>
                                </SelectItem>
                                <SelectItem value="absent">
                                    <span className="text-red-600">● Absent</span>
                                </SelectItem>
                            </SelectContent>
                        </Select>
                    </div>

                    <div className="space-y-2">
                        <Label>
                            Notes / Reason {(status === 'excused' || status === 'absent') && <span className="text-red-500">*</span>}
                        </Label>
                        <Textarea
                            value={notes}
                            onChange={(e: React.ChangeEvent<HTMLTextAreaElement>) => setNotes(e.target.value)}
                            placeholder={
                                status === 'excused'
                                    ? 'Reason for absence (required)...'
                                    : status === 'absent'
                                        ? 'Reason for marking absent (required)...'
                                        : 'Optional notes...'
                            }
                            className="border-[#1E5AA8]/20 min-h-[80px]"
                        />
                        {(status === 'excused' || status === 'absent') && !notes.trim() && (
                            <p className="text-xs text-red-500">Reason is required for {status} status</p>
                        )}
                    </div>

                    {attendance?.check_in_at && (
                        <div className="text-sm text-gray-500">
                            Checked in: {new Date(attendance.check_in_at).toLocaleString()}
                        </div>
                    )}
                </div>

                <DialogFooter className="flex justify-between">
                    <div>
                        {onDelete && (
                            <Button
                                type="button"
                                variant="ghost"
                                onClick={handleDelete}
                                disabled={loading}
                                className="text-red-600 hover:text-red-700 hover:bg-red-50"
                            >
                                Remove Check-in
                            </Button>
                        )}
                    </div>
                    <div className="flex gap-2">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            onClick={handleSave}
                            disabled={loading}
                            className="bg-[#1E5AA8] hover:bg-[#154785]"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
}
