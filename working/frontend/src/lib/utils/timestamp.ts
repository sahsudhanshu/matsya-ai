/**
 * Timestamp formatting utilities for message display
 * Supports relative timestamps for recent messages and absolute timestamps for older messages
 */

/**
 * Determines if a timestamp is recent (< 24 hours ago)
 */
export function isRecent(timestamp: Date): boolean {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  const hours = diff / (1000 * 60 * 60);
  return hours < 24;
}

/**
 * Formats a timestamp as relative time (e.g., "2 minutes ago", "3 hours ago")
 * For messages less than 24 hours old
 */
export function formatRelativeTime(timestamp: Date, locale: string = 'en'): string {
  const now = new Date();
  const diff = now.getTime() - timestamp.getTime();
  
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  
  // Less than 1 minute
  if (seconds < 60) {
    return 'just now';
  }
  
  // Less than 1 hour
  if (minutes < 60) {
    return `${minutes} ${minutes === 1 ? 'minute' : 'minutes'} ago`;
  }
  
  // Less than 24 hours
  if (hours < 24) {
    return `${hours} ${hours === 1 ? 'hour' : 'hours'} ago`;
  }
  
  // Fallback to absolute time
  return formatAbsoluteTime(timestamp, locale);
}

/**
 * Formats a timestamp as absolute time (e.g., "Jan 15, 2:30 PM")
 * For messages older than 24 hours
 */
export function formatAbsoluteTime(timestamp: Date, locale: string = 'en'): string {
  const now = new Date();
  const isThisYear = timestamp.getFullYear() === now.getFullYear();
  
  // Format options based on whether it's this year or not
  const options: Intl.DateTimeFormatOptions = {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: shouldUse12Hour(locale),
  };
  
  // Include year if not this year
  if (!isThisYear) {
    options.year = 'numeric';
  }
  
  return timestamp.toLocaleString(locale, options);
}

/**
 * Determines if the locale should use 12-hour format
 * Based on common locale conventions
 */
function shouldUse12Hour(locale: string): boolean {
  // Locales that typically use 12-hour format
  const use12Hour = ['en-US', 'en-IN', 'en-PH', 'en-AU', 'en-NZ', 'en-CA'];
  
  // Check if locale starts with any of the 12-hour locales
  return use12Hour.some(l => locale.startsWith(l.split('-')[0]));
}

/**
 * Formats a timestamp for message display
 * Automatically chooses between relative and absolute format
 */
export function formatMessageTimestamp(timestamp: Date, locale: string = 'en'): string {
  if (isRecent(timestamp)) {
    return formatRelativeTime(timestamp, locale);
  }
  return formatAbsoluteTime(timestamp, locale);
}

/**
 * Formats a short timestamp for compact display (e.g., "2:30 PM")
 * Used in message rows
 */
export function formatShortTime(timestamp: Date, locale: string = 'en'): string {
  return timestamp.toLocaleTimeString(locale, {
    hour: 'numeric',
    minute: '2-digit',
    hour12: shouldUse12Hour(locale),
  });
}
