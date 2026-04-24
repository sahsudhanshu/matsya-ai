"use client";

import React, { useCallback, useRef, useState } from 'react';
import { Upload, ImageIcon, ArrowRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useAgentFirstStore } from '@/lib/stores/agent-first-store';

interface InlineUploadZoneProps {
  className?: string;
}

/**
 * Drag-and-drop upload zone rendered inline inside an agent chat bubble.
 * Dropping/selecting a file opens the Upload canvas pane with the file pre-loaded.
 */
export default function InlineUploadZone({ className }: InlineUploadZoneProps) {
  const setActiveComponent = useAgentFirstStore(s => s.setActiveComponent);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFiles = useCallback((files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter(f => f.type.startsWith('image/'));
    if (fileArray.length === 0) return;
    setActiveComponent('upload', { initialFiles: fileArray, autoAnalyze: true });
  }, [setActiveComponent]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') setDragActive(true);
    else if (e.type === 'dragleave') setDragActive(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    handleFiles(e.dataTransfer.files);
  }, [handleFiles]);

  return (
    <div className={cn("mt-2 rounded-xl border-2 border-dashed overflow-hidden transition-colors", dragActive ? "border-primary bg-primary/5" : "border-border/40 bg-card/30", className)}>
      <div
        onDragEnter={handleDrag}
        onDragLeave={handleDrag}
        onDragOver={handleDrag}
        onDrop={handleDrop}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 py-6 px-4 cursor-pointer hover:bg-primary/5 transition-colors"
      >
        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => handleFiles(e.target.files)}
        />
        <div className={cn(
          "w-10 h-10 rounded-xl flex items-center justify-center transition-colors",
          dragActive ? "bg-primary/20 text-primary" : "bg-muted/50 text-muted-foreground"
        )}>
          {dragActive ? <ImageIcon className="w-5 h-5" /> : <Upload className="w-5 h-5" />}
        </div>
        <div className="text-center">
          <p className="text-xs font-semibold">
            {dragActive ? 'Drop images here' : 'Drag photos or click to upload'}
          </p>
          <p className="text-[10px] text-muted-foreground mt-0.5">
            Fish photos for instant AI analysis
          </p>
        </div>
      </div>

      {/* Quick shortcut */}
      <button
        onClick={() => setActiveComponent('upload')}
        className="w-full flex items-center justify-center gap-1.5 py-2 border-t border-border/20 text-[10px] font-bold uppercase tracking-wider text-primary hover:bg-primary/5 transition-colors"
      >
        Open Scanner <ArrowRight className="w-3 h-3" />
      </button>
    </div>
  );
}
