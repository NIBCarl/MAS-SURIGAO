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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Member, UserRole, MemberStatus } from '@/types';

interface EditMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    member: Member | null;
    onSubmit: (memberId: number, updates: Partial<Member>) => Promise<void>;
}

export function EditMemberDialog({
    open,
    onOpenChange,
    member,
    onSubmit,
}: EditMemberDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        email: '',
        role: 'member' as UserRole,
        status: 'inactive' as MemberStatus,
    });
    const [error, setError] = useState<string | null>(null);

    // Update form when member changes
    useEffect(() => {
        if (member) {
            setFormData({
                full_name: member.full_name,
                phone: member.phone,
                email: member.email || '',
                role: member.role,
                status: member.status,
            });
            setError(null);
        }
    }, [member]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!member?.localId) return;

        setError(null);
        setLoading(true);

        try {
            // Validate required fields
            if (!formData.full_name.trim()) {
                throw new Error('Full name is required');
            }
            if (!formData.phone.trim()) {
                throw new Error('Phone number is required');
            }

            await onSubmit(member.localId, {
                full_name: formData.full_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || undefined,
                role: formData.role,
                status: formData.status,
            });

            onOpenChange(false);
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to update member');
        } finally {
            setLoading(false);
        }
    };

    if (!member) return null;

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[425px]">
                <DialogHeader>
                    <DialogTitle className="text-[#0F2C59]">Edit Member</DialogTitle>
                    <DialogDescription>
                        Update member information. Changes will sync to the database.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                            {error}
                        </div>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="edit_full_name">Full Name *</Label>
                        <Input
                            id="edit_full_name"
                            value={formData.full_name}
                            onChange={(e) =>
                                setFormData({ ...formData, full_name: e.target.value })
                            }
                            placeholder="Enter full name"
                            className="border-[#1E5AA8]/20"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_phone">Phone Number *</Label>
                        <Input
                            id="edit_phone"
                            value={formData.phone}
                            onChange={(e) =>
                                setFormData({ ...formData, phone: e.target.value })
                            }
                            placeholder="09XX XXX XXXX"
                            className="border-[#1E5AA8]/20"
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="edit_email">Email (Optional)</Label>
                        <Input
                            id="edit_email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            placeholder="email@example.com"
                            className="border-[#1E5AA8]/20"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <Label htmlFor="edit_role">Role</Label>
                            <Select
                                value={formData.role}
                                onValueChange={(value: UserRole) =>
                                    setFormData({ ...formData, role: value })
                                }
                            >
                                <SelectTrigger className="border-[#1E5AA8]/20">
                                    <SelectValue placeholder="Select role" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="member">Member</SelectItem>
                                    <SelectItem value="secretary">Secretary</SelectItem>
                                    <SelectItem value="admin">Admin</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>

                        <div className="space-y-2">
                            <Label htmlFor="edit_status">Status</Label>
                            <Select
                                value={formData.status}
                                onValueChange={(value: MemberStatus) =>
                                    setFormData({ ...formData, status: value })
                                }
                            >
                                <SelectTrigger className="border-[#1E5AA8]/20">
                                    <SelectValue placeholder="Select status" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="active">Active</SelectItem>
                                    <SelectItem value="irregular">Irregular</SelectItem>
                                    <SelectItem value="at-risk">At Risk</SelectItem>
                                    <SelectItem value="inactive">Inactive</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
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
                            className="bg-[#1E5AA8] hover:bg-[#154785]"
                        >
                            {loading ? 'Saving...' : 'Save Changes'}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
