"use client";

import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { MapPin, Clock, Upload, BarChart3, MessageSquare, Globe } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentContext } from '@/lib/stores/agent-context-store';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";

/**
 * ContextPill - A subtle animated badge next to the chat input
 * showing what context the AI is currently "seeing".
 */
export default function ContextPill({ className }: { className?: string }) {
  const label = useAgentContext(s => s.getContextLabel());
  const currentPage = useAgentContext(s => s.currentPage);
  const userLocation = useAgentContext(s => s.userLocation);
  const currentGroupId = useAgentContext(s => s.currentGroupId);
  const selectedMapPoint = useAgentContext(s => s.selectedMapPoint);

  const getIcon = () => {
    switch (currentPage) {
      case 'map': return MapPin;
      case 'history': return Clock;
      case 'upload': return Upload;
      case 'analytics': return BarChart3;
      default: return MessageSquare;
    }
  };
  const Icon = getIcon();

  // Build tooltip details
  const details: string[] = [];
  if (userLocation) details.push(`GPS: ${userLocation.lat.toFixed(2)}°N, ${userLocation.lon.toFixed(2)}°E`);
  if (currentGroupId) details.push(`Group: ${currentGroupId.slice(0, 8)}…`);
  if (selectedMapPoint && selectedMapPoint.lat != null && selectedMapPoint.lon != null) details.push(`Pin: ${selectedMapPoint.lat.toFixed(4)}°N, ${selectedMapPoint.lon.toFixed(4)}°E`);

  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <AnimatePresence mode="wait">
          <motion.div
            key={label}
            initial={{ opacity: 0, y: 4, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: -4, scale: 0.95 }}
            transition={{ duration: 0.2 }}
            className={cn(
              "flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-primary/8 border border-primary/15 cursor-default select-none",
              className,
            )}
          >
            <Icon className="w-3 h-3 text-primary/60" />
            <span className="text-[10px] font-semibold text-primary/70 whitespace-nowrap max-w-[140px] truncate">
              {label}
            </span>
            {userLocation && (
              <Globe className="w-2.5 h-2.5 text-primary/40" />
            )}
          </motion.div>
        </AnimatePresence>
      </TooltipTrigger>
      <TooltipContent side="top" className="max-w-[240px]">
        <p className="text-[11px] font-semibold mb-1">AI is aware of:</p>
        <p className="text-[10px] text-muted-foreground">{label}</p>
        {details.length > 0 && (
          <ul className="mt-1 space-y-0.5">
            {details.map((d, i) => (
              <li key={i} className="text-[10px] text-muted-foreground/80">• {d}</li>
            ))}
          </ul>
        )}
      </TooltipContent>
    </Tooltip>
  );
}
