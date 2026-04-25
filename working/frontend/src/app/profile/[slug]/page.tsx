"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { getPublicProfile } from "@/lib/api-client";
import type { UserProfile } from "@/lib/api-client";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { ArrowLeft, MapPin, Anchor, User, Calendar, Fish, Scale, BarChart2 } from "lucide-react";

const PORT_LABELS: Record<string, string> = {
    ratnagiri: "Ratnagiri Port, Maharashtra",
    goa: "Panaji Port, Goa",
    kochi: "Kochi Port, Kerala",
    mumbai: "Sassoon Dock, Mumbai",
    mangalore: "Mangalore Port, Karnataka",
    vizag: "Visakhapatnam Port, AP",
    chennai: "Chennai Port, Tamil Nadu",
    paradip: "Paradip Port, Odisha",
    not_available: "Not Available",
};

export default function PublicProfilePage() {
    const params = useParams();
    const router = useRouter();
    const slug = params.slug as string;

    const [profile, setProfile] = useState<Partial<UserProfile> | null>(null);
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState("");

    useEffect(() => {
        async function load() {
            if (!slug) return;
            try {
                const data = await getPublicProfile(slug);
                setProfile(data);
            } catch (err: any) {
                setError(err.message || "Profile not found");
            } finally {
                setLoading(false);
            }
        }
        load();
    }, [slug]);

    const joinDate = profile?.createdAt
        ? new Date(profile.createdAt).toLocaleDateString("en-US", { month: "long", year: "numeric" })
        : null;

    return (
        <div className="min-h-[100dvh] bg-background text-foreground relative pb-24 lg:pb-0 font-sans selection:bg-primary/30">

            {/* Dynamic Background */}
            <div className="fixed inset-0 overflow-hidden pointer-events-none">
                <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-primary/20 dark:bg-primary/10 blur-[100px]" />
                <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-indigo-500/20 dark:bg-indigo-500/10 blur-[100px]" />
            </div>

            <div className="max-w-3xl mx-auto px-6 pt-12 relative z-10 w-full">
                {/* Header */}
                <div className="flex items-center gap-4 mb-4 sm:mb-8">
                    <Button variant="ghost" className="h-10 w-10 p-0 rounded-full bg-muted/20 hover:bg-muted/40" onClick={() => router.push("/")}>
                        <ArrowLeft className="w-5 h-5" />
                    </Button>
                    <h1 className="text-xl font-bold">Public Profile</h1>
                </div>

                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="w-8 h-8 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
                    </div>
                ) : error || !profile ? (
                    <div className="py-20 text-center space-y-4">
                        <h2 className="text-2xl font-bold text-muted-foreground">{error || "Profile not found"}</h2>
                        <p className="text-muted-foreground">This profile might not exist or is set to private.</p>
                        <Button variant="outline" className="mt-4 rounded-xl font-bold" onClick={() => router.push("/")}>
                            Return Home
                        </Button>
                    </div>
                ) : (
                    <Card className="rounded-[2.5rem] border-border/50 bg-card/50 backdrop-blur-sm overflow-hidden shadow-xl sm:mx-0 -mx-4">
                        <CardContent className="px-6 sm:px-8 pb-10 pt-10 relative">
                            {/* Avatar */}
                            <div className="flex justify-between items-end mb-8">
                                <div className="relative group">
                                    <div className="w-24 h-24 sm:w-32 sm:h-32 rounded-full border-4 border-background bg-muted overflow-hidden shadow-2xl relative z-10">
                                        {profile.avatar ? (
                                            <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
                                        ) : (
                                            <div className="w-full h-full flex items-center justify-center bg-muted text-muted-foreground">
                                                <User className="w-12 h-12" />
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>

                            {/* Profile Details */}
                            <div className="space-y-6">
                                <div>
                                    <h1 className="text-3xl font-black mb-1">{profile.name || "Fisherman"}</h1>
                                    <p className="text-muted-foreground capitalize flex items-center gap-2 font-medium">
                                        {profile.role || "Fisherman"}
                                    </p>
                                </div>

                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                        <Anchor className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Fishing Port</p>
                                            <p className="font-bold">
                                                {profile.port === "other"
                                                    ? (profile.customPort || "Not specified")
                                                    : (profile.port ? (PORT_LABELS[profile.port] || profile.port) : "Not specified")}
                                            </p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                        <MapPin className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Region</p>
                                            <p className="font-bold">{profile.region || "Not specified"}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30 col-span-1 md:col-span-2">
                                        <Calendar className="w-5 h-5 text-primary" />
                                        <div>
                                            <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Joined</p>
                                            <p className="font-bold">{joinDate || "Recently"}</p>
                                        </div>
                                    </div>
                                </div>

                                {/* Fishing Stats */}
                                {(profile as any).showPublicStats && (profile as any).stats && (
                                    <div className="mt-4">
                                        <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold mb-3 flex items-center gap-2">
                                            <BarChart2 className="w-3.5 h-3.5" /> Fishing Statistics
                                        </p>
                                        <div className="grid grid-cols-2 gap-3">
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                                <Fish className="w-5 h-5 text-primary" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Total Fish</p>
                                                    <p className="font-bold text-lg">{(profile as any).stats.totalFish ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                                <Scale className="w-5 h-5 text-primary" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Species</p>
                                                    <p className="font-bold text-lg">{(profile as any).stats.uniqueSpecies ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                                <Anchor className="w-5 h-5 text-primary" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Analyses</p>
                                                    <p className="font-bold text-lg">{(profile as any).stats.totalGroups ?? 0}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-3 p-4 rounded-2xl bg-muted/30">
                                                <Calendar className="w-5 h-5 text-primary" />
                                                <div>
                                                    <p className="text-xs uppercase tracking-wider text-muted-foreground font-bold">Last Catch</p>
                                                    <p className="font-bold text-sm">
                                                        {(profile as any).stats.lastCatchDate
                                                            ? new Date((profile as any).stats.lastCatchDate).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })
                                                            : "N/A"}
                                                    </p>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                )}
                            </div>
                        </CardContent>
                    </Card>
                )}
            </div>
        </div>
    );
}
