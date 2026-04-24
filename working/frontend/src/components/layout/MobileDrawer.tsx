"use client"

import React, { ReactNode, useEffect, useRef } from 'react';
import { Drawer } from 'vaul';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

interface MobileDrawerProps {
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
  title?: string;
}

export default function MobileDrawer({
  isOpen,
  onClose,
  children,
  title,
}: MobileDrawerProps) {
  const previousFocusRef = useRef<HTMLElement | null>(null);

  // ── Focus management ───────────────────────────────────────────────────────
  useEffect(() => {
    if (isOpen) {
      // Store current focus
      previousFocusRef.current = document.activeElement as HTMLElement;
    } else {
      // Restore focus when drawer closes
      if (previousFocusRef.current) {
        previousFocusRef.current.focus();
      }
    }
  }, [isOpen]);

  return (
    <Drawer.Root
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) onClose();
      }}
      direction="right"
      modal={true}
    >
      <Drawer.Portal>
        <Drawer.Overlay
          className="fixed inset-0 bg-black/40 backdrop-blur-sm z-40"
          onClick={onClose}
        />
        <Drawer.Content
          className={cn(
            "fixed right-0 top-0 bottom-0 w-[90%] max-w-[600px] z-50",
            "bg-background border-l border-border/20",
            "flex flex-col outline-none"
          )}
        >
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border/20 bg-card/30 backdrop-blur-sm shrink-0">
            <Drawer.Title className="text-base font-bold">
              {title || 'Content'}
            </Drawer.Title>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 transition-colors"
              aria-label="Close drawer"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Content */}
          <div className="flex-1 overflow-y-auto">
            {children}
          </div>
        </Drawer.Content>
      </Drawer.Portal>
    </Drawer.Root>
  );
}
