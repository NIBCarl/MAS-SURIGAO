'use client';

import { useState, useEffect } from 'react';
import {
    Dialog,
    DialogContent,
    DialogDescription,
    DialogFooter,
    DialogHeader,
    DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Event } from '@/types';
import { Calendar, Clock, MapPin } from 'lucide-react';

interface EditEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    event: Event | null;
    onSave: (updates: Partial<Event>) => Promise<void>;
    onDelete?: () => Promise<void>;
}

export function EditEventDialog({
    open,
    onOpenChange,
    event,
    onSave,
    onDelete,
}: EditEventDialogProps) {
    const [formData, setFormData] = useState({
        title: '',
        event_date: '',
        start_time: '',
        location: '',
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Update form when event changes
    useEffect(() => {
        if (event) {
            setFormData({
                title: event.title,
                event_date: event.event_date,
                start_time: event.start_time,
                location: event.location || '',
            });
        }
    }, [event]);

    const handleSave = async () => {
        setError(null);

        if (!formData.title.trim()) {
            setError('Event title is required');
            return;
        }
        if (!formData.event_date) {
            setError('Event date is required');
            return;
        }
        if (!formData.start_time) {
            setError('Start time is required');
            return;
        }

        setLoading(true);
        try {
            await onSave({
                title: formData.title.trim(),
                event_date: formData.event_date,
                start_time: formData.start_time,
                location: formData.location.trim() || undefined,
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to save event');
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
            setError(err instanceof Error ? err.message : 'Failed to delete event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-[#0F2C59] flex items-center gap-2">
                        <Calendar className="w-5 h-5 text-[#D4AF37]" />
                        Edit Event
                    </DialogTitle>
                    <DialogDescription>
                        Update event details or delete the event
                    </DialogDescription>
                </DialogHeader>

                <div className="space-y-4 py-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="title">Event Title *</Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                            placeholder="e.g., Thursday Devotional"
                            className="border-[#1E5AA8]/20"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="event_date">
                                <Calendar className="inline w-4 h-4 mr-1" />
                                Date *
                            </Label>
                            <Input
                                id="event_date"
                                type="date"
                                value={formData.event_date}
                                onChange={(e) => setFormData({ ...formData, event_date: e.target.value })}
                                className="border-[#1E5AA8]/20"
                            />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="start_time">
                                <Clock className="inline w-4 h-4 mr-1" />
                                Time *
                            </Label>
                            <Input
                                id="start_time"
                                type="time"
                                value={formData.start_time}
                                onChange={(e) => setFormData({ ...formData, start_time: e.target.value })}
                                className="border-[#1E5AA8]/20"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location">
                            <MapPin className="inline w-4 h-4 mr-1" />
                            Location (Optional)
                        </Label>
                        <Input
                            id="location"
                            value={formData.location}
                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                            placeholder="e.g., Main Hall"
                            className="border-[#1E5AA8]/20"
                        />
                    </div>
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
                                Delete Event
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
