"""
Shared MySQL connection pool - reused across all agent modules.
Using PyMySQL as the driver (pure Python, no compiled deps).
"""
import os
import pymysql
import pymysql.cursors
from dotenv import load_dotenv

load_dotenv()
# print(f"DB_PASSWD: {os.getenv('DB_PASSWORD')},DB_PORT:{os.getenv('DB_PORT')} DB_HOST: {os.getenv('DB_HOST')}, DB_USER: {os.getenv('DB_USER')}, DB_NAME: {os.getenv('DB_NAME')}")
_pool = None

def _get_connection() -> pymysql.connections.Connection:
    """Create a new PyMySQL connection. Call this to get a fresh connection from the pool."""
    ssl_enabled = os.getenv("DB_SSL", "false").lower() == "true"
    return pymysql.connect(
        host=os.getenv("DB_HOST", "localhost"),
        port=int(os.getenv("DB_PORT", "3306")),
        user=os.getenv("DB_USER", "root"),
        password=os.getenv("DB_PASSWORD", ""),
        database=os.getenv("DB_NAME", "defaultdb"),
        charset="utf8mb4",
        cursorclass=pymysql.cursors.DictCursor,
        autocommit=True,
        # ssl={} enables TLS without strict CA verification (matches Aiven's self-signed chain)
        **({"ssl": {}} if ssl_enabled else {}),
    )


def execute(sql: str, args=None):
    """Execute a SQL statement, returning (rows, lastrowid).
    For SELECT: rows is a list of dicts.
    For INSERT/UPDATE/DELETE: rows is an empty list, lastrowid has the insert ID.
    """
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, args or ())
            if sql.strip().upper().startswith("SELECT") or sql.strip().upper().startswith("SHOW"):
                rows = cursor.fetchall()
                return rows, None
            else:
                return [], cursor.lastrowid
    finally:
        conn.close()


def fetchone(sql: str, args=None):
    """Fetch a single row dict, or None."""
    conn = _get_connection()
    try:
        with conn.cursor() as cursor:
            cursor.execute(sql, args or ())
            return cursor.fetchone()
    finally:
        conn.close()


def fetchall(sql: str, args=None):
    """Fetch all rows as a list of dicts."""
    rows, _ = execute(sql, args)
    return rows
