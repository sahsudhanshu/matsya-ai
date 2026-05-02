"use client"

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Camera, Pencil, Save, Globe, ExternalLink,
    X, Copy, Link2, Scale, Loader2,
    Settings, LogOut
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Badge } from "@/components/ui/badge";
import { useAuth } from "@/lib/auth-context";
import { getUserProfile, updateUserProfile } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-client";
import { toast } from "sonner";

// ═══════════════════════════════════════════════════════════════════
// PROFILE OVERLAY - lightweight, no router, renders directly
// ═══════════════════════════════════════════════════════════════════

interface ProfileOverlayProps {
    onClose: () => void;
    onSwitchTab?: (tab: 'settings' | 'help') => void;
}

export default function ProfileOverlay({ onClose, onSwitchTab }: ProfileOverlayProps) {
    const { user, updateUser, logout } = useAuth();
    const fileInputRef = useRef<HTMLInputElement>(null);

    const [profile, setProfile] = useState<UserProfile | null>(null);
    const [isEditing, setIsEditing] = useState(false);
    const [isSaving, setIsSaving] = useState(false);
    const [isLoading, setIsLoading] = useState(true);

    const [editName, setEditName] = useState("");
    const [editPhone, setEditPhone] = useState("");
    const [editPort, setEditPort] = useState("");
    const [editCustomPort, setEditCustomPort] = useState("");
    const [editRegion, setEditRegion] = useState("");
    const [editRole, setEditRole] = useState("");

    const [publicEnabled, setPublicEnabled] = useState(false);
    const [publicSlug, setPublicSlug] = useState("");
    const [showStats, setShowStats] = useState(false);
    const [isSavingPublic, setIsSavingPublic] = useState(false);

    const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
    const [isUploadingAvatar, setIsUploadingAvatar] = useState(false);

    useEffect(() => {
        getUserProfile()
            .then((p) => {
                setProfile(p);
                setPublicEnabled(p.publicProfileEnabled ?? false);
                setPublicSlug(p.publicProfileSlug || "");
                setShowStats((p as unknown as { showPublicStats?: boolean }).showPublicStats ?? false);
                setEditName(p.name || user?.name || "");
                setEditPhone(p.phone || user?.phone || "");
                setEditPort(p.port || user?.port || "");
                setEditCustomPort(p.customPort || "");
                setEditRegion(p.region || user?.region || "");
                setEditRole(p.role || user?.role || "fisherman");
            })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    const cancelEdit = useCallback(() => {
        if (profile) {
            setEditName(profile.name || user?.name || "");
            setEditPhone(profile.phone || user?.phone || "");
            setEditPort(profile.port || user?.port || "");
            setEditCustomPort(profile.customPort || "");
            setEditRegion(profile.region || user?.region || "");
            setEditRole(profile.role || user?.role || "fisherman");
        }
        setIsEditing(false);
    }, [profile, user]);

    const saveProfile = useCallback(async () => {
        setIsSaving(true);
        try {
            const data = {
                name: editName, email: user?.email || "", phone: editPhone,
                port: editPort, customPort: editPort === "other" ? editCustomPort : "",
                region: editRegion, role: editRole,
            };
            const result = await updateUserProfile(data);
            setProfile(result.profile);
            updateUser({ name: editName, phone: editPhone, port: editPort, region: editRegion, role: editRole });
            setIsEditing(false);
            toast.success("Profile saved!");
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
        finally { setIsSaving(false); }
    }, [editName, editPhone, editPort, editCustomPort, editRegion, editRole, user, updateUser]);

    const uploadAvatar = useCallback(async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = (ev) => setAvatarPreview(ev.target?.result as string);
        reader.readAsDataURL(file);
        setIsUploadingAvatar(true);
        try {
            const result = await updateUserProfile({}, file.name, file.type);
            if (result.avatarUploadUrl) {
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();
                    xhr.open("PUT", result.avatarUploadUrl!, true);
                    xhr.setRequestHeader("Content-Type", file.type);
                    xhr.onload = () => xhr.status >= 200 && xhr.status < 300 ? resolve() : reject();
                    xhr.onerror = () => reject();
                    xhr.send(file);
                });
            }
            const avatarUrl = result.avatarS3Url ? `${result.avatarS3Url}?t=${Date.now()}` : avatarPreview || "";
            setProfile((p) => p ? { ...p, avatar: avatarUrl } : p);
            updateUser({ avatar: avatarUrl });
            toast.success("Photo updated!");
        } catch { toast.error("Failed to upload photo"); setAvatarPreview(null); }
        finally { setIsUploadingAvatar(false); }
    }, [updateUser, avatarPreview]);

    const togglePublic = useCallback(async (checked: boolean) => {
        setPublicEnabled(checked);
        let slug = publicSlug;
        if (checked && !slug) {
            const base = (editName || user?.name || "fisherman").toLowerCase().replace(/[^a-z0-9]/g, "-").replace(/-+/g, "-").slice(0, 20);
            slug = `${base}-${(user?.id || "").slice(0, 8)}`;
            setPublicSlug(slug);
        }
        setIsSavingPublic(true);
        try {
            await updateUserProfile({
                name: editName || profile?.name || user?.name || "Fisherman",
                phone: editPhone || profile?.phone || "", port: editPort || profile?.port || "",
                customPort: editPort === "other" ? editCustomPort : "",
                region: editRegion || profile?.region || "", role: editRole || profile?.role || "fisherman",
                publicProfileEnabled: checked, publicProfileSlug: slug,
            } as Record<string, unknown>);
            toast.success(checked ? "Public profile enabled!" : "Public profile disabled");
        } catch { toast.error("Failed"); setPublicEnabled(!checked); }
        finally { setIsSavingPublic(false); }
    }, [publicSlug, editName, editPhone, editPort, editCustomPort, editRegion, editRole, profile, user]);

    const toggleStats = useCallback(async (checked: boolean) => {
        setShowStats(checked);
        try {
            await updateUserProfile({
                name: editName || profile?.name || "", phone: editPhone || profile?.phone || "",
                port: editPort || profile?.port || "", customPort: editPort === "other" ? editCustomPort : "",
                region: editRegion || profile?.region || "", role: editRole || profile?.role || "fisherman",
                showPublicStats: checked,
            } as Record<string, unknown>);
            toast.success(checked ? "Stats visible!" : "Stats hidden");
        } catch { setShowStats(!checked); toast.error("Failed"); }
    }, [editName, editPhone, editPort, editCustomPort, editRegion, editRole, profile]);

    const displayAvatar = avatarPreview || profile?.avatar || user?.avatar || "";
    const displayName = profile?.name || user?.name || "User";
    const displayEmail = user?.email || profile?.email || "";
    const displayRole = profile?.role || user?.role || "fisherman";
    const displayRegion = profile?.region || user?.region || "";
    const userInitials = displayName.split(" ").map((n) => n[0]).join("").toUpperCase().slice(0, 2);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5">
            {/* Header */}
            <div className="space-y-1 pr-8">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">My Profile</h1>
                <p className="text-xs text-muted-foreground/60">View and manage your personal information.</p>
            </div>

            {/* ═════ PROFILE CARD ═════ */}
            <Card className="rounded-2xl border-border/30 bg-card/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5 space-y-5">
                    {/* Avatar + Identity */}
                    <div className="flex items-center gap-4">
                        <div className="relative group shrink-0">
                            <Avatar className="h-16 w-16 sm:h-20 sm:w-20 border-2 border-primary/10 shadow-lg">
                                <AvatarImage src={displayAvatar} />
                                <AvatarFallback className="text-base font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                            </Avatar>
                            <input ref={fileInputRef} type="file" accept="image/jpeg,image/png,image/webp" className="hidden" onChange={uploadAvatar} />
                            <Button size="icon"
                                className="absolute -bottom-1 -right-1 h-8 w-8 min-h-0 min-w-0 p-0 rounded-full bg-primary shadow-md group-hover:scale-110 transition-transform flex items-center justify-center"
                                onClick={() => fileInputRef.current?.click()} disabled={isUploadingAvatar}>
                                {isUploadingAvatar ? <Loader2 className="w-4 h-4 animate-spin" /> : <Camera className="w-4 h-4" />}
                            </Button>
                        </div>
                        <div className="min-w-0 flex-1">
                            <h3 className="text-base sm:text-lg font-bold truncate">{displayName}</h3>
                            <p className="text-xs text-muted-foreground/70 truncate">
                                {displayRole}{displayRegion ? ` • ${displayRegion}` : ""}
                            </p>
                            <p className="text-[11px] text-muted-foreground/50 truncate">{displayEmail}</p>
                            <Badge className="mt-1.5 bg-emerald-500/10 text-emerald-500 border-none px-2 py-0.5 text-[9px] font-bold uppercase">Verified</Badge>
                        </div>
                        <div className="flex flex-col gap-1.5 shrink-0">
                            {!isEditing ? (
                                <Button variant="outline" size="sm" className="rounded-xl h-8 text-xs font-semibold gap-1.5 border-border/20" onClick={() => setIsEditing(true)}>
                                    <Pencil className="w-3 h-3" /> Edit
                                </Button>
                            ) : (
                                <>
                                    <Button size="sm" className="rounded-xl h-8 px-3 bg-primary text-xs font-semibold gap-1.5" onClick={saveProfile} disabled={isSaving}>
                                        {isSaving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Save className="w-3 h-3" />} Save
                                    </Button>
                                    <Button variant="outline" size="sm" className="rounded-xl h-8 px-3 text-xs font-semibold gap-1.5" onClick={cancelEdit}>
                                        <X className="w-3 h-3" /> Cancel
                                    </Button>
                                </>
                            )}
                        </div>
                    </div>

                    {/* Profile Fields */}
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-4 border-t border-border/20">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Full Name</Label>
                            <Input value={editName} onChange={(e) => setEditName(e.target.value)} disabled={!isEditing}
                                className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60" placeholder="Your name" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Email <span className="normal-case text-muted-foreground/30">(locked)</span></Label>
                            <Input value={displayEmail} disabled className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm opacity-50 cursor-not-allowed" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Phone</Label>
                            <Input value={editPhone} onChange={(e) => setEditPhone(e.target.value)} disabled={!isEditing}
                                className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60" placeholder="+91 98765 43210" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Fishing Port</Label>
                            <Select value={editPort} onValueChange={(v) => { setEditPort(v); if (v !== "other") setEditCustomPort(""); }} disabled={!isEditing}>
                                <SelectTrigger className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="ratnagiri">Ratnagiri, Maharashtra</SelectItem>
                                    <SelectItem value="goa">Panaji, Goa</SelectItem>
                                    <SelectItem value="kochi">Kochi, Kerala</SelectItem>
                                    <SelectItem value="mumbai">Sassoon Dock, Mumbai</SelectItem>
                                    <SelectItem value="mangalore">Mangalore, Karnataka</SelectItem>
                                    <SelectItem value="vizag">Visakhapatnam, AP</SelectItem>
                                    <SelectItem value="chennai">Chennai, Tamil Nadu</SelectItem>
                                    <SelectItem value="paradip">Paradip, Odisha</SelectItem>
                                    <SelectItem value="other">Other</SelectItem>
                                    <SelectItem value="not_available">N/A</SelectItem>
                                </SelectContent>
                            </Select>
                            {editPort === "other" && (
                                <Input value={editCustomPort} onChange={(e) => setEditCustomPort(e.target.value)} disabled={!isEditing}
                                    className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60 mt-1.5" placeholder="Port name" />
                            )}
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Region</Label>
                            <Input value={editRegion} onChange={(e) => setEditRegion(e.target.value)} disabled={!isEditing}
                                className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60" placeholder="e.g. Konkan" />
                        </div>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Role</Label>
                            <Select value={editRole} onValueChange={setEditRole} disabled={!isEditing}>
                                <SelectTrigger className="h-9 rounded-xl bg-muted/15 border-border/15 px-3 text-sm disabled:opacity-60"><SelectValue placeholder="Select" /></SelectTrigger>
                                <SelectContent className="rounded-xl">
                                    <SelectItem value="fisherman">Fisherman</SelectItem>
                                    <SelectItem value="boat_owner">Boat Owner</SelectItem>
                                    <SelectItem value="trader">Fish Trader</SelectItem>
                                    <SelectItem value="cooperative_member">Cooperative</SelectItem>
                                    <SelectItem value="researcher">Researcher</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                    </div>
                </CardContent>
            </Card>

            {/* ═════ PUBLIC PROFILE ═════ */}
            <Card className="rounded-2xl border-border/30 bg-card/30 overflow-hidden">
                <CardContent className="p-4 sm:p-5 space-y-3">
                    <div className="flex items-center gap-2 mb-1">
                        <Globe className="w-4 h-4 text-primary" />
                        <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">Public Profile</h2>
                    </div>

                    <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/15 transition-colors">
                        <div className="flex items-center gap-3 min-w-0">
                            <div className="p-2 bg-indigo-500/10 text-indigo-500 rounded-xl shrink-0"><ExternalLink className="w-4 h-4" /></div>
                            <div className="min-w-0">
                                <h4 className="text-sm font-semibold">Enable Public Profile</h4>
                                <p className="text-xs text-muted-foreground/60 truncate">Allow others to view your profile</p>
                            </div>
                        </div>
                        <Switch checked={publicEnabled} onCheckedChange={togglePublic} disabled={isSavingPublic} />
                    </div>

                    {publicEnabled && publicSlug && (
                        <div className="space-y-3 animate-in slide-in-from-top-1 fade-in duration-150">
                            <div className="flex items-center justify-between p-3 rounded-xl hover:bg-muted/15 transition-colors">
                                <div className="flex items-center gap-3 min-w-0">
                                    <div className="p-2 bg-teal-500/10 text-teal-500 rounded-xl shrink-0"><Scale className="w-4 h-4" /></div>
                                    <div className="min-w-0">
                                        <h4 className="text-sm font-semibold">Show Statistics</h4>
                                        <p className="text-xs text-muted-foreground/60 truncate">Display catch stats publicly</p>
                                    </div>
                                </div>
                                <Switch checked={showStats} onCheckedChange={toggleStats} />
                            </div>

                            <div className="space-y-1.5 px-1">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50">Profile URL</Label>
                                <div className="flex gap-2">
                                    <div className="flex-1 flex items-center h-9 rounded-xl bg-muted/15 px-3 text-xs text-muted-foreground truncate">
                                        <Link2 className="w-3.5 h-3.5 mr-2 shrink-0" />
                                        <span className="truncate">{typeof window !== "undefined" ? window.location.origin : ""}/profile/{publicSlug}</span>
                                    </div>
                                    <Button variant="outline" size="sm" className="rounded-xl h-9 px-3 font-semibold text-xs gap-1.5 border-border/20 shrink-0"
                                        onClick={() => { navigator.clipboard.writeText(`${window.location.origin}/profile/${publicSlug}`); toast.success("Copied!"); }}>
                                        <Copy className="w-3 h-3" /> Copy
                                    </Button>
                                </div>
                            </div>

                            <Button variant="outline" size="sm" className="rounded-xl h-8 font-semibold text-xs gap-1.5 border-border/20"
                                onClick={() => window.open(`/profile/${publicSlug}`, '_blank')}>
                                <ExternalLink className="w-3 h-3" /> Preview
                            </Button>
                        </div>
                    )}
                </CardContent>
            </Card>

            {/* ═════ APP SETTINGS & LOGOUT (MOBILE COMPATIBLE) ═════ */}
            <div className="space-y-2 pt-2">
                <Button variant="outline" className="w-full justify-between rounded-2xl h-14 px-5 border-border/30 hover:bg-muted/30 transition-colors"
                    onClick={() => onSwitchTab?.('settings')}>
                    <div className="flex items-center gap-3">
                        <div className="p-2 bg-slate-500/10 text-slate-500 dark:text-slate-400 rounded-xl"><Settings className="w-5 h-5" /></div>
                        <span className="font-semibold text-sm">App Settings</span>
                    </div>
                </Button>
                <Button variant="outline" className="w-full justify-start rounded-2xl h-14 px-5 border-red-500/20 text-red-500 hover:bg-red-500/10 hover:text-red-500 transition-colors"
                    onClick={() => { logout(); onClose(); }}>
                    <LogOut className="w-5 h-5 mr-3" />
                    <span className="font-semibold text-sm">Log Out</span>
                </Button>
            </div>
        </div>
    );
}
