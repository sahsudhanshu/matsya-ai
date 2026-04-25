"use client"

import { useState, useCallback, useRef, useEffect } from 'react';

interface UseVoiceInputOptions {
    lang?: string;
    onResult?: (transcript: string) => void;
    onError?: (error: string) => void;
}

interface UseVoiceInputReturn {
    isListening: boolean;
    transcript: string;
    isSupported: boolean;
    startListening: () => void;
    stopListening: () => void;
    error: string | null;
}

export function useVoiceInput({ lang = 'en-IN', onResult, onError }: UseVoiceInputOptions = {}): UseVoiceInputReturn {
    const [isListening, setIsListening] = useState(false);
    const [transcript, setTranscript] = useState('');
    const [error, setError] = useState<string | null>(null);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const recognitionRef = useRef<any>(null);

    const isSupported = typeof window !== 'undefined' &&
        ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window);

    useEffect(() => {
        return () => {
            if (recognitionRef.current) {
                recognitionRef.current.abort();
            }
        };
    }, []);

    const startListening = useCallback(() => {
        if (!isSupported) {
            const msg = 'Speech recognition is not supported in this browser.';
            setError(msg);
            onError?.(msg);
            return;
        }

        setError(null);
        setTranscript('');

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const SpeechRecognition = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
        const recognition = new SpeechRecognition();

        recognition.lang = lang;
        recognition.continuous = false;
        recognition.interimResults = true;
        recognition.maxAlternatives = 1;

        recognition.onstart = () => {
            setIsListening(true);
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onresult = (event: any) => {
            let finalTranscript = '';
            let interimTranscript = '';

            for (let i = event.resultIndex; i < event.results.length; i++) {
                const result = event.results[i];
                if (result.isFinal) {
                    finalTranscript += result[0].transcript;
                } else {
                    interimTranscript += result[0].transcript;
                }
            }

            const text = finalTranscript || interimTranscript;
            setTranscript(text);

            if (finalTranscript) {
                onResult?.(finalTranscript);
            }
        };

        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        recognition.onerror = (event: any) => {
            let msg = 'Speech recognition error.';
            if (event.error === 'not-allowed') {
                msg = 'Microphone access denied. Please allow microphone permissions.';
            } else if (event.error === 'no-speech') {
                msg = 'No speech detected. Please try again.';
            } else if (event.error === 'network') {
                msg = 'Network error. Please check your connection.';
            }
            setError(msg);
            setIsListening(false);
            onError?.(msg);
        };

        recognition.onend = () => {
            setIsListening(false);
        };

        recognitionRef.current = recognition;
        recognition.start();
    }, [lang, isSupported, onResult, onError]);

    const stopListening = useCallback(() => {
        if (recognitionRef.current) {
            recognitionRef.current.stop();
        }
        setIsListening(false);
    }, []);

    return { isListening, transcript, isSupported, startListening, stopListening, error };
}
