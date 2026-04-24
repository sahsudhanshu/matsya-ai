"""
Development-mode startup diagnostics for matsya AI Agent.
Validates required environment variables and probes external service connectivity.
Only runs when APP_ENV != 'production'.
"""
from __future__ import annotations
import os
import logging

logger = logging.getLogger(__name__)

# ── ANSI color helpers ──────────────────────────────────────────────────────
class C:
    RESET   = '\033[0m'
    BOLD    = '\033[1m'
    DIM     = '\033[2m'
    RED     = '\033[31m'
    GREEN   = '\033[32m'
    YELLOW  = '\033[33m'
    BLUE    = '\033[34m'
    CYAN    = '\033[36m'
    WHITE   = '\033[37m'
    BG_RED  = '\033[41m'
    BG_GREEN= '\033[42m'
    BG_YELLOW='\033[43m'

OK   = f'{C.GREEN}✅{C.RESET}'
WARN = f'{C.YELLOW}⚠️{C.RESET}'
FAIL = f'{C.RED}❌{C.RESET}'

# ── Check definitions ───────────────────────────────────────────────────────
ENV_CHECKS = [
    # (name, env_key, level, description)
    ('GOOGLE_API_KEY',              'GOOGLE_API_KEY',               'critical', 'Gemini API key for LLM'),
    ('COGNITO_USER_POOL_ID',        'COGNITO_USER_POOL_ID',         'critical', 'Cognito User Pool for auth'),
    ('COGNITO_CLIENT_ID',           'COGNITO_CLIENT_ID',            'warn',     'Cognito Client ID'),
    ('DB_HOST',                     'DB_HOST',                      'critical', 'MySQL host'),
    ('DB_USER',                     'DB_USER',                      'critical', 'MySQL user'),
    ('DB_PASSWORD',                 'DB_PASSWORD',                  'warn',     'MySQL password'),
    ('DB_NAME',                     'DB_NAME',                      'critical', 'MySQL database name'),
    ('OPENWEATHERMAP_API_KEY',      'OPENWEATHERMAP_API_KEY',       'warn',     'Weather API key'),
]


async def run_startup_checks() -> dict:
    """Run all startup diagnostics. Returns dict with 'ok' bool and counts."""
    if os.getenv('APP_ENV', 'development') == 'production':
        return {'ok': True}

    results = {'critical_errors': 0, 'warnings': 0}
    lines: list[str] = []

    lines.append('')
    lines.append(f'{C.CYAN}{C.BOLD}╔══════════════════════════════════════════════════════════════════╗{C.RESET}')
    lines.append(f'{C.CYAN}{C.BOLD}║  🤖 matsya AI Agent - Development Startup Diagnostics          ║{C.RESET}')
    lines.append(f'{C.CYAN}{C.BOLD}╠══════════════════════════════════════════════════════════════════╣{C.RESET}')

    # ── 1. Environment Variables ─────────────────────────────────────────────
    lines.append(f'{C.CYAN}{C.BOLD}║  {C.WHITE}Environment Variables{C.RESET}')
    lines.append(f'{C.CYAN}{C.BOLD}╟──────────────────────────────────────────────────────────────────╢{C.RESET}')

    for name, env_key, level, desc in ENV_CHECKS:
        value = os.getenv(env_key, '')
        max_len = 30

        if value:
            display = value[:max_len] + '…' if len(value) > max_len else value
            lines.append(f'{C.CYAN}║{C.RESET}  {OK} {name:<30} = {C.DIM}{display}{C.RESET}')
        elif level == 'critical':
            lines.append(f'{C.CYAN}║{C.RESET}  {FAIL} {name:<30} = {C.RED}{C.BOLD}MISSING{C.RESET}  {C.DIM}({desc}){C.RESET}')
            results['critical_errors'] += 1
        else:
            lines.append(f'{C.CYAN}║{C.RESET}  {WARN} {name:<30} = {C.YELLOW}not set{C.RESET}  {C.DIM}({desc}){C.RESET}')
            results['warnings'] += 1

    # ── 2. Connectivity Probes ──────────────────────────────────────────────
    lines.append(f'{C.CYAN}{C.BOLD}╟──────────────────────────────────────────────────────────────────╢{C.RESET}')
    lines.append(f'{C.CYAN}{C.BOLD}║  {C.WHITE}Connectivity{C.RESET}')
    lines.append(f'{C.CYAN}{C.BOLD}╟──────────────────────────────────────────────────────────────────╢{C.RESET}')

    # MySQL
    try:
        import pymysql
        ssl_enabled = os.getenv('DB_SSL', 'false').lower() == 'true'
        conn = pymysql.connect(
            host=os.getenv('DB_HOST', 'localhost'),
            port=int(os.getenv('DB_PORT', '3306')),
            user=os.getenv('DB_USER', 'root'),
            password=os.getenv('DB_PASSWORD', ''),
            database=os.getenv('DB_NAME', 'defaultdb'),
            charset='utf8mb4',
            connect_timeout=5,
            **({"ssl": {}} if ssl_enabled else {}),
        )
        with conn.cursor() as cur:
            cur.execute('SHOW TABLES')
            count = len(cur.fetchall())
        conn.close()
        lines.append(f'{C.CYAN}║{C.RESET}  {OK} {"MySQL":<30} = {C.GREEN}connected{C.RESET} {C.DIM}({count} tables){C.RESET}')
    except Exception as e:
        lines.append(f'{C.CYAN}║{C.RESET}  {FAIL} {"MySQL":<30} = {C.RED}unreachable{C.RESET}  {C.DIM}{str(e)[:50]}{C.RESET}')
        results['critical_errors'] += 1

    # Gemini API - lightweight HTTP check via REST endpoint
    api_key = os.getenv('GOOGLE_API_KEY', '')
    if api_key:
        try:
            import urllib.request
            import urllib.error
            model_name = os.getenv('GEMINI_MODEL', 'gemini-2.0-flash')
            url = f"https://generativelanguage.googleapis.com/v1beta/models/{model_name}?key={api_key}"
            req = urllib.request.Request(url, method='GET')
            req.add_header('Content-Type', 'application/json')
            with urllib.request.urlopen(req, timeout=5) as resp:
                if resp.status == 200:
                    lines.append(f'{C.CYAN}║{C.RESET}  {OK} {"Gemini API":<30} = {C.GREEN}connected{C.RESET} {C.DIM}({model_name}){C.RESET}')
                else:
                    lines.append(f'{C.CYAN}║{C.RESET}  {WARN} {"Gemini API":<30} = {C.YELLOW}status {resp.status}{C.RESET}')
                    results['warnings'] += 1
        except urllib.error.HTTPError as e:
            lines.append(f'{C.CYAN}║{C.RESET}  {FAIL} {"Gemini API":<30} = {C.RED}HTTP {e.code}{C.RESET}  {C.DIM}{str(e.reason)[:40]}{C.RESET}')
            results['critical_errors'] += 1
        except Exception as e:
            lines.append(f'{C.CYAN}║{C.RESET}  {FAIL} {"Gemini API":<30} = {C.RED}error{C.RESET}  {C.DIM}{str(e)[:50]}{C.RESET}')
            results['critical_errors'] += 1
    else:
        lines.append(f'{C.CYAN}║{C.RESET}  {FAIL} {"Gemini API":<30} = {C.RED}no API key{C.RESET}')
        results['critical_errors'] += 1

    # ── 3. Summary ──────────────────────────────────────────────────────────
    lines.append(f'{C.CYAN}{C.BOLD}╟──────────────────────────────────────────────────────────────────╢{C.RESET}')

    if results['critical_errors'] > 0:
        lines.append(f'{C.CYAN}║{C.RESET}  {C.BG_RED}{C.WHITE}{C.BOLD} RESULT {C.RESET} {C.RED}{results["critical_errors"]} critical error(s){C.RESET}, {C.YELLOW}{results["warnings"]} warning(s){C.RESET}')
    elif results['warnings'] > 0:
        lines.append(f'{C.CYAN}║{C.RESET}  {C.BG_YELLOW}{C.BOLD} RESULT {C.RESET} {C.GREEN}0 critical errors{C.RESET}, {C.YELLOW}{results["warnings"]} warning(s){C.RESET}')
    else:
        lines.append(f'{C.CYAN}║{C.RESET}  {C.BG_GREEN}{C.BOLD} RESULT {C.RESET} {C.GREEN}All checks passed!{C.RESET}')

    lines.append(f'{C.CYAN}{C.BOLD}╚══════════════════════════════════════════════════════════════════╝{C.RESET}')
    lines.append('')

    print('\n'.join(lines))

    results['ok'] = results['critical_errors'] == 0
    return results
