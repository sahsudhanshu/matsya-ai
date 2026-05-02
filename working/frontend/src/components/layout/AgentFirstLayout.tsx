/* eslint-disable @typescript-eslint/no-explicit-any */
"use client"
/* eslint-disable @next/next/no-img-element */

import React, { useState, useEffect, useCallback, useRef, memo } from 'react';
import Link from 'next/link';
import { usePathname, useRouter } from 'next/navigation';
import { motion, AnimatePresence } from 'framer-motion';
import {
    Sparkles, Upload, MapPin, BarChart3, Clock, Settings,
    HelpCircle, User, LogOut, ChevronLeft, Globe, Bell, X,
    Plus, MessageSquare, PanelLeftClose, PanelLeftOpen,
    Home, Camera, Sun, Moon, Monitor,
    PanelRightOpen, Trash2, Loader2
} from 'lucide-react';
import { useTheme } from 'next-themes';
import { cn } from '@/lib/utils';
import { useAuth } from '@/lib/auth-context';
import { useLanguage, LANGUAGES } from '@/lib/i18n';
import { useAgentFirstStore, selectActiveComponent, selectIsOffline } from '@/lib/stores/agent-first-store';
import AgentChat from '@/components/AgentChat';
import CommandPalette from '@/components/agent/CommandPalette';
import { useAgentContext } from '@/lib/stores/agent-context-store';
import LanguageOnboarding from '@/components/LanguageOnboarding';
import ContentCanvasPane from '@/components/canvas/ContentCanvasPane';
import PaneDivider from './PaneDivider';
import { OfflineIndicator } from './OfflineIndicator';
import OverlayDialog from './OverlayDialog';
import type { OverlayTab } from './OverlayDialog';
import { getConversationsList, createConversation, deleteConversation } from '@/lib/api-client';
import type { Conversation } from '@/lib/api-client';
import {
    DropdownMenu,
    DropdownMenuContent,
    DropdownMenuItem,
    DropdownMenuLabel,
    DropdownMenuSeparator,
    DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
    Tooltip,
    TooltipContent,
    TooltipProvider,
    TooltipTrigger,
} from "@/components/ui/tooltip";

// ── Direct overlay components (no page/router overhead → instant scrolling) ───
import SettingsOverlay from '@/components/overlay/SettingsOverlay';
import ProfileOverlay from '@/components/overlay/ProfileOverlay';
import HelpOverlay from '@/components/overlay/HelpOverlay';

const TOOL_ITEMS = [
    { id: 'upload' as const, icon: Upload, label: 'Upload Catch', color: 'text-emerald-400', activeBg: 'bg-emerald-500/15', hoverBg: 'hover:bg-emerald-500/10' },
    { id: 'map' as const, icon: MapPin, label: 'Ocean Map', color: 'text-cyan-400', activeBg: 'bg-cyan-500/15', hoverBg: 'hover:bg-cyan-500/10' },
    { id: 'history' as const, icon: Clock, label: 'History', color: 'text-orange-400', activeBg: 'bg-orange-500/15', hoverBg: 'hover:bg-orange-500/10' },
    { id: 'analytics' as const, icon: BarChart3, label: 'Analytics', color: 'text-purple-400', activeBg: 'bg-purple-500/15', hoverBg: 'hover:bg-purple-500/10' },
] as const;

// ── Constants ─────────────────────────────────────────────────────────────────
const MOBILE_BREAKPOINT = 768;
const DEFAULT_AGENT_PERCENT = 38;

// ── Memoized Icon Button ──────────────────────────────────────────────────────
const IconRailButton = memo(function IconRailButton({
    icon: Icon, label, isActive, color, activeBg, hoverBg, onClick
}: {
    icon: React.ElementType; label: string; isActive: boolean;
    color?: string; activeBg?: string; hoverBg?: string; onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={onClick}
                    className={cn(
                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-150 relative",
                        isActive
                            ? `${activeBg || 'bg-primary/15'} border border-primary/30 shadow-lg shadow-primary/10`
                            : `bg-transparent border border-transparent ${hoverBg || 'hover:bg-muted/30'} hover:border-border/30`
                    )}
                >
                    <Icon className={cn("w-[18px] h-[18px] transition-colors duration-150", isActive ? (color || 'text-primary') : "text-muted-foreground")} />
                    {isActive && <div className="absolute -right-[1px] top-1/2 -translate-y-1/2 w-[3px] h-4 bg-primary rounded-l-full" />}
                </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p className="text-xs font-medium">{label}</p></TooltipContent>
        </Tooltip>
    );
});

// ── Nav Link Button (for secondary items in rail) ─────────────────────────────
const NavLinkButton = memo(function NavLinkButton({
    icon: Icon, label, isActive, onClick
}: {
    icon: React.ElementType; label: string; isActive: boolean; onClick: () => void;
}) {
    return (
        <Tooltip>
            <TooltipTrigger asChild>
                <button
                    onClick={onClick}
                    className={cn(
                        "w-full aspect-square rounded-xl flex items-center justify-center transition-all duration-150",
                        isActive ? "bg-primary/10 text-primary" : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/30"
                    )}
                >
                    <Icon className="w-[17px] h-[17px]" />
                </button>
            </TooltipTrigger>
            <TooltipContent side="right"><p className="text-xs font-medium">{label}</p></TooltipContent>
        </Tooltip>
    );
});

// ═══════════════════════════════════════════════════════════════════════════════
//  MAIN LAYOUT
// ═══════════════════════════════════════════════════════════════════════════════

export default function AgentFirstLayout() {
    const { user, logout } = useAuth();
    const { locale, setLocale, t } = useLanguage();
    const router = useRouter();
    const { theme, setTheme } = useTheme();

    const activeComponent = useAgentFirstStore(selectActiveComponent);
    const isOffline = useAgentFirstStore(selectIsOffline);
    const setActiveComponent = useAgentFirstStore((s) => s.setActiveComponent);
    const clearComponent = useAgentFirstStore((s) => s.clearComponent);
    const paneWidths = useAgentFirstStore((s) => s.paneWidths);
    const setPaneWidths = useAgentFirstStore((s) => s.setPaneWidths);
    const setOffline = useAgentFirstStore((s) => s.setOffline);

    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false,
    );
    const [mobileDrawerOpen, setMobileDrawerOpen] = useState(false);
    const [chatId, setChatId] = useState<string | null>(null);
    const [agentWidthPercent, setAgentWidthPercent] = useState(DEFAULT_AGENT_PERCENT);
    const [chatCollapsed, setChatCollapsed] = useState(false);
    const [overlayTab, setOverlayTab] = useState<OverlayTab | null>(null);
    const [chatHistory, setChatHistory] = useState<Conversation[]>([]);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [sidebarExpanded, setSidebarExpanded] = useState(false);
    const [rightSidebarExpanded, setRightSidebarExpanded] = useState(false);
    const [profileDropdownOpen, setProfileDropdownOpen] = useState(false);
    const [canvasFlash, setCanvasFlash] = useState(false);
    const [deletingChatId, setDeletingChatId] = useState<string | null>(null);
    const prevActiveRef = useRef<string | null>(null);

    // ── Sync current page to agent context store ──────────────────────────────
    const setContextPage = useAgentContext(s => s.setCurrentPage);
    const clearPanelContext = useAgentContext(s => s.clearPanelContext);
    const clearMapPoint = useAgentContext(s => s.setSelectedMapPoint);
    const prevPanelRef = useRef<string | null>(null);
    useEffect(() => {
        // When leaving a panel, clear only its owned context fields
        if (prevPanelRef.current && prevPanelRef.current !== activeComponent) {
            clearPanelContext(prevPanelRef.current as any);
        }
        prevPanelRef.current = activeComponent;

        // Update current page in context
        setContextPage(activeComponent ?? 'chat');
        // Retained for backward compat: also wipe map pin when not on map
        if (activeComponent !== 'map') {
            clearMapPoint(null);
        }
    }, [activeComponent, setContextPage, clearPanelContext, clearMapPoint]);

    // Hover-to-expand refs
    const leftHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const rightHoverTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    const leftHoverExpanded = useRef(false);
    const rightHoverExpanded = useRef(false);

    const handleLeftMouseEnter = useCallback(() => {
        if (sidebarExpanded || profileDropdownOpen) return;
        leftHoverTimer.current = setTimeout(() => {
            setSidebarExpanded(true);
            leftHoverExpanded.current = true;
        }, 800);
    }, [sidebarExpanded, profileDropdownOpen]);

    const handleLeftMouseLeave = useCallback(() => {
        if (leftHoverTimer.current) { clearTimeout(leftHoverTimer.current); leftHoverTimer.current = null; }
        if (leftHoverExpanded.current) {
            leftHoverTimer.current = setTimeout(() => {
                setSidebarExpanded(false);
                leftHoverExpanded.current = false;
            }, 300);
        }
    }, []);

    const handleRightMouseEnter = useCallback(() => {
        if (rightSidebarExpanded) return;
        rightHoverTimer.current = setTimeout(() => {
            setRightSidebarExpanded(true);
            rightHoverExpanded.current = true;
        }, 800);
    }, [rightSidebarExpanded]);

    const handleRightMouseLeave = useCallback(() => {
        if (rightHoverTimer.current) { clearTimeout(rightHoverTimer.current); rightHoverTimer.current = null; }
        if (rightHoverExpanded.current) {
            rightHoverTimer.current = setTimeout(() => {
                setRightSidebarExpanded(false);
                rightHoverExpanded.current = false;
            }, 300);
        }
    }, []);

    const containerRef = useRef<HTMLDivElement>(null);
    const isDraggingRef = useRef(false);

    // ── Responsive detection ──────────────────────────────────────────────────────
    useEffect(() => {
        const check = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        check();
        window.addEventListener('resize', check);
        return () => window.removeEventListener('resize', check);
    }, []);

    // ── Online/Offline detection ──────────────────────────────────────────────────
    useEffect(() => {
        const handleOnline = () => setOffline(false);
        const handleOffline = () => setOffline(true);
        setOffline(!navigator.onLine);
        window.addEventListener('online', handleOnline);
        window.addEventListener('offline', handleOffline);
        return () => {
            window.removeEventListener('online', handleOnline);
            window.removeEventListener('offline', handleOffline);
        };
    }, [setOffline]);

    // ── Fetch chat history on mount ────────────────────────────────────────────────
    useEffect(() => {
        setIsLoadingHistory(true);
        getConversationsList()
            .then(setChatHistory)
            .catch(() => { })
            .finally(() => setIsLoadingHistory(false));
    }, []);

    // ── Sync pane widths from store ───────────────────────────────────────────────
    useEffect(() => {
        setAgentWidthPercent(paneWidths.agent);
    }, [paneWidths]);

    // ── Auto-open mobile drawer when activeComponent is set externally (e.g. CapabilityCards) ──
    useEffect(() => {
        if (isMobile && activeComponent) {
            setMobileDrawerOpen(true);
        } else if (isMobile && !activeComponent) {
            setMobileDrawerOpen(false);
        }
    }, [isMobile, activeComponent]);

    // ── Canvas flash + auto-expand when agent opens a tool ────────────────────
    useEffect(() => {
        if (activeComponent && prevActiveRef.current !== activeComponent) {
            // Auto-expand chat if it was collapsed
            if (chatCollapsed) setChatCollapsed(false);
            // Trigger flash attention animation on the canvas pane
            setCanvasFlash(true);
            const timer = setTimeout(() => setCanvasFlash(false), 800);
            prevActiveRef.current = activeComponent;
            return () => clearTimeout(timer);
        }
        if (!activeComponent) {
            prevActiveRef.current = null;
        }
    }, [activeComponent, chatCollapsed]);

    // ── Pane resize handler (uses RAF for smooth dragging) ────────────────────────
    const handleResize = useCallback((deltaX: number) => {
        if (!containerRef.current) return;
        const containerWidth = containerRef.current.offsetWidth;
        const deltaPercent = (deltaX / containerWidth) * 100;
        setAgentWidthPercent((prev) => {
            const next = Math.max(25, Math.min(55, prev + deltaPercent));
            return next;
        });
    }, []);

    const resetLayout = useCallback(() => {
        setAgentWidthPercent(DEFAULT_AGENT_PERCENT);
        setPaneWidths({ agent: DEFAULT_AGENT_PERCENT, canvas: 100 - DEFAULT_AGENT_PERCENT });
    }, [setPaneWidths]);

    // Pane widths are auto-persisted by the store's session persistence subscriber

    const handleToolClick = useCallback((toolId: 'upload' | 'map' | 'analytics' | 'history') => {
        if (activeComponent === toolId) {
            clearComponent();
            if (isMobile) setMobileDrawerOpen(false);
        } else {
            setActiveComponent(toolId);
            setChatCollapsed(false); // Ensure chat is visible when opening a tool
            if (isMobile) setMobileDrawerOpen(true);
        }
    }, [activeComponent, clearComponent, setActiveComponent, isMobile]);

    const handleLogout = useCallback(() => {
        logout();
        router.push('/login');
    }, [logout, router]);

    // ── Overlay dialog handlers ───────────────────────────────────────────────────
    const openOverlay = useCallback((tab: OverlayTab) => setOverlayTab(tab), []);
    const closeOverlay = useCallback(() => setOverlayTab(null), []);

    const userInitials = user?.name
        ? user.name.split(' ').map((n: string) => n[0]).join('').toUpperCase().slice(0, 2)
        : 'U';

    // ═══════════════════════════════════════════════════════════════════════════════
    //  RENDER
    // ═══════════════════════════════════════════════════════════════════════════════

    return (
        <TooltipProvider delayDuration={150}>
            <div className="flex h-[100dvh] bg-background text-foreground font-sans overflow-hidden">

                {/* ════════════════════════════════════════════════════════════════════════
            ICON RAIL (Left Edge ~ 64px) - Desktop only
            ════════════════════════════════════════════════════════════════════════ */}
                <aside
                    className={cn(
                        "hidden md:flex flex-col h-full min-h-0 bg-card/30 backdrop-blur-xl border-r border-border/20 shrink-0 z-50 transition-all duration-300 ease-out overflow-hidden",
                        sidebarExpanded ? "w-60" : "w-16"
                    )}
                    onMouseEnter={handleLeftMouseEnter}
                    onMouseLeave={handleLeftMouseLeave}
                >
                    {/* Header - Logo + Toggle */}
                    <div className={cn(
                        "h-14 flex items-center border-b border-border/10 shrink-0 relative",
                        sidebarExpanded ? "px-3 justify-between" : "justify-center"
                    )}>
                        <button
                            onClick={(e) => {
                                if (!sidebarExpanded) {
                                    e.stopPropagation();
                                    setSidebarExpanded(true);
                                    leftHoverExpanded.current = false;
                                } else {
                                    clearComponent();
                                    setChatCollapsed(false);
                                }
                            }}
                            className={cn(
                                " flex items-center transition-all hover:scale-105 cursor-pointer gap-2",
                                sidebarExpanded ? "h-9 px-3" : "w-10 h-10 justify-center group/logobtn"
                            )}
                        >
                            {sidebarExpanded ? (
                                <>
                                    <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain shrink-0" />
                                    <span className="text-sm font-bold text-primary truncate whitespace-nowrap">MatsyaAI</span>
                                </>
                            ) : (
                                <>
                                    <img src="/logo.png" alt="Logo" className="w-10 h-10 object-contain shrink-0 group-hover/logobtn:hidden" />
                                    <PanelLeftOpen className="w-5 h-5 text-primary shrink-0 hidden group-hover/logobtn:block" />
                                </>
                            )}
                        </button>
                        {sidebarExpanded && (
                            <button
                                onClick={() => { setSidebarExpanded(false); leftHoverExpanded.current = false; }}
                                className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/30 text-muted-foreground/50"
                            >
                                <PanelLeftClose className="w-5 h-5 hover:text-primary" />
                            </button>
                        )}
                    </div>

                    {/* New Chat Button */}
                    <div className={cn("pt-3 pb-0.5", sidebarExpanded ? "px-3" : "px-2 flex flex-col items-center")}>
                        <button
                            onClick={() => {
                                setChatCollapsed(false);
                                clearComponent();
                                setChatId(null);
                            }}
                            className={cn(
                                "w-full rounded-xl flex items-center justify-center transition-all bg-transparent group/newchat relative overflow-hidden",
                                sidebarExpanded
                                    ? "w-full h-9 gap-2.5 px-3 hover:bg-muted/20 text-muted-foreground/70 hover:text-foreground justify-start"
                                    : "w-[40px] h-[40px] justify-center hover:bg-muted/30 text-muted-foreground/60 hover:text-foreground duration-150"
                            )}
                        >
                            <Plus className={cn("shrink-0 transition-all", sidebarExpanded ? "w-4 h-4" : "w-[18px] h-[18px]")} />
                            <span className={cn(
                                "text-sm font-semibold truncate whitespace-nowrap transition-[opacity,max-width] duration-150 delay-100 flex-1 text-left",
                                sidebarExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                            )}>
                                New Chat
                            </span>
                            {!sidebarExpanded && (
                                <div className="absolute left-full ml-2 opacity-0 group-hover/newchat:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-border/10 whitespace-nowrap pointer-events-none z-50">
                                    New Chat
                                </div>
                            )}
                        </button>
                    </div>

                    {/* Agent / Chat Button */}
                    <div className={cn("pb-1", sidebarExpanded ? "px-3" : "px-2 flex flex-col items-center")}>
                        <button
                            onClick={() => { clearComponent(); setChatCollapsed(false); }}
                            className={cn(
                                "w-full rounded-xl flex items-center transition-all group/agentbtn relative overflow-hidden",
                                sidebarExpanded
                                    ? "w-full h-9 gap-2.5 px-3 justify-start"
                                    : "w-[40px] h-[40px] justify-center",
                                !activeComponent && !chatCollapsed
                                    ? "bg-primary/10 text-primary"
                                    : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/20"
                            )}
                        >
                            <MessageSquare className={cn("shrink-0 transition-all", sidebarExpanded ? "w-4 h-4" : "w-[18px] h-[18px]")} />
                            <span className={cn(
                                "text-sm font-semibold truncate whitespace-nowrap transition-[opacity,max-width] duration-150 delay-100 flex-1 text-left",
                                sidebarExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                            )}>
                                {chatCollapsed ? 'Open Chat' : 'AI Assistant'}
                            </span>
                            {!sidebarExpanded && (
                                <div className="absolute left-full ml-2 opacity-0 group-hover/agentbtn:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-border/10 whitespace-nowrap pointer-events-none z-50">
                                    {chatCollapsed ? 'Open Chat' : 'AI Assistant'}
                                </div>
                            )}
                        </button>
                    </div>


                    {/* Chat History - only shown when sidebar is expanded */}
                    {sidebarExpanded && (
                        <>
                            {(chatHistory.length > 0 || isLoadingHistory) && (
                                <>
                                    <div className="mx-3 my-1 border-t border-border/15" />
                                    <div className="px-4 py-1">
                                        <p className="text-[10px] font-bold uppercase tracking-widest">Recent chats</p>
                                    </div>
                                </>
                            )}
                            <div className="flex-1 overflow-y-auto overflow-x-hidden py-1 space-y-0.5 px-3 scrollbar-thin scrollbar-thumb-border/20 scrollbar-track-transparent">
                                {isLoadingHistory ? (
                                    // Skeletons while loading
                                    Array.from({ length: 5 }).map((_, i) => (
                                        <div key={`skel-${i}`} className="w-full h-8 rounded-lg flex items-center px-2.5">
                                            <div className="h-3 bg-muted/50 rounded animate-pulse w-full max-w-[80%]" />
                                        </div>
                                    ))
                                ) : (
                                    chatHistory.slice(0, 20).map((conv) => {
                                        const isActive = chatId === conv.conversationId;
                                        return (
                                            <div
                                                key={conv.conversationId}
                                                onClick={() => {
                                                    setChatId(conv.conversationId);
                                                    setChatCollapsed(false);
                                                    clearComponent();
                                                }}
                                                className={cn(
                                                    "w-full h-8 rounded-lg flex items-center gap-2.5 px-2.5 text-left transition-all group/item cursor-pointer",
                                                    isActive
                                                        ? "bg-primary/10 text-primary"
                                                        : "text-muted-foreground/70 hover:text-foreground hover:bg-muted/15"
                                                )}
                                            >
                                                <span className="text-[12px] font-medium truncate whitespace-nowrap flex-1">
                                                    {conv.title || 'Untitled Chat'}
                                                </span>
                                                <button
                                                    onClick={async (e) => {
                                                        e.stopPropagation();
                                                        if (deletingChatId) return;
                                                        setDeletingChatId(conv.conversationId);
                                                        try {
                                                            await deleteConversation(conv.conversationId);
                                                            setChatHistory(prev => prev.filter(c => c.conversationId !== conv.conversationId));
                                                            if (isActive) {
                                                                setChatId(null);
                                                                clearComponent();
                                                            }
                                                        } catch (err) {
                                                            console.error("Failed to delete chat", err);
                                                        } finally {
                                                            setDeletingChatId(null);
                                                        }
                                                    }}
                                                    disabled={deletingChatId === conv.conversationId}
                                                    className={cn(
                                                        "w-5 h-5 rounded flex items-center justify-center transition-all shrink-0",
                                                        deletingChatId === conv.conversationId
                                                            ? "opacity-100 text-muted-foreground"
                                                            : "opacity-0 group-hover/item:opacity-100 hover:bg-red-500/20 hover:text-red-500"
                                                    )}
                                                    title="Delete chat"
                                                >
                                                    {deletingChatId === conv.conversationId ? (
                                                        <Loader2 className="w-3 h-3 animate-spin" />
                                                    ) : (
                                                        <Trash2 className="w-3 h-3" />
                                                    )}
                                                </button>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </>
                    )}

                    {/* Offline Indicator */}
                    {isOffline && (
                        <div className={cn("py-1 flex", sidebarExpanded ? "justify-start px-2" : "justify-center w-full px-2")}>
                            <OfflineIndicator isCompact={!sidebarExpanded} className="text-[10px]" />
                        </div>
                    )}

                    {(!sidebarExpanded || (!isLoadingHistory && chatHistory.length === 0)) && <div className="flex-1" />}

                    {/* Secondary Nav */}
                    <div className={cn("flex flex-col gap-0.5 py-2 border-t border-border/15", sidebarExpanded ? "px-3" : "px-2 items-center")}>
                        {[
                            { icon: HelpCircle, label: 'Help & Support', isActive: overlayTab === 'help', onClick: () => openOverlay('help') },
                        ].map((item) => {
                            const Icon = item.icon;
                            return (
                                <button
                                    key={item.label}
                                    onClick={item.onClick}
                                    className={cn(
                                        "w-full rounded-xl flex items-center transition-all group/sec navbtn relative overflow-hidden",
                                        sidebarExpanded
                                            ? "w-full h-9 gap-2.5 px-3 justify-start"
                                            : "w-[40px] h-[40px] justify-center",
                                        item.isActive
                                            ? "bg-primary/10 text-primary"
                                            : "text-muted-foreground/50 hover:text-foreground hover:bg-muted/20"
                                    )}
                                >
                                    <Icon className="w-[22px] h-[22px] shrink-0 transition-all mx-0.5" />
                                    <span className={cn(
                                        "text-[13px] font-medium truncate whitespace-nowrap transition-[opacity,max-width] duration-150 delay-100 flex-1 text-left",
                                        sidebarExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                                    )}>
                                        {item.label}
                                    </span>
                                    {!sidebarExpanded && (
                                        <div className="absolute left-full ml-2 opacity-0 group-hover/sec:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-border/10 whitespace-nowrap pointer-events-none z-50">
                                            {item.label}
                                        </div>
                                    )}
                                </button>
                            );
                        })}
                    </div>

                    {/* User Avatar */}
                    <div
                        className={cn("pb-3 pt-1 border-t border-border/15", sidebarExpanded ? "px-3" : "px-2 flex flex-col items-center")}
                    >
                        <DropdownMenu open={profileDropdownOpen} onOpenChange={setProfileDropdownOpen}>
                            <DropdownMenuTrigger asChild>
                                <button className={cn(
                                    "w-full flex items-center py-2 transition-all",
                                    sidebarExpanded ? "gap-2.5 px-2 rounded-xl hover:bg-muted/20" : "justify-center"
                                )}>
                                    <Avatar className="h-8 w-8 border border-border/30 hover:border-primary/30 transition-all cursor-pointer shrink-0">
                                        {user?.avatar && (user.avatar.startsWith('http://') || user.avatar.startsWith('https://')) && (
                                            <AvatarImage src={user.avatar} />
                                        )}
                                        <AvatarFallback className="text-[10px] font-bold bg-primary/10 text-primary">{userInitials}</AvatarFallback>
                                    </Avatar>
                                    {sidebarExpanded && (
                                        <div className="min-w-0 text-left">
                                            <p className="text-xs font-semibold truncate">{user?.name ?? 'Fisher'}</p>
                                            <p className="text-[10px] text-muted-foreground/40 truncate">{user?.email ?? ''}</p>
                                        </div>
                                    )}
                                </button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent
                                side="right"
                                align="end"
                                className="w-56 rounded-xl border-border/30"
                            >
                                <DropdownMenuLabel className="font-normal">
                                    <div className="flex flex-col space-y-1 pb-1">
                                        <p className="text-sm font-bold">{user?.name ?? 'Fisher'}</p>
                                        <p className="text-[11px] text-muted-foreground/60">{user?.email ?? 'user@matsyaai.in'}</p>
                                        {user?.port && <Badge className="w-fit mt-1 text-[10px] bg-primary/10 text-primary border-none">{user.port}</Badge>}
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border/20" />
                                <DropdownMenuItem onClick={() => openOverlay('profile')} className="cursor-pointer text-xs">
                                    <User className="mr-2 w-3.5 h-3.5 text-muted-foreground" /> Profile
                                </DropdownMenuItem>
                                <DropdownMenuItem onClick={() => openOverlay('settings')} className="cursor-pointer text-xs">
                                    <Settings className="mr-2 w-3.5 h-3.5 text-muted-foreground" /> Settings
                                </DropdownMenuItem>

                                <DropdownMenuSeparator className="bg-border/20" />
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60 flex items-center justify-between w-full h-10 pr-2">
                                    <span>Appearance</span>
                                    <div className="flex bg-muted/20 rounded-full p-0.5 border border-border/20 shrink-0 relative items-center h-8 w-[98px]">
                                        {/* Animated Background Slider */}
                                        <div className={cn(
                                            "absolute left-0.5 top-0.5 bottom-0.5 w-7 bg-background rounded-full shadow-sm transition-transform duration-300 ease-in-out border border-border/10",
                                            theme === 'light' ? "translate-x-0" :
                                                theme === 'system' ? "translate-x-[28px]" :
                                                    "translate-x-[56px]"
                                        )} />

                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTheme('light'); }}
                                            className={cn("w-7 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'light' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            title="Light"
                                        >
                                            <Sun className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTheme('system'); }}
                                            className={cn("w-7 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'system' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            title="System Default"
                                        >
                                            <Monitor className="w-3.5 h-3.5" />
                                        </button>
                                        <button
                                            onClick={(e) => { e.preventDefault(); e.stopPropagation(); setTheme('dark'); }}
                                            className={cn("w-7 h-full flex items-center justify-center rounded-full transition-all relative z-10", theme === 'dark' ? "text-foreground" : "text-muted-foreground hover:text-foreground")}
                                            title="Dark"
                                        >
                                            <Moon className="w-3.5 h-3.5" />
                                        </button>
                                    </div>
                                </DropdownMenuLabel>
                                <DropdownMenuSeparator className="bg-border/20" />
                                <DropdownMenuLabel className="text-[10px] font-bold uppercase tracking-wider text-muted-foreground/60">Language</DropdownMenuLabel>
                                {LANGUAGES.map((lang) => (
                                    <DropdownMenuItem
                                        key={lang.code}
                                        onClick={() => setLocale(lang.code)}
                                        className={cn(
                                            "cursor-pointer flex items-center justify-between text-xs",
                                            locale === lang.code && "bg-primary/8 text-primary font-bold"
                                        )}
                                    >
                                        <span>{lang.label}</span>
                                        <span className="text-[10px] text-muted-foreground/50">{lang.labelEn}</span>
                                    </DropdownMenuItem>
                                ))}
                                <DropdownMenuSeparator className="bg-border/20" />
                                <DropdownMenuItem onClick={handleLogout} className="text-red-400/80 focus:text-red-400 focus:bg-red-500/5 cursor-pointer">
                                    <LogOut className="mr-2 w-4 h-4" />Logout
                                </DropdownMenuItem>
                            </DropdownMenuContent>
                        </DropdownMenu>
                    </div>
                </aside>

                {/* ════════════════════════════════════════════════════════════════════════
            MAIN CONTENT: Split Pane (Desktop) / Stacked (Mobile)
            ════════════════════════════════════════════════════════════════════════ */}
                <div className="flex-1 flex flex-col h-full min-h-0 overflow-hidden" ref={containerRef}>

                    {/* ── Mobile Top Bar (simplified: logo + offline only) ── */}
                    <div className="md:hidden flex items-center justify-between h-12 px-4 border-b border-border/20 bg-card/30 backdrop-blur-xl shrink-0" data-compact>
                        <div className="flex items-center gap-3">
                            <img src="/logo.png" alt="MatsyaAI" className="w-8 h-8 object-contain" />
                            <span className="font-bold text-base text-foreground">MatsyaAI</span>
                            {isOffline && <OfflineIndicator className="text-[9px] ml-1" />}
                        </div>
                    </div>

                    {/* ── Desktop Split Pane ── */}
                    {!isMobile ? (
                        <div className="flex-1 flex overflow-hidden">
                            {/* Left Pane: Agent Chat (collapsible) */}
                            <AnimatePresence initial={false}>
                                {!chatCollapsed && (
                                    <motion.div
                                        initial={{ width: 0, opacity: 0 }}
                                        animate={{
                                            width: activeComponent ? `${agentWidthPercent}%` : '100%',
                                            opacity: 1,
                                        }}
                                        exit={{ width: 0, opacity: 0 }}
                                        transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                        className="h-full overflow-hidden flex flex-col border-r border-border/10 will-change-[width]"
                                        style={{ minWidth: activeComponent ? 320 : undefined }}
                                    >
                                        {/* Chat with inline collapse button */}
                                        <div className="flex-1 overflow-hidden relative">
                                            <AgentChat
                                                variant="compact"
                                                chatId={chatId}
                                                onChatIdChange={(newId) => setChatId(newId)}
                                                onNewConversationCreated={(conv) => {
                                                    setChatHistory(prev => {
                                                        if (prev.find(c => c.conversationId === conv.conversationId)) return prev;
                                                        return [conv, ...prev];
                                                    });
                                                }}
                                            />
                                            {/* Collapse button - overlaid on chat header */}
                                            {activeComponent && (
                                                <div className="absolute top-2.5 right-2 z-20">
                                                    <Tooltip>
                                                        <TooltipTrigger asChild>
                                                            <button
                                                                onClick={() => setChatCollapsed(true)}
                                                                className="w-7 h-7 rounded-lg flex items-center justify-center bg-muted/40 hover:bg-muted/70 backdrop-blur-sm transition-all text-muted-foreground hover:text-foreground border border-border/20"
                                                            >
                                                                <PanelLeftClose className="w-3.5 h-3.5" />
                                                            </button>
                                                        </TooltipTrigger>
                                                        <TooltipContent side="bottom"><p className="text-xs">Collapse chat</p></TooltipContent>
                                                    </Tooltip>
                                                </div>
                                            )}
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>


                            {/* Divider + Right Pane (Canvas) */}
                            <AnimatePresence>
                                {!chatCollapsed && activeComponent && (
                                    <PaneDivider onResize={handleResize} onReset={resetLayout} />
                                )}
                            </AnimatePresence>

                            <motion.div
                                initial={false}
                                animate={{
                                    width: activeComponent ? (chatCollapsed ? '100%' : `${100 - agentWidthPercent}%`) : 0,
                                    borderLeftWidth: activeComponent ? 1 : 0,
                                }}
                                transition={{ duration: 0.35, ease: [0.16, 1, 0.3, 1] }}
                                className={cn(
                                    "h-full overflow-hidden will-change-[width] border-border/10 bg-background relative z-10",
                                    "transition-[width,border-width,box-shadow] duration-500 ease-[cubic-bezier(0.16,1,0.3,1)]",
                                    canvasFlash && "ring-2 ring-primary/40 shadow-lg shadow-primary/10"
                                )}
                            >
                                <div className="h-full flex flex-col absolute inset-y-0 left-0 min-w-[340px]" style={{ width: '100%' }}>
                                    {/* Canvas Header */}
                                    <div className="h-12 flex items-center justify-between px-4 border-b border-border/20 bg-card/60 backdrop-blur-sm shrink-0">
                                        <div className="flex items-center gap-2">
                                            {/* Expand chat button (only when collapsed) */}
                                            {chatCollapsed && (
                                                <Tooltip>
                                                    <TooltipTrigger asChild>
                                                        <button
                                                            onClick={() => setChatCollapsed(false)}
                                                            className="w-8 h-8 rounded-lg flex items-center justify-center bg-primary/10 border border-primary/20 hover:bg-primary/20 transition-all text-primary mr-1"
                                                        >
                                                            <PanelLeftOpen className="w-4 h-4" />
                                                        </button>
                                                    </TooltipTrigger>
                                                    <TooltipContent side="bottom"><p className="text-xs">Show chat</p></TooltipContent>
                                                </Tooltip>
                                            )}
                                            <div className={cn(
                                                "w-7 h-7 rounded-lg flex items-center justify-center",
                                                activeComponent === 'upload' && "bg-emerald-500/15 text-emerald-400",
                                                activeComponent === 'map' && "bg-cyan-500/15 text-cyan-400",
                                                activeComponent === 'analytics' && "bg-purple-500/15 text-purple-400"
                                            )}>
                                                {activeComponent === 'upload' && <Upload className="w-3.5 h-3.5" />}
                                                {activeComponent === 'map' && <MapPin className="w-3.5 h-3.5" />}
                                                {activeComponent === 'analytics' && <BarChart3 className="w-3.5 h-3.5" />}
                                            </div>
                                            <span className="text-sm font-semibold capitalize">{activeComponent === 'map' ? 'Ocean Map' : activeComponent === 'upload' ? 'Catch Analysis' : 'Analytics'}</span>
                                        </div>
                                        <button
                                            onClick={() => clearComponent()}
                                            className="w-8 h-8 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors text-muted-foreground hover:text-foreground"
                                        >
                                            <X className="w-4 h-4" />
                                        </button>
                                    </div>
                                    {/* Canvas Content - scrollable with responsive padding */}
                                    <div className="flex-1 overflow-y-auto overflow-x-hidden relative">
                                        <div className="p-3 sm:p-4 lg:p-5 min-h-full">
                                            <ContentCanvasPane />
                                        </div>
                                    </div>
                                </div>
                            </motion.div>
                        </div>
                    ) : (
                        /* ── Mobile: Full Chat + Drawer for Canvas ── */
                        <div className="flex-1 overflow-hidden relative pb-[72px]">
                            <AgentChat
                                variant="compact"
                                chatId={chatId}
                                onChatIdChange={(newId) => setChatId(newId)}
                            />

                            {/* Mobile Canvas Drawer */}
                            <AnimatePresence>
                                {activeComponent && mobileDrawerOpen && (
                                    <motion.div
                                        initial={{ x: '100%' }}
                                        animate={{ x: 0 }}
                                        exit={{ x: '100%' }}
                                        transition={{ type: 'spring', damping: 25, stiffness: 300 }}
                                        className="absolute inset-0 z-40 bg-background flex flex-col will-change-transform"
                                    >
                                        {/* Drawer Header */}
                                        <div className="h-12 flex items-center justify-between px-4 border-b border-border/15 bg-card/20 shrink-0">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => { setMobileDrawerOpen(false); clearComponent(); }}
                                                    className="w-10 h-10 rounded-lg flex items-center justify-center hover:bg-muted/30 text-muted-foreground"
                                                >
                                                    <ChevronLeft className="w-5 h-5" />
                                                </button>
                                                <span className="text-sm font-semibold capitalize">{activeComponent === 'map' ? 'Ocean Map' : activeComponent === 'upload' ? 'Catch Analysis' : 'Analytics'}</span>
                                            </div>
                                        </div>
                                        <div className="flex-1 overflow-y-auto overflow-x-hidden relative pb-[72px]">
                                            <div className="p-3 sm:p-4 min-h-full">
                                                <ContentCanvasPane />
                                            </div>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>

                            {/* ════════════════════════════════════════════════════════════════
                                MOBILE BOTTOM TAB NAVIGATION
                                Fixed bar with 4 large, labelled icons for non-tech-savvy users
                            ════════════════════════════════════════════════════════════════ */}
                            <nav className="fixed bottom-0 left-0 right-0 z-50 md:hidden bg-card/95 backdrop-blur-xl border-t border-border/30 safe-area-bottom">
                                <div className="flex items-stretch justify-around h-[68px]">
                                    {[
                                        {
                                            id: 'ai' as const,
                                            icon: Sparkles,
                                            label: 'AI',
                                            isActive: !activeComponent && !mobileDrawerOpen,
                                            onClick: () => { clearComponent(); setMobileDrawerOpen(false); },
                                        },
                                        {
                                            id: 'camera' as const,
                                            icon: Camera,
                                            label: 'Camera',
                                            isActive: activeComponent === 'upload',
                                            onClick: () => handleToolClick('upload'),
                                        },
                                        {
                                            id: 'market' as const,
                                            icon: MapPin,
                                            label: 'Market',
                                            isActive: activeComponent === 'map',
                                            onClick: () => handleToolClick('map'),
                                        },
                                        {
                                            id: 'profile' as const,
                                            icon: User,
                                            label: 'Profile',
                                            isActive: overlayTab === 'profile',
                                            onClick: () => openOverlay('profile'),
                                        },
                                    ].map((tab) => {
                                        const TabIcon = tab.icon;
                                        return (
                                            <button
                                                key={tab.id}
                                                onClick={tab.onClick}
                                                className={cn(
                                                    "flex-1 flex flex-col items-center justify-center gap-1 transition-colors duration-150 relative",
                                                    tab.isActive
                                                        ? "text-primary"
                                                        : "text-muted-foreground"
                                                )}
                                            >
                                                <div className={cn(
                                                    "w-12 h-7 rounded-full flex items-center justify-center transition-all duration-200",
                                                    tab.isActive ? "bg-primary/10" : "bg-transparent"
                                                )}>
                                                    <TabIcon className={cn(
                                                        "w-5 h-5 transition-all",
                                                        tab.isActive && "scale-105"
                                                    )} />
                                                </div>
                                                <span className={cn(
                                                    "text-[11px] font-semibold leading-none",
                                                    tab.isActive && "font-bold"
                                                )}>
                                                    {tab.label}
                                                </span>
                                            </button>
                                        );
                                    })}
                                </div>
                            </nav>

                            {/* Floating Ask AI FAB - visible when tool drawer is open on mobile */}
                            <AnimatePresence>
                                {mobileDrawerOpen && activeComponent && (
                                    <motion.button
                                        initial={{ scale: 0, opacity: 0 }}
                                        animate={{ scale: 1, opacity: 1 }}
                                        exit={{ scale: 0, opacity: 0 }}
                                        transition={{ type: 'spring', stiffness: 400, damping: 25 }}
                                        onClick={() => {
                                            const ctx = activeComponent;
                                            clearComponent();
                                            setMobileDrawerOpen(false);
                                            setTimeout(() => {
                                                (window as any).__agentChatInject?.(`I was just looking at ${ctx}. Help me with what I see there.`);
                                            }, 200);
                                        }}
                                        className="fixed bottom-[84px] right-4 z-[60] md:hidden w-12 h-12 rounded-full bg-primary text-primary-foreground shadow-lg shadow-primary/30 flex items-center justify-center"
                                    >
                                        <Sparkles className="w-5 h-5" />
                                    </motion.button>
                                )}
                            </AnimatePresence>
                        </div>
                    )}
                </div>

                {/* ════════════════════════════════════════════════════════════════════════
                RIGHT SIDEBAR - Tools (Upload, Map, Analytics, History)
                ════════════════════════════════════════════════════════════════════════ */}
                <aside
                    className={
                        cn(
                            "hidden md:flex flex-col h-full min-h-0 bg-card/30 backdrop-blur-xl border-l border-border/20 shrink-0 z-50 transition-all duration-300 ease-[cubic-bezier(0.16,1,0.3,1)] overflow-hidden",
                            rightSidebarExpanded ? "w-52" : "w-14"
                        )
                    }
                    onMouseEnter={handleRightMouseEnter}
                    onMouseLeave={handleRightMouseLeave}
                >
                    {/* Toggle Header */}
                    <div className={
                        cn(
                            "h-14 flex items-center border-b border-border/10 shrink-0 relative group/rtoggle",
                            rightSidebarExpanded ? "px-3 justify-between" : "justify-center"
                        )
                    } >
                        {
                            rightSidebarExpanded ? (
                                <>
                                    <span className="text-xs font-bold uppercase tracking-widest text-muted-foreground/50">Tools</span>
                                    <button
                                        onClick={() => { setRightSidebarExpanded(false); rightHoverExpanded.current = false; }}
                                        className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors text-muted-foreground/50 hover:text-foreground"
                                    >
                                        <PanelLeftOpen className="w-4 h-4" />
                                    </button>
                                </>
                            ) : (
                                <button
                                    onClick={() => { setRightSidebarExpanded(false); rightHoverExpanded.current = false; }}
                                    className="w-7 h-7 rounded-lg flex items-center justify-center hover:bg-muted/30 transition-colors text-muted-foreground/50 hover:text-foreground"
                                >
                                    <PanelRightOpen className="w-4 h-4" />
                                </button>
                                // <button
                                //     onClick={() => { setRightSidebarExpanded(true); rightHoverExpanded.current = false; }}
                                //     className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-5 h-10 rounded-l-md flex items-center justify-center bg-card/60 border border-r-0 border-border/20 opacity-0 group-hover/rtoggle:opacity-100 transition-all duration-200 text-muted-foreground/40 hover:text-foreground hover:bg-muted/40"
                                // >
                                //     <PanelLeftClose className="w-3 h-3" />
                                // </button>
                            )}
                    </div >

                    {/* Tool Buttons */}
                    < div className={cn("flex flex-col gap-0.5 py-2", rightSidebarExpanded ? "px-3" : "px-2")} >
                        {
                            TOOL_ITEMS.map((tool) => {
                                const Icon = tool.icon;
                                const isActive = activeComponent === tool.id;
                                return (
                                    <button
                                        key={tool.id}
                                        onClick={() => handleToolClick(tool.id)}
                                        className={cn(
                                            "w-full rounded-xl flex items-center transition-all group/rtool relative overflow-hidden",
                                            rightSidebarExpanded
                                                ? "w-full h-9 gap-2.5 px-3 justify-start"
                                                : "w-[40px] h-[40px] justify-center",
                                            isActive
                                                ? cn(tool.activeBg, tool.color)
                                                : "text-muted-foreground/60 hover:text-foreground hover:bg-muted/25"
                                        )}
                                    >
                                        <Icon className="shrink-0 transition-all w-[18px] h-[18px]" />
                                        <span className={cn(
                                            "text-sm font-semibold truncate whitespace-nowrap transition-all flex-1 text-left",
                                            rightSidebarExpanded ? "opacity-100 max-w-full" : "opacity-0 max-w-0"
                                        )}>
                                            {tool.label}
                                        </span>
                                        {!rightSidebarExpanded && (
                                            <div className="absolute right-full mr-2 opacity-0 group-hover/rtool:opacity-100 transition-opacity bg-popover text-popover-foreground text-xs px-2 py-1 rounded shadow-[0_0_10px_rgba(0,0,0,0.1)] border border-border/10 whitespace-nowrap pointer-events-none z-50">
                                                {tool.label}
                                            </div>
                                        )}
                                    </button>
                                );
                            })
                        }
                    </div >

                    <div className="flex-1" />
                </aside >

                {/* ════════════════════════════════════════════════════════════════════════
            COMMAND PALETTE (Ctrl+K)
            ════════════════════════════════════════════════════════════════════════ */}
                <CommandPalette
                    chatHistory={chatHistory}
                    onFocusChat={() => {
                        if (isMobile) { setMobileDrawerOpen(false); }
                        setChatCollapsed(false);
                    }}
                    onSelectChat={(id) => setChatId(id)}
                    onNewChat={async () => {
                        try {
                            const conv = await createConversation();
                            setChatId(conv.conversationId);
                            setChatHistory(prev => [conv, ...prev]);
                        } catch { }
                    }}
                />

                {/* ════════════════════════════════════════════════════════════════════════
            OVERLAY DIALOGS (Settings / Profile / Help)
            ════════════════════════════════════════════════════════════════════════ */}
                < OverlayDialog isOpen={overlayTab !== null} onClose={closeOverlay} >
                    {overlayTab === 'settings' && <SettingsOverlay onClose={closeOverlay} onSwitchTab={(tab) => setOverlayTab(tab)} />}
                    {overlayTab === 'profile' && <ProfileOverlay onClose={closeOverlay} onSwitchTab={(tab) => setOverlayTab(tab)} />}
                    {overlayTab === 'help' && <HelpOverlay />}
                </OverlayDialog >

                {/* ════════════════════════════════════════════════════════════════════════
            LANGUAGE ONBOARDING - Full-screen first-visit language selector
            ════════════════════════════════════════════════════════════════════════ */}
                <LanguageOnboarding />

            </div >
        </TooltipProvider >
    );
}
