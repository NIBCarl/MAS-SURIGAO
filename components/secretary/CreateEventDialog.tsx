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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Calendar, Clock, MapPin } from 'lucide-react';
import { format } from 'date-fns';

interface CreateEventDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (event: {
        title: string;
        event_date: string;
        start_time: string;
        location?: string;
    }) => Promise<void>;
    createdBy?: string;
}

export function CreateEventDialog({
    open,
    onOpenChange,
    onSubmit,
}: CreateEventDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        event_date: format(new Date(), 'yyyy-MM-dd'),
        start_time: '19:00',
        location: '',
    });
    const [error, setError] = useState<string | null>(null);

    // Quick presets for common events
    const presets = [
        { title: 'Monday Devotional', time: '19:00' },
        { title: 'Thursday Devotional', time: '19:00' },
        { title: 'Sunday Service', time: '09:00' },
        { title: 'Special Meeting', time: '19:00' },
    ];

    const applyPreset = (preset: { title: string; time: string }) => {
        setFormData({
            ...formData,
            title: preset.title,
            start_time: preset.time,
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setLoading(true);

        try {
            // Validate required fields
            if (!formData.title.trim()) {
                throw new Error('Event title is required');
            }
            if (!formData.event_date) {
                throw new Error('Event date is required');
            }
            if (!formData.start_time) {
                throw new Error('Start time is required');
            }

            await onSubmit({
                title: formData.title.trim(),
                event_date: formData.event_date,
                start_time: formData.start_time,
                location: formData.location.trim() || undefined,
            });

            // Reset form
            setFormData({
                title: '',
                event_date: format(new Date(), 'yyyy-MM-dd'),
                start_time: '19:00',
                location: '',
            });
            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to create event');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-[#0F2C59]">Create New Event</DialogTitle>
                    <DialogDescription>
                        Create a new event for attendance tracking.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                            {error}
                        </div>
                    )}

                    {/* Quick Presets */}
                    <div className="space-y-2">
                        <Label>Quick Presets</Label>
                        <div className="flex flex-wrap gap-2">
                            {presets.map((preset) => (
                                <Button
                                    key={preset.title}
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    onClick={() => applyPreset(preset)}
                                    className="text-xs border-[#D4AF37]/50 hover:bg-[#D4AF37]/10"
                                >
                                    {preset.title}
                                </Button>
                            ))}
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="title" className="flex items-center gap-2">
                            <Calendar className="w-4 h-4 text-[#D4AF37]" />
                            Event Title *
                        </Label>
                        <Input
                            id="title"
                            value={formData.title}
                            onChange={(e) =>
                                setFormData({ ...formData, title: e.target.value })
                            }
                            placeholder="e.g., Monday Devotional"
                            className="border-[#1E5AA8]/20"
                            required
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="event_date">Date *</Label>
                            <Input
                                id="event_date"
                                type="date"
                                value={formData.event_date}
                                onChange={(e) =>
                                    setFormData({ ...formData, event_date: e.target.value })
                                }
                                className="border-[#1E5AA8]/20"
                                required
                            />
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="start_time" className="flex items-center gap-2">
                                <Clock className="w-4 h-4 text-[#D4AF37]" />
                                Start Time *
                            </Label>
                            <Input
                                id="start_time"
                                type="time"
                                value={formData.start_time}
                                onChange={(e) =>
                                    setFormData({ ...formData, start_time: e.target.value })
                                }
                                className="border-[#1E5AA8]/20"
                                required
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="location" className="flex items-center gap-2">
                            <MapPin className="w-4 h-4 text-[#D4AF37]" />
                            Location (Optional)
                        </Label>
                        <Input
                            id="location"
                            value={formData.location}
                            onChange={(e) =>
                                setFormData({ ...formData, location: e.target.value })
                            }
                            placeholder="e.g., Main Hall"
                            className="border-[#1E5AA8]/20"
                        />
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            Cancel
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-[#D4AF37] hover:bg-[#B8860B] text-white"
                        >
                            {loading ? 'Creating...' : 'Create Event'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
