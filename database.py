"""
SokoPrice Database
SQLite setup with users, products, prices, and audit tables.
"""

import sqlite3
import os
from datetime import datetime

DB_PATH = os.getenv("DB_PATH", "sokoprice.db")


def get_db():
    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    conn.execute("PRAGMA journal_mode=WAL")
    conn.execute("PRAGMA foreign_keys=ON")
    return conn


def init_db():
    conn = get_db()
    c = conn.cursor()

    c.executescript("""
        CREATE TABLE IF NOT EXISTS users (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            name        TEXT    NOT NULL,
            email       TEXT    UNIQUE NOT NULL,
            password    TEXT    NOT NULL,
            role        TEXT    NOT NULL DEFAULT 'consumer',
            market      TEXT,
            active      INTEGER NOT NULL DEFAULT 1,
            created_at  TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS products (
            id            INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id     INTEGER NOT NULL REFERENCES users(id),
            commodity     TEXT    NOT NULL,
            market        TEXT    NOT NULL,
            price_rwf     REAL    NOT NULL,
            unit          TEXT    NOT NULL DEFAULT 'kg',
            quantity_kg   REAL    NOT NULL DEFAULT 1.0,
            status        TEXT    NOT NULL DEFAULT 'active',
            created_at    TEXT    NOT NULL,
            updated_at    TEXT    NOT NULL,
            FOREIGN KEY(seller_id) REFERENCES users(id)
        );

        CREATE TABLE IF NOT EXISTS price_records (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity   TEXT    NOT NULL,
            market      TEXT    NOT NULL,
            price_rwf   REAL    NOT NULL,
            price_date  TEXT    NOT NULL,
            source      TEXT    NOT NULL DEFAULT 'upload',
            uploaded_by INTEGER REFERENCES users(id),
            created_at  TEXT    NOT NULL
        );

        CREATE TABLE IF NOT EXISTS forecast_log (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            commodity   TEXT NOT NULL,
            market      TEXT NOT NULL,
            forecast_date TEXT NOT NULL,
            predicted_rwf REAL NOT NULL,
            created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_price_records_commodity
            ON price_records(commodity, market, price_date);

        CREATE INDEX IF NOT EXISTS idx_products_seller
            ON products(seller_id);

        CREATE TABLE IF NOT EXISTS messages (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            sender_id   INTEGER NOT NULL REFERENCES users(id),
            receiver_id INTEGER NOT NULL REFERENCES users(id),
            product_id  INTEGER REFERENCES products(id),
            message     TEXT NOT NULL,
            read        INTEGER NOT NULL DEFAULT 0,
            created_at  TEXT NOT NULL
        );

        CREATE INDEX IF NOT EXISTS idx_messages_users
            ON messages(sender_id, receiver_id);

        CREATE TABLE IF NOT EXISTS pending_price_submissions (
            id          INTEGER PRIMARY KEY AUTOINCREMENT,
            seller_id   INTEGER NOT NULL REFERENCES users(id),
            commodity   TEXT NOT NULL,
            market      TEXT NOT NULL,
            price_rwf   REAL NOT NULL,
            price_date  TEXT NOT NULL,
            status      TEXT NOT NULL DEFAULT 'pending',
            reviewed_by INTEGER REFERENCES users(id),
            created_at  TEXT NOT NULL
        );
    """)

    # Seed admin user if not exists
    admin_exists = c.execute(
        "SELECT id FROM users WHERE email = ?", ("admin@sokoprice.rw",)
    ).fetchone()

    if not admin_exists:
        import hashlib
        pw = hashlib.sha256("admin123".encode()).hexdigest()
        c.execute(
            "INSERT INTO users(name,email,password,role,created_at) VALUES(?,?,?,?,?)",
            ("SokoPrice Admin", "admin@sokoprice.rw", pw, "admin", datetime.utcnow().isoformat())
        )

    conn.commit()
    conn.close()
    print("Database initialized")


if __name__ == "__main__":
    init_db()
