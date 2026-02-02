'use client';

import { useState } from 'react';
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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar, MoreHorizontal, Pencil, Trash2, Plus, Clock, MapPin } from 'lucide-react';
import { Event } from '@/types';
import { EditEventDialog } from './EditEventDialog';
import { CreateEventDialog } from './CreateEventDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import db from '@/lib/db';
import { supabase } from '@/lib/supabase';

interface EventManagementProps {
    events: Event[];
    onRefresh: () => void;
    onSelectEvent?: (event: Event) => void;
}

export function EventManagement({ events, onRefresh, onSelectEvent }: EventManagementProps) {
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(false);

    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-800">Active</Badge>;
            case 'upcoming':
                return <Badge className="bg-blue-100 text-blue-800">Upcoming</Badge>;
            case 'closed':
                return <Badge className="bg-gray-100 text-gray-800">Closed</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">{status}</Badge>;
        }
    };

    const formatDate = (dateStr: string) => {
        return new Date(dateStr).toLocaleDateString('en-US', {
            weekday: 'short',
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    // Format time from 24-hour to 12-hour format
    const formatTime12Hour = (time: string) => {
        const [hours, minutes] = time.split(':');
        const hour = parseInt(hours, 10);
        const ampm = hour >= 12 ? 'PM' : 'AM';
        const hour12 = hour % 12 || 12;
        return `${hour12}:${minutes} ${ampm}`;
    };

    const handleEdit = (event: Event) => {
        setSelectedEvent(event);
        setShowEditDialog(true);
    };

    const handleSaveEdit = async (updates: Partial<Event>) => {
        if (!selectedEvent?.localId) return;

        // Update local DB
        await db.events.update(selectedEvent.localId, {
            ...updates,
            syncStatus: 'pending',
        });

        // Add to sync queue
        const updated = await db.events.get(selectedEvent.localId);
        if (updated) {
            await db.addToSyncQueue('events', 'update', updated);

            // Try to sync if has server ID
            if (updated.id) {
                try {
                    await supabase
                        .from('events')
                        .update(updates)
                        .eq('id', updated.id);

                    await db.events.update(selectedEvent.localId, { syncStatus: 'synced' });
                } catch (err) {
                    console.error('Failed to sync event update:', err);
                }
            }
        }

        onRefresh();
    };

    const handleDelete = async () => {
        if (!selectedEvent?.localId) return;

        setLoading(true);
        try {
            // Delete from local DB
            await db.events.delete(selectedEvent.localId);

            // Sync delete if has server ID
            if (selectedEvent.id) {
                await db.addToSyncQueue('events', 'delete', selectedEvent);
                try {
                    await supabase.from('events').delete().eq('id', selectedEvent.id);
                } catch (err) {
                    console.error('Failed to sync event delete:', err);
                }
            }

            onRefresh();
            setShowDeleteDialog(false);
        } finally {
            setLoading(false);
        }
    };

    const handleCreateEvent = async (eventData: {
        title: string;
        event_date: string;
        start_time: string;
        location?: string;
    }) => {
        const event: Event = {
            ...eventData,
            status: 'active',
            syncStatus: 'pending',
        };

        const localId = await db.events.add(event);
        await db.addToSyncQueue('events', 'create', { ...event, localId });

        // Try to sync
        try {
            const { error } = await supabase.from('events').insert({
                title: event.title,
                event_date: event.event_date,
                start_time: event.start_time,
                location: event.location,
                status: event.status,
            });

            if (!error) {
                await db.events.update(localId, { syncStatus: 'synced' });
            }
        } catch (err) {
            console.error('Failed to sync new event:', err);
        }

        onRefresh();
    };

    return (
        <>
            <Card className="border-[#D4AF37]/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                            <Calendar className="w-5 h-5 text-[#D4AF37]" />
                            Event Management
                        </CardTitle>
                        <Button
                            onClick={() => setShowCreateDialog(true)}
                            className="bg-[#D4AF37] hover:bg-[#B8860B] text-white"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Create Event
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {events.length === 0 ? (
                        <div className="text-center py-8 text-gray-500">
                            <Calendar className="w-12 h-12 mx-auto mb-2 text-gray-300" />
                            No events yet. Create your first event!
                        </div>
                    ) : (
                        <div className="rounded-md border">
                            <Table>
                                <TableHeader>
                                    <TableRow>
                                        <TableHead>Event</TableHead>
                                        <TableHead>Date</TableHead>
                                        <TableHead>Time</TableHead>
                                        <TableHead>Status</TableHead>
                                        <TableHead className="text-right">Actions</TableHead>
                                    </TableRow>
                                </TableHeader>
                                <TableBody>
                                    {events.map((event) => (
                                        <TableRow
                                            key={event.localId || event.id}
                                            className="cursor-pointer hover:bg-gray-50"
                                            onClick={() => onSelectEvent?.(event)}
                                        >
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-[#0F2C59]">{event.title}</div>
                                                    {event.location && (
                                                        <div className="text-sm text-gray-500 flex items-center gap-1">
                                                            <MapPin className="w-3 h-3" />
                                                            {event.location}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{formatDate(event.event_date)}</TableCell>
                                            <TableCell>
                                                <div className="flex items-center gap-1 text-gray-600">
                                                    <Clock className="w-4 h-4" />
                                                    {formatTime12Hour(event.start_time)}
                                                </div>
                                            </TableCell>
                                            <TableCell>{getStatusBadge(event.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                handleEdit(event);
                                                            }}
                                                        >
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Edit Event
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                setSelectedEvent(event);
                                                                setShowDeleteDialog(true);
                                                            }}
                                                            className="text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Delete Event
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))}
                                </TableBody>
                            </Table>
                        </div>
                    )}
                </CardContent>
            </Card>

            <EditEventDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                event={selectedEvent}
                onSave={handleSaveEdit}
                onDelete={() => {
                    setShowEditDialog(false);
                    setShowDeleteDialog(true);
                    return Promise.resolve();
                }}
            />

            <CreateEventDialog
                open={showCreateDialog}
                onOpenChange={setShowCreateDialog}
                onSubmit={handleCreateEvent}
            />

            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Delete Event"
                description={`Are you sure you want to delete "${selectedEvent?.title}"? This will also delete all attendance records for this event. This action cannot be undone.`}
                confirmLabel="Delete"
                variant="destructive"
                onConfirm={handleDelete}
                loading={loading}
            />
        </>
    );
}
