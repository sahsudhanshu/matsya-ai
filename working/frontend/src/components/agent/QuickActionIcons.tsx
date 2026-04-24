"use client"

import React from 'react';
import { MapPin, Camera, BarChart3, type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { ComponentType } from '@/types/agent-first';

interface QuickAction {
  id: string;
  icon: LucideIcon;
  label: string;
  shortcut: string;
  component: ComponentType;
  color: string;
}

interface QuickActionIconsProps {
  className?: string;
}

/**
 * QuickActionIcons - Icon buttons for quick access to Map, Upload, and Analytics
 * 
 * Features:
 * - Three icon buttons: Map (Ctrl+M), Camera (Ctrl+U), Chart (Ctrl+A)
 * - Tooltips showing feature names and keyboard shortcuts
 * - Active state highlighting when component is displayed
 * - Oceanic theme with glassmorphism
 * - Full i18n support
 * - Keyboard shortcut support
 * 
 * Requirements: 21.1, 21.5, 21.7
 */
export default function QuickActionIcons({
  className,
}: QuickActionIconsProps) {
  const { t } = useLanguage();
  const activeComponent = useAgentFirstStore((state) => state.activeComponent);
  const setActiveComponent = useAgentFirstStore((state) => state.setActiveComponent);

  const actions: QuickAction[] = [
    {
      id: 'map',
      icon: MapPin,
      label: t('capability.viewMap'),
      shortcut: 'Ctrl+M',
      component: 'map',
      color: 'text-cyan-400',
    },
    {
      id: 'upload',
      icon: Camera,
      label: t('capability.uploadCatch'),
      shortcut: 'Ctrl+U',
      component: 'upload',
      color: 'text-emerald-400',
    },
    {
      id: 'analytics',
      icon: BarChart3,
      label: t('capability.analytics'),
      shortcut: 'Ctrl+A',
      component: 'analytics',
      color: 'text-purple-400',
    },
  ];

  // Handle icon click
  const handleClick = (component: ComponentType) => {
    if (activeComponent === component) {
      // If already active, do nothing (or could toggle off)
      return;
    }
    setActiveComponent(component);
  };

  // Keyboard shortcuts
  React.useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey) {
        switch (e.key.toLowerCase()) {
          case 'm':
            e.preventDefault();
            setActiveComponent('map');
            break;
          case 'u':
            e.preventDefault();
            setActiveComponent('upload');
            break;
          case 'a':
            e.preventDefault();
            setActiveComponent('analytics');
            break;
        }
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [setActiveComponent]);

  return (
    <div
      className={cn(
        "flex items-center gap-1 px-2",
        className
      )}
    >
      {actions.map((action) => {
        const Icon = action.icon;
        const isActive = activeComponent === action.component;

        return (
          <div key={action.id} className="relative group">
            {/* Icon Button */}
            <button
              onClick={() => handleClick(action.component)}
              className={cn(
                "relative w-9 h-9 rounded-lg flex items-center justify-center",
                "transition-all duration-200",
                "focus:outline-none focus:ring-2 focus:ring-primary/50",
                isActive
                  ? "bg-primary/20 border border-primary/40 shadow-lg shadow-primary/20"
                  : "bg-card/20 border border-border/20 hover:bg-card/40 hover:border-border/40"
              )}
              aria-label={`${action.label} (${action.shortcut})`}
            >
              <Icon
                className={cn(
                  "w-4 h-4 transition-colors",
                  isActive ? action.color : "text-muted-foreground group-hover:text-foreground"
                )}
              />
              
              {/* Active indicator glow */}
              {isActive && (
                <div
                  className={cn(
                    "absolute inset-0 rounded-lg blur-md opacity-30",
                    "bg-gradient-to-br from-primary/40 to-primary/20"
                  )}
                />
              )}
            </button>

            {/* Tooltip */}
            <div
              className={cn(
                "absolute bottom-full left-1/2 -translate-x-1/2 mb-2",
                "px-2 py-1.5 rounded-md",
                "bg-slate-900/95 backdrop-blur-sm border border-border/40",
                "shadow-xl",
                "opacity-0 group-hover:opacity-100",
                "pointer-events-none transition-opacity duration-200",
                "whitespace-nowrap z-50"
              )}
            >
              <div className="text-xs font-medium text-foreground">
                {action.label}
              </div>
              <div className="text-[10px] text-muted-foreground/70 mt-0.5">
                {action.shortcut}
              </div>
              
              {/* Tooltip arrow */}
              <div
                className={cn(
                  "absolute top-full left-1/2 -translate-x-1/2",
                  "w-0 h-0",
                  "border-l-4 border-l-transparent",
                  "border-r-4 border-r-transparent",
                  "border-t-4 border-t-slate-900/95"
                )}
              />
            </div>
          </div>
        );
      })}
    </div>
  );
}
