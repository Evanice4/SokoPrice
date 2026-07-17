"""
SokoPrice Database
Supports both PostgreSQL (production on Render) and SQLite (local development).
PostgreSQL is used when DATABASE_URL environment variable is set.
"""

import os
from datetime import datetime

DATABASE_URL = os.getenv("DATABASE_URL")
USE_POSTGRES = bool(DATABASE_URL)


def get_db():
    if USE_POSTGRES:
        import psycopg2
        import psycopg2.extras

        conn = psycopg2.connect(DATABASE_URL)
        conn.autocommit = False

        class PGWrapper:
            def __init__(self, conn):
                self._conn = conn
                self._cur = conn.cursor(
                    cursor_factory=psycopg2.extras.RealDictCursor
                )

            def execute(self, query, params=None):
                self._cur.execute(query, params or ())
                return self._cur

            def fetchone(self):
                return self._cur.fetchone()

            def fetchall(self):
                return self._cur.fetchall()

            def commit(self):
                self._conn.commit()

            def close(self):
                self._cur.close()
                self._conn.close()

            @property
            def lastrowid(self):
                return self._cur.fetchone()

        return PGWrapper(conn)
    else:
        import sqlite3
        DB_PATH = os.path.join(
            os.path.dirname(os.path.abspath(__file__)), "sokoprice.db"
        )
        conn = sqlite3.connect(DB_PATH)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        conn.execute("PRAGMA foreign_keys=ON")
        return conn


def q(query: str) -> str:
    """Convert SQLite ? placeholders to PostgreSQL %s when needed."""
    if USE_POSTGRES:
        return query.replace("?", "%s")
    return query


def init_db():
    conn = get_db()

    if USE_POSTGRES:
        cur = conn.cursor()
        cur.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'consumer',
                market TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS products (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL REFERENCES users(id),
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                unit TEXT NOT NULL DEFAULT 'kg',
                quantity_kg REAL NOT NULL DEFAULT 1.0,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS price_records (
                id SERIAL PRIMARY KEY,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                price_date TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'upload',
                uploaded_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS forecast_log (
                id SERIAL PRIMARY KEY,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                forecast_date TEXT NOT NULL,
                predicted_rwf REAL NOT NULL,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                sender_id INTEGER NOT NULL REFERENCES users(id),
                receiver_id INTEGER NOT NULL REFERENCES users(id),
                product_id INTEGER,
                message TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            )
        """)
        cur.execute("""
            CREATE TABLE IF NOT EXISTS pending_price_submissions (
                id SERIAL PRIMARY KEY,
                seller_id INTEGER NOT NULL REFERENCES users(id),
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                price_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            )
        """)

        # Seed admin
        cur.execute(
            "SELECT id FROM users WHERE email=%s", ("admin@sokoprice.rw",)
        )
        if not cur.fetchone():
            from auth import hash_password
            cur.execute(
                """INSERT INTO users(name,email,password,role,created_at)
                   VALUES(%s,%s,%s,%s,%s)""",
                ("SokoPrice Admin", "admin@sokoprice.rw",
                 hash_password("admin123"), "admin",
                 datetime.utcnow().isoformat())
            )
        conn.commit()
        cur.close()
        conn.close()

    else:
        import sqlite3
        c = conn.cursor()
        c.executescript("""
            CREATE TABLE IF NOT EXISTS users (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                name TEXT NOT NULL,
                email TEXT UNIQUE NOT NULL,
                password TEXT NOT NULL,
                role TEXT NOT NULL DEFAULT 'consumer',
                market TEXT,
                active INTEGER NOT NULL DEFAULT 1,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS products (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id INTEGER NOT NULL,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                unit TEXT NOT NULL DEFAULT 'kg',
                quantity_kg REAL NOT NULL DEFAULT 1.0,
                status TEXT NOT NULL DEFAULT 'active',
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                FOREIGN KEY(seller_id) REFERENCES users(id)
            );
            CREATE TABLE IF NOT EXISTS price_records (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                price_date TEXT NOT NULL,
                source TEXT NOT NULL DEFAULT 'upload',
                uploaded_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS forecast_log (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                forecast_date TEXT NOT NULL,
                predicted_rwf REAL NOT NULL,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS messages (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                sender_id INTEGER NOT NULL,
                receiver_id INTEGER NOT NULL,
                product_id INTEGER,
                message TEXT NOT NULL,
                read INTEGER NOT NULL DEFAULT 0,
                created_at TEXT NOT NULL
            );
            CREATE TABLE IF NOT EXISTS pending_price_submissions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                seller_id INTEGER NOT NULL,
                commodity TEXT NOT NULL,
                market TEXT NOT NULL,
                price_rwf REAL NOT NULL,
                price_date TEXT NOT NULL,
                status TEXT NOT NULL DEFAULT 'pending',
                reviewed_by INTEGER REFERENCES users(id),
                created_at TEXT NOT NULL
            );
        """)
        existing = c.execute(
            "SELECT id FROM users WHERE email=?", ("admin@sokoprice.rw",)
        ).fetchone()
        if not existing:
            from auth import hash_password
            c.execute(
                """INSERT INTO users(name,email,password,role,created_at)
                   VALUES(?,?,?,?,?)""",
                ("SokoPrice Admin", "admin@sokoprice.rw",
                 hash_password("admin123"), "admin",
                 datetime.utcnow().isoformat())
            )
        conn.commit()
        conn.close()

    print("Database initialized")