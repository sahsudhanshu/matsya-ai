/**
 * Indian number formatting utilities
 * Formats currency and numbers in the Indian numbering system (Lakhs, Crores)
 */

/**
 * Formats a number using Indian comma grouping: 1,23,45,678
 */
export function formatIndianNumber(num: number): string {
    const str = Math.abs(Math.round(num)).toString();
    if (str.length <= 3) return (num < 0 ? "-" : "") + str;

    const lastThree = str.slice(-3);
    const remaining = str.slice(0, -3);
    const grouped = remaining.replace(/\B(?=(\d{2})+(?!\d))/g, ",");

    return (num < 0 ? "-" : "") + grouped + "," + lastThree;
}

/**
 * Formats amount as Indian Rupees: ₹1,23,456
 */
export function formatINR(amount: number, decimals = 0): string {
    if (decimals > 0) {
        const integer = Math.floor(Math.abs(amount));
        const decimal = Math.abs(amount - integer)
            .toFixed(decimals)
            .slice(1); // .xx
        return (amount < 0 ? "-" : "") + "₹" + formatIndianNumber(integer) + decimal;
    }
    return "₹" + formatIndianNumber(amount);
}

/**
 * Formats large numbers in human-readable Indian short form
 * e.g. 150000 → "₹1.5 Lakh", 12000000 → "₹1.2 Crore"
 */
export function formatINRShort(amount: number): string {
    const abs = Math.abs(amount);
    const sign = amount < 0 ? "-" : "";

    if (abs >= 1_00_00_000) {
        return sign + "₹" + (abs / 1_00_00_000).toFixed(1).replace(/\.0$/, "") + " Crore";
    }
    if (abs >= 1_00_000) {
        return sign + "₹" + (abs / 1_00_000).toFixed(1).replace(/\.0$/, "") + " Lakh";
    }
    if (abs >= 1_000) {
        return sign + "₹" + (abs / 1_000).toFixed(1).replace(/\.0$/, "") + "K";
    }
    return sign + "₹" + formatIndianNumber(abs);
}
