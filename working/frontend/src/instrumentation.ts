/**
 * Next.js Instrumentation - runs once when the dev server starts.
 * https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 *
 * Prints startup diagnostics to the TERMINAL (not browser).
 */

export async function register() {
    if (process.env.NODE_ENV === 'production') return;

    const checks: { name: string; key: string; level: 'critical' | 'warn'; desc: string }[] = [
        { name: 'NEXT_PUBLIC_API_URL', key: 'NEXT_PUBLIC_API_URL', level: 'critical', desc: 'Backend API URL' },
        { name: 'NEXT_PUBLIC_AGENT_URL', key: 'NEXT_PUBLIC_AGENT_URL', level: 'critical', desc: 'Agent API URL' },
        { name: 'NEXT_PUBLIC_ML_BASE_URL', key: 'NEXT_PUBLIC_ML_BASE_URL', level: 'warn', desc: 'ML Model API base URL' },
        { name: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', key: 'NEXT_PUBLIC_COGNITO_USER_POOL_ID', level: 'warn', desc: 'Cognito User Pool ID' },
        { name: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', key: 'NEXT_PUBLIC_COGNITO_CLIENT_ID', level: 'warn', desc: 'Cognito Client ID' },
        { name: 'NEXT_PUBLIC_COGNITO_REGION', key: 'NEXT_PUBLIC_COGNITO_REGION', level: 'warn', desc: 'Cognito Region' },
        { name: 'NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', key: 'NEXT_PUBLIC_OPENWEATHERMAP_API_KEY', level: 'warn', desc: 'OpenWeatherMap API key' },
    ];

    const R = '\x1b[0m';
    const B = '\x1b[1m';
    const DIM = '\x1b[2m';
    const RED = '\x1b[31m';
    const GRN = '\x1b[32m';
    const YEL = '\x1b[33m';
    const CYN = '\x1b[36m';
    const WHT = '\x1b[37m';
    const BGR = '\x1b[41m';
    const BGG = '\x1b[42m';
    const BGY = '\x1b[43m';

    const OK = `${GRN}✅${R}`;
    const WARN = `${YEL}⚠️${R}`;
    const FAIL = `${RED}❌${R}`;

    let criticalErrors = 0;
    let warnings = 0;

    const lines: string[] = [];

    lines.push('');
    lines.push(`${CYN}${B}╔══════════════════════════════════════════════════════════════════╗${R}`);
    lines.push(`${CYN}${B}║  🌊 MatsyaAI Frontend - Development Startup Diagnostics         ║${R}`);
    lines.push(`${CYN}${B}╠══════════════════════════════════════════════════════════════════╣${R}`);
    lines.push(`${CYN}${B}║  ${WHT}Environment Variables${R}`);
    lines.push(`${CYN}${B}╟──────────────────────────────────────────────────────────────────╢${R}`);

    for (const { name, key, level, desc } of checks) {
        const value = process.env[key];
        const maxLen = 30;

        if (value) {
            const display = value.length > maxLen ? value.slice(0, maxLen) + '…' : value;
            lines.push(`${CYN}║${R}  ${OK} ${name.padEnd(34)} = ${DIM}${display}${R}`);
        } else if (level === 'critical') {
            lines.push(`${CYN}║${R}  ${FAIL} ${name.padEnd(34)} = ${RED}${B}MISSING${R}  ${DIM}(${desc})${R}`);
            criticalErrors++;
        } else {
            lines.push(`${CYN}║${R}  ${WARN} ${name.padEnd(34)} = ${YEL}not set${R}  ${DIM}(${desc})${R}`);
            warnings++;
        }
    }

    // Connectivity probes
    lines.push(`${CYN}${B}╟──────────────────────────────────────────────────────────────────╢${R}`);
    lines.push(`${CYN}${B}║  ${WHT}Connectivity${R}`);
    lines.push(`${CYN}${B}╟──────────────────────────────────────────────────────────────────╢${R}`);

    const apiUrl = process.env.NEXT_PUBLIC_API_URL;
    if (apiUrl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${apiUrl}/health`, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeout);
            if (res && res.ok) {
                lines.push(`${CYN}║${R}  ${OK} ${'Backend API'.padEnd(34)} = ${GRN}${apiUrl}${R} ${DIM}(healthy)${R}`);
            } else {
                lines.push(`${CYN}║${R}  ${WARN} ${'Backend API'.padEnd(34)} = ${YEL}${apiUrl}${R} ${DIM}(not responding yet)${R}`);
                warnings++;
            }
        } catch {
            lines.push(`${CYN}║${R}  ${WARN} ${'Backend API'.padEnd(34)} = ${YEL}unreachable${R}  ${DIM}${apiUrl}${R}`);
            warnings++;
        }
    }

    const agentUrl = process.env.NEXT_PUBLIC_AGENT_URL;
    if (agentUrl) {
        try {
            const controller = new AbortController();
            const timeout = setTimeout(() => controller.abort(), 3000);
            const res = await fetch(`${agentUrl}/health`, { signal: controller.signal }).catch(() => null);
            clearTimeout(timeout);
            if (res && res.ok) {
                lines.push(`${CYN}║${R}  ${OK} ${'Agent API'.padEnd(34)} = ${GRN}${agentUrl}${R} ${DIM}(healthy)${R}`);
            } else {
                lines.push(`${CYN}║${R}  ${WARN} ${'Agent API'.padEnd(34)} = ${YEL}${agentUrl}${R} ${DIM}(not responding yet)${R}`);
                warnings++;
            }
        } catch {
            lines.push(`${CYN}║${R}  ${WARN} ${'Agent API'.padEnd(34)} = ${YEL}unreachable${R}  ${DIM}${agentUrl}${R}`);
            warnings++;
        }
    }

    // Summary
    lines.push(`${CYN}${B}╟──────────────────────────────────────────────────────────────────╢${R}`);

    if (criticalErrors > 0) {
        lines.push(`${CYN}║${R}  ${BGR}${WHT}${B} RESULT ${R} ${RED}${criticalErrors} critical error(s)${R}, ${YEL}${warnings} warning(s)${R}`);
    } else if (warnings > 0) {
        lines.push(`${CYN}║${R}  ${BGY}${B} RESULT ${R} ${GRN}0 critical errors${R}, ${YEL}${warnings} warning(s)${R}`);
    } else {
        lines.push(`${CYN}║${R}  ${BGG}${B} RESULT ${R} ${GRN}All checks passed!${R}`);
    }

    lines.push(`${CYN}${B}╚══════════════════════════════════════════════════════════════════╝${R}`);
    lines.push('');

    // console.log works in both Node.js and Edge runtimes
    console.log(lines.join('\n'));
}
