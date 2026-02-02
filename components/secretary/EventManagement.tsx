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
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuTrigger,
    DropdownMenuSeparator,
} from '@/components/ui/dropdown-menu';
import { Calendar, MoreHorizontal, Pencil, Trash2, Plus, Clock, MapPin, ChevronRight } from 'lucide-react';
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

export function EventManagement({ events, onRefresh, onSelectEvent }: EventManagementProps) {
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showCreateDialog, setShowCreateDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(false);

    const getStatusBadge = (status: string) => {
        const styles: Record<string, { bg: string; text: string }> = {
            active: { bg: 'rgba(16,185,129,0.15)', text: '#10B981' },
            upcoming: { bg: 'rgba(59,130,246,0.15)', text: '#3B82F6' },
            closed: { bg: 'rgba(107,114,128,0.15)', text: '#9CA3AF' },
        };
        
        const style = styles[status] || styles.closed;
        
        return (
            <Badge 
                className="h-8 px-3 rounded-lg font-semibold border-0 capitalize"
                style={{ 
                    background: style.bg,
                    color: style.text,
                    boxShadow: `0 2px 8px ${style.bg}`
                }}
            >
                {status}
            </Badge>
        );
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
            <div 
                className="rounded-3xl overflow-hidden"
                style={{ 
                    background: `linear-gradient(145deg, ${colors.dark} 0%, ${colors.darkest} 100%)`,
                    boxShadow: '0 8px 32px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                }}
            >
                {/* Header */}
                <div className="p-6 border-b" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                        <div className="flex items-center gap-3">
                            <div 
                                className="w-12 h-12 rounded-xl flex items-center justify-center"
                                style={{ 
                                    background: `linear-gradient(145deg, ${colors.gold} 0%, #B8860B 100%)`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                            >
                                <Calendar className="w-6 h-6 text-white" />
                            </div>
                            <div>
                                <h2 className="text-xl font-bold text-white">Event Management</h2>
                                <p className="text-sm" style={{ color: colors.lighter }}>
                                    {events.length} events total
                                </p>
                            </div>
                        </div>
                        
                        <Button
                            onClick={() => setShowCreateDialog(true)}
                            className="h-12 px-6 rounded-xl font-semibold text-white border-0"
                            style={{ 
                                background: `linear-gradient(145deg, ${colors.gold} 0%, #B8860B 100%)`,
                                boxShadow: '0 4px 12px rgba(212,175,55,0.3), inset 0 1px 0 rgba(255,255,255,0.3)'
                            }}
                        >
                            <Plus className="w-5 h-5 mr-2" />
                            Create Event
                        </Button>
                    </div>
                </div>

                {/* Content */}
                <div className="p-6">
                    {events.length === 0 ? (
                        <div 
                            className="text-center py-16 rounded-2xl"
                            style={{ background: 'rgba(0,0,0,0.2)' }}
                        >
                            <Calendar className="w-16 h-16 mx-auto mb-4 opacity-30" style={{ color: colors.lighter }} />
                            <p className="text-lg mb-2" style={{ color: colors.light }}>No Events Yet</p>
                            <p className="text-sm mb-6" style={{ color: colors.lighter }}>Create your first event to get started</p>
                            <Button
                                onClick={() => setShowCreateDialog(true)}
                                className="h-12 px-6 rounded-xl font-semibold text-white border-0"
                                style={{ 
                                    background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                                    boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.2)'
                                }}
                            >
                                <Plus className="w-5 h-5 mr-2" />
                                Create First Event
                            </Button>
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
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Event</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Date</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Time</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs">Status</TableHead>
                                            <TableHead className="text-white/80 font-semibold uppercase tracking-wider text-xs text-right">Actions</TableHead>
                                        </TableRow>
                                    </TableHeader>
                                    <TableBody>
                                        {events.map((event) => (
                                            <TableRow
                                                key={event.localId || event.id}
                                                className="border-0 cursor-pointer transition-colors hover:bg-white/5 group"
                                                style={{ borderBottom: '1px solid rgba(255,255,255,0.05)' }}
                                                onClick={() => onSelectEvent?.(event)}
                                            >
                                                <TableCell>
                                                    <div className="flex items-center gap-3">
                                                        <div 
                                                            className="w-10 h-10 rounded-xl flex items-center justify-center"
                                                            style={{ 
                                                                background: `linear-gradient(145deg, ${colors.light} 0%, ${colors.base} 100%)`,
                                                                boxShadow: '0 4px 12px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                                                            }}
                                                        >
                                                            <Calendar className="w-5 h-5 text-white" />
                                                        </div>
                                                        <div>
                                                            <div className="font-semibold text-white group-hover:text-white transition-colors">
                                                                {event.title}
                                                            </div>
                                                            {event.location && (
                                                                <div className="text-sm flex items-center gap-1" style={{ color: colors.lighter }}>
                                                                    <MapPin className="w-3 h-3" />
                                                                    {event.location}
                                                                </div>
                                                            )}
                                                        </div>
                                                    </div>
                                                </TableCell>
                                                <TableCell>
                                                    <span className="text-white/80">{formatDate(event.event_date)}</span>
                                                </TableCell>
                                                <TableCell>
                                                    <div className="flex items-center gap-2 text-white/80">
                                                        <Clock className="w-4 h-4" style={{ color: colors.lighter }} />
                                                        {formatTime12Hour(event.start_time)}
                                                    </div>
                                                </TableCell>
                                                <TableCell>{getStatusBadge(event.status)}</TableCell>
                                                <TableCell className="text-right">
                                                    <div className="flex items-center justify-end gap-2">
                                                        {/* Quick select button (visible on hover) */}
                                                        <Button
                                                            variant="ghost"
                                                            size="sm"
                                                            onClick={(e) => {
                                                                e.stopPropagation();
                                                                onSelectEvent?.(event);
                                                            }}
                                                            className="h-9 px-3 rounded-lg text-white opacity-0 group-hover:opacity-100 transition-opacity hover:bg-white/10"
                                                        >
                                                            <span className="text-xs mr-1">Select</span>
                                                            <ChevronRight className="w-4 h-4" />
                                                        </Button>
                                                        
                                                        <DropdownMenu>
                                                            <DropdownMenuTrigger asChild onClick={(e) => e.stopPropagation()}>
                                                                <Button 
                                                                    variant="ghost" 
                                                                    size="sm"
                                                                    className="h-9 w-9 rounded-lg p-0 text-white hover:bg-white/10"
                                                                >
                                                                    <MoreHorizontal className="w-5 h-5" />
                                                                </Button>
                                                            </DropdownMenuTrigger>
                                                            <DropdownMenuContent 
                                                                align="end"
                                                                className="rounded-xl border-0"
                                                                style={{ 
                                                                    background: colors.dark,
                                                                    boxShadow: '0 20px 40px rgba(0,0,0,0.3)'
                                                                }}
                                                            >
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        handleEdit(event);
                                                                    }}
                                                                    className="text-white hover:bg-white/10 rounded-lg cursor-pointer"
                                                                >
                                                                    <Pencil className="w-4 h-4 mr-2" style={{ color: colors.lighter }} />
                                                                    Edit Event
                                                                </DropdownMenuItem>
                                                                <DropdownMenuSeparator className="bg-white/10" />
                                                                <DropdownMenuItem
                                                                    onClick={(e) => {
                                                                        e.stopPropagation();
                                                                        setSelectedEvent(event);
                                                                        setShowDeleteDialog(true);
                                                                    }}
                                                                    className="text-red-400 hover:bg-red-500/10 rounded-lg cursor-pointer"
                                                                >
                                                                    <Trash2 className="w-4 h-4 mr-2" />
                                                                    Delete Event
                                                                </DropdownMenuItem>
                                                            </DropdownMenuContent>
                                                        </DropdownMenu>
                                                    </div>
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
