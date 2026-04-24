"use client"

import React, { useState, useRef, useEffect } from 'react';
import { GripVertical, RotateCcw } from 'lucide-react';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import { cn } from '@/lib/utils';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

interface PaneDividerProps {
  onResize: (deltaX: number) => void;
  onReset: () => void;
}

export default function PaneDivider({ onResize, onReset }: PaneDividerProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const startXRef = useRef<number>(0);

  // ── Drag handlers ──────────────────────────────────────────────────────────
  const handleMouseDown = (e: React.MouseEvent) => {
    e.preventDefault();
    setIsDragging(true);
    startXRef.current = e.clientX;
    useAgentFirstStore.setState({ isDraggingDivider: true });

    // Change cursor globally
    document.body.style.cursor = 'col-resize';
    document.body.style.userSelect = 'none';
  };

  useEffect(() => {
    if (!isDragging) return;

    let rafId: number | null = null;
    let pendingDeltaX = 0;

    const handleMouseMove = (e: MouseEvent) => {
      pendingDeltaX += e.clientX - startXRef.current;
      startXRef.current = e.clientX;

      // Use RAF to batch resize calls for smooth 60fps dragging
      if (rafId === null) {
        rafId = requestAnimationFrame(() => {
          onResize(pendingDeltaX);
          pendingDeltaX = 0;
          rafId = null;
        });
      }
    };

    const handleMouseUp = () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      setIsDragging(false);
      useAgentFirstStore.setState({ isDraggingDivider: false });
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };
  }, [isDragging, onResize]);

  return (
    <div
      className={cn(
        "relative w-1 bg-border/20 hover:bg-border/40 transition-colors cursor-col-resize group flex-shrink-0 z-50",
        isDragging && "bg-primary/40"
      )}
      onMouseDown={handleMouseDown}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Drag handle */}
      <div
        className={cn(
          "absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 flex flex-col items-center gap-2 py-3 px-1.5 rounded-lg bg-background/80 backdrop-blur-sm border border-border/30 shadow-lg transition-all duration-200",
          (isHovered || isDragging) ? "opacity-100 scale-100" : "opacity-0 scale-95 pointer-events-none"
        )}
      >
        <GripVertical className="w-4 h-4 text-muted-foreground" />

        <TooltipProvider>
          <Tooltip>
            <TooltipTrigger asChild>
              <button
                onClick={(e) => {
                  e.stopPropagation();
                  onReset();
                }}
                className="p-1.5 rounded-md hover:bg-muted/50 transition-colors"
                aria-label="Reset layout"
              >
                <RotateCcw className="w-3.5 h-3.5 text-muted-foreground" />
              </button>
            </TooltipTrigger>
            <TooltipContent side="right">
              <p className="text-xs">Reset Layout</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
      </div>

      {/* Hover indicator */}
      <div
        className={cn(
          "absolute inset-0 bg-primary/10 transition-opacity duration-200",
          (isHovered || isDragging) ? "opacity-100" : "opacity-0"
        )}
      />
    </div>
  );
}
