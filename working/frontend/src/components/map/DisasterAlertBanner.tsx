"use client";

import React, { useState } from "react";
import { AlertTriangle, ChevronDown, ChevronUp, X, Shield, ShieldAlert } from "lucide-react";
import { cn } from "@/lib/utils";
import { Badge } from "@/components/ui/badge";
import type { DisasterAlert } from "@/lib/alerts";
import {
    getSeverityColor,
    getSeverityBg,
    getSeverityLabel,
    getAlertIcon,
    timeUntilExpiry,
} from "@/lib/alerts";

interface Props {
    alerts: DisasterAlert[];
    safetyStatus: "SAFE" | "UNSAFE" | null; // null = location unknown
    onDismiss?: (id: string) => void;
}

export default function DisasterAlertBanner({ alerts, safetyStatus, onDismiss }: Props) {
    const [expanded, setExpanded] = useState(false);
    const [dismissed, setDismissed] = useState<Set<string>>(new Set());

    const visible = alerts.filter((a) => !dismissed.has(a.id));
    if (visible.length === 0) return null;

    // Sort: red first, then orange, then yellow
    const sorted = [...visible].sort((a, b) => {
        const order = { red: 0, orange: 1, yellow: 2 };
        return order[a.severity] - order[b.severity];
    });
    const top = sorted[0];

    const handleDismiss = (id: string) => {
        setDismissed((prev) => new Set(prev).add(id));
        onDismiss?.(id);
    };

    return (
        <div className="space-y-2">
            {/* ── Top Banner ─────────────────────────────────────────────── */}
            <button
                onClick={() => setExpanded(!expanded)}
                className={cn(
                    "w-full flex items-center gap-3 px-4 py-3 rounded-2xl border backdrop-blur-sm transition-all",
                    top.severity === "red"
                        ? "bg-red-500/10 border-red-500/30"
                        : top.severity === "orange"
                            ? "bg-orange-500/10 border-orange-500/30"
                            : "bg-yellow-500/10 border-yellow-500/30"
                )}
            >
                <div
                    className="p-2 rounded-xl"
                    style={{ backgroundColor: getSeverityColor(top.severity) + "20" }}
                >
                    <AlertTriangle
                        className="w-5 h-5"
                        style={{ color: getSeverityColor(top.severity) }}
                    />
                </div>
                <div className="flex-1 text-left">
                    <div className="flex items-center gap-2">
                        <span className="text-sm font-bold">{top.title}</span>
                        <Badge
                            className={cn("text-[9px] h-4 border", getSeverityBg(top.severity))}
                        >
                            {getSeverityLabel(top.severity)}
                        </Badge>
                    </div>
                    <p className="text-xs text-muted-foreground line-clamp-1">{top.description}</p>
                </div>

                {/* Safety Status Pill */}
                {safetyStatus && (
                    <div
                        className={cn(
                            "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold border",
                            safetyStatus === "SAFE"
                                ? "bg-emerald-500/15 border-emerald-500/30 text-emerald-400"
                                : "bg-red-500/15 border-red-500/30 text-red-400"
                        )}
                    >
                        {safetyStatus === "SAFE" ? (
                            <Shield className="w-3.5 h-3.5" />
                        ) : (
                            <ShieldAlert className="w-3.5 h-3.5" />
                        )}
                        {safetyStatus}
                    </div>
                )}

                <div className="flex items-center gap-2 text-muted-foreground">
                    <span className="text-[10px] font-bold">{visible.length} alert{visible.length > 1 ? "s" : ""}</span>
                    {expanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </div>
            </button>

            {/* ── Expanded Alert Cards ───────────────────────────────────── */}
            {expanded && (
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 animate-in slide-in-from-top-2 duration-200">
                    {sorted.map((alert) => (
                        <div
                            key={alert.id}
                            className={cn(
                                "relative p-4 rounded-2xl border backdrop-blur-sm transition-all",
                                getSeverityBg(alert.severity)
                            )}
                        >
                            <button
                                onClick={() => handleDismiss(alert.id)}
                                className="absolute top-3 right-3 p-1 rounded-lg hover:bg-white/10 transition-colors"
                            >
                                <X className="w-3.5 h-3.5" />
                            </button>

                            <div className="flex items-start gap-3">
                                <span className="text-2xl">{getAlertIcon(alert.type)}</span>
                                <div className="flex-1 min-w-0">
                                    <div className="flex items-center gap-2 mb-1">
                                        <h4 className="text-sm font-bold truncate">{alert.title}</h4>
                                    </div>
                                    <p className="text-xs opacity-80 line-clamp-2 mb-2">{alert.description}</p>
                                    <div className="flex items-center gap-3 text-[10px] font-bold uppercase tracking-wider opacity-70">
                                        <span
                                            className="flex items-center gap-1"
                                        >
                                            <span
                                                className="w-2 h-2 rounded-full inline-block"
                                                style={{ backgroundColor: getSeverityColor(alert.severity) }}
                                            />
                                            {getSeverityLabel(alert.severity)}
                                        </span>
                                        <span>⏱ {timeUntilExpiry(alert.expiresAt)}</span>
                                        <span>{alert.radiusKm}km zone</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
