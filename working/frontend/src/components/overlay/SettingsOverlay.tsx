"use client"

import React, { useState, useEffect, useCallback } from 'react';
import {
    Shield, Bell, Globe, Lock, Eye, EyeOff,
    Smartphone, Save, Anchor, Scale, Ship,
    Download, Trash2, ChevronRight, Loader2,
    LogOut, HelpCircle, Languages, Moon, Sun, Monitor,
} from 'lucide-react';

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useAuth } from "@/lib/auth-context";
import { getUserProfile, updateUserProfile, exportUserData, deleteUserAccount } from "@/lib/api-client";
import { toast } from "sonner";
import { cn } from "@/lib/utils";
import { useTheme } from "next-themes";
import { useRouter } from "next/navigation";

// ── Reusable setting row ──────────────────────────────────────────────────────
function SettingRow({
    icon: Icon, label, description, iconBg, iconColor, children, onClick, className,
}: {
    icon: React.ElementType; label: string; description: string;
    iconBg: string; iconColor: string; children?: React.ReactNode;
    onClick?: () => void; className?: string;
}) {
    return (
        <div
            className={cn(
                "flex items-center justify-between p-3 sm:p-3.5 rounded-xl hover:bg-muted/20 transition-colors gap-3",
                onClick && "cursor-pointer", className,
            )}
            onClick={onClick}
        >
            <div className="flex items-center gap-3 min-w-0">
                <div className={cn("p-2 rounded-xl shrink-0", iconBg, iconColor)}>
                    <Icon className="w-4 h-4" />
                </div>
                <div className="min-w-0">
                    <h4 className="text-sm font-semibold leading-tight truncate">{label}</h4>
                    <p className="text-xs text-muted-foreground/60 leading-tight mt-0.5 truncate">{description}</p>
                </div>
            </div>
            {children}
        </div>
    );
}

function Section({ icon: Icon, title, children }: { icon: React.ElementType; title: string; children: React.ReactNode }) {
    return (
        <section className="space-y-2.5">
            <div className="flex items-center gap-2 px-1">
                <Icon className="w-4 h-4 text-primary" />
                <h2 className="text-xs font-bold uppercase tracking-widest text-muted-foreground">{title}</h2>
            </div>
            <Card className="rounded-2xl border-border/30 bg-card/30 overflow-hidden">
                <CardContent className="p-1.5 sm:p-2 space-y-0.5">{children}</CardContent>
            </Card>
        </section>
    );
}

// ═══════════════════════════════════════════════════════════════════
// SETTINGS OVERLAY - lightweight, no router, no page overhead
// ═══════════════════════════════════════════════════════════════════

interface SettingsOverlayProps {
    onClose: () => void;
    onSwitchTab?: (tab: 'profile' | 'help') => void;
}

export default function SettingsOverlay({ onClose, onSwitchTab }: SettingsOverlayProps) {
    const { user, logout, changePassword } = useAuth();
    const { theme, setTheme } = useTheme();
    const router = useRouter();

    const [isLoading, setIsLoading] = useState(true);
    const [showPassword, setShowPassword] = useState(false);
    const [oldPw, setOldPw] = useState("");
    const [newPw, setNewPw] = useState("");
    const [confirmPw, setConfirmPw] = useState("");
    const [showOldPw, setShowOldPw] = useState(false);
    const [showNewPw, setShowNewPw] = useState(false);
    const [isChangingPw, setIsChangingPw] = useState(false);

    const [language, setLanguage] = useState("english");
    const [notifications, setNotifications] = useState(true);
    const [offlineSync, setOfflineSync] = useState(true);
    const [units, setUnits] = useState("kg");
    const [boatType, setBoatType] = useState("");

    const [showDelete, setShowDelete] = useState(false);
    const [deleteText, setDeleteText] = useState("");
    const [isDeleting, setIsDeleting] = useState(false);
    const [isExporting, setIsExporting] = useState(false);

    useEffect(() => {
        getUserProfile()
            .then((p) => {
                setLanguage(p.preferences?.language || "english");
                setNotifications(p.preferences?.notifications ?? true);
                setOfflineSync(p.preferences?.offlineSync ?? true);
                setUnits(p.preferences?.units || "kg");
                setBoatType(p.preferences?.boatType || "");
            })
            .catch(() => { })
            .finally(() => setIsLoading(false));
    }, []);

    const changePw = useCallback(async () => {
        if (newPw !== confirmPw) { toast.error("Passwords don't match"); return; }
        if (newPw.length < 8) { toast.error("Min 8 characters"); return; }
        setIsChangingPw(true);
        try {
            await changePassword(oldPw, newPw);
            toast.success("Password changed!");
            setOldPw(""); setNewPw(""); setConfirmPw(""); setShowPassword(false);
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
        finally { setIsChangingPw(false); }
    }, [oldPw, newPw, confirmPw, changePassword]);

    const savePref = useCallback(async () => {
        try {
            await updateUserProfile({ preferences: { language, notifications, offlineSync, units, boatType } });
            toast.success("Preferences saved!");
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
    }, [language, notifications, offlineSync, units, boatType]);

    const exportData = useCallback(async () => {
        setIsExporting(true);
        try {
            const csv = await exportUserData();
            const blob = new Blob([csv], { type: "text/csv" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a"); a.href = url;
            a.download = `matsyaai-data-${new Date().toISOString().slice(0, 10)}.csv`;
            document.body.appendChild(a); a.click(); document.body.removeChild(a);
            URL.revokeObjectURL(url);
            toast.success("Data exported!");
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
        finally { setIsExporting(false); }
    }, []);

    const deleteAccount = useCallback(async () => {
        if (deleteText !== "DELETE") { toast.error('Type "DELETE" to confirm'); return; }
        setIsDeleting(true);
        try {
            await deleteUserAccount();
            toast.success("Account deleted.");
            logout();
            onClose();
        } catch (e: unknown) { toast.error(e instanceof Error ? e.message : "Failed"); }
        finally { setIsDeleting(false); }
    }, [deleteText, logout, onClose]);

    if (isLoading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="w-5 h-5 text-primary animate-spin" />
            </div>
        );
    }

    return (
        <div className="px-4 sm:px-6 py-5 sm:py-6 space-y-5">
            <div className="space-y-1 pr-8">
                <h1 className="text-lg sm:text-xl font-bold tracking-tight">Settings</h1>
                <p className="text-xs text-muted-foreground/60">Manage security, preferences, and privacy.</p>
            </div>

            {/* SECURITY */}
            <Section icon={Shield} title="Security">
                <SettingRow icon={Lock} label="Change Password" description="Update your password"
                    iconBg="bg-red-500/10" iconColor="text-red-500"
                    onClick={() => setShowPassword(!showPassword)}
                >
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200", showPassword && "rotate-90")} />
                </SettingRow>

                {showPassword && (
                    <div className="px-3 pb-3 space-y-3 animate-in slide-in-from-top-1 fade-in duration-150">
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Current Password</Label>
                            <div className="relative">
                                <Input type={showOldPw ? "text" : "password"} value={oldPw} onChange={(e) => setOldPw(e.target.value)}
                                    placeholder="••••••••" className="h-9 rounded-xl bg-muted/15 border-border/20 px-3 pr-9 text-sm" />
                                <button type="button" onClick={() => setShowOldPw(!showOldPw)}
                                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                                    {showOldPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                </button>
                            </div>
                        </div>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">New Password</Label>
                                <div className="relative">
                                    <Input type={showNewPw ? "text" : "password"} value={newPw} onChange={(e) => setNewPw(e.target.value)}
                                        placeholder="••••••••" className="h-9 rounded-xl bg-muted/15 border-border/20 px-3 pr-9 text-sm" />
                                    <button type="button" onClick={() => setShowNewPw(!showNewPw)}
                                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground/40 hover:text-foreground transition-colors">
                                        {showNewPw ? <EyeOff className="w-3.5 h-3.5" /> : <Eye className="w-3.5 h-3.5" />}
                                    </button>
                                </div>
                            </div>
                            <div className="space-y-1.5">
                                <Label className="text-[10px] font-bold uppercase tracking-widest text-muted-foreground/50 ml-1">Confirm</Label>
                                <Input type="password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)}
                                    placeholder="••••••••" className="h-9 rounded-xl bg-muted/15 border-border/20 px-3 text-sm" />
                            </div>
                        </div>
                        <div className="flex justify-end">
                            <Button size="sm" className="rounded-xl h-8 px-4 bg-primary font-semibold text-xs"
                                onClick={changePw} disabled={isChangingPw || !oldPw || !newPw || !confirmPw}>
                                {isChangingPw ? <><Loader2 className="w-3 h-3 animate-spin mr-1.5" />Changing...</> : "Change Password"}
                            </Button>
                        </div>
                    </div>
                )}
            </Section>

            {/* APP PREFERENCES */}
            <Section icon={Languages} title="Preferences">
                <SettingRow icon={Globe} label="Language" description="Select your language"
                    iconBg="bg-blue-500/10" iconColor="text-blue-500">
                    <Select value={language} onValueChange={setLanguage}>
                        <SelectTrigger className="w-28 h-8 rounded-lg border-border/20 font-semibold text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="english">English</SelectItem>
                            <SelectItem value="hindi">हिन्दी</SelectItem>
                            <SelectItem value="marathi">मराठी</SelectItem>
                            <SelectItem value="malayalam">മലയാളം</SelectItem>
                            <SelectItem value="tamil">தமிழ்</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>

                {/* ── Theme Switcher ── */}
                <SettingRow icon={Moon} label="Appearance" description="Select application theme"
                    iconBg="bg-indigo-500/10" iconColor="text-indigo-500">
                    <div className="flex bg-muted/30 rounded-full p-1 border border-border/20 shrink-0 relative items-center h-9">
                        {/* Animated Background Slider */}
                        <div className={cn(
                            "absolute left-1 top-1 bottom-1 w-8 bg-background rounded-full shadow-sm transition-transform duration-300 ease-in-out border border-border/10",
                            theme === 'light' ? "translate-x-0" :
                                theme === 'system' ? "translate-x-[32px]" :
                                    "translate-x-[64px]"
                        )} />

                        <button
                            onClick={() => setTheme('light')}
                            className={cn("w-8 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'light' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                            title="Light"
                        >
                            <Sun className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setTheme('system')}
                            className={cn("w-8 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'system' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                            title="System Default"
                        >
                            <Monitor className="w-4 h-4" />
                        </button>
                        <button
                            onClick={() => setTheme('dark')}
                            className={cn("w-8 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'dark' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                            title="Dark"
                        >
                            <Moon className="w-4 h-4" />
                        </button>
                    </div>
                </SettingRow>

                <SettingRow icon={Bell} label="Notifications" description="Prices & weather alerts"
                    iconBg="bg-emerald-500/10" iconColor="text-emerald-500">
                    <Switch checked={notifications} onCheckedChange={setNotifications} />
                </SettingRow>
                <SettingRow icon={Smartphone} label="Offline Sync" description="Sync between sea and land"
                    iconBg="bg-amber-500/10" iconColor="text-amber-500">
                    <Switch checked={offlineSync} onCheckedChange={setOfflineSync} />
                </SettingRow>
                <div className="flex justify-end px-3 pt-1 pb-1.5">
                    <Button variant="outline" size="sm" className="rounded-xl h-7 font-semibold text-[11px] gap-1.5 border-border/20" onClick={savePref}>
                        <Save className="w-3 h-3" /> Save
                    </Button>
                </div>
            </Section>

            {/* FISHING PREFERENCES */}
            <Section icon={Anchor} title="Fishing">
                <SettingRow icon={Scale} label="Weight Units" description="Display preference"
                    iconBg="bg-violet-500/10" iconColor="text-violet-500">
                    <Select value={units} onValueChange={setUnits}>
                        <SelectTrigger className="w-24 h-8 rounded-lg border-border/20 font-semibold text-xs shrink-0"><SelectValue /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="kg">Kilograms</SelectItem>
                            <SelectItem value="lb">Pounds</SelectItem>
                            <SelectItem value="g">Grams</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>
                <SettingRow icon={Ship} label="Boat Type" description="Primary vessel"
                    iconBg="bg-cyan-500/10" iconColor="text-cyan-500">
                    <Select value={boatType} onValueChange={setBoatType}>
                        <SelectTrigger className="w-28 h-8 rounded-lg border-border/20 font-semibold text-xs shrink-0"><SelectValue placeholder="Select" /></SelectTrigger>
                        <SelectContent className="rounded-xl">
                            <SelectItem value="trawler">Trawler</SelectItem>
                            <SelectItem value="gillnetter">Gill Netter</SelectItem>
                            <SelectItem value="purse_seiner">Purse Seiner</SelectItem>
                            <SelectItem value="catamaran">Catamaran</SelectItem>
                            <SelectItem value="country_craft">Country Craft</SelectItem>
                            <SelectItem value="motorized">Motorized</SelectItem>
                            <SelectItem value="non_motorized">Non-Motorized</SelectItem>
                        </SelectContent>
                    </Select>
                </SettingRow>
                <div className="flex justify-end px-3 pt-1 pb-1.5">
                    <Button variant="outline" size="sm" className="rounded-xl h-7 font-semibold text-[11px] gap-1.5 border-border/20" onClick={savePref}>
                        <Save className="w-3 h-3" /> Save
                    </Button>
                </div>
            </Section>

            {/* DATA & PRIVACY */}
            <Section icon={Shield} title="Data & Privacy">
                <SettingRow icon={Download} label={isExporting ? "Exporting..." : "Export Data"}
                    description="Download catch history as CSV"
                    iconBg="bg-teal-500/10" iconColor="text-teal-500"
                    onClick={!isExporting ? exportData : undefined}>
                    {isExporting ? <Loader2 className="w-3.5 h-3.5 text-teal-500 animate-spin shrink-0" /> : <ChevronRight className="w-4 h-4 text-muted-foreground/40 shrink-0" />}
                </SettingRow>
                <SettingRow icon={Trash2} label="Delete Account" description="Remove all data permanently"
                    iconBg="bg-red-500/10" iconColor="text-red-500"
                    onClick={() => setShowDelete(!showDelete)} className="hover:bg-red-500/5">
                    <ChevronRight className={cn("w-4 h-4 text-muted-foreground/40 shrink-0 transition-transform duration-200", showDelete && "rotate-90")} />
                </SettingRow>
                {showDelete && (
                    <div className="mx-2 p-3 rounded-xl bg-red-500/5 border border-red-500/10 space-y-2.5 animate-in slide-in-from-top-1 fade-in duration-150">
                        <p className="text-xs text-red-500 font-bold">⚠️ This action is irreversible</p>
                        <p className="text-[11px] text-muted-foreground/60 leading-relaxed">All your data will be permanently deleted.</p>
                        <div className="space-y-1.5">
                            <Label className="text-[10px] font-bold uppercase text-muted-foreground/50">Type <span className="text-red-500">DELETE</span></Label>
                            <Input value={deleteText} onChange={(e) => setDeleteText(e.target.value)} placeholder="DELETE"
                                className="h-8 rounded-xl bg-muted/15 border-red-500/15 px-3 text-xs" />
                        </div>
                        <div className="flex gap-2 justify-end">
                            <Button variant="outline" size="sm" className="rounded-xl h-7 text-[11px] font-semibold"
                                onClick={() => { setShowDelete(false); setDeleteText(""); }}>Cancel</Button>
                            <Button size="sm" className="rounded-xl h-7 px-4 bg-red-500 hover:bg-red-600 text-[11px] font-semibold"
                                onClick={deleteAccount} disabled={isDeleting || deleteText !== "DELETE"}>
                                {isDeleting ? <><Loader2 className="w-3 h-3 animate-spin mr-1" />Deleting...</> : "Delete"}
                            </Button>
                        </div>
                    </div>
                )}
            </Section>

            {/* FOOTER */}
            <div className="pt-3 border-t border-border/20 flex flex-col sm:flex-row gap-1.5 justify-between">
                <Button variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-red-500 hover:bg-red-500/10 font-semibold text-xs gap-1.5 justify-start"
                    onClick={() => { logout(); onClose(); router.push('/login'); }}>
                    <LogOut className="w-3.5 h-3.5" /> Log Out
                </Button>
                {onSwitchTab && (
                    <Button variant="ghost" size="sm" className="rounded-xl h-8 px-3 text-muted-foreground font-semibold text-xs gap-1.5 justify-start sm:justify-end"
                        onClick={() => onSwitchTab('help')}>
                        <HelpCircle className="w-3.5 h-3.5" /> Help & Support
                    </Button>
                )}
            </div>
        </div>
    );
}
