"use client";

import React, {
    useState,
    useRef,
    useEffect,
    useCallback,
    lazy,
    Suspense,
} from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import {
    Send,
    Mic,
    Bot,
    Volume2,
    Pause,
    Fish,
    Loader2,
    ImageIcon,
    Sparkles,
    Check,
    CheckCheck,
    AlertCircle,
    MapPin,
    Upload,
    BarChart3,
    Clock,
    X,
    Reply,
    Wrench,
} from "lucide-react";
import { Textarea } from "@/components/ui/textarea";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import {
    streamChat,
    createConversation,
    synthesizeSpeech,
    getConversationMessagesPage,
    type GroupRecord,
    type Conversation,
    type StreamChatUi,
} from "@/lib/api-client";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";
import { useLanguage } from "@/lib/i18n";
import { useVoiceInput } from "@/hooks/useVoiceInput";
import { formatMessageTimestamp } from "@/lib/utils/timestamp";
import { useAgentFirstStore } from "@/lib/stores/agent-first-store";
import { toast as sonnerToast } from "sonner";
import { useAgentContext } from "@/lib/stores/agent-context-store";
import CapabilityCards from "@/components/agent/CapabilityCards";
import ContextPill from "@/components/agent/ContextPill";
import { AnimatePresence, motion } from "framer-motion";

// Lazy-load inline widgets (rendered inside chat bubbles)
import { lazyRetry } from "@/lib/lazy-retry";
const InlineHistoryCarousel = lazy(
    lazyRetry(() => import("@/components/agent/InlineHistoryCarousel")),
);
const InlineUploadZone = lazy(
    lazyRetry(() => import("@/components/agent/InlineUploadZone")),
);
const InlineMiniMap = lazy(
    lazyRetry(() => import("@/components/agent/InlineMiniMap")),
);

// ── Types ──────────────────────────────────────────────────────────────────
type MessageStatus = "sending" | "sent" | "failed";

interface MessageWidget {
    type: "map" | "history" | "upload";
    mapLat?: number;
    mapLon?: number;
}

/** A context chip attached to a user message, shown visually and sent to backend */
interface ContextChip {
    type: "location" | "history" | "upload" | "analytics";
    label: string;
    /** Extra data for interactivity (coordinates, group ID, etc.) */
    data?: Record<string, any>;
}

interface Message {
    id: string;
    role: "user" | "assistant" | "system";
    content: string;
    timestamp: Date;
    status?: MessageStatus;
    isPaneMessage?: boolean; // Flag to indicate message from ContentCanvas component
    paneSource?: "upload" | "map" | "analytics" | "history"; // Source component for PaneMessage
    replyTo?: string; // Add reply context
    replyToId?: string;
    widget?: MessageWidget; // Interactive inline widget from agent UI directive
    locationContext?: { lat: number; lon: number }; // Extracted map pin for clickable chip
    referenceContext?: {
        label: string;
        detail: string;
        icon: "history" | "upload" | "map" | "analytics";
        backendText: string;
    };
    contextChips?: ContextChip[]; // All attached context chips (location, history, upload, analytics)
    toolCalls?: string[]; // Tool names invoked during streaming (shown inline like ChatGPT)
}

function parseStoredUserMessage(rawText: string): {
    content: string;
    replyTo?: string;
    replyToId?: string;
    locationContext?: { lat: number; lon: number };
    contextChips?: ContextChip[];
} {
    // Stored user prompts may contain transport metadata used for model context.
    let content = rawText ?? "";
    let replyTo: string | undefined;
    let replyToId: string | undefined;
    let locationContext: { lat: number; lon: number } | undefined;
    const chips: ContextChip[] = [];

    const replyPrefixWithId = content.match(
        /^\[Replying to id:([^\s\]]+)\s+text:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/,
    );
    if (replyPrefixWithId) {
        replyToId = replyPrefixWithId[1]?.trim();
        replyTo = replyPrefixWithId[2]?.trim();
        content = replyPrefixWithId[3] ?? "";
    }

    const replyPrefix = content.match(
        /^\[Replying to:\s*"([\s\S]*?)"\]\s*\n\n([\s\S]*)$/,
    );
    if (!replyTo && replyPrefix) {
        replyTo = replyPrefix[1]?.trim();
        content = replyPrefix[2] ?? "";
    }

    // Extract mapPin location before stripping context tags
    const mapPinMatch = content.match(/\[mapPin:([\d.\-]+),([\d.\-]+)\]/);
    if (mapPinMatch) {
        const lat = parseFloat(mapPinMatch[1]);
        const lon = parseFloat(mapPinMatch[2]);
        if (!isNaN(lat) && !isNaN(lon)) {
            locationContext = { lat, lon };
            chips.push({
                type: "location",
                label: `${lat.toFixed(4)}°N, ${lon.toFixed(4)}°E`,
                data: { lat, lon },
            });
        }
    }

    // Extract groupId for history chip
    const groupIdMatch = content.match(/\[groupId:([^\]]+)\]/);
    if (groupIdMatch) {
        chips.push({
            type: "history",
            label: `Catch #${groupIdMatch[1].slice(0, 8)}`,
            data: { groupId: groupIdMatch[1] },
        });
    }

    // Extract scan/species for upload chip
    const scanMatch = content.match(/\[scan:([^\]]+)\]/);
    const speciesMatch = content.match(/\[species:([^\]]+)\]/);
    if (scanMatch) {
        chips.push({
            type: "upload",
            label: speciesMatch ? `Scan · ${speciesMatch[1]}` : "Scan results",
            data: { summary: scanMatch[1], species: speciesMatch?.[1] },
        });
    }

    // Extract page for analytics chip
    const pageMatch = content.match(/\[page:analytics\]/i);
    if (pageMatch) {
        chips.push({ type: "analytics", label: "Analytics", data: {} });
    }

    // Strip all context bracket tags: [page:...] [mapPin:...] [userLoc:...] [lang:...] [scan:...] etc.
    content = content.replace(
        /\[(?:page|lang|userLoc|groupId|species|imgIdx|mapPin|mapZoom|scan|offline|group|image):[^\]]*\]\s*/gi,
        "",
    );
    return {
        content: content.trim(),
        replyTo,
        replyToId,
        locationContext,
        contextChips: chips.length > 0 ? chips : undefined,
    };
}

interface AgentChatProps {
    /** Compact mode for embedded panels; full for standalone page */
    variant?: "compact" | "full";
    /** Group ID to reference in queries */
    contextGroupId?: string | null;
    /** Current image index for multi-image context */
    contextImageIndex?: number;
    /** Total images in group */
    contextImageCount?: number;
    /** Species name for the current image */
    contextSpecies?: string;
    /** Optional class for the outer container */
    className?: string;
    /** Optional existing chat ID to continue */
    chatId?: string | null;
    /** Force-reset token for explicit New Chat actions */
    resetToken?: number;
    /** Callback when a chatId is established */
    onChatIdChange?: (chatId: string) => void;
    /** Optional initial conversation history for session restore */
    initialMessages?: Message[];
    /** Callback when conversation history changes */
    onMessagesChange?: (messages: Message[]) => void;
    /** Callback when a new conversation is created */
    onNewConversationCreated?: (conv: Conversation) => void;
}

/**
 * Strip agent UI JSON directives from displayed text.
 *
 * Production approach — single compiled regex pass instead of four chained
 * `.replace()` calls.  Handles all known directive shapes:
 *   • `UI: {...}`  `UI{...}`  `**UI**\n{...}`  (prefix + JSON block)
 *   • Bare `{"map":true,...}` or any JSON block the model emits without prefix
 *   • Orphaned `UI` / `**UI**` tokens at the start or end of the string
 *
 * The regex is anchored with alternation so only one pass is needed.
 * A secondary JSON.parse guard removes any stray top-level object that
 * survived the regex (e.g., model emits valid JSON with no UI prefix).
 */
const UI_DIRECTIVE_RE = new RegExp(
    [
        // 1. Optional leading newlines + optional bold markers + "UI" keyword
        //    + optional colon + optional whitespace + JSON block (lazy)
        String.raw`\n*\**UI:?\**\s*\n*\{[\s\S]*?\}`,
        // 2. Orphaned UI token at the very end (after stripping the block above)
        String.raw`\n*\**UI:?\**\s*$`,
        // 3. Orphaned UI token at the very start
        String.raw`^\s*\**UI:?\**\s*\n*`,
    ].join("|"),
    "gi",
);

const stripUiDirective = (text: string): string => {
    // Single-pass replace for all known directive shapes
    let result = text.replace(UI_DIRECTIVE_RE, "").trim();

    // Secondary guard: if the entire remaining output is a JSON object (e.g.,
    // the model emitted `{"map":true}` with no UI prefix), drop it entirely.
    if (result.startsWith("{") && result.endsWith("}")) {
        try {
            const parsed = JSON.parse(result);
            if (parsed !== null && typeof parsed === "object" && !Array.isArray(parsed)) {
                return "";
            }
        } catch {
            // Not valid JSON — keep the text as-is (could be a code block)
        }
    }

    return result;
};

const MD_COMPONENTS: React.ComponentProps<typeof ReactMarkdown>["components"] =
{
    p: ({ children }) => (
        <p className="mb-3 last:mb-0 leading-relaxed text-[14px] sm:text-[15px] text-foreground/90 font-medium">
            {children}
        </p>
    ),
    strong: ({ children }) => (
        <strong className="font-bold text-foreground">{children}</strong>
    ),
    em: ({ children }) => (
        <em className="italic text-muted-foreground">{children}</em>
    ),
    ul: ({ children }) => <ul className="my-3 space-y-1.5">{children}</ul>,
    ol: ({ children }) => (
        <ol className="my-3 space-y-1.5 list-decimal list-outside ml-4">
            {children}
        </ol>
    ),
    li: ({ children }) => (
        <li className="text-[14px] sm:text-[15px] items-start text-foreground/90 font-medium my-0.5">
            <span className="leading-relaxed">{children}</span>
        </li>
    ),
    code: ({ children }) => (
        <code className="bg-muted px-1.5 py-0.5 rounded-md text-[13px] font-mono text-primary/80 font-semibold">
            {children}
        </code>
    ),
    hr: () => <hr className="my-4 border-border/30" />,
    h3: ({ children }) => (
        <h3 className="font-bold text-base sm:text-lg mt-4 mb-2">{children}</h3>
    ),
    h4: ({ children }) => (
        <h4 className="font-semibold text-sm sm:text-base mt-3 mb-1.5 text-foreground/80">
            {children}
        </h4>
    ),
    blockquote: ({ children }) => (
        <blockquote className="border-l-4 border-primary/30 pl-3 my-3 text-muted-foreground italic text-[14px] sm:text-[15px] bg-muted/20 py-1 pr-2 rounded-r-lg">
            {children}
        </blockquote>
    ),
};

// ── Message Status Indicator ───────────────────────────────────────────────
function MessageStatusIndicator({ status }: { status?: MessageStatus }) {
    if (!status) return null;

    switch (status) {
        case "sending":
            return (
                <div className="flex items-center gap-1 text-muted-foreground/50">
                    <Loader2 className="w-3 h-3 animate-spin" />
                </div>
            );
        case "sent":
            return (
                <div className="flex items-center gap-1 text-primary/50">
                    <CheckCheck className="w-3 h-3" />
                </div>
            );
        case "failed":
            return (
                <div className="flex items-center gap-1 text-red-500/70">
                    <AlertCircle className="w-3 h-3" />
                </div>
            );
        default:
            return null;
    }
}

// ── Reusable Component: Animated Dots for loading states ────────────────────
function AnimatedDots() {
    return (
        <span className="loading-dots inline-flex space-x-[1px] ml-0.5 pointer-events-none">
            <span className="dot">.</span>
            <span className="dot">.</span>
            <span className="dot">.</span>
        </span>
    );
}

// ── Message Row Component ──────────────────────────────────────────────────
interface MessageRowProps {
    message: Message;
    isCompact: boolean;
    isStreaming: boolean;
    playingMsgId: string | null;
    synthesizingMsgId: string | null;
    onPlayPause: (msg: Message) => void;
    onReplyQuoteClick: (msg: Message) => void;
    registerMessageElement: (id: string, el: HTMLDivElement | null) => void;
    isHighlighted: boolean;
    style?: React.CSSProperties;
    isThinking?: boolean;
    activeToolName?: string | null;
}

function MessageRow({
    message: msg,
    isCompact,
    isStreaming,
    playingMsgId,
    synthesizingMsgId,
    onPlayPause,
    onReplyQuoteClick,
    registerMessageElement,
    isHighlighted,
    style,
    isThinking,
    activeToolName,
}: MessageRowProps) {
    const { locale } = useLanguage();
    const replyPreview = msg.replyTo
        ? msg.replyTo.length > 120
            ? `${msg.replyTo.slice(0, 120)}...`
            : msg.replyTo
        : null;

    // System context note
    if (msg.role === "system") {
        return (
            <div
                style={style}
                className="flex justify-center animate-fade-in px-3 py-2"
            >
                <div className="px-3 py-1 rounded-full bg-primary/5 border border-primary/10 text-[10px] text-primary/70 font-medium flex items-center gap-1.5">
                    <ImageIcon className="w-3 h-3" />
                    {msg.content}
                </div>
            </div>
        );
    }

    // Get PaneMessage badge icon
    const getPaneMessageIcon = () => {
        if (!msg.isPaneMessage || !msg.paneSource) return null;

        switch (msg.paneSource) {
            case "map":
                return <MapPin className="w-3 h-3" />;
            case "upload":
                return <Upload className="w-3 h-3" />;
            case "analytics":
                return <BarChart3 className="w-3 h-3" />;
            default:
                return null;
        }
    };

    const getPaneMessageLabel = () => {
        if (!msg.isPaneMessage || !msg.paneSource) return null;

        switch (msg.paneSource) {
            case "map":
                return "Map";
            case "upload":
                return "Upload";
            case "analytics":
                return "Analytics";
            case "history":
                return "History";
            default:
                return null;
        }
    };

    return (
        <div
            ref={(el) => registerMessageElement(msg.id, el)}
            data-message-id={msg.id}
            style={style}
            className={cn(
                "group flex gap-2.5 sm:gap-3 animate-fade-in-up w-full px-2 py-0.5",
                isHighlighted &&
                "rounded-xl bg-primary/8 ring-1 ring-primary/35 transition-all duration-300",
                msg.role === "user" ? "justify-end" : "justify-start",
            )}
        >
            {msg.role === "assistant" && (
                <Avatar
                    className={cn(
                        "shrink-0 border border-primary/20 overflow-hidden",
                        isCompact ? "h-9 w-9 mt-0.5" : "h-10 w-10 mt-1",
                    )}
                >
                    <img
                        src="/logo.png"
                        alt="Matsya AI"
                        className="h-full w-full object-contain"
                    />
                </Avatar>
            )}

            <div
                className={cn(
                    "space-y-1.5 min-w-0 flex flex-col",
                    msg.role === "user" ? "items-end flex-1" : "flex-1 items-start",
                )}
            >
                {/* PaneMessage badge - shown above user messages */}
                {msg.role === "user" && msg.isPaneMessage && (
                    <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-[9px] text-primary/80 font-medium">
                        {getPaneMessageIcon()}
                        <span>{getPaneMessageLabel()}</span>
                    </div>
                )}

                {/* ── Context Chips - all attached context rendered as clickable pills ── */}
                {msg.role === "user" &&
                    msg.contextChips &&
                    msg.contextChips.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 items-center justify-end max-w-[85%]">
                            {msg.contextChips.map((chip, i) => {
                                const chipStyles: Record<
                                    ContextChip["type"],
                                    {
                                        bg: string;
                                        border: string;
                                        text: string;
                                        icon: React.ReactNode;
                                    }
                                > = {
                                    location: {
                                        bg: "bg-cyan-500/10 hover:bg-cyan-500/20",
                                        border: "border-cyan-500/20",
                                        text: "text-cyan-600 dark:text-cyan-400",
                                        icon: <MapPin className="w-3 h-3" />,
                                    },
                                    history: {
                                        bg: "bg-orange-500/10 hover:bg-orange-500/20",
                                        border: "border-orange-500/20",
                                        text: "text-orange-600 dark:text-orange-400",
                                        icon: <Clock className="w-3 h-3" />,
                                    },
                                    upload: {
                                        bg: "bg-violet-500/10 hover:bg-violet-500/20",
                                        border: "border-violet-500/20",
                                        text: "text-violet-600 dark:text-violet-400",
                                        icon: <Upload className="w-3 h-3" />,
                                    },
                                    analytics: {
                                        bg: "bg-emerald-500/10 hover:bg-emerald-500/20",
                                        border: "border-emerald-500/20",
                                        text: "text-emerald-600 dark:text-emerald-400",
                                        icon: <BarChart3 className="w-3 h-3" />,
                                    },
                                };
                                const s = chipStyles[chip.type];
                                const handleClick = () => {
                                    const store = useAgentFirstStore.getState();
                                    if (chip.type === "location" && chip.data?.lat != null) {
                                        store.setActiveComponent("map", {
                                            flyToLocation: {
                                                lat: chip.data.lat,
                                                lon: chip.data.lon,
                                                _t: Date.now(),
                                            },
                                        });
                                    } else if (chip.type === "history") {
                                        store.setActiveComponent("history");
                                    } else if (chip.type === "upload") {
                                        store.setActiveComponent("upload");
                                    } else if (chip.type === "analytics") {
                                        store.setActiveComponent("analytics");
                                    }
                                };
                                return (
                                    <button
                                        key={`${chip.type}-${i}`}
                                        onClick={handleClick}
                                        className={cn(
                                            "flex items-center gap-1 px-2 py-0.5 rounded-full border text-[10px] font-semibold transition-colors cursor-pointer",
                                            s.bg,
                                            s.border,
                                            s.text,
                                        )}
                                    >
                                        {s.icon}
                                        {chip.label}
                                    </button>
                                );
                            })}
                        </div>
                    )}

                {/* Inline mini-map preview for location context */}
                {msg.role === "user" && msg.locationContext && (
                    <Suspense
                        fallback={
                            <div className="w-full max-w-[320px] h-[170px] rounded-xl bg-muted/20 animate-pulse" />
                        }
                    >
                        <InlineMiniMap
                            lat={msg.locationContext.lat}
                            lon={msg.locationContext.lon}
                            onClick={() => {
                                useAgentFirstStore.getState().setActiveComponent("map", {
                                    flyToLocation: {
                                        lat: msg.locationContext!.lat,
                                        lon: msg.locationContext!.lon,
                                        _t: Date.now(),
                                    },
                                });
                            }}
                        />
                    </Suspense>
                )}

                <div className={cn(
                    "leading-relaxed",
                    msg.role === 'user'
                        ? "w-fit rounded-2xl rounded-tr-md bg-primary text-primary-foreground shadow-md px-3.5 py-2 text-[13px] sm:text-[14px] font-medium max-w-[85%] break-words"
                        : "py-0.5 w-full max-w-full sm:max-w-prose break-words overflow-hidden"
                )}>
                    {replyPreview && (
                        <button
                            type="button"
                            onClick={() => onReplyQuoteClick(msg)}
                            className={cn(
                                "mb-1.5 rounded-md border-l-2 px-2 py-1 text-[11px] leading-4",
                                "w-full text-left transition-colors hover:opacity-95",
                                msg.role === 'user'
                                    ? "border-white/60 bg-white/15 text-primary-foreground/90"
                                    : "border-primary/35 bg-primary/5 text-muted-foreground"
                            )}
                            title="Jump to replied message"
                        >
                            <div className={cn(
                                "mb-0.5 text-[10px] font-semibold uppercase tracking-wide",
                                msg.role === 'user' ? "text-primary-foreground/80" : "text-primary/80"
                            )}>
                                Replying to
                            </div>
                            {replyPreview}
                        </button>
                    )}
                    {msg.role === 'assistant' ? (
                        <>
                            {/* ── Inline Thinking / Tool Calls (ChatGPT-style) ── */}
                            {isStreaming && isThinking && (
                                <div className="mb-2">
                                    {/* Completed tool calls */}
                                    {msg.toolCalls && msg.toolCalls.length > 0 && (
                                        <div className="space-y-1.5 mb-1.5">
                                            {msg.toolCalls.map((tool, i) => {
                                                const isActive = i === msg.toolCalls!.length - 1 && activeToolName === tool;
                                                const { label, icon: ToolIcon } = humanizeToolName(tool);
                                                return (
                                                    <div key={`${tool}-${i}`} className={cn(
                                                        "flex items-center gap-2 py-1 px-2 rounded-lg transition-colors",
                                                        isActive ? "bg-primary/5" : "bg-transparent"
                                                    )}>
                                                        {isActive ? (
                                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                                <ToolIcon className="w-3 h-3 text-primary animate-pulse" />
                                                            </div>
                                                        ) : (
                                                            <div className="w-5 h-5 rounded-full bg-emerald-500/10 flex items-center justify-center shrink-0">
                                                                <Check className="w-3 h-3 text-emerald-500" />
                                                            </div>
                                                        )}
                                                        <span className={cn(
                                                            "text-[11px] font-medium flex items-center gap-0.5",
                                                            isActive ? "text-foreground/80" : "text-muted-foreground/60"
                                                        )}>
                                                            {label.replace(/\.\.\.$/, '')}
                                                            {isActive ? <AnimatedDots /> : "..."}
                                                        </span>
                                                    </div>
                                                );
                                            })}
                                        </div>
                                    )}
                                    {/* Thinking indicator (no tool active) */}
                                    {!activeToolName && !msg.content.trim() && (
                                        <div className="flex items-center gap-2 py-1 px-2">
                                            <div className="w-5 h-5 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
                                                <Loader2 className="w-3 h-3 text-primary animate-spin" />
                                            </div>
                                            <span className="text-[11px] text-foreground/70 font-medium flex items-center">
                                                Thinking<AnimatedDots />
                                            </span>
                                        </div>
                                    )}
                                </div>
                            )}
                            {msg.content ? (
                                <div className={cn(
                                    "space-y-4",
                                    isStreaming && msg.id.startsWith('ai_temp_') && "typing-cursor-container"
                                )}>
                                    <ReactMarkdown remarkPlugins={[remarkGfm]} components={MD_COMPONENTS}>
                                        {stripUiDirective(msg.content)}
                                    </ReactMarkdown>
                                    {/* Map Ping Chips - clickable coordinate badges (Idea 5) */}
                                    {!isStreaming && <MapPingChips content={msg.content} />}
                                </div>
                            ) : isStreaming ? null : (
                                <div className="space-y-2 mt-2 w-[80%] max-w-[300px]">
                                    <div className="h-4 bg-muted animate-pulse rounded-full w-full"></div>
                                    <div className="h-4 bg-muted animate-pulse rounded-full w-5/6 shadow-sm"></div>
                                    <div className="h-4 bg-muted animate-pulse rounded-full w-4/6 shadow-sm"></div>
                                </div>
                            )}
                            {/* Show completed tool calls summary even after streaming ends */}
                            {!isStreaming && msg.toolCalls && msg.toolCalls.length > 0 && (
                                <InlineToolCallsSummary toolCalls={msg.toolCalls} />
                            )}
                        </>
                    ) : (
                        <span className="whitespace-pre-wrap">{msg.content}</span>
                    )}
                </div>

                {/* ── Inline Widgets (history / upload / map) ── */}
                {msg.role === "assistant" && msg.widget && !isStreaming && (
                    <Suspense
                        fallback={
                            <div className="h-16 rounded-xl bg-muted/20 animate-pulse mt-1" />
                        }
                    >
                        {msg.widget.type === "map" &&
                            msg.widget.mapLat != null &&
                            msg.widget.mapLon != null &&
                            !isNaN(msg.widget.mapLat) &&
                            !isNaN(msg.widget.mapLon) && (
                                <InlineMiniMap
                                    lat={msg.widget.mapLat}
                                    lon={msg.widget.mapLon}
                                    onClick={() => {
                                        useAgentFirstStore.getState().setActiveComponent("map", {
                                            flyToLocation: {
                                                lat: msg.widget!.mapLat!,
                                                lon: msg.widget!.mapLon!,
                                                _t: Date.now(),
                                            },
                                        });
                                    }}
                                />
                            )}
                        {msg.widget.type === "history" && (
                            <InlineHistoryCarousel
                                onAskAboutGroup={(groupId, summary) => {
                                    (window as any).__agentChatInject?.(
                                        "Analyze this catch group",
                                        {
                                            label: "Analyze this catch group",
                                            detail: `Group ${groupId.slice(0, 8)}`,
                                            icon: "history" as const,
                                            backendText: `Summarize and analyze catch group ${groupId}: ${summary}`,
                                        },
                                    );
                                }}
                            />
                        )}
                        {msg.widget.type === "upload" && <InlineUploadZone />}
                    </Suspense>
                )}

                {/* Action row under message */}
                <div
                    className={cn(
                        "flex items-center gap-2",
                        msg.role === "user" ? "justify-end" : "justify-start mt-1",
                    )}
                >
                    {msg.role === "assistant" && msg.content && !isStreaming && (
                        <button
                            onClick={() => onPlayPause(msg)}
                            disabled={Boolean(
                                synthesizingMsgId && synthesizingMsgId !== msg.id,
                            )}
                            className={cn(
                                "flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all",
                                playingMsgId === msg.id
                                    ? "bg-primary/15 text-primary"
                                    : "text-muted-foreground hover:bg-muted/50 hover:text-foreground",
                                synthesizingMsgId &&
                                synthesizingMsgId !== msg.id &&
                                "opacity-60 cursor-not-allowed",
                            )}
                        >
                            {synthesizingMsgId === msg.id ? (
                                <>
                                    <Loader2 className="w-3 h-3 animate-spin" /> Loading
                                </>
                            ) : playingMsgId === msg.id ? (
                                <>
                                    <Pause className="w-3 h-3" /> Pause
                                </>
                            ) : (
                                <>
                                    <Volume2 className="w-3 h-3" /> Listen
                                </>
                            )}
                        </button>
                    )}
                    {msg.content && msg.role === "assistant" && !isStreaming && (
                        <button
                            onClick={() => (window as any).dispatchReply?.(msg)}
                            className="flex items-center gap-1.5 px-2 py-1 rounded-md text-[10px] sm:text-[11px] font-bold uppercase tracking-wider transition-all text-muted-foreground hover:bg-muted/50 hover:text-foreground ml-1 mr-2"
                        >
                            <Reply className="w-3 h-3" /> Reply
                        </button>
                    )}
                    {msg.role === "user" && (
                        <MessageStatusIndicator status={msg.status} />
                    )}
                    <span
                        className="text-[9px] text-muted-foreground/50 flex-shrink-0"
                        title={msg.timestamp.toLocaleString(locale)}
                    >
                        {formatMessageTimestamp(msg.timestamp, locale)}
                    </span>
                </div>
            </div>
        </div>
    );
}

// ── Inline Tool Calls Summary (collapsible, shown after streaming ends) ────
/** Map raw tool function names to user-friendly labels + icons */
function humanizeToolName(raw: string): { label: string; icon: React.ElementType } {
    const MAP: Record<string, { label: string; icon: React.ElementType }> = {
        get_catch_history: { label: 'Looking up catch history...', icon: Clock },
        get_group_history: { label: 'Fetching group records...', icon: Clock },
        get_fishing_spots: { label: 'Finding fishing spots...', icon: MapPin },
        get_weather: { label: 'Checking weather conditions...', icon: Fish },
        get_market_prices: { label: 'Fetching market prices...', icon: BarChart3 },
        analyze_image: { label: 'Analyzing image...', icon: ImageIcon },
        identify_species: { label: 'Identifying species...', icon: Fish },
        get_regulations: { label: 'Looking up regulations...', icon: Fish },
        get_alerts: { label: 'Checking safety alerts...', icon: AlertCircle },
        search_web: { label: 'Searching the web...', icon: Sparkles },
        get_tidal_data: { label: 'Checking tidal data...', icon: Fish },
    };
    if (MAP[raw]) return MAP[raw];
    // Fallback: convert snake_case to readable sentence
    const readable = raw.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
    return { label: `${readable}...`, icon: Wrench };
}

function InlineToolCallsSummary({ toolCalls }: { toolCalls: string[] }) {
    const [isOpen, setIsOpen] = useState(false);
    if (!toolCalls.length) return null;
    return (
        <button
            onClick={() => setIsOpen((o) => !o)}
            className="flex flex-col items-start gap-1 mt-1 mb-0.5 text-left group/tools"
        >
            <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground/60 hover:text-muted-foreground/80 transition-colors">
                <Wrench className="w-3 h-3" />
                <span className="font-medium">
                    Used {toolCalls.length} tool{toolCalls.length > 1 ? "s" : ""}
                </span>
                <span className={cn(
                    "text-[9px] transition-transform duration-200",
                    isOpen ? "rotate-180" : ""
                )}>▾</span>
            </div>
            {isOpen && (
                <div className="pl-4 space-y-0.5 mt-0.5">
                    {toolCalls.map((tool, i) => {
                        const { label } = humanizeToolName(tool);
                        return (
                            <div key={`${tool}-${i}`} className="flex items-center gap-1.5 text-[10px] text-muted-foreground/50">
                                <Check className="w-3 h-3 text-emerald-500/60" />
                                <span>{label}</span>
                            </div>
                        );
                    })}
                </div>
            )}
        </button>
    );
}

// ── Tool Suggestion Chips (Idea 3) ─────────────────────────────────────────
// Shows contextual tool suggestions based on what the user is typing
const TOOL_SUGGESTION_RULES: {
    pattern: RegExp;
    toolId: "upload" | "map" | "analytics" | "history";
    label: string;
    icon: React.ElementType;
    prompt?: string;
}[] = [
        {
            pattern: /\b(photo|image|picture|scan|upload|camera|identify)\b/i,
            toolId: "upload",
            label: "Open Scanner",
            icon: Upload,
        },
        {
            pattern:
                /\b(where|spot|zone|location|fishing spot|near|map|harbor|coast)\b/i,
            toolId: "map",
            label: "Open Map",
            icon: MapPin,
        },
        {
            pattern: /\b(how much|price|market|cost|value|sell|earning)\b/i,
            toolId: "analytics",
            label: "View Analytics",
            icon: BarChart3,
            prompt: "What are today's market prices for fish in my area?",
        },
        {
            pattern: /\b(yesterday|last week|previous|history|past|caught|record)\b/i,
            toolId: "history",
            label: "View History",
            icon: Fish,
        },
    ];

function ToolSuggestionChips({
    inputText,
    onToolClick,
    onPromptInject,
}: {
    inputText: string;
    onToolClick: (toolId: "upload" | "map" | "analytics" | "history") => void;
    onPromptInject: (prompt: string) => void;
}) {
    if (!inputText || inputText.length < 3) return null;
    const matches = TOOL_SUGGESTION_RULES.filter((r) =>
        r.pattern.test(inputText),
    );
    if (matches.length === 0) return null;

    return (
        <AnimatePresence>
            <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                exit={{ opacity: 0, height: 0 }}
                className="flex items-center gap-1.5 px-3 py-1.5 border-b border-border/10 overflow-x-auto scrollbar-none"
            >
                <Sparkles className="w-3 h-3 text-primary/50 shrink-0" />
                <span className="text-[9px] text-muted-foreground/60 font-semibold whitespace-nowrap shrink-0">
                    Suggest:
                </span>
                {matches.slice(0, 2).map((m) => {
                    const Icon = m.icon;
                    return (
                        <button
                            key={m.toolId}
                            onClick={() =>
                                m.prompt ? onPromptInject(m.prompt) : onToolClick(m.toolId)
                            }
                            className="flex items-center gap-1 px-2 py-1 rounded-full bg-primary/8 border border-primary/15 text-[10px] font-semibold text-primary/80 hover:bg-primary/15 transition-colors whitespace-nowrap shrink-0"
                        >
                            <Icon className="w-3 h-3" />
                            {m.label}
                        </button>
                    );
                })}
            </motion.div>
        </AnimatePresence>
    );
}

// Show a greeting and date at the top of empty chat state
function AgentDigestCard({ onBriefingClick }: { onBriefingClick: (prompt: string) => void }) {
    const { user } = useAuth();
    const hour = new Date().getHours();
    const greeting = hour < 12 ? 'Good Morning' : hour < 17 ? 'Good Afternoon' : 'Good Evening';

    // Get the first name, fallback to 'Fisher'
    const firstName = user?.name ? user.name.split(' ')[0] : 'Fisher';

    return (
        <motion.div
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, ease: [0.16, 1, 0.3, 1] }}
            className="w-full mb-2 mt-4 sm:mt-8 flex flex-col items-center justify-center text-center px-4"
        >
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mb-1">
                {greeting}, {firstName}
            </h2>
            <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground/70">
                {new Date().toLocaleDateString('en-IN', { weekday: 'long', month: 'long', day: 'numeric' })}
            </p>
        </motion.div>
    );
}

// ── Map Ping Chip Extractor (Idea 5) ──────────────────────────────────────
// Extracts coordinate mentions from assistant text and renders clickable chips
const COORD_REGEX =
    /(-?\d{1,3}\.\d{2,6})\s*[°]?\s*[NS]?\s*[,\s]+\s*(-?\d{1,3}\.\d{2,6})\s*[°]?\s*[EW]?/g;

function MapPingChips({ content }: { content: string }) {
    const coords = React.useMemo(() => {
        const matches: { lat: number; lon: number }[] = [];
        let match: RegExpExecArray | null;
        const regex = new RegExp(COORD_REGEX.source, "g");
        while ((match = regex.exec(content)) !== null) {
            const lat = parseFloat(match[1]);
            const lon = parseFloat(match[2]);
            if (
                !isNaN(lat) &&
                !isNaN(lon) &&
                Math.abs(lat) <= 90 &&
                Math.abs(lon) <= 180
            ) {
                // Deduplicate
                if (
                    !matches.some(
                        (m) =>
                            Math.abs(m.lat - lat) < 0.0001 && Math.abs(m.lon - lon) < 0.0001,
                    )
                ) {
                    matches.push({ lat, lon });
                }
            }
        }
        return matches;
    }, [content]);

    if (coords.length === 0) return null;

    return (
        <div className="flex flex-wrap gap-1 mt-1.5">
            {coords.slice(0, 3).map((c, i) => (
                <button
                    key={i}
                    onClick={() => {
                        if (!isNaN(c.lat) && !isNaN(c.lon)) {
                            useAgentFirstStore.getState().setActiveComponent("map", {
                                flyToLocation: { lat: c.lat, lon: c.lon, _t: Date.now() },
                                initialCenter: [c.lat, c.lon],
                                initialZoom: 12,
                            });
                            sonnerToast("Map opened", {
                                description: `Showing ${c.lat.toFixed(2)}°N, ${c.lon.toFixed(2)}°E`,
                                icon: "📍",
                                duration: 2500,
                            });
                        }
                    }}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-cyan-500/10 border border-cyan-500/20 text-[10px] text-cyan-600 dark:text-cyan-400 font-semibold hover:bg-cyan-500/20 transition-colors cursor-pointer"
                >
                    <MapPin className="w-3 h-3" />
                    {c.lat.toFixed(2)}°N, {c.lon.toFixed(2)}°E
                </button>
            ))}
        </div>
    );
}

// ═══════════════════════════════════════════════════════════════════════════
export default function AgentChat({
    variant = "full",
    contextGroupId = null,
    contextImageIndex = 0,
    contextImageCount = 0,
    contextSpecies = "",
    className,
    chatId: externalChatId = null,
    resetToken = 0,
    onChatIdChange,
    initialMessages = [],
    onMessagesChange,
    onNewConversationCreated,
}: AgentChatProps) {
    const { user } = useAuth();
    const { t, locale, speechCode } = useLanguage();
    const isCompact = variant === "compact";

    const [messages, setMessages] = useState<Message[]>(initialMessages);
    const [input, setInput] = useState("");
    const [isTyping, setIsTyping] = useState(false);
    const [chatId, setChatId] = useState<string | null>(externalChatId);
    const [replyingTo, setReplyingTo] = useState<Message | null>(null);
    const [isLoadingHistory, setIsLoadingHistory] = useState(false);
    const [isLoadingOlderHistory, setIsLoadingOlderHistory] = useState(false);
    const [historyCursor, setHistoryCursor] = useState<string | null>(null);
    const [hasMoreHistory, setHasMoreHistory] = useState(false);

    const [playingMsgId, setPlayingMsgId] = useState<string | null>(null);
    const [synthesizingMsgId, setSynthesizingMsgId] = useState<string | null>(
        null,
    );
    const isSynthesizingRef = useRef(false);
    const audioMapRef = useRef<Record<string, HTMLAudioElement>>({});

    const scrollAreaRef = useRef<HTMLDivElement>(null);
    const bottomRef = useRef<HTMLDivElement>(null);
    const messageElementsRef = useRef<Record<string, HTMLDivElement | null>>({});

    // ── Tool activity tracking (shows which tool the agent is calling) ──────
    const [activeToolName, setActiveToolName] = useState<string | null>(null);

    // ── Abort controller for in-flight stream (cancelled on chat switch) ─────
    const streamAbortRef = useRef<AbortController | null>(null);

    // ── Agent context store integration ──────────────────────────────────────
    const agentContextPayload = useAgentContext((s) => s.buildContextPayload);
    const activeComponent = useAgentFirstStore((s) => s.activeComponent);

    // Track pending reference context from inject calls
    const pendingRefContext = useRef<Message["referenceContext"] | null>(null);

    // Expose a global injection helper so inline widgets can inject prompts
    useEffect(() => {
        (window as any).__agentChatInject = (
            text: string,
            context?: {
                label: string;
                detail: string;
                icon: "history" | "upload" | "map" | "analytics";
                backendText: string;
            },
        ) => {
            if (context) {
                pendingRefContext.current = context;
                setInput(context.label); // Show short label in input
            } else {
                pendingRefContext.current = null;
                setInput(text);
            }
            inputRef.current?.focus();
        };
        return () => {
            delete (window as any).__agentChatInject;
        };
    }, []);
    const inputRef = useRef<HTMLTextAreaElement>(null);
    const shouldAutoScrollRef = useRef(true);
    const historyRequestIdRef = useRef(0);
    const [highlightedMessageId, setHighlightedMessageId] = useState<
        string | null
    >(null);

    // ── Notify parent when messages change ──────────────────────────────────────
    useEffect(() => {
        if (onMessagesChange) {
            onMessagesChange(messages);
        }
    }, [messages, onMessagesChange]);

    // ── Load Chat History when externalChatId changes ───────────────────────────
    useEffect(() => {
        // Abort any in-flight stream when switching chats
        streamAbortRef.current?.abort();
        streamAbortRef.current = null;
        setIsTyping(false);
        setActiveToolName(null);

        if (externalChatId) {
            const requestId = ++historyRequestIdRef.current;
            setChatId(externalChatId);
            setReplyingTo(null);
            setIsLoadingHistory(true);
            getConversationMessagesPage(30, externalChatId)
                .then((page) => {
                    if (historyRequestIdRef.current !== requestId) return;
                    setMessages(
                        page.messages.map((m) => ({
                            ...(m.role === "user"
                                ? parseStoredUserMessage(m.text)
                                : { content: m.text }),
                            id: m.id,
                            role: m.role as "user" | "assistant",
                            timestamp: new Date(m.timestamp),
                            status: "sent",
                        })),
                    );
                    setHistoryCursor(page.nextCursor ?? null);
                    setHasMoreHistory(page.hasMore);
                })
                .catch(console.error)
                .finally(() => {
                    if (historyRequestIdRef.current === requestId) {
                        setIsLoadingHistory(false);
                    }
                });
        } else {
            historyRequestIdRef.current += 1;
            setChatId(null);
            setMessages(initialMessages);
            setReplyingTo(null);
            setHistoryCursor(null);
            setHasMoreHistory(false);
            setIsLoadingHistory(false);
        }
    }, [externalChatId]);

    // ── Explicit reset for New Chat even when chatId remains null ───────────────
    useEffect(() => {
        if (resetToken <= 0) return;
        // Abort any in-flight stream
        streamAbortRef.current?.abort();
        streamAbortRef.current = null;
        setIsTyping(false);
        setActiveToolName(null);
        historyRequestIdRef.current += 1;
        setChatId(null);
        setMessages([]);
        setInput("");
        setReplyingTo(null);
        setHistoryCursor(null);
        setHasMoreHistory(false);
        setIsLoadingHistory(false);
    }, [resetToken]);

    const loadOlderHistory = useCallback(async () => {
        if (!externalChatId || !historyCursor || isLoadingOlderHistory) return;

        setIsLoadingOlderHistory(true);
        const container = scrollAreaRef.current;
        const previousScrollHeight = container?.scrollHeight ?? 0;
        const previousScrollTop = container?.scrollTop ?? 0;

        try {
            const page = await getConversationMessagesPage(
                30,
                externalChatId,
                historyCursor,
            );
            const olderMessages: Message[] = page.messages.map((m) => ({
                ...(m.role === "user"
                    ? parseStoredUserMessage(m.text)
                    : { content: m.text }),
                id: m.id,
                role: m.role as "user" | "assistant",
                timestamp: new Date(m.timestamp),
                status: "sent",
            }));

            setMessages((prev) => {
                const existingIds = new Set(prev.map((m) => m.id));
                const uniqueOlder = olderMessages.filter((m) => !existingIds.has(m.id));
                return [...uniqueOlder, ...prev];
            });

            setHistoryCursor(page.nextCursor ?? null);
            setHasMoreHistory(page.hasMore);

            requestAnimationFrame(() => {
                if (!container) return;
                const newScrollHeight = container.scrollHeight;
                const heightDelta = newScrollHeight - previousScrollHeight;
                container.scrollTop = previousScrollTop + heightDelta;
            });
        } catch (e) {
            console.error("Failed to load older history", e);
        } finally {
            setIsLoadingOlderHistory(false);
        }
    }, [externalChatId, historyCursor, isLoadingOlderHistory]);

    const registerMessageElement = useCallback(
        (id: string, el: HTMLDivElement | null) => {
            if (el) messageElementsRef.current[id] = el;
            else delete messageElementsRef.current[id];
        },
        [],
    );

    const handleReplyQuoteClick = useCallback(
        (msg: Message) => {
            let targetId = msg.replyToId;

            if (!targetId && msg.replyTo) {
                const needle = msg.replyTo.trim().toLowerCase();
                const found = messages.find((m) => {
                    if (m.id === msg.id) return false;
                    const text = m.content.trim().toLowerCase();
                    return (
                        text.startsWith(needle) ||
                        needle.startsWith(text.slice(0, Math.min(40, text.length)))
                    );
                });
                targetId = found?.id;
            }

            if (!targetId) {
                toast.error("Original replied message was not found");
                return;
            }

            const targetEl = messageElementsRef.current[targetId];
            if (!targetEl) {
                toast.error(
                    "Original replied message is not visible in this chat window",
                );
                return;
            }

            targetEl.scrollIntoView({ behavior: "smooth", block: "center" });
            setHighlightedMessageId(targetId);
            window.setTimeout(() => {
                setHighlightedMessageId((current) =>
                    current === targetId ? null : current,
                );
            }, 1400);
        },
        [messages],
    );

    useEffect(() => {
        (window as any).dispatchReply = (msg: Message) => {
            setReplyingTo(msg);
            inputRef.current?.focus();
        };
        return () => {
            delete (window as any).dispatchReply;
        };
    }, []);

    // ── Geolocation ──────────────────────────────────────────────────────────
    const [userLocation, setUserLocation] = useState<{
        latitude: number;
        longitude: number;
    } | null>(null);
    useEffect(() => {
        if (!navigator.geolocation) return;
        navigator.geolocation.getCurrentPosition(
            (pos) =>
                setUserLocation({
                    latitude: pos.coords.latitude,
                    longitude: pos.coords.longitude,
                }),
            () => { },
            { enableHighAccuracy: false, timeout: 10000, maximumAge: 300000 },
        );
    }, []);

    // ── Context Welcome message ──────────────────────────────────────────────────────
    useEffect(() => {
        if (messages.length === 0 && contextGroupId) {
            const welcomeContent = `I've analyzed your catch${contextImageCount > 1 ? ` (${contextImageCount} images)` : ""}. ${contextSpecies ? `I can see **${contextSpecies}** in this image.` : ""} Ask me anything about your fish - species details, market value, sustainability, health status, or cooking tips!`;
            setMessages([
                {
                    id: "welcome",
                    role: "assistant",
                    content: welcomeContent,
                    timestamp: new Date(),
                },
            ]);
        }
    }, [contextGroupId, contextImageCount, contextSpecies]);

    // ── Update welcome when image changes ────────────────────────────────────
    useEffect(() => {
        if (contextGroupId && contextSpecies) {
            setMessages((prev) => {
                // Add a system note about image switch
                const systemNote: Message = {
                    id: `ctx_${Date.now()}`,
                    role: "system",
                    content: `Now viewing image ${contextImageIndex + 1}${contextImageCount ? ` of ${contextImageCount}` : ""}${contextSpecies ? ` - ${contextSpecies}` : ""}`,
                    timestamp: new Date(),
                };
                return [...prev, systemNote];
            });
        }
    }, [contextImageIndex]);

    // ── TTS ──────────────────────────────────────────────────────────────────
    const handlePlayPause = async (msg: Message) => {
        if (playingMsgId === msg.id) {
            audioMapRef.current[msg.id]?.pause();
            window.speechSynthesis?.cancel();
            setPlayingMsgId(null);
            return;
        }
        if (playingMsgId && audioMapRef.current[playingMsgId]) {
            audioMapRef.current[playingMsgId].pause();
        }
        window.speechSynthesis?.cancel();
        if (audioMapRef.current[msg.id]) {
            setPlayingMsgId(msg.id);
            audioMapRef.current[msg.id].play().catch(console.error);
            return;
        }
        if (isSynthesizingRef.current) return;

        // Helper: browser-native TTS fallback
        const fallbackBrowserTTS = () => {
            if (!window.speechSynthesis) {
                toast.error("Speech not available on this device.");
                return;
            }
            const utterance = new SpeechSynthesisUtterance(
                msg.content.substring(0, 1000),
            );
            utterance.lang = speechCode || "en-IN";
            utterance.rate = 0.9;
            setPlayingMsgId(msg.id);
            utterance.onend = () =>
                setPlayingMsgId((prev) => (prev === msg.id ? null : prev));
            utterance.onerror = () => setPlayingMsgId(null);
            window.speechSynthesis.speak(utterance);
        };

        try {
            isSynthesizingRef.current = true;
            setSynthesizingMsgId(msg.id);
            const res = await synthesizeSpeech(msg.content, speechCode || "en-IN");
            // Backend signals this language has no Polly voice - use browser TTS
            if ((res as any).useBrowserTTS || !res.audioBase64) {
                fallbackBrowserTTS();
                return;
            }
            const audio = new Audio(`data:audio/mp3;base64,${res.audioBase64}`);
            audioMapRef.current[msg.id] = audio;
            setPlayingMsgId(msg.id);
            audio.play().catch(console.error);
            audio.onended = () =>
                setPlayingMsgId((prev) => (prev === msg.id ? null : prev));
        } catch {
            // Polly failed (500 / credentials) - fall back to browser speech
            console.warn(
                "[TTS] Polly failed, using browser speechSynthesis fallback",
            );
            fallbackBrowserTTS();
        } finally {
            isSynthesizingRef.current = false;
            setSynthesizingMsgId(null);
        }
    };

    // ── Voice input ───────────────────────────────────────────────────────────
    const {
        isListening,
        transcript,
        isSupported: voiceSupported,
        startListening,
        stopListening,
    } = useVoiceInput({
        lang: speechCode,
        onResult: (t) => setInput(t),
        onError: (e) => toast.error(e),
    });
    useEffect(() => {
        if (isListening && transcript) setInput(transcript);
    }, [transcript, isListening]);

    // Keep textarea height in sync even when input value is set programmatically.
    useEffect(() => {
        const el = inputRef.current;
        if (!el) return;
        el.style.height = "auto";
        el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
    }, [input]);

    // ── Auto scroll ──────────────────────────────────────────────────────────
    useEffect(() => {
        if (shouldAutoScrollRef.current && messages.length > 0) {
            bottomRef.current?.scrollIntoView({ behavior: "smooth" });
        }
    }, [messages, isTyping]);

    // ── Detect manual scroll to disable auto-scroll ─────────────────────────
    useEffect(() => {
        const container = scrollAreaRef.current;
        if (!container) return;

        const handleScroll = () => {
            const { scrollTop, scrollHeight, clientHeight } = container;
            const isNearBottom = scrollHeight - scrollTop - clientHeight < 100;
            shouldAutoScrollRef.current = isNearBottom;
        };

        container.addEventListener("scroll", handleScroll);
        return () => container.removeEventListener("scroll", handleScroll);
    }, []);

    // ── Send ──────────────────────────────────────────────────────────────────
    const handleSend = useCallback(
        async (messageText?: string) => {
            const rawText = (messageText ?? input).trim();
            if (!rawText || isTyping) return;

            // Inject context about the current image if available
            let text = rawText;
            if (contextGroupId) {
                text = `[group:${contextGroupId}] [image:${contextImageIndex + 1}/${contextImageCount}] ${rawText}`;
            }
            // Prepend global agent context (page, location, selection etc.)
            const ctxPayload = agentContextPayload();
            if (ctxPayload) {
                text = `${ctxPayload} ${text}`;
            }

            const userMessageId = `user_${Date.now()}`;
            // Attach location context from the current agent context (if a map pin is selected)
            const currentMapPin =
                useAgentContext.getState().selectedMapPoint ?? undefined;
            // Attach reference context if injected from a tool panel
            const refCtx = pendingRefContext.current;
            pendingRefContext.current = null;

            // ── Build context chips from all active context ──
            const ctxState = useAgentContext.getState();
            const chips: ContextChip[] = [];
            if (currentMapPin) {
                chips.push({
                    type: "location",
                    label: `${currentMapPin.lat.toFixed(4)}°N, ${currentMapPin.lon.toFixed(4)}°E`,
                    data: { lat: currentMapPin.lat, lon: currentMapPin.lon },
                });
            }
            if (ctxState.currentGroupId) {
                chips.push({
                    type: "history",
                    label: `Catch #${ctxState.currentGroupId.slice(0, 8)}`,
                    data: { groupId: ctxState.currentGroupId },
                });
            }
            if (ctxState.scanSummary) {
                chips.push({
                    type: "upload",
                    label: ctxState.currentSpecies
                        ? `Scan · ${ctxState.currentSpecies}`
                        : "Scan results",
                    data: {
                        summary: ctxState.scanSummary,
                        species: ctxState.currentSpecies,
                    },
                });
            }
            if (ctxState.currentPage === "analytics") {
                chips.push({ type: "analytics", label: "Analytics", data: {} });
            }
            // If a reference context inject is present, add it as a chip too
            if (refCtx) {
                const refType =
                    refCtx.icon === "map"
                        ? ("location" as const)
                        : (refCtx.icon as ContextChip["type"]);
                // Only add if not already covered by auto-detected chips
                if (!chips.some((c) => c.type === refType)) {
                    chips.push({
                        type: refType,
                        label: refCtx.detail,
                        data: { backendText: refCtx.backendText },
                    });
                }
            }

            const userMessage: Message = {
                id: userMessageId,
                role: "user",
                content: refCtx ? refCtx.label : rawText,
                timestamp: new Date(),
                status: "sending",
                replyTo: replyingTo ? replyingTo.content.substring(0, 100) : undefined,
                replyToId: replyingTo?.id,
                locationContext: currentMapPin,
                referenceContext: refCtx ?? undefined,
                contextChips: chips.length > 0 ? chips : undefined,
            };
            setMessages((prev) => [...prev, userMessage]);

            // If there's a reference context, send the detailed backend text instead
            if (refCtx) {
                text = refCtx.backendText;
                // Still prepend global agent context
                const ctxPayload2 = agentContextPayload();
                if (ctxPayload2) {
                    text = `${ctxPayload2} ${text}`;
                }
            }

            // Include reply context in prompt
            if (replyingTo) {
                text = `[Replying to id:${replyingTo.id} text:"${replyingTo.content.substring(0, 200)}..."]\n\n${text}`;
            }

            setInput("");
            setReplyingTo(null);
            setIsTyping(true);

            // Create abort controller for this stream
            streamAbortRef.current?.abort();
            const streamAbort = new AbortController();
            streamAbortRef.current = streamAbort;

            const tempAiMsgId = `ai_temp_${Date.now()}`;

            try {
                let targetChatId = chatId;
                if (!targetChatId) {
                    try {
                        const newConv = await createConversation(
                            rawText.substring(0, 40),
                            locale,
                        );
                        targetChatId = newConv.conversationId;
                        setChatId(targetChatId);
                        if (onNewConversationCreated) onNewConversationCreated(newConv);
                    } catch (e) {
                        console.error("Failed to create conversation", e);
                    }
                }

                // Mark user message as sent
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === userMessageId
                            ? { ...m, status: "sent" as MessageStatus }
                            : m,
                    ),
                );

                setMessages((prev) => [
                    ...prev,
                    {
                        id: tempAiMsgId,
                        role: "assistant",
                        content: "",
                        timestamp: new Date(),
                    },
                ]);

                // ── Typewriter character queue ──────────────────────────────────
                const charQueue: string[] = [];
                let animFrame: number | null = null;
                let typewriterDone = false;

                const drainCharQueue = () => {
                    if (typewriterDone) return;
                    // Dynamically increase drain rate when queue is large
                    const CHARS_PER_FRAME =
                        charQueue.length > 80 ? 12 : charQueue.length > 30 ? 6 : 3;
                    let appended = "";
                    for (let i = 0; i < CHARS_PER_FRAME && charQueue.length > 0; i++) {
                        appended += charQueue.shift();
                    }
                    if (appended) {
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempAiMsgId
                                    ? { ...m, content: m.content + appended }
                                    : m,
                            ),
                        );
                    }
                    if (charQueue.length > 0) {
                        animFrame = requestAnimationFrame(drainCharQueue);
                    } else {
                        animFrame = null;
                    }
                };

                const enqueueChunk = (chunkText: string) => {
                    for (const ch of chunkText) charQueue.push(ch);
                    if (animFrame === null) {
                        animFrame = requestAnimationFrame(drainCharQueue);
                    }
                };

                const res = await streamChat(
                    text,
                    enqueueChunk,
                    targetChatId ?? undefined,
                    locale,
                    userLocation ?? undefined,
                    (toolName) => {
                        setActiveToolName(toolName);
                        // Push tool name into the message for inline display
                        setMessages((prev) =>
                            prev.map((m) =>
                                m.id === tempAiMsgId
                                    ? {
                                        ...m,
                                        toolCalls: [
                                            ...(m.toolCalls ?? []).filter((t) => t !== toolName),
                                            toolName,
                                        ],
                                    }
                                    : m,
                            ),
                        );
                    },
                    streamAbort.signal,
                );

                // Flush any remaining characters instantly
                typewriterDone = true;
                if (animFrame !== null) {
                    cancelAnimationFrame(animFrame);
                    animFrame = null;
                }
                if (charQueue.length > 0) {
                    const remaining = charQueue.join("");
                    charQueue.length = 0;
                    setMessages((prev) =>
                        prev.map((m) =>
                            m.id === tempAiMsgId
                                ? { ...m, content: m.content + remaining }
                                : m,
                        ),
                    );
                }
                setActiveToolName(null);

                const finalChatId = targetChatId ?? res.chatId;
                if (finalChatId && !finalChatId.startsWith("demo_")) {
                    setChatId(finalChatId);
                    if (externalChatId !== finalChatId) {
                        onChatIdChange?.(finalChatId);
                    }
                }

                // Determine widget from agent UI directive AND auto-open sidebar tool
                let widget: MessageWidget | undefined;
                if (res.ui) {
                    const store = useAgentFirstStore.getState();
                    if (res.ui.map && res.ui.mapLat != null && res.ui.mapLon != null && !isNaN(res.ui.mapLat) && !isNaN(res.ui.mapLon)) {
                        // Inline mini-map preview + open sidebar
                        widget = {
                            type: "map",
                            mapLat: res.ui.mapLat,
                            mapLon: res.ui.mapLon,
                        };
                        store.setActiveComponent("map", {
                            initialCenter: [res.ui.mapLat, res.ui.mapLon],
                            initialZoom: 12,
                            flyToLocation: {
                                lat: res.ui.mapLat,
                                lon: res.ui.mapLon,
                                _t: Date.now(),
                            },
                        });
                        sonnerToast("Map opened", {
                            description: `Showing location at ${res.ui.mapLat.toFixed(2)}°N, ${res.ui.mapLon.toFixed(2)}°E`,
                            icon: "🗺️",
                            duration: 3000,
                        });
                    } else if (res.ui.history) {
                        widget = { type: "history" };
                        store.setActiveComponent("history");
                        sonnerToast("Catch history opened", {
                            description: "Showing your recent catches in the side panel",
                            icon: "📋",
                            duration: 3000,
                        });
                    } else if (res.ui.upload) {
                        widget = { type: "upload" };
                        store.setActiveComponent("upload");
                        sonnerToast("Upload panel opened", {
                            description: "Ready to analyze your catch photos",
                            icon: "📸",
                            duration: 3000,
                        });
                    }
                }

                // Always replace temp ID so Listen/Reply buttons appear and markdown renders
                const finalMsgId = res.messageId || `msg_${Date.now()}`;
                setMessages((prev) =>
                    prev.map((m) =>
                        m.id === tempAiMsgId
                            ? {
                                ...m,
                                id: finalMsgId,
                                content: stripUiDirective(m.content),
                                widget,
                            }
                            : m,
                    ),
                );
            } catch (err: any) {
                // If aborted (user switched chats), silently clean up
                if (err?.name === 'AbortError') {
                    setMessages((prev) => prev.filter((m) => m.id !== tempAiMsgId));
                    return;
                }
                console.error("Chat error:", err);

                // Remove the temp skeleton and mark user message as failed, add error message
                setMessages((prev) => {
                    const cleaned = prev.filter((m) => m.id !== tempAiMsgId);
                    return [
                        ...cleaned.map((m) =>
                            m.id === userMessageId
                                ? { ...m, status: "failed" as MessageStatus }
                                : m,
                        ),
                        {
                            id: `err_${Date.now()}`,
                            role: "assistant" as const,
                            content: "Sorry, I couldn't process that. Please try again.",
                            timestamp: new Date(),
                        },
                    ];
                });
            } finally {
                setIsTyping(false);
                setActiveToolName(null);
            }
        },
        [
            input,
            isTyping,
            chatId,
            contextGroupId,
            contextImageIndex,
            contextImageCount,
            locale,
            userLocation,
            onChatIdChange,
            externalChatId,
            onNewConversationCreated,
            replyingTo,
            agentContextPayload,
        ],
    );

    // ── Quick action chips for compact mode ──────────────────────────────────
    const quickChips = contextGroupId
        ? [
            t("chat.chip.tellAbout"),
            t("chat.chip.marketValue"),
            t("chat.chip.healthy"),
            t("chat.chip.cooking"),
            t("chat.chip.sustainability"),
        ]
        : [
            t("chat.chip.identify"),
            t("chat.chip.seaConditions"),
            t("chat.chip.regulations"),
        ];

    const hasPendingAssistantSkeleton = messages.some(
        (m) =>
            m.role === "assistant" &&
            m.id.startsWith("ai_temp_") &&
            !m.content.trim(),
    );

    const replyPreview = replyingTo
        ? replyingTo.content.length > 180
            ? `${replyingTo.content.slice(0, 180)}...`
            : replyingTo.content
        : "";

    // ═════════════════════════════════════════════════════════════════════════
    return (
        <div
            className={cn(
                "flex flex-col bg-card/30 backdrop-blur-sm rounded-2xl border border-border/20 overflow-hidden relative",
                isCompact
                    ? "h-full"
                    : "h-[calc(100dvh-185px)] sm:h-[calc(100dvh-210px)] lg:h-[calc(100dvh-140px)]",
                !isCompact && "mx-auto w-full max-w-[1200px] 2xl:max-w-[1280px]",
                className,
            )}
        >
            {/* ── Header (Matsya Branding) ── */}
            <div
                className={cn(
                    "flex items-center gap-3 border-b border-border/15 shrink-0 overflow-hidden",
                    isCompact ? "px-4 py-3 pr-10" : "px-5 py-4",
                )}
            >
                <div className="min-w-0">
                    <h3
                        className={cn(
                            "font-bold leading-tight",
                            isCompact ? "text-sm" : "text-base",
                        )}
                    >
                        {contextGroupId ? "Matsya AI" : "Matsya AI"}
                    </h3>
                    <p className="text-[10px] text-muted-foreground/60 leading-tight">
                        {contextGroupId
                            ? `Analyzing image ${contextImageIndex + 1}${contextImageCount ? ` of ${contextImageCount}` : ""}`
                            : "Ask me anything"}
                    </p>
                </div>
            </div>

            {/* ── Messages ── */}
            <div
                className={cn(
                    "flex-1 overflow-y-auto py-2 relative scrollbar-thin",
                    isCompact
                        ? "px-5 sm:px-6 pb-40"
                        : "px-4 sm:px-8 lg:px-12 xl:px-16 2xl:px-20 pb-48 lg:pb-56",
                )}
                ref={scrollAreaRef}
            >
                <div
                    className={cn(
                        "space-y-1 pb-1 mx-auto w-full",
                        isCompact ? "max-w-4xl" : "max-w-2xl",
                    )}
                >
                    {hasMoreHistory && !isLoadingHistory && (
                        <div className="flex justify-center pb-1">
                            <button
                                onClick={loadOlderHistory}
                                disabled={isLoadingOlderHistory}
                                className="text-[11px] px-3 py-1 rounded-full border border-border/30 text-muted-foreground hover:text-foreground hover:bg-muted/30 transition-colors disabled:opacity-50"
                            >
                                {isLoadingOlderHistory
                                    ? "Loading older messages..."
                                    : "Load older messages"}
                            </button>
                        </div>
                    )}
                    {isLoadingHistory && (
                        <div className="space-y-4 py-4">
                            {[1, 2, 3].map((i) => (
                                <div key={i} className="flex gap-3 w-full">
                                    <div className="h-8 w-8 rounded-full bg-muted animate-pulse shrink-0" />
                                    <div className="flex-1 space-y-2">
                                        <div className="h-4 rounded-full bg-muted animate-pulse w-3/4" />
                                        <div className="h-4 rounded-full bg-muted animate-pulse w-1/2" />
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                    {!isLoadingHistory &&
                        messages.map((msg) => (
                            <MessageRow
                                key={msg.id}
                                message={msg}
                                isCompact={isCompact}
                                isStreaming={isTyping && msg.id.startsWith("ai_temp_")}
                                playingMsgId={playingMsgId}
                                synthesizingMsgId={synthesizingMsgId}
                                onPlayPause={handlePlayPause}
                                onReplyQuoteClick={handleReplyQuoteClick}
                                registerMessageElement={registerMessageElement}
                                isHighlighted={highlightedMessageId === msg.id}
                                isThinking={isTyping && msg.id.startsWith("ai_temp_")}
                                activeToolName={msg.id.startsWith("ai_temp_") ? activeToolName : null}
                            />
                        ))}

                    {/* ── Agent Digest + Capability Cards (Empty State) ── */}
                    <AnimatePresence>
                        {messages.length === 0 && !contextGroupId && (
                            <motion.div
                                initial={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, y: -20 }}
                                transition={{ duration: 0.3, ease: "easeOut" }}
                            >
                                <AgentDigestCard
                                    onBriefingClick={(prompt) => handleSend(prompt)}
                                />
                                <CapabilityCards
                                    onCardClick={(command) => {
                                        // Trigger the command as if user typed it
                                        handleSend(command);
                                    }}
                                />
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* Typing indicator removed - thinking now shows inline in the message bubble */}

                    <div ref={bottomRef} />
                </div>
            </div>

            {/* ── Floating Input Area ── */}
            <div
                className={cn(
                    "shrink-0 flex flex-col items-center relative z-10",
                    "bg-gradient-to-t from-background via-background/90 to-transparent",
                    isCompact ? "pt-6 pb-4 px-2" : "pt-8 pb-6 px-4",
                )}
            >
                <div
                    className={cn(
                        "w-full flex flex-col gap-2 relative",
                        isCompact ? "max-w-3xl" : "max-w-3xl",
                    )}
                >
                    {/* ── Voice indicator ── */}
                    <AnimatePresence>
                        {isListening && (
                            <motion.div
                                initial={{ opacity: 0, y: 10 }}
                                animate={{ opacity: 1, y: 0 }}
                                exit={{ opacity: 0, scale: 0.95 }}
                                className="absolute -top-10 left-0 right-0 mx-auto w-fit bg-red-500 text-white shadow-lg shadow-red-500/20 px-4 py-1.5 rounded-full flex items-center gap-2"
                            >
                                <div className="relative flex items-center justify-center">
                                    <div className="w-2 h-2 bg-white rounded-full animate-pulse" />
                                    <div className="absolute w-4 h-4 bg-white/30 rounded-full animate-ping" />
                                </div>
                                <span className="text-[11px] font-bold tracking-wide">
                                    LISTENING...
                                </span>
                            </motion.div>
                        )}
                    </AnimatePresence>

                    {/* ── Quick chips ── */}
                    {messages.length === 0 && quickChips.length > 0 && (
                        <div className="flex overflow-x-auto gap-1.5 sm:justify-center mb-1 pb-2 w-full max-w-full hide-scrollbar snap-x snap-mandatory px-1 sm:px-0 sm:flex-wrap">
                            {quickChips.map((chip, i) => (
                                <button
                                    key={i}
                                    onClick={() => handleSend(chip)}
                                    disabled={isTyping}
                                    className="px-3 py-1.5 rounded-full bg-background/50 border border-border/40 text-[11px] font-medium text-foreground/70 hover:bg-primary/5 hover:text-primary hover:border-primary/20 shadow-sm transition-all duration-200 disabled:opacity-40 shrink-0 snap-center whitespace-nowrap"
                                >
                                    {chip}
                                </button>
                            ))}
                        </div>
                    )}

                    {/* ── Replying To Banner ── */}
                    {replyingTo && (
                        <div className="w-full rounded-t-2xl border-t border-l border-r border-border/20 bg-muted/40 backdrop-blur-md px-4 py-2 text-xs -mb-3 pb-4">
                            <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 border-l-2 border-primary/35 pl-2.5">
                                    <div className="flex items-center gap-1.5 text-[10px] uppercase tracking-wider text-primary/80 font-bold mb-0.5">
                                        <Reply className="w-3 h-3" />
                                        Replying to{" "}
                                        {replyingTo.role === "assistant" ? "assistant" : "message"}
                                    </div>
                                    <div className="relative">
                                        <p
                                            className="text-muted-foreground leading-snug overflow-hidden pr-8 line-clamp-1"
                                            title={replyingTo.content}
                                        >
                                            {replyPreview}
                                        </p>
                                        <span className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-muted/20 to-transparent" />
                                    </div>
                                </div>
                                <button
                                    onClick={() => setReplyingTo(null)}
                                    className="text-muted-foreground/60 hover:text-foreground shrink-0 mt-0.5 bg-background/50 rounded-full p-1 border border-border/10"
                                >
                                    <X className="w-3.5 h-3.5" />
                                </button>
                            </div>
                        </div>
                    )}

                    {/* ── Main Input Card ── */}
                    <div
                        className={cn(
                            "relative w-full rounded-2xl sm:rounded-3xl border border-border/40 bg-card/80 backdrop-blur-xl shadow-lg shadow-black/5 flex flex-col overflow-hidden transition-all duration-300 focus-within:shadow-xl focus-within:border-primary/20 focus-within:ring-1 focus-within:ring-primary/10",
                            replyingTo && "rounded-t-none",
                        )}
                    >
                        {/* Context Pill - only show when a tool panel is open (avoids redundancy with reference chips) */}
                        {activeComponent && (
                            <div className="px-4 pt-3 flex items-center justify-between border-b border-border/10 pb-2 bg-muted/10">
                                <ContextPill />
                                {isCompact && (
                                    <span className="text-[9px] text-muted-foreground/40 ml-auto hidden sm:block">
                                        Ctrl+K for commands
                                    </span>
                                )}
                            </div>
                        )}

                        {/* ── Tool Suggestion Chips (Idea 3) ── */}
                        <ToolSuggestionChips
                            inputText={input}
                            onToolClick={(toolId) => {
                                useAgentFirstStore.getState().setActiveComponent(toolId);
                            }}
                            onPromptInject={(prompt) => handleSend(prompt)}
                        />

                        <div
                            className={cn(
                                "flex flex-row items-end gap-2",
                                isCompact ? "p-2" : "p-3",
                            )}
                        >
                            <Textarea
                                ref={inputRef}
                                value={input}
                                rows={1}
                                onChange={(e) => {
                                    setInput(e.target.value);
                                    const el = e.currentTarget;
                                    el.style.height = "auto";
                                    el.style.height = `${Math.min(el.scrollHeight, 200)}px`;
                                }}
                                onKeyDown={(e) => {
                                    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
                                        e.preventDefault();
                                        handleSend();
                                        return;
                                    }
                                    if (e.key === "Enter" && !e.shiftKey) {
                                        e.preventDefault();
                                        handleSend();
                                    }
                                }}
                                placeholder={
                                    contextGroupId
                                        ? "Ask about this catch..."
                                        : t("chat.placeholder")
                                }
                                disabled={isTyping}
                                className={cn(
                                    "flex-1 min-h-[44px] max-h-52 resize-none py-3 pl-3 sm:pl-4 pr-2 bg-transparent border-0 focus-visible:ring-0 leading-relaxed text-foreground placeholder:text-muted-foreground/50",
                                    isCompact ? "text-[13px]" : "text-[14px]",
                                )}
                            />

                            <div className="flex items-center gap-1 shrink-0 pb-1 pr-1">
                                <button
                                    onClick={() => {
                                        if (!voiceSupported) {
                                            toast.error(t("voice.notSupported"));
                                            return;
                                        }
                                        isListening ? stopListening() : startListening();
                                    }}
                                    disabled={isTyping}
                                    className={cn(
                                        "shrink-0 rounded-full flex items-center justify-center transition-all",
                                        isCompact ? "w-8 h-8" : "w-10 h-10",
                                        isListening
                                            ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                                            : "bg-transparent text-muted-foreground/60 hover:bg-muted",
                                    )}
                                >
                                    <Mic className={cn(isCompact ? "w-4 h-4" : "w-5 h-5")} />
                                </button>

                                <button
                                    onClick={() => handleSend()}
                                    disabled={!input.trim() || isTyping}
                                    className={cn(
                                        "shrink-0 rounded-full flex items-center justify-center transition-all",
                                        isCompact ? "w-8 h-8" : "w-10 h-10",
                                        input.trim() && !isTyping
                                            ? "bg-primary text-primary-foreground shadow-md shadow-primary/20 hover:scale-105 active:scale-95"
                                            : "bg-muted text-muted-foreground/40",
                                    )}
                                >
                                    {isTyping ? (
                                        <Loader2
                                            className={cn(
                                                "animate-spin",
                                                isCompact ? "w-4 h-4" : "w-4.5 h-4.5",
                                            )}
                                        />
                                    ) : (
                                        <Send
                                            className={cn(
                                                isCompact ? "w-4 h-4" : "w-4.5 h-4.5",
                                                "ml-0.5",
                                            )}
                                        />
                                    )}
                                </button>
                            </div>
                        </div>
                    </div>

                    {/* Tiny footer label */}
                    {!isCompact && !contextGroupId && (
                        <div className="text-center mt-1">
                            <span className="text-[10px] text-muted-foreground/40">
                                AI can make mistakes. Consider verifying important information.
                            </span>
                        </div>
                    )}
                </div>
            </div>

            {/* ════════════════════════════════════════════════════════════════════
                HOLD-TO-SPEAK FAB - Large floating mic button (WhatsApp style)
                Visible only on touch devices / mobile
            ════════════════════════════════════════════════════════════════════ */}
            {voiceSupported && (
                <div className="absolute bottom-24 right-4 z-30 md:bottom-28 md:right-6">
                    <div className="relative">
                        {/* Pulsing rings when listening */}
                        {isListening && (
                            <>
                                <div className="absolute inset-0 rounded-full bg-red-500/20 animate-pulse-ring" />
                                <div
                                    className="absolute inset-[-8px] rounded-full bg-red-500/10 animate-pulse-ring"
                                    style={{ animationDelay: "0.3s" }}
                                />
                            </>
                        )}
                        <button
                            onPointerDown={(e) => {
                                e.preventDefault();
                                if (!isTyping && voiceSupported) startListening();
                            }}
                            onPointerUp={(e) => {
                                e.preventDefault();
                                if (isListening) {
                                    stopListening();
                                    // Auto-send after a brief delay for STT to finalize
                                    setTimeout(() => {
                                        const currentInput = inputRef.current?.value?.trim();
                                        if (currentInput) handleSend(currentInput);
                                    }, 400);
                                }
                            }}
                            onPointerCancel={() => {
                                if (isListening) stopListening();
                            }}
                            onContextMenu={(e) => e.preventDefault()}
                            disabled={isTyping}
                            className={cn(
                                "w-[72px] h-[72px] rounded-full flex items-center justify-center shadow-2xl transition-all duration-200 select-none touch-none",
                                isListening
                                    ? "bg-red-500 text-white scale-110 shadow-red-500/40"
                                    : "bg-primary text-primary-foreground hover:scale-105 shadow-primary/30 active:scale-95",
                            )}
                            aria-label="Hold to speak"
                        >
                            <Mic className="w-8 h-8" />
                        </button>
                        {!isListening && (
                            <span className="absolute -bottom-6 left-1/2 -translate-x-1/2 text-[10px] font-semibold text-muted-foreground whitespace-nowrap">
                                Hold to speak
                            </span>
                        )}
                    </div>
                </div>
            )}
        </div>
    );
}
