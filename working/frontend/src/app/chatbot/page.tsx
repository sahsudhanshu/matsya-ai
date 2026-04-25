"use client"

import React, { useState, useEffect } from 'react';
import {
  MessageSquare, Clock, ChevronRight, Zap, Fish, CloudRain, Waves, BookOpen, HelpCircle, Plus, ExternalLink
} from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Card, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import { getConversationsList } from "@/lib/api-client";
import type { Conversation } from "@/lib/api-client";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import AgentChat from '@/components/AgentChat';

// ── Helpers ────────────────────────────────────────────────────────────────
const parseSafeDate = (dateInput: string | Date | undefined): Date => {
  if (!dateInput) return new Date();
  let d = new Date(dateInput);
  if (isNaN(d.getTime()) && typeof dateInput === 'string')
    d = new Date(dateInput.replace(/\.[0-9a-fA-F]{3}Z$/, '.000Z'));
  return isNaN(d.getTime()) ? new Date() : d;
};

function ConversationSkeleton() {
  return (
    <div className="space-y-2 px-1 animate-pulse">
      {[80, 65, 90].map((w, i) => (
        <div key={i} className="flex items-center gap-2.5 p-3 rounded-xl bg-muted/20">
          <Skeleton className="w-6 h-6 rounded-lg shrink-0" />
          <div className="flex-1 space-y-1.5">
            <Skeleton className={`h-3 rounded`} style={{ width: `${w}%` }} />
            <Skeleton className="h-2 w-14 rounded" />
          </div>
        </div>
      ))}
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function ChatbotPage() {
  const { user } = useAuth();
  const { t } = useLanguage();

  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [currentChatId, setCurrentChatId] = useState<string | null>(null);
  const [newChatResetToken, setNewChatResetToken] = useState(0);
  const [chats, setChats] = useState<{ id: string; title: string; updatedAt?: string }[]>([]);

  // ── Geolocation for Telegram Link ──────────────────────────────────────────
  const [userLocation, setUserLocation] = useState<{ latitude: number; longitude: number } | null>(null);
  useEffect(() => {
    if (!navigator.geolocation) return;
    navigator.geolocation.getCurrentPosition(
      (pos) => setUserLocation({ latitude: pos.coords.latitude, longitude: pos.coords.longitude }),
      () => { },
      { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 }
    );
  }, []);

  // ── Init ──────────────────────────────────────────────────────────────────
  useEffect(() => {
    const init = async () => {
      try {
        const convList = await getConversationsList();
        setChats(convList.map(c => ({ id: c.conversationId, title: c.title, updatedAt: c.updatedAt })));
        setIsLoadingChats(false);
      } catch { setIsLoadingChats(false); }
    };
    init();
  }, []);

  const createNewChat = () => {
    setCurrentChatId(null);
    setNewChatResetToken((prev) => prev + 1);
  };

  const handleChatIdChange = (newChatId: string) => {
    setCurrentChatId(newChatId);

    // Optimistically reflect the new conversation immediately.
    setChats(prev => {
      if (prev.some(c => c.id === newChatId)) return prev;
      return [{ id: newChatId, title: 'New Chat', updatedAt: new Date().toISOString() }, ...prev].slice(0, 20);
    });

    // Refresh chats list to get the new title
    getConversationsList().then(convList => {
      setChats(convList.map(c => ({ id: c.conversationId, title: c.title, updatedAt: c.updatedAt })));
    }).catch(console.error);
  };

  const handleNewConversationCreated = (conv: Conversation) => {
    setChats(prev => {
      if (prev.some(c => c.id === conv.conversationId)) return prev;
      return [{
        id: conv.conversationId,
        title: conv.title || 'New Chat',
        updatedAt: conv.updatedAt || new Date().toISOString(),
      }, ...prev].slice(0, 20);
    });
  };

  // ── Quick actions ─────────────────────────────────────────────────────────
  const QUICK_ACTIONS = [
    { label: t('chat.action.fish'), icon: Fish, query: "How do I identify fish species?", color: "text-blue-500 bg-blue-500/10" },
    { label: t('chat.action.weather'), icon: CloudRain, query: "What are the sea conditions today?", color: "text-cyan-500 bg-cyan-500/10" },
    { label: t('chat.action.ocean'), icon: Waves, query: "What are the current ocean conditions?", color: "text-emerald-500 bg-emerald-500/10" },
    { label: t('chat.action.regulations'), icon: BookOpen, query: "What are the fishing regulations?", color: "text-amber-500 bg-amber-500/10" },
    { label: t('chat.action.tips'), icon: HelpCircle, query: "Give me tips to improve my catch", color: "text-purple-500 bg-purple-500/10" },
  ];

  // ═════════════════════════════════════════════════════════════════════════
  return (
    <div className="mx-auto w-full max-w-[1760px] px-2 sm:px-4 xl:px-6 flex flex-col space-y-4 sm:space-y-6 h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-140px)] animate-fade-in-up">

      {/* ── Page header ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 shrink-0">
        <div className="space-y-1">
          <h1 className="text-2xl sm:text-3xl font-bold tracking-tight">{t('chat.title')}</h1>
          <p className="text-sm sm:text-base text-muted-foreground/60">{t('chat.subtitle')}</p>
        </div>
        <div className="flex gap-2">
          <a
            href={userLocation ? `https://t.me/MatsyaAICompanionBot?start=loc_${userLocation.latitude.toFixed(6)}_${userLocation.longitude.toFixed(6)}${user?.id ? `_${user.id}` : ''}` : "https://t.me/MatsyaAICompanionBot"}
            target="_blank"
            rel="noopener noreferrer"
            className="hidden sm:inline-flex items-center gap-2 flex-none rounded-xl bg-[#229ED9] hover:bg-[#1a8abf] text-white border-0 h-10 sm:h-11 text-xs sm:text-sm px-4 font-semibold transition-colors shadow-sm shadow-[#229ED9]/20"
          >
            <svg className="w-4 h-4" viewBox="0 0 24 24" fill="currentColor"><path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.479.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z" /></svg>
            Connect to Telegram
            <ExternalLink className="w-3 h-3 opacity-70" />
          </a>
          <Button variant="outline" className="flex-1 sm:flex-none rounded-xl bg-card/40 backdrop-blur-sm border-border/40 h-10 sm:h-11 text-xs sm:text-sm hover:bg-primary/5 hover:text-primary transition-colors" onClick={createNewChat}>
            <Plus className="mr-2 w-4 h-4" /> New Chat
          </Button>
        </div>
      </div>

      <div className="flex-1 grid grid-cols-1 lg:grid-cols-12 gap-4 lg:gap-6 min-h-0">

        {/* ── Main chat area ── */}
        <div className="lg:col-span-8 flex flex-col h-[400px] sm:h-[500px] lg:h-full min-h-0 order-2 lg:order-1 animate-slide-in-left">
          {/* Keep component mounted so in-flight streamed replies are not lost on chatId updates */}
          <AgentChat
            variant="full"
            chatId={currentChatId}
            resetToken={newChatResetToken}
            onChatIdChange={handleChatIdChange}
            onNewConversationCreated={handleNewConversationCreated}
          />
        </div>

        {/* ── Sidebar ── */}
        <div className="lg:col-span-4 flex flex-col lg:flex-col gap-3 lg:gap-5 h-auto lg:h-full min-h-0 order-1 lg:order-2 animate-slide-in-right">

          {/* Past Conversations */}
          <Card className="rounded-2xl border-border/20 bg-card/30 backdrop-blur-sm flex flex-col flex-none lg:flex-1 min-h-0 overflow-hidden !p-0 !m-0 !gap-0 !py-0">
            <CardHeader className="border-b border-border/15 !px-4 !py-3 !pb-3 !gap-0">
              <div className="flex items-center justify-between">
                <CardTitle className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2">
                  <MessageSquare className="w-3.5 h-3.5" /> Past Conversations
                </CardTitle>
                <Button variant="ghost" size="sm" className="h-7 text-[11px] text-primary px-2 hover:bg-primary/10 rounded-lg" onClick={createNewChat}>
                  <Plus className="w-3 h-3 mr-1" /> New
                </Button>
              </div>
            </CardHeader>
            <div className="flex-1 overflow-y-auto p-3 space-y-1.5 max-h-[150px] sm:max-h-[200px] lg:max-h-none">
              {isLoadingChats ? (
                <ConversationSkeleton />
              ) : chats.length > 0 ? chats.map(chat => (
                <button key={chat.id} onClick={() => setCurrentChatId(chat.id)}
                  className={cn("w-full text-left p-3 rounded-xl border transition-all duration-300 group",
                    currentChatId === chat.id
                      ? "bg-primary/10 border-primary/20 text-primary shadow-sm"
                      : "border-transparent hover:bg-muted/30 text-muted-foreground hover:text-foreground")}>
                  <div className="flex items-start gap-2.5">
                    <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors duration-300",
                      currentChatId === chat.id ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground group-hover:bg-primary/10 group-hover:text-primary")}>
                      <MessageSquare className="w-3 h-3" />
                    </div>
                    <div className="min-w-0 flex-1 space-y-0.5">
                      <p className="text-[13px] font-semibold truncate leading-tight">{chat.title || 'Untitled Chat'}</p>
                      {chat.updatedAt && (
                        <p className="text-[10px] text-muted-foreground/60 flex items-center gap-1">
                          <Clock className="w-2.5 h-2.5 flex-shrink-0" />
                          {parseSafeDate(chat.updatedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                        </p>
                      )}
                    </div>
                    <ChevronRight className={cn("w-3.5 h-3.5 shrink-0 mt-1 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-1 group-hover:translate-x-0",
                      currentChatId === chat.id && "opacity-100 translate-x-0 text-primary")} />
                  </div>
                </button>
              )) : (
                <div className="flex flex-col items-center justify-center py-8 text-center gap-3">
                  <div className="w-12 h-12 rounded-2xl bg-muted/30 flex items-center justify-center">
                    <MessageSquare className="w-5 h-5 text-muted-foreground/40" />
                  </div>
                  <p className="text-xs text-muted-foreground/70">No past chats yet.<br />Start a conversation!</p>
                </div>
              )}
            </div>
          </Card>

          {/* Quick Actions */}
          <Card className="rounded-2xl border-border/20 bg-card/30 backdrop-blur-sm p-4">
            <p className="text-xs font-bold text-muted-foreground uppercase tracking-wider flex items-center gap-2 mb-3">
              <Zap className="w-3.5 h-3.5 text-amber-500" /> Quick Actions
            </p>
            {/* Mobile: horizontal scroll */}
            <div className="flex lg:hidden gap-2 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-none">
              {QUICK_ACTIONS.map((action, i) => (
                <button key={i}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl border border-border/15 bg-background/20 hover:bg-primary hover:text-white hover:border-primary text-muted-foreground transition-all duration-300 group shrink-0">
                  <div className={cn("w-6 h-6 rounded-lg flex items-center justify-center shrink-0 transition-colors", action.color, "group-hover:bg-white/20 text-white")}>
                    <action.icon className="w-3 h-3" />
                  </div>
                  <span className="text-[11px] font-semibold whitespace-nowrap">{action.label}</span>
                </button>
              ))}
            </div>
            {/* Desktop: vertical list */}
            <div className="hidden lg:flex flex-col gap-1.5">
              {QUICK_ACTIONS.map((action, i) => (
                <button key={i}
                  className="w-full flex items-center gap-3 p-2 rounded-xl border border-transparent hover:border-border/15 bg-transparent hover:bg-card/40 text-muted-foreground transition-all duration-300 group">
                  <div className={cn("w-7 h-7 rounded-lg flex items-center justify-center shrink-0 transition-colors", action.color, "group-hover:scale-110")}>
                    <action.icon className="w-3.5 h-3.5" />
                  </div>
                  <span className="text-xs font-semibold text-left truncate group-hover:text-foreground">{action.label}</span>
                  <ChevronRight className="w-3 h-3 ml-auto shrink-0 opacity-0 group-hover:opacity-100 transition-all duration-300 -translate-x-1 group-hover:translate-x-0" />
                </button>
              ))}
            </div>
          </Card>

        </div>
      </div>
    </div>
  );
}
