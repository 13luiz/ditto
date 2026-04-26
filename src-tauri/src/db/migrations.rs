use rusqlite::{Connection, Result};

pub fn run(conn: &Connection) -> Result<()> {
    conn.execute_batch(MIGRATION_V1)?;
    conn.execute_batch(MIGRATION_V2)?;
    conn.execute_batch(MIGRATION_V3)?;
    Ok(())
}

const MIGRATION_V1: &str = "
CREATE TABLE IF NOT EXISTS conversations (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS messages (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    conversation_id INTEGER NOT NULL,
    role TEXT NOT NULL CHECK(role IN ('user', 'assistant', 'system', 'tool')),
    content TEXT NOT NULL,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    FOREIGN KEY (conversation_id) REFERENCES conversations(id)
);

CREATE TABLE IF NOT EXISTS memory (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    key TEXT NOT NULL UNIQUE,
    value TEXT NOT NULL,
    category TEXT NOT NULL DEFAULT 'general',
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS settings (
    key TEXT PRIMARY KEY,
    value TEXT NOT NULL,
    updated_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_messages_conversation ON messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_memory_key ON memory(key);
CREATE INDEX IF NOT EXISTS idx_memory_category ON memory(category);
";

const MIGRATION_V2: &str = "
CREATE TABLE IF NOT EXISTS bond_level (
    id INTEGER PRIMARY KEY CHECK(id = 1),
    level INTEGER NOT NULL DEFAULT 1,
    total_points INTEGER NOT NULL DEFAULT 0,
    daily_points TEXT NOT NULL DEFAULT '{}',
    last_award_date TEXT NOT NULL DEFAULT ''
);
";

const MIGRATION_V3: &str = "
CREATE TABLE IF NOT EXISTS letters (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    direction TEXT NOT NULL CHECK(direction IN ('to_user', 'from_user')),
    content TEXT NOT NULL,
    attachment TEXT,
    read_at TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE TABLE IF NOT EXISTS journal_entries (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    entry_date TEXT NOT NULL,
    content TEXT NOT NULL,
    mood_summary TEXT,
    stats_json TEXT,
    milestone TEXT,
    created_at TEXT NOT NULL DEFAULT (datetime('now')),
    UNIQUE(entry_date)
);

CREATE TABLE IF NOT EXISTS mini_game_results (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    game_type TEXT NOT NULL,
    score INTEGER NOT NULL,
    won INTEGER NOT NULL DEFAULT 0,
    care_effects_json TEXT,
    played_at TEXT NOT NULL DEFAULT (datetime('now'))
);

CREATE INDEX IF NOT EXISTS idx_letters_read ON letters(read_at);
CREATE INDEX IF NOT EXISTS idx_journal_date ON journal_entries(entry_date);
CREATE INDEX IF NOT EXISTS idx_game_type ON mini_game_results(game_type);
";

#[cfg(test)]
mod tests {
    use super::*;
    use rusqlite::Connection;

    #[test]
    fn test_migration_creates_tables() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        let tables: Vec<String> = conn
            .prepare("SELECT name FROM sqlite_master WHERE type='table' ORDER BY name")
            .unwrap()
            .query_map([], |row| row.get(0))
            .unwrap()
            .filter_map(|r| r.ok())
            .collect();

        assert!(tables.contains(&"conversations".to_string()));
        assert!(tables.contains(&"messages".to_string()));
        assert!(tables.contains(&"memory".to_string()));
        assert!(tables.contains(&"settings".to_string()));
        assert!(tables.contains(&"bond_level".to_string()));
        assert!(tables.contains(&"letters".to_string()));
        assert!(tables.contains(&"journal_entries".to_string()));
        assert!(tables.contains(&"mini_game_results".to_string()));
    }

    #[test]
    fn test_migration_is_idempotent() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();
        run(&conn).unwrap();

        let count: i64 = conn
            .query_row(
                "SELECT COUNT(*) FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%'",
                [],
                |row| row.get(0),
            )
            .unwrap();
        assert_eq!(count, 8);
    }

    #[test]
    fn test_letters_table_schema() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        // Verify columns exist and have correct types
        conn.execute(
            "INSERT INTO letters (direction, content) VALUES ('to_user', 'Hello!')",
            [],
        )
        .unwrap();

        let (id, direction, content, read_at): (i64, String, String, Option<String>) = conn
            .query_row(
                "SELECT id, direction, content, read_at FROM letters WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?, row.get(3)?)),
            )
            .unwrap();

        assert_eq!(id, 1);
        assert_eq!(direction, "to_user");
        assert_eq!(content, "Hello!");
        assert_eq!(read_at, None);
    }

    #[test]
    fn test_letters_direction_check_constraint() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        let result = conn.execute(
            "INSERT INTO letters (direction, content) VALUES ('invalid', 'test')",
            [],
        );
        assert!(
            result.is_err(),
            "direction CHECK should reject invalid values"
        );
    }

    #[test]
    fn test_journal_entries_unique_date() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        conn.execute(
            "INSERT INTO journal_entries (entry_date, content) VALUES ('2026-04-26', 'Day 1')",
            [],
        )
        .unwrap();

        let duplicate = conn.execute(
            "INSERT INTO journal_entries (entry_date, content) VALUES ('2026-04-26', 'Day 1 dup')",
            [],
        );
        assert!(
            duplicate.is_err(),
            "UNIQUE(entry_date) should reject duplicates"
        );
    }

    #[test]
    fn test_mini_game_results_insert() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        conn.execute(
            "INSERT INTO mini_game_results (game_type, score, won, care_effects_json) VALUES ('rps', 3, 1, '{\"happiness\": 15}')",
            [],
        )
        .unwrap();

        let (game_type, score, won): (String, i32, i32) = conn
            .query_row(
                "SELECT game_type, score, won FROM mini_game_results WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(game_type, "rps");
        assert_eq!(score, 3);
        assert_eq!(won, 1);
    }

    #[test]
    fn test_journal_entries_fields() {
        let conn = Connection::open_in_memory().unwrap();
        run(&conn).unwrap();

        conn.execute(
            "INSERT INTO journal_entries (entry_date, content, mood_summary, stats_json, milestone) \
             VALUES ('2026-04-26', '- Had a great day', 'Happy (82/100)', '{\"conversations\": 8}', '30-day anniversary')",
            [],
        )
        .unwrap();

        let (content, mood, milestone): (String, String, String) = conn
            .query_row(
                "SELECT content, mood_summary, milestone FROM journal_entries WHERE entry_date = '2026-04-26'",
                [],
                |row| Ok((row.get(0)?, row.get(1)?, row.get(2)?)),
            )
            .unwrap();

        assert_eq!(content, "- Had a great day");
        assert_eq!(mood, "Happy (82/100)");
        assert_eq!(milestone, "30-day anniversary");
    }
}
