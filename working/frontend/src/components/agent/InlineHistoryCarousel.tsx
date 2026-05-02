"use client";

import React, { useEffect, useState } from 'react';
import Image from "next/image";
import { Clock, ChevronRight, Fish, Sparkles, Images } from 'lucide-react';
import { cn } from '@/lib/utils';
import { getGroups, type GroupRecord } from '@/lib/api-client';
import { resolveMLUrl } from '@/lib/constants';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';
import { Badge } from '@/components/ui/badge';

interface InlineHistoryCarouselProps {
  /** Called when the user clicks "Ask AI about this catch" */
  onAskAboutGroup?: (groupId: string, summary: string) => void;
  className?: string;
}

/**
 * Horizontal carousel of recent catches rendered inline inside a chat bubble.
 * Each card shows a thumbnail, species breakdown, date, and an "Ask AI" chip.
 */
export default function InlineHistoryCarousel({ onAskAboutGroup, className }: InlineHistoryCarouselProps) {
  const setActiveComponent = useAgentFirstStore(s => s.setActiveComponent);
  const [groups, setGroups] = useState<GroupRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getGroups(6)
      .then(res => setGroups(res.groups ?? []))
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  if (loading) {
    return (
      <div className={cn("mt-2 rounded-xl border border-border/30 bg-muted/10 overflow-hidden", className)}>
        <div className="flex items-center gap-1.5 px-3 py-2 border-b border-border/20">
          <div className="h-3 w-3 rounded bg-muted animate-pulse" />
          <div className="h-3 w-20 rounded bg-muted animate-pulse" />
        </div>
        <div className="flex gap-2.5 p-3">
          {[1, 2, 3].map(i => (
            <div key={i} className="w-[160px] shrink-0 rounded-lg border border-border/20 overflow-hidden">
              <div className="h-[80px] bg-muted/40 animate-pulse" />
              <div className="p-2 space-y-1.5">
                <div className="h-3 w-20 rounded bg-muted animate-pulse" />
                <div className="h-2.5 w-14 rounded bg-muted/60 animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  if (groups.length === 0) {
    return (
      <div className={cn("mt-2 flex flex-col items-center justify-center h-24 rounded-xl border border-border/30 bg-muted/10 gap-1", className)}>
        <Images className="w-5 h-5 text-muted-foreground/50" />
        <span className="text-[11px] text-muted-foreground">No catches yet</span>
      </div>
    );
  }

  return (
    <div className={cn("mt-2 rounded-xl border border-border/30 overflow-hidden bg-card/40 backdrop-blur-sm max-w-full", className)}>
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2 border-b border-border/20">
        <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
          <Clock className="w-3 h-3 text-orange-400" />
          Recent Catches
        </div>
        <button
          onClick={() => setActiveComponent('history')}
          className="flex items-center gap-0.5 text-[10px] font-bold uppercase tracking-wider text-primary hover:text-primary/80 transition-colors"
        >
          View All <ChevronRight className="w-3 h-3" />
        </button>
      </div>

      {/* Scrollable carousel */}
      <div className="overflow-x-auto scrollbar-thin scrollbar-thumb-border/40">
        <div className="flex gap-2.5 p-3 w-max">
          {groups.map((group) => {
            const stats = group.analysisResult?.aggregateStats;
            const topSpecies = stats?.speciesDistribution
              ? Object.entries(stats.speciesDistribution).sort((a, b) => (b[1] as number) - (a[1] as number))[0]?.[0]
              : null;
            const fishCount = stats?.totalFishCount ?? 0;
            const imgUrl = group.presignedViewUrls?.[0]
              || (group.analysisResult?.images?.[0]?.yolo_image_url
                ? resolveMLUrl(group.analysisResult.images[0].yolo_image_url)
                : null);

            const summary = [
              `${group.imageCount} image${group.imageCount > 1 ? 's' : ''}`,
              fishCount > 0 ? `${fishCount} fish` : null,
              topSpecies,
              stats?.diseaseDetected ? 'disease detected' : null,
            ].filter(Boolean).join(', ');

            return (
              <div
                key={group.groupId}
                className="flex flex-col w-[160px] shrink-0 rounded-lg border border-border/20 bg-background/60 overflow-hidden hover:border-primary/30 transition-colors"
              >
                {/* Thumbnail */}
                <div className="h-[80px] bg-muted/30 relative overflow-hidden">
                  {imgUrl ? (
                    <Image unoptimized width={800} height={800}  src={imgUrl} alt="catch" className="w-full h-full object-cover" />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Fish className="w-6 h-6 text-muted-foreground/30" />
                    </div>
                  )}
                  <Badge className="absolute top-1.5 right-1.5 text-[8px] h-4 px-1.5 bg-black/50 text-white border-none">
                    {group.imageCount} img
                  </Badge>
                </div>

                {/* Info */}
                <div className="p-2 flex-1 flex flex-col gap-1">
                  <p className="text-[11px] font-bold truncate">{topSpecies || 'Unknown'}</p>
                  <p className="text-[9px] text-muted-foreground">
                    {new Date(group.createdAt).toLocaleDateString()}
                    {fishCount > 0 && ` · ${fishCount} fish`}
                  </p>
                </div>

                {/* Ask AI button */}
                <button
                  onClick={() => onAskAboutGroup?.(group.groupId, summary)}
                  className="flex items-center justify-center gap-1 py-1.5 border-t border-border/20 text-[10px] font-bold text-primary hover:bg-primary/5 transition-colors"
                >
                  <Sparkles className="w-3 h-3" />
                  Ask AI
                </button>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
