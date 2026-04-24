"use client"

import React, { ReactNode, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';

// ── Types ─────────────────────────────────────────────────────────────────────
export type OverlayTab = 'settings' | 'profile' | 'help';

interface OverlayDialogProps {
    isOpen: boolean;
    onClose: () => void;
    children: ReactNode;
    className?: string;
}

// ── Overlay Dialog ────────────────────────────────────────────────────────────
export default function OverlayDialog({ isOpen, onClose, children, className }: OverlayDialogProps) {
    const scrollRef = useRef<HTMLDivElement>(null);

    // ── Close on Escape ──
    const handleEscape = useCallback((e: KeyboardEvent) => {
        if (e.key === 'Escape') onClose();
    }, [onClose]);

    useEffect(() => {
        if (isOpen) {
            document.addEventListener('keydown', handleEscape);
            document.body.style.overflow = 'hidden';
            // Reset scroll position when opening
            if (scrollRef.current) scrollRef.current.scrollTop = 0;
        }
        return () => {
            document.removeEventListener('keydown', handleEscape);
            document.body.style.overflow = '';
        };
    }, [isOpen, handleEscape]);

    return (
        <AnimatePresence>
            {isOpen && (
                <div className="fixed inset-0 z-[100] flex items-end sm:items-center justify-center">
                    {/* Backdrop without blur to fix rendering lag over heavy maps */}
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        transition={{ duration: 0.2 }}
                        className="absolute inset-0 bg-black/80"
                        onClick={onClose}
                    />

                    {/* Dialog panel */}
                    <motion.div
                        initial={{ opacity: 0, y: 30, scale: 0.97 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.97 }}
                        transition={{
                            type: 'spring',
                            damping: 30,
                            stiffness: 400,
                            mass: 0.8,
                        }}
                        className={cn(
                            // Mobile: slide up from bottom, full width, rounded top
                            "relative w-full h-[92vh] rounded-t-2xl",
                            // Desktop: centered card
                            "sm:h-auto sm:w-[95vw] sm:max-w-3xl sm:max-h-[85vh] sm:rounded-2xl",
                            "bg-card border-0 sm:border sm:border-border/25",
                            "shadow-2xl shadow-black/40",
                            "flex flex-col overflow-hidden",
                            className
                        )}
                        onClick={(e) => e.stopPropagation()}
                    >
                        {/* Drag handle (mobile) */}
                        <div className="sm:hidden flex justify-center pt-2 pb-1 shrink-0">
                            <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
                        </div>

                        {/* Close button */}
                        <button
                            onClick={onClose}
                            className={cn(
                                "absolute top-3 right-3 z-10",
                                "w-8 h-8 rounded-lg flex items-center justify-center",
                                "bg-muted/30 hover:bg-muted/60 transition-all duration-150",
                                "text-muted-foreground hover:text-foreground",
                            )}
                            aria-label="Close dialog"
                        >
                            <X className="w-4 h-4" />
                        </button>

                        {/* Scrollable content */}
                        <div
                            ref={scrollRef}
                            className="flex-1 overflow-y-auto overscroll-contain scroll-smooth"
                        >
                            {children}
                        </div>
                    </motion.div>
                </div>
            )}
        </AnimatePresence>
    );
}
