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
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Eye, EyeOff, Info } from 'lucide-react';
import { UserRole } from '@/types';
import { generateQRCode, generateTempPIN } from '@/lib/utils/checkin';
import { supabase } from '@/lib/supabase';

interface AddMemberDialogProps {
    open: boolean;
    onOpenChange: (open: boolean) => void;
    onSubmit: (member: {
        id?: string;
        full_name: string;
        phone: string;
        email?: string;
        role: UserRole;
        qr_code: string;
    }) => Promise<void>;
    registeredBy?: string;
}

export function AddMemberDialog({
    open,
    onOpenChange,
    onSubmit,
}: AddMemberDialogProps) {
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        full_name: '',
        phone: '',
        email: '',
        password: '',
        role: 'member' as UserRole,
        createLoginAccount: false,
    });
    const [showPassword, setShowPassword] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [successInfo, setSuccessInfo] = useState<string | null>(null);

    const generatePassword = () => {
        // Generate a readable password: 2 words + 4 digits
        const adjectives = ['Happy', 'Bright', 'Swift', 'Calm', 'Bold', 'Kind'];
        const nouns = ['Star', 'Moon', 'Sun', 'Wave', 'Bird', 'Tree'];
        const adj = adjectives[Math.floor(Math.random() * adjectives.length)];
        const noun = nouns[Math.floor(Math.random() * nouns.length)];
        const nums = Math.floor(1000 + Math.random() * 9000);
        const password = `${adj}${noun}${nums}`;
        setFormData({ ...formData, password });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);
        setSuccessInfo(null);
        setLoading(true);

        try {
            // Validate required fields
            if (!formData.full_name.trim()) {
                throw new Error('Full name is required');
            }
            if (!formData.phone.trim()) {
                throw new Error('Phone number is required');
            }

            // Generate QR code
            const qr_code = generateQRCode();
            let userId: string | undefined;

            // If creating login account, need email and password
            if (formData.createLoginAccount) {
                if (!formData.email.trim()) {
                    throw new Error('Email is required for login account');
                }
                if (!formData.password || formData.password.length < 6) {
                    throw new Error('Password must be at least 6 characters');
                }

                // Create Supabase Auth account
                const { data: authData, error: authError } = await supabase.auth.signUp({
                    email: formData.email.trim(),
                    password: formData.password,
                    options: {
                        data: {
                            full_name: formData.full_name.trim(),
                            role: formData.role,
                        },
                    },
                });

                if (authError) {
                    throw new Error(`Auth error: ${authError.message}`);
                }

                userId = authData.user?.id;
                setSuccessInfo(`Login account created! Email: ${formData.email}, Password: ${formData.password}`);
            }

            await onSubmit({
                id: userId,
                full_name: formData.full_name.trim(),
                phone: formData.phone.trim(),
                email: formData.email.trim() || undefined,
                role: formData.role,
                qr_code,
            });

            // Reset form
            setFormData({
                full_name: '',
                phone: '',
                email: '',
                password: '',
                role: 'member',
                createLoginAccount: false,
            });

            // Keep dialog open briefly if we created a login to show credentials
            if (!formData.createLoginAccount) {
                onOpenChange(false);
            }
        } catch (err) {
            setError(err instanceof Error ? err.message : 'Failed to add member');
        } finally {
            setLoading(false);
        }
    };

    return (
        <Dialog open={open} onOpenChange={onOpenChange}>
            <DialogContent className="sm:max-w-[500px]">
                <DialogHeader>
                    <DialogTitle className="text-[#0F2C59]">Add New Member</DialogTitle>
                    <DialogDescription>
                        Create a new member. Optionally create a login account for them.
                    </DialogDescription>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">
                    {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg">
                            {error}
                        </div>
                    )}

                    {successInfo && (
                        <Alert className="border-green-200 bg-green-50">
                            <Info className="h-4 w-4 text-green-600" />
                            <AlertDescription className="text-green-800">
                                <strong>Member created!</strong>
                                <br />
                                {successInfo}
                                <br />
                                <span className="text-xs">Please save these credentials before closing.</span>
                            </AlertDescription>
                        </Alert>
                    )}

                    <div className="space-y-2">
                        <Label htmlFor="full_name">Full Name *</Label>
                        <Input
                            id="full_name"
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
                        <Label htmlFor="phone">Phone Number *</Label>
                        <Input
                            id="phone"
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
                        <Label htmlFor="email">
                            Email {formData.createLoginAccount ? '*' : '(Optional)'}
                        </Label>
                        <Input
                            id="email"
                            type="email"
                            value={formData.email}
                            onChange={(e) =>
                                setFormData({ ...formData, email: e.target.value })
                            }
                            placeholder="email@example.com"
                            className="border-[#1E5AA8]/20"
                            required={formData.createLoginAccount}
                        />
                    </div>

                    <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
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

                    {/* Login Account Toggle */}
                    <div className="border border-[#D4AF37]/30 rounded-lg p-4 space-y-3">
                        <div className="flex items-center justify-between">
                            <div>
                                <Label className="text-sm font-medium">Create Login Account</Label>
                                <p className="text-xs text-gray-500">
                                    Allow member to login and view their QR/stats
                                </p>
                            </div>
                            <input
                                type="checkbox"
                                checked={formData.createLoginAccount}
                                onChange={(e) =>
                                    setFormData({ ...formData, createLoginAccount: e.target.checked })
                                }
                                className="w-5 h-5 rounded border-gray-300"
                            />
                        </div>

                        {formData.createLoginAccount && (
                            <div className="space-y-2 pt-2 border-t border-[#D4AF37]/20">
                                <Label htmlFor="password">Password *</Label>
                                <div className="flex gap-2">
                                    <div className="relative flex-1">
                                        <Input
                                            id="password"
                                            type={showPassword ? 'text' : 'password'}
                                            value={formData.password}
                                            onChange={(e) =>
                                                setFormData({ ...formData, password: e.target.value })
                                            }
                                            placeholder="Min 6 characters"
                                            className="border-[#1E5AA8]/20 pr-10"
                                            required
                                            minLength={6}
                                        />
                                        <button
                                            type="button"
                                            onClick={() => setShowPassword(!showPassword)}
                                            className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
                                        >
                                            {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                                        </button>
                                    </div>
                                    <Button
                                        type="button"
                                        variant="outline"
                                        onClick={generatePassword}
                                        className="shrink-0"
                                    >
                                        Generate
                                    </Button>
                                </div>
                            </div>
                        )}
                    </div>

                    <DialogFooter>
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => onOpenChange(false)}
                            disabled={loading}
                        >
                            {successInfo ? 'Close' : 'Cancel'}
                        </Button>
                        {!successInfo && (
                            <Button
                                type="submit"
                                disabled={loading}
                                className="bg-[#1E5AA8] hover:bg-[#154785]"
                            >
                                {loading ? 'Creating...' : 'Create Member'}
                            </Button>
                        )}
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
}
