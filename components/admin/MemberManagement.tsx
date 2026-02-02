'use client';

import { useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
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
import {
    Search,
    Plus,
    MoreHorizontal,
    Pencil,
    Trash2,
    Shield,
    User,
    Users,
    QrCode
} from 'lucide-react';
import { Member, UserRole } from '@/types';
import { AddMemberDialog } from './AddMemberDialog';
import { EditMemberDialog } from './EditMemberDialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import db from '@/lib/db';
import { supabase } from '@/lib/supabase';

interface MemberManagementProps {
    members: Member[];
    onRefresh: () => void;
    currentUserId?: string;
}

export function MemberManagement({
    members,
    onRefresh,
    currentUserId
}: MemberManagementProps) {
    const [searchQuery, setSearchQuery] = useState('');
    const [showAddDialog, setShowAddDialog] = useState(false);
    const [showEditDialog, setShowEditDialog] = useState(false);
    const [showDeleteDialog, setShowDeleteDialog] = useState(false);
    const [selectedMember, setSelectedMember] = useState<Member | null>(null);
    const [loading, setLoading] = useState(false);

    // Filter members based on search
    const filteredMembers = members.filter(
        (m) =>
            m.full_name.toLowerCase().includes(searchQuery.toLowerCase()) ||
            m.phone.includes(searchQuery) ||
            (m.email && m.email.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    // Add new member
    const handleAddMember = async (memberData: {
        id?: string;
        full_name: string;
        phone: string;
        email?: string;
        role: UserRole;
        qr_code: string;
    }) => {
        const member: Member = {
            id: memberData.id,
            full_name: memberData.full_name,
            phone: memberData.phone,
            email: memberData.email,
            qr_code: memberData.qr_code,
            role: memberData.role,
            status: 'inactive',
            registered_by: currentUserId,
            syncStatus: 'pending',
        };

        // Save to local DB
        const localId = await db.members.add(member);

        // Add to sync queue
        await db.addToSyncQueue('members', 'create', { ...member, localId });

        // Try to sync immediately if online
        try {
            const insertData: Record<string, unknown> = {
                full_name: member.full_name,
                phone: member.phone,
                email: member.email,
                qr_code: member.qr_code,
                role: member.role,
                status: member.status,
                registered_by: member.registered_by,
            };

            // If we have an auth user ID, include it to link records
            if (memberData.id) {
                insertData.id = memberData.id;
            }

            const { error } = await supabase.from('members').insert(insertData);

            if (!error) {
                await db.members.update(localId, { syncStatus: 'synced' });
            }
        } catch (err) {
            console.error('Failed to sync new member:', err);
        }

        onRefresh();
    };

    // Update member
    const handleUpdateMember = async (localId: number, updates: Partial<Member>) => {
        // Update local DB
        await db.members.update(localId, {
            ...updates,
            syncStatus: 'pending',
            updated_at: new Date().toISOString(),
        });

        // Add to sync queue
        const member = await db.members.get(localId);
        if (member) {
            await db.addToSyncQueue('members', 'update', member);

            // Try to sync immediately if online and has server ID
            if (member.id) {
                try {
                    const { error } = await supabase
                        .from('members')
                        .update({
                            full_name: updates.full_name,
                            phone: updates.phone,
                            email: updates.email,
                            role: updates.role,
                            status: updates.status,
                        })
                        .eq('id', member.id);

                    if (!error) {
                        await db.members.update(localId, { syncStatus: 'synced' });
                    }
                } catch (err) {
                    console.error('Failed to sync member update:', err);
                }
            }
        }

        onRefresh();
    };

    // Soft delete member (set status to inactive)
    const handleDeleteMember = async () => {
        if (!selectedMember?.localId) return;

        setLoading(true);
        try {
            // Soft delete - set status to inactive
            await handleUpdateMember(selectedMember.localId, { status: 'inactive' });
            setShowDeleteDialog(false);
            setSelectedMember(null);
        } finally {
            setLoading(false);
        }
    };

    // Open edit dialog
    const openEditDialog = (member: Member) => {
        setSelectedMember(member);
        setShowEditDialog(true);
    };

    // Open delete confirmation
    const openDeleteDialog = (member: Member) => {
        setSelectedMember(member);
        setShowDeleteDialog(true);
    };

    // Get role badge color
    const getRoleBadge = (role: UserRole) => {
        switch (role) {
            case 'admin':
                return <Badge className="bg-purple-100 text-purple-800">Admin</Badge>;
            case 'secretary':
                return <Badge className="bg-blue-100 text-blue-800">Secretary</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">Member</Badge>;
        }
    };

    // Get status badge color
    const getStatusBadge = (status: string) => {
        switch (status) {
            case 'active':
                return <Badge className="bg-green-100 text-green-800">Active</Badge>;
            case 'irregular':
                return <Badge className="bg-yellow-100 text-yellow-800">Irregular</Badge>;
            case 'at-risk':
                return <Badge className="bg-red-100 text-red-800">At Risk</Badge>;
            default:
                return <Badge className="bg-gray-100 text-gray-800">Inactive</Badge>;
        }
    };

    return (
        <>
            <Card className="border-[#D4AF37]/20">
                <CardHeader>
                    <div className="flex items-center justify-between">
                        <CardTitle className="text-[#0F2C59] flex items-center gap-2">
                            <Users className="w-5 h-5 text-[#D4AF37]" />
                            Member Management
                        </CardTitle>
                        <Button
                            onClick={() => setShowAddDialog(true)}
                            className="bg-[#1E5AA8] hover:bg-[#154785]"
                        >
                            <Plus className="w-4 h-4 mr-2" />
                            Add Member
                        </Button>
                    </div>
                </CardHeader>
                <CardContent>
                    {/* Search */}
                    <div className="mb-4">
                        <div className="relative">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400" />
                            <Input
                                placeholder="Search by name, phone, or email..."
                                value={searchQuery}
                                onChange={(e) => setSearchQuery(e.target.value)}
                                className="pl-10 border-[#1E5AA8]/20"
                            />
                        </div>
                    </div>

                    {/* Members Table */}
                    <div className="rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead>Name</TableHead>
                                    <TableHead>Phone</TableHead>
                                    <TableHead>Role</TableHead>
                                    <TableHead>Status</TableHead>
                                    <TableHead className="text-right">Actions</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredMembers.length === 0 ? (
                                    <TableRow>
                                        <TableCell colSpan={5} className="text-center py-8 text-gray-500">
                                            No members found
                                        </TableCell>
                                    </TableRow>
                                ) : (
                                    filteredMembers.map((member) => (
                                        <TableRow key={member.localId}>
                                            <TableCell>
                                                <div>
                                                    <div className="font-medium text-[#0F2C59]">
                                                        {member.full_name}
                                                    </div>
                                                    {member.email && (
                                                        <div className="text-sm text-gray-500">
                                                            {member.email}
                                                        </div>
                                                    )}
                                                </div>
                                            </TableCell>
                                            <TableCell>{member.phone}</TableCell>
                                            <TableCell>{getRoleBadge(member.role)}</TableCell>
                                            <TableCell>{getStatusBadge(member.status)}</TableCell>
                                            <TableCell className="text-right">
                                                <DropdownMenu>
                                                    <DropdownMenuTrigger asChild>
                                                        <Button variant="ghost" size="sm">
                                                            <MoreHorizontal className="w-4 h-4" />
                                                        </Button>
                                                    </DropdownMenuTrigger>
                                                    <DropdownMenuContent align="end">
                                                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                            <Pencil className="w-4 h-4 mr-2" />
                                                            Edit Details
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                            <Shield className="w-4 h-4 mr-2" />
                                                            Change Role
                                                        </DropdownMenuItem>
                                                        <DropdownMenuItem onClick={() => openEditDialog(member)}>
                                                            <QrCode className="w-4 h-4 mr-2" />
                                                            View QR Code
                                                        </DropdownMenuItem>
                                                        <DropdownMenuSeparator />
                                                        <DropdownMenuItem
                                                            onClick={() => openDeleteDialog(member)}
                                                            className="text-red-600"
                                                        >
                                                            <Trash2 className="w-4 h-4 mr-2" />
                                                            Deactivate
                                                        </DropdownMenuItem>
                                                    </DropdownMenuContent>
                                                </DropdownMenu>
                                            </TableCell>
                                        </TableRow>
                                    ))
                                )}
                            </TableBody>
                        </Table>
                    </div>

                    {/* Stats footer */}
                    <div className="mt-4 flex justify-between text-sm text-gray-500">
                        <span>
                            Showing {filteredMembers.length} of {members.length} members
                        </span>
                        <span>
                            {members.filter((m) => m.status === 'active').length} active
                        </span>
                    </div>
                </CardContent>
            </Card>

            {/* Add Member Dialog */}
            <AddMemberDialog
                open={showAddDialog}
                onOpenChange={setShowAddDialog}
                onSubmit={handleAddMember}
                registeredBy={currentUserId}
            />

            {/* Edit Member Dialog */}
            <EditMemberDialog
                open={showEditDialog}
                onOpenChange={setShowEditDialog}
                member={selectedMember}
                onSubmit={handleUpdateMember}
            />

            {/* Delete Confirmation Dialog */}
            <ConfirmDialog
                open={showDeleteDialog}
                onOpenChange={setShowDeleteDialog}
                title="Deactivate Member"
                description={`Are you sure you want to deactivate ${selectedMember?.full_name}? They will no longer be able to check in to events. This action can be undone by changing their status back to active.`}
                confirmLabel="Deactivate"
                variant="destructive"
                onConfirm={handleDeleteMember}
                loading={loading}
            />
        </>
    );
}
