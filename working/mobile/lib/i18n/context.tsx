"use client"

import React, { createContext, useContext, useState, useCallback, useEffect, type ReactNode } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { Locale, TranslationKey, TranslationStrings, LanguageInfo } from './types';
import en from './translations/en';
import hi from './translations/hi';
import bn from './translations/bn';
import ta from './translations/ta';
import te from './translations/te';
import mr from './translations/mr';

// ── Language registry ─────────────────────────────────────────────────────────
export const LANGUAGES: LanguageInfo[] = [
    { code: 'en', label: 'English', labelEn: 'English', speechCode: 'en-IN' },
    { code: 'hi', label: 'हिन्दी', labelEn: 'Hindi', speechCode: 'hi-IN' },
    { code: 'bn', label: 'বাংলা', labelEn: 'Bengali', speechCode: 'bn-IN' },
    { code: 'ta', label: 'தமிழ்', labelEn: 'Tamil', speechCode: 'ta-IN' },
    { code: 'te', label: 'తెలుగు', labelEn: 'Telugu', speechCode: 'te-IN' },
    { code: 'mr', label: 'मराठी', labelEn: 'Marathi', speechCode: 'mr-IN' },
];

const translations: Record<Locale, TranslationStrings> = { en, hi, bn, ta, te, mr };

// ── Context ───────────────────────────────────────────────────────────────────
interface LanguageContextValue {
    locale: Locale;
    setLocale: (locale: Locale) => Promise<void>;
    t: (key: TranslationKey) => string;
    speechCode: string;
    isLoaded: boolean;
}

const LanguageContext = createContext<LanguageContextValue | null>(null);

const STORAGE_KEY = 'oceanai-locale';

export function LanguageProvider({ children }: { children: ReactNode }) {
    const [locale, setLocaleState] = useState<Locale>('en');
    const [isLoaded, setIsLoaded] = useState(false);

    // Load saved locale on mount
    useEffect(() => {
        const loadLocale = async () => {
            try {
                const saved = await AsyncStorage.getItem(STORAGE_KEY) as Locale | null;
                if (saved && translations[saved]) {
                    setLocaleState(saved);
                }
            } catch {
                // Ignore storage errors
            } finally {
                setIsLoaded(true);
            }
        };
        loadLocale();
    }, []);

    const setLocale = useCallback(async (newLocale: Locale) => {
        setLocaleState(newLocale);
        try {
            await AsyncStorage.setItem(STORAGE_KEY, newLocale);
        } catch {
            // Ignore storage errors
        }
    }, []);

    const t = useCallback((key: TranslationKey): string => {
        return translations[locale]?.[key] ?? translations.en[key] ?? key;
    }, [locale]);

    const speechCode = LANGUAGES.find(l => l.code === locale)?.speechCode ?? 'en-IN';

    return (
        <LanguageContext.Provider value={{ locale, setLocale, t, speechCode, isLoaded }}>
            {children}
        </LanguageContext.Provider>
    );
}

export function useLanguage() {
    const ctx = useContext(LanguageContext);
    if (!ctx) throw new Error('useLanguage must be used within LanguageProvider');
    return ctx;
}
