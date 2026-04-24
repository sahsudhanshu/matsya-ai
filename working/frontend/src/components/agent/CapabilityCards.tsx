"use client"

import React from 'react';
import { motion } from 'framer-motion';
import {
  CloudSun,
  Camera,
  MapPin,
  BarChart3,
  type LucideIcon
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/lib/i18n';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import type { ComponentType } from '@/types/agent-first';

interface CapabilityCard {
  id: string;
  title: string;
  description: string;
  icon: LucideIcon;
  command: string;
  color: string;
  iconBg: string;
  gradient: string;
  paneAction?: ComponentType;
}

interface CapabilityCardsProps {
  onCardClick?: (command: string) => void;
  className?: string;
}

// Shared spring config for the card entrance
const CARD_SPRING = {
  type: 'spring' as const,
  stiffness: 380,
  damping: 28,
  mass: 0.7,
};

export default function CapabilityCards({
  onCardClick,
  className,
}: CapabilityCardsProps) {
  const { t } = useLanguage();
  const setActiveComponent = useAgentFirstStore((s) => s.setActiveComponent);

  const cards: CapabilityCard[] = [
    {
      id: 'daily-briefing',
      title: t('capability.dailyBriefing'),
      description: t('capability.dailyBriefingDesc'),
      icon: CloudSun,
      command: 'Give me today\'s daily briefing - weather, best fishing zones, market prices, and any safety alerts.',
      color: 'text-amber-500',
      iconBg: 'bg-amber-50 dark:bg-amber-500/15 border-amber-200/40 dark:border-amber-400/20',
      gradient: 'from-amber-500/10 via-orange-500/5 to-transparent',
    },
    {
      id: 'upload-catch',
      title: t('capability.uploadCatch'),
      description: t('capability.uploadCatchDesc'),
      icon: Camera,
      command: '',
      color: 'text-emerald-600 dark:text-emerald-400',
      iconBg: 'bg-emerald-50 dark:bg-emerald-500/15 border-emerald-200/40 dark:border-emerald-400/20',
      gradient: 'from-emerald-500/10 via-teal-500/5 to-transparent',
      paneAction: 'upload',
    },
    {
      id: 'view-map',
      title: t('capability.viewMap'),
      description: t('capability.viewMapDesc'),
      icon: MapPin,
      command: '',
      color: 'text-cyan-600 dark:text-cyan-400',
      iconBg: 'bg-cyan-50 dark:bg-cyan-500/15 border-cyan-200/40 dark:border-cyan-400/20',
      gradient: 'from-cyan-500/10 via-blue-500/5 to-transparent',
      paneAction: 'map',
    },
    {
      id: 'analytics',
      title: t('capability.analytics'),
      description: t('capability.analyticsDesc'),
      icon: BarChart3,
      command: '',
      color: 'text-violet-600 dark:text-violet-400',
      iconBg: 'bg-violet-50 dark:bg-violet-500/15 border-violet-200/40 dark:border-violet-400/20',
      gradient: 'from-violet-500/10 via-purple-500/5 to-transparent',
      paneAction: 'analytics',
    },
  ];

  const handleCardClick = (card: CapabilityCard) => {
    if (card.paneAction) {
      setActiveComponent(card.paneAction);
      return;
    }
    if (onCardClick && card.command) {
      onCardClick(card.command);
    }
  };

  return (
    <div className={cn("w-full px-4 pt-4", className)}>
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.4, ease: [0.16, 1, 0.3, 1] }}
        className="mb-6 text-center"
      >
        <h3 className="text-lg font-semibold text-foreground mb-1">
          {t('capability.title')}
        </h3>
        <p className="text-sm text-muted-foreground">
          {t('capability.subtitle')}
        </p>
      </motion.div>

      {/* Card Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-w-2xl mx-auto">
        {cards.map((card, index) => {
          const Icon = card.icon;

          return (
            <motion.button
              key={card.id}
              initial={{ opacity: 0, y: 24, scale: 0.97 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{
                ...CARD_SPRING,
                delay: 0.05 + index * 0.07,
                opacity: { duration: 0.25, delay: 0.05 + index * 0.07 },
              }}
              whileHover={{
                y: -3,
                transition: { type: 'spring', stiffness: 400, damping: 25 },
              }}
              whileTap={{ scale: 0.98, transition: { duration: 0.1 } }}
              onClick={() => handleCardClick(card)}
              className={cn(
                "group relative overflow-hidden rounded-xl p-4",
                "bg-card/40 hover:bg-card/60 backdrop-blur-md border border-border/20",
                "hover:border-primary/20",
                "text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-primary/50",
                "shadow-sm hover:shadow-lg transition-all duration-300 ease-out",
              )}
            >
              {/* Subtle background gradient glow that fades in on hover */}
              <div
                className={cn(
                  "absolute inset-0 bg-gradient-to-br opacity-0 group-hover:opacity-100 transition-opacity duration-500 ease-out",
                  card.gradient
                )}
              />

              {/* Animated Shine Effect (crosses the card on hover) */}
              <div className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/5 to-transparent group-hover:animate-shimmer transition-transform" />

              {/* Content */}
              <div className="relative z-10 flex items-start gap-3.5">
                {/* Icon Container */}
                <div
                  className={cn(
                    "relative shrink-0 w-11 h-11 rounded-xl flex items-center justify-center border",
                    "transition-all duration-300 ease-out group-hover:scale-110 group-hover:shadow-md",
                    "bg-background/80",
                    card.iconBg,
                  )}
                >
                  <Icon className={cn("w-5 h-5 transition-transform duration-300 group-hover:-rotate-3 group-hover:scale-110", card.color)} />
                </div>

                {/* Text */}
                <div className="flex-1 min-w-0 pt-0.5">
                  <h4 className="text-sm font-semibold text-foreground mb-1 leading-none group-hover:text-primary transition-colors duration-300">
                    {card.title}
                  </h4>
                  <p className="text-[13px] text-muted-foreground leading-snug line-clamp-2 transition-colors duration-300">
                    {card.description}
                  </p>
                </div>
              </div>
            </motion.button>
          );
        })}
      </div>

      {/* Footer Hint */}
      <motion.p
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.45, duration: 0.4 }}
        className="mt-5 text-center text-xs text-muted-foreground/50"
      >
        {t('capability.hint')}
      </motion.p>
    </div>
  );
}
