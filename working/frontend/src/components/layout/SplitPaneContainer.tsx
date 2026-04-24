"use client"

import React, { useState, useEffect, useRef, ReactNode } from 'react';
import { useAgentFirstStore, selectPaneWidths } from '@/lib/stores/agent-first-store';
import PaneDivider from './PaneDivider';
import { cn } from '@/lib/utils';

interface SplitPaneContainerProps {
  leftPane: ReactNode;
  rightPane: ReactNode;
  defaultAgentWidth?: number;
  minAgentWidth?: number;
  minCanvasWidth?: number;
  maxAgentWidth?: number;
  persistKey?: string;
  className?: string;
}

const MOBILE_BREAKPOINT = 768;
const MIN_AGENT_PX = 280;
const MIN_CANVAS_PX = 400;

export default function SplitPaneContainer({
  leftPane,
  rightPane,
  defaultAgentWidth = 38,
  minAgentWidth = 25,
  minCanvasWidth = 400,
  maxAgentWidth = 50,
  persistKey = 'matsyaai_pane_widths',
  className,
}: SplitPaneContainerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const [isMobile, setIsMobile] = useState(false);
  
  const paneWidths = useAgentFirstStore(selectPaneWidths);
  const setPaneWidths = useAgentFirstStore((state) => state.setPaneWidths);
  const isDragging = useAgentFirstStore((state) => state.isDraggingDivider);

  // ── Responsive breakpoint detection ────────────────────────────────────────
  useEffect(() => {
    const checkMobile = () => {
      const mobile = window.innerWidth < MOBILE_BREAKPOINT;
      setIsMobile(mobile);
      useAgentFirstStore.setState({ isMobile: mobile });
    };
    
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // ── Restore pane widths from localStorage ──────────────────────────────────
  useEffect(() => {
    try {
      const stored = localStorage.getItem(persistKey);
      if (stored) {
        const widths = JSON.parse(stored);
        // Validate constraints
        if (
          widths.agent >= minAgentWidth &&
          widths.agent <= maxAgentWidth &&
          widths.canvas >= (100 - maxAgentWidth)
        ) {
          setPaneWidths(widths);
        }
      }
    } catch (error) {
      console.error('[SplitPane] Failed to restore widths:', error);
    }
  }, [persistKey, minAgentWidth, maxAgentWidth, setPaneWidths]);

  // ── Persist pane widths to localStorage (debounced) ────────────────────────
  useEffect(() => {
    const timer = setTimeout(() => {
      try {
        localStorage.setItem(persistKey, JSON.stringify(paneWidths));
      } catch (error) {
        console.error('[SplitPane] Failed to persist widths:', error);
      }
    }, 300);
    
    return () => clearTimeout(timer);
  }, [paneWidths, persistKey]);

  // ── Handle pane resize ─────────────────────────────────────────────────────
  const handleResize = (deltaX: number) => {
    if (!containerRef.current) return;
    
    const containerWidth = containerRef.current.offsetWidth;
    const deltaPercent = (deltaX / containerWidth) * 100;
    const newAgentWidth = paneWidths.agent + deltaPercent;
    
    // Calculate minimum widths in percentage
    const minAgentPercent = (MIN_AGENT_PX / containerWidth) * 100;
    const minCanvasPercent = (MIN_CANVAS_PX / containerWidth) * 100;
    
    // Enforce constraints
    const clampedAgentWidth = Math.max(
      Math.max(minAgentWidth, minAgentPercent),
      Math.min(
        Math.min(maxAgentWidth, 100 - minCanvasPercent),
        newAgentWidth
      )
    );
    
    setPaneWidths({
      agent: clampedAgentWidth,
      canvas: 100 - clampedAgentWidth,
    });
  };

  // ── Reset layout to defaults ───────────────────────────────────────────────
  const resetLayout = () => {
    setPaneWidths({ agent: defaultAgentWidth, canvas: 100 - defaultAgentWidth });
  };

  // ── Mobile mode: render only left pane ────────────────────────────────────
  if (isMobile) {
    return (
      <div className={cn("w-full h-full", className)}>
        {leftPane}
      </div>
    );
  }

  // ── Desktop mode: split pane layout ────────────────────────────────────────
  return (
    <div
      ref={containerRef}
      className={cn(
        "flex w-full h-full relative overflow-hidden",
        className
      )}
    >
      {/* Left Pane - Agent Interface */}
      <div
        className="h-full overflow-hidden transition-all duration-200"
        style={{ width: `${paneWidths.agent}%` }}
      >
        {leftPane}
      </div>

      {/* Divider */}
      <PaneDivider onResize={handleResize} onReset={resetLayout} />

      {/* Right Pane - Content Canvas */}
      <div
        className="h-full overflow-hidden transition-all duration-200"
        style={{ width: `${paneWidths.canvas}%` }}
      >
        {rightPane}
      </div>
    </div>
  );
}
