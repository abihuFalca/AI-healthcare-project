"""
export_sqlite_to_sql.py
=======================
Reads every row from the local SQLite database (backend/healthcare.db) and
writes a PostgreSQL-compatible INSERT file: backend/migrations/002_seed_data.sql

HOW TO RUN (from the backend/ directory):
    python migrations/export_sqlite_to_sql.py

OUTPUT:
    backend/migrations/002_seed_data.sql

SAFETY RULES:
  - This script is READ-ONLY on the SQLite file. It never modifies healthcare.db.
  - It never connects to Supabase.
  - Running it multiple times is safe; it overwrites the output file each time.
  - The generated SQL uses explicit column lists and OVERRIDING SYSTEM VALUE
    so that original id values are preserved exactly, keeping all foreign key
    relationships intact.

BOOLEAN CONVERSION:
  SQLite stores booleans as integers (0 or 1).
  PostgreSQL expects TRUE or FALSE.
  The BOOLEAN_COLUMNS dict below lists every column that needs this conversion.
"""

import sqlite3
import os
import sys

# ---------------------------------------------------------------------------
# Paths
# ---------------------------------------------------------------------------
SCRIPT_DIR   = os.path.dirname(os.path.abspath(__file__))
BACKEND_DIR  = os.path.dirname(SCRIPT_DIR)
DB_PATH      = os.path.join(BACKEND_DIR, "healthcare.db")
OUTPUT_PATH  = os.path.join(SCRIPT_DIR, "002_seed_data.sql")

# ---------------------------------------------------------------------------
# Tables to export — order matters because of foreign key dependencies.
# A table must appear AFTER all tables it references.
# ---------------------------------------------------------------------------
TABLE_ORDER = [
    "users",
    "patient_profiles",
    "healthcare_workers",
    "medical_history",
    "medications",
    "risk_factors",
    "assessments",
    "patient_vitals",
    "ai_explanations",
    "healthcare_reviews",
    "notifications",
    "audit_logs",
    "system_settings",
]

# ---------------------------------------------------------------------------
# Columns that are stored as INTEGER (0/1) in SQLite but are BOOLEAN in
# PostgreSQL. These will be converted to FALSE / TRUE in the output SQL.
# ---------------------------------------------------------------------------
BOOLEAN_COLUMNS = {
    "patient_profiles": {"consent_accepted"},
    "assessments":      {"safety_rule_triggered"},
    "notifications":    {"is_read"},
}

# ---------------------------------------------------------------------------
# Helper: escape a value for safe embedding in a SQL string literal.
# Single quotes inside text are doubled (standard SQL escaping).
# ---------------------------------------------------------------------------
def sql_literal(value, col_name, table_name):
    """Convert a Python value to a safe SQL literal string."""

    # NULL
    if value is None:
        return "NULL"

    # Boolean columns: SQLite 0/1 → PostgreSQL FALSE/TRUE
    bool_cols = BOOLEAN_COLUMNS.get(table_name, set())
    if col_name in bool_cols:
        return "TRUE" if int(value) else "FALSE"

    # Integer (non-boolean)
    if isinstance(value, int):
        return str(value)

    # Float
    if isinstance(value, float):
        return str(value)

    # Text — escape single quotes by doubling them
    text = str(value).replace("'", "''")
    return f"'{text}'"


# ---------------------------------------------------------------------------
# Helper: get ordered column names for a table
# ---------------------------------------------------------------------------
def get_columns(cursor, table_name):
    cursor.execute(f"PRAGMA table_info({table_name})")
    return [row[1] for row in cursor.fetchall()]


# ---------------------------------------------------------------------------
# Main export
# ---------------------------------------------------------------------------
def export():
    if not os.path.exists(DB_PATH):
        print(f"ERROR: SQLite database not found at: {DB_PATH}")
        sys.exit(1)

    conn = sqlite3.connect(DB_PATH)
    conn.row_factory = sqlite3.Row
    cursor = conn.cursor()

    lines = []

    lines.append("-- =============================================================================")
    lines.append("-- FILE: 002_seed_data.sql")
    lines.append("-- PURPOSE: Import all existing records from SQLite into Supabase PostgreSQL.")
    lines.append("--")
    lines.append("-- HOW TO USE:")
    lines.append("--   1. Make sure 001_create_schema.sql has already been run successfully.")
    lines.append("--   2. Open Supabase → SQL Editor → New Query.")
    lines.append("--   3. Paste the entire contents of this file and click RUN.")
    lines.append("--")
    lines.append("-- IMPORTANT:")
    lines.append("--   Run this file ONLY ONCE on a fresh (empty) set of tables.")
    lines.append("--   Running it a second time will cause duplicate-key errors because")
    lines.append("--   the original id values are explicitly inserted.")
    lines.append("--")
    lines.append("-- OVERRIDING SYSTEM VALUE:")
    lines.append("--   PostgreSQL SERIAL columns manage their own auto-increment counter.")
    lines.append("--   To insert rows with specific id values we use:")
    lines.append("--     INSERT INTO table (id, ...) OVERRIDING SYSTEM VALUE VALUES (...).")
    lines.append("--   After this file runs, 003_set_sequences.sql resets each counter so")
    lines.append("--   future inserts do not collide with the imported ids.")
    lines.append("-- =============================================================================")
    lines.append("")

    total_rows = 0

    for table in TABLE_ORDER:
        columns = get_columns(cursor, table)

        # Skip internal SQLite tables
        if not columns:
            continue

        cursor.execute(f"SELECT * FROM {table}")
        rows = cursor.fetchall()

        lines.append(f"-- -----------------------------------------------------------------------------")
        lines.append(f"-- Table: {table}  ({len(rows)} rows)")
        lines.append(f"-- -----------------------------------------------------------------------------")

        if not rows:
            lines.append(f"-- (no rows to insert)")
            lines.append("")
            continue

        col_list = ", ".join(columns)

        for row in rows:
            row_dict = dict(row)
            values = ", ".join(
                sql_literal(row_dict[col], col, table)
                for col in columns
            )
            lines.append(
                f"INSERT INTO {table} ({col_list}) "
                f"OVERRIDING SYSTEM VALUE "
                f"VALUES ({values});"
            )
            total_rows += 1

        lines.append("")

    conn.close()

    # Write output file
    with open(OUTPUT_PATH, "w", encoding="utf-8") as f:
        f.write("\n".join(lines))
        f.write("\n")

    print(f"Export complete.")
    print(f"  Source : {DB_PATH}")
    print(f"  Output : {OUTPUT_PATH}")
    print(f"  Total rows exported: {total_rows}")
    print()
    print("Next steps:")
    print("  1. Open backend/migrations/002_seed_data.sql and review the contents.")
    print("  2. Run 001_create_schema.sql in Supabase SQL Editor first.")
    print("  3. Then run 002_seed_data.sql in Supabase SQL Editor.")
    print("  4. Then run 003_set_sequences.sql in Supabase SQL Editor.")


if __name__ == "__main__":
    export()
