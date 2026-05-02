"use client";

import React, { useEffect, useState, useCallback } from 'react';
import {
  Sparkles, MapPin, Upload, BarChart3, Clock, MessageSquare,
  Fish, Send,
} from 'lucide-react';
import {
  CommandDialog,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
  CommandSeparator,
} from '@/components/ui/command';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { Conversation } from '@/lib/api-client';

interface CommandPaletteProps {
  /** Recent conversations list for quick switch */
  chatHistory?: Conversation[];
  /** Callback to focus the agent chat input and optionally inject text */
  onFocusChat?: (injectedPrompt?: string) => void;
  /** Select a conversation by id */
  onSelectChat?: (conversationId: string) => void;
  /** Start a new chat */
  onNewChat?: () => void;
}

/**
 * Global command palette (Ctrl+K / Cmd+K).
 * Provides instant access to the AI agent, all tools, and recent chats.
 * Type @agent <query> or just a question to send it directly to the agent.
 */
export default function CommandPalette({
  chatHistory = [],
  onFocusChat,
  onSelectChat,
  onNewChat,
}: CommandPaletteProps) {
  const [open, setOpen] = useState(false);
  const [searchValue, setSearchValue] = useState('');
  const setActiveComponent = useAgentFirstStore(s => s.setActiveComponent);
  const clearComponent = useAgentFirstStore(s => s.clearComponent);

  // Global keyboard shortcut
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setOpen(prev => !prev);
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, []);

  const runCommand = useCallback((callback: () => void) => {
    setOpen(false);
    setSearchValue('');
    // Small delay so the dialog closes smoothly
    requestAnimationFrame(callback);
  }, []);

  // Detect @agent prefixed queries or natural language questions
  const isAgentQuery = searchValue.startsWith('@agent ') || searchValue.startsWith('@matsya ');
  const agentQueryText = isAgentQuery ? searchValue.replace(/^@(?:agent|matsya)\s+/, '') : '';
  const isNaturalQuestion = !isAgentQuery && searchValue.length > 10 && /[?.]$|^(what|where|how|when|why|which|can|tell|show|give|find|get)\b/i.test(searchValue);

  return (
    <CommandDialog open={open} onOpenChange={(v) => { setOpen(v); if (!v) setSearchValue(''); }}>
      <CommandInput
        placeholder="Ask Matsya AI, open tool, or search chats... (@agent for direct query)"
        value={searchValue}
        onValueChange={setSearchValue}
      />
      <CommandList>
        <CommandEmpty>
          {searchValue.length > 2 ? (
            <button
              onClick={() => runCommand(() => onFocusChat?.(searchValue))}
              className="flex items-center gap-2 w-full px-2 py-3 text-sm text-left hover:bg-muted/50 rounded-md transition-colors"
            >
              <Fish className="w-4 h-4 text-primary" />
              <span>Ask Matsya AI: &quot;{searchValue}&quot;</span>
              <Send className="w-3 h-3 ml-auto text-muted-foreground" />
            </button>
          ) : (
            'No results found.'
          )}
        </CommandEmpty>

        {/* ── Direct Agent Query (when @agent prefix or question detected) ── */}
        {(isAgentQuery || isNaturalQuestion) && searchValue.length > 3 && (
          <CommandGroup heading="Ask Matsya AI">
            <CommandItem
              onSelect={() => runCommand(() => {
                clearComponent();
                onFocusChat?.(isAgentQuery ? agentQueryText : searchValue);
              })}
            >
              <Fish className="mr-2 h-4 w-4 text-primary" />
              <span className="truncate">Ask: &quot;{isAgentQuery ? agentQueryText : searchValue}&quot;</span>
              <Send className="ml-auto h-3 w-3 text-muted-foreground/50" />
            </CommandItem>
          </CommandGroup>
        )}

        {/* ── Agent Actions ── */}
        <CommandGroup heading="Matsya AI">
          <CommandItem
            onSelect={() => runCommand(() => {
              clearComponent();
              onFocusChat?.();
            })}
            className='hover:text-white'
          >
            <Fish className="mr-2 h-4 w-4 text-primary" />
            <span>Ask Matsya AI...</span>
            <span className="ml-auto text-[10px]">Focus chat</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => {
              onFocusChat?.("Give me today's daily briefing - weather, best fishing zones, market prices, and any safety alerts.");
            })}
          >
            <Sparkles className="mr-2 h-4 w-4 text-amber-400" />
            <span>Daily Briefing</span>
          </CommandItem>
          <CommandItem
            onSelect={() => runCommand(() => {
              onNewChat?.();
            })}
          >
            <MessageSquare className="mr-2 h-4 w-4 text-muted-foreground" />
            <span>New Chat</span>
          </CommandItem>
        </CommandGroup>

        <CommandSeparator />

        {/* ── Tools ── */}
        <CommandGroup heading="Tools">
          <CommandItem onSelect={() => runCommand(() => setActiveComponent('upload'))}>
            <Upload className="mr-2 h-4 w-4 text-emerald-400" />
            <span>Upload / Scan Catch</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setActiveComponent('map'))}>
            <MapPin className="mr-2 h-4 w-4 text-cyan-400" />
            <span>Ocean Map</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setActiveComponent('analytics'))}>
            <BarChart3 className="mr-2 h-4 w-4 text-purple-400" />
            <span>Analytics Dashboard</span>
          </CommandItem>
          <CommandItem onSelect={() => runCommand(() => setActiveComponent('history'))}>
            <Clock className="mr-2 h-4 w-4 text-orange-400" />
            <span>Catch History</span>
          </CommandItem>
        </CommandGroup>

        {/* ── Recent Chats ── */}
        {chatHistory.length > 0 && (
          <>
            <CommandSeparator />
            <CommandGroup heading="Recent Chats">
              {chatHistory.slice(0, 8).map((conv) => (
                <CommandItem
                  key={conv.conversationId}
                  onSelect={() => runCommand(() => onSelectChat?.(conv.conversationId))}
                  className='hover:text-white'
                >
                  <MessageSquare className="mr-2 h-4 w-4" />
                  <span className="truncate">{conv.title || 'Untitled Chat'}</span>
                  <span className="ml-auto text-[10px] text-muted-foreground/40">
                    {new Date(conv.updatedAt).toLocaleDateString()}
                  </span>
                </CommandItem>
              ))}
            </CommandGroup>
          </>
        )}
      </CommandList>
    </CommandDialog>
  );
}
