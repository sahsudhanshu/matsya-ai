"use client"

import React, { useRef, useState, useCallback, useEffect } from 'react';
import { Camera, X, SwitchCamera, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/lib/i18n';

interface CameraModalProps {
    isOpen: boolean;
    onClose: () => void;
    onCapture: (file: File) => void;
}

export default function CameraModal({ isOpen, onClose, onCapture }: CameraModalProps) {
    const { t } = useLanguage();
    const videoRef = useRef<HTMLVideoElement>(null);
    const canvasRef = useRef<HTMLCanvasElement>(null);
    const streamRef = useRef<MediaStream | null>(null);
    const [isStarting, setIsStarting] = useState(true);
    const [facingMode, setFacingMode] = useState<'environment' | 'user'>('environment');
    const [error, setError] = useState<string | null>(null);

    const stopStream = useCallback(() => {
        if (streamRef.current) {
            streamRef.current.getTracks().forEach(track => track.stop());
            streamRef.current = null;
        }
    }, []);

    const startCamera = useCallback(async (facing: 'environment' | 'user') => {
        setIsStarting(true);
        setError(null);
        stopStream();

        // Check HTTPS
        if (typeof window !== 'undefined' && location.protocol !== 'https:' && location.hostname !== 'localhost' && location.hostname !== '127.0.0.1') {
            setError(t('camera.httpsRequired'));
            setIsStarting(false);
            return;
        }

        if (!navigator.mediaDevices?.getUserMedia) {
            setError(t('camera.notSupported'));
            setIsStarting(false);
            return;
        }

        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { facingMode: facing, width: { ideal: 1920 }, height: { ideal: 1080 } },
                audio: false,
            });
            streamRef.current = stream;
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                await videoRef.current.play();
            }
            setIsStarting(false);
        } catch (err) {
            setIsStarting(false);
            if (err instanceof DOMException) {
                if (err.name === 'NotAllowedError') {
                    setError(t('camera.denied'));
                } else if (err.name === 'NotFoundError' || err.name === 'OverconstrainedError') {
                    setError(t('camera.notFound'));
                } else {
                    setError(t('camera.notSupported'));
                }
            } else {
                setError(t('camera.notSupported'));
            }
        }
    }, [stopStream, t]);

    useEffect(() => {
        if (isOpen) {
            startCamera(facingMode);
        }
        return () => {
            stopStream();
        };
    }, [isOpen, facingMode, startCamera, stopStream]);

    const handleCapture = useCallback(() => {
        const video = videoRef.current;
        const canvas = canvasRef.current;
        if (!video || !canvas) return;

        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        ctx.drawImage(video, 0, 0);

        canvas.toBlob((blob) => {
            if (blob) {
                const file = new File([blob], `camera-capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                onCapture(file);
                onClose();
            }
        }, 'image/jpeg', 0.92);
    }, [onCapture, onClose]);

    const handleSwitchCamera = useCallback(() => {
        setFacingMode(prev => prev === 'environment' ? 'user' : 'environment');
    }, []);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-[100] bg-black/90 backdrop-blur-sm flex flex-col items-center justify-center animate-in fade-in duration-200">
            {/* Header */}
            <div className="absolute top-0 left-0 right-0 flex items-center justify-between p-4 sm:p-6 z-10">
                <h2 className="text-white font-bold text-lg">{t('camera.title')}</h2>
                <Button
                    variant="ghost"
                    size="icon"
                    className="text-white hover:bg-white/20 rounded-full h-10 w-10"
                    onClick={() => { stopStream(); onClose(); }}
                >
                    <X className="w-6 h-6" />
                </Button>
            </div>

            {/* Error state */}
            {error ? (
                <div className="max-w-sm text-center space-y-4 p-6">
                    <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto">
                        <Camera className="w-8 h-8 text-red-400" />
                    </div>
                    <p className="text-white/80 text-sm leading-relaxed">{error}</p>
                    <Button variant="outline" className="rounded-xl text-white border-white/30 bg-white/10 hover:bg-white/20" onClick={() => { stopStream(); onClose(); }}>
                        {t('camera.close')}
                    </Button>
                </div>
            ) : (
                <>
                    {/* Video preview */}
                    <div className="relative w-full max-w-2xl aspect-[4/3] sm:rounded-2xl overflow-hidden bg-black">
                        {isStarting && (
                            <div className="absolute inset-0 flex items-center justify-center bg-black/60 z-10">
                                <div className="flex flex-col items-center gap-3 text-white">
                                    <Loader2 className="w-8 h-8 animate-spin" />
                                    <span className="text-sm">{t('camera.starting')}</span>
                                </div>
                            </div>
                        )}
                        <video
                            ref={videoRef}
                            autoPlay
                            playsInline
                            muted
                            className="w-full h-full object-cover"
                            style={{ transform: facingMode === 'user' ? 'scaleX(-1)' : 'none' }}
                        />
                        {/* Viewfinder grid */}
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/3 left-0 right-0 h-px bg-white/20" />
                            <div className="absolute top-2/3 left-0 right-0 h-px bg-white/20" />
                            <div className="absolute top-0 bottom-0 left-1/3 w-px bg-white/20" />
                            <div className="absolute top-0 bottom-0 left-2/3 w-px bg-white/20" />
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="flex items-center justify-center gap-8 py-8">
                        <Button
                            variant="ghost"
                            size="icon"
                            className="text-white hover:bg-white/20 rounded-full h-12 w-12"
                            onClick={handleSwitchCamera}
                        >
                            <SwitchCamera className="w-6 h-6" />
                        </Button>
                        <button
                            onClick={handleCapture}
                            disabled={isStarting}
                            className="w-18 h-18 rounded-full border-4 border-white bg-white/20 hover:bg-white/40 active:scale-90 transition-all duration-150 flex items-center justify-center disabled:opacity-50"
                            style={{ width: 72, height: 72 }}
                        >
                            <div className="w-14 h-14 rounded-full bg-white" style={{ width: 56, height: 56 }} />
                        </button>
                        <div className="w-12 h-12" /> {/* spacer for symmetry */}
                    </div>
                </>
            )}

            {/* Hidden canvas for capture */}
            <canvas ref={canvasRef} className="hidden" />
        </div>
    );
}
