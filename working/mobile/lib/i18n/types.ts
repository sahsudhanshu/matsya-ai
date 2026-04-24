import type en from './translations/en';

// All translation keys based on the English file
export type TranslationKey = keyof typeof en;
export type TranslationStrings = Partial<Record<TranslationKey, string>>;

export type Locale = 'en' | 'hi' | 'bn' | 'ta' | 'te' | 'mr';

export interface LanguageInfo {
    code: Locale;
    label: string;        // Native script label
    labelEn: string;      // English label
    speechCode: string;   // BCP-47 code for Web Speech API
}
