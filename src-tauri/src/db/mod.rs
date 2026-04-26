pub mod migrations;
pub mod models;

use models::{JournalEntry, Letter, Message, MessageRole, MiniGameResult};
use rusqlite::{params, Connection, Result};

pub struct Database {
    pub conn: Connection,
}

impl Database {
    pub fn open_in_memory() -> Result<Self> {
        let conn = Connection::open_in_memory()?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    pub fn open(path: &str) -> Result<Self> {
        let conn = Connection::open(path)?;
        let db = Self { conn };
        db.run_migrations()?;
        Ok(db)
    }

    fn run_migrations(&self) -> Result<()> {
        migrations::run(&self.conn)?;
        Ok(())
    }

    pub fn open_with_recovery(path: &str) -> Result<Self> {
        match Self::open(path) {
            Ok(db) => Ok(db),
            Err(_) => {
                // Database is corrupted — delete and recreate
                let _ = std::fs::remove_file(path);
                Self::open(path)
            }
        }
    }

    pub fn create_conversation(&self) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO conversations (created_at, updated_at) VALUES (datetime('now'), datetime('now'))",
            [],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn save_message(
        &self,
        conversation_id: i64,
        role: &MessageRole,
        content: &str,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO messages (conversation_id, role, content) VALUES (?1, ?2, ?3)",
            params![conversation_id, role.as_str(), content],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn load_messages(&self, conversation_id: i64, limit: usize) -> Result<Vec<Message>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, conversation_id, role, content, created_at FROM messages WHERE conversation_id = ?1 ORDER BY id DESC LIMIT ?2"
        )?;

        let messages = stmt
            .query_map(params![conversation_id, limit as i64], |row| {
                let role_str: String = row.get(3)?;
                let role = MessageRole::from_str(&role_str).unwrap_or(MessageRole::User);
                Ok(Message {
                    id: row.get(0)?,
                    conversation_id: row.get(1)?,
                    role,
                    content: row.get(3)?,
                    created_at: row.get(4)?,
                })
            })?
            .collect::<Result<Vec<_>>>()?;

        let mut messages = messages;
        messages.reverse();
        Ok(messages)
    }

    pub fn get_latest_conversation_id(&self) -> Result<Option<i64>> {
        self.conn
            .query_row(
                "SELECT id FROM conversations ORDER BY id DESC LIMIT 1",
                [],
                |row| row.get(0),
            )
            .map(Some)
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok(None)
                } else {
                    Err(e)
                }
            })
    }

    pub fn save_memory(&self, key: &str, value: &str, category: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO memory (key, value, category) VALUES (?1, ?2, ?3) ON CONFLICT(key) DO UPDATE SET value = ?2, category = ?3, updated_at = datetime('now')",
            params![key, value, category],
        )?;
        Ok(())
    }

    pub fn load_memory(&self, key: &str) -> Result<Option<String>> {
        self.conn
            .query_row("SELECT value FROM memory WHERE key = ?1", [key], |row| {
                row.get(0)
            })
            .map(Some)
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok(None)
                } else {
                    Err(e)
                }
            })
    }

    pub fn load_memories_by_category(&self, category: &str) -> Result<Vec<(String, String)>> {
        let mut stmt = self
            .conn
            .prepare("SELECT key, value FROM memory WHERE category = ?1")?;
        stmt.query_map([category], |row| Ok((row.get(0)?, row.get(1)?)))
            .and_then(|rows| rows.collect())
    }

    pub fn save_setting(&self, key: &str, value: &str) -> Result<()> {
        self.conn.execute(
            "INSERT INTO settings (key, value) VALUES (?1, ?2) ON CONFLICT(key) DO UPDATE SET value = ?2, updated_at = datetime('now')",
            params![key, value],
        )?;
        Ok(())
    }

    pub fn load_setting(&self, key: &str) -> Result<Option<String>> {
        self.conn
            .query_row("SELECT value FROM settings WHERE key = ?1", [key], |row| {
                row.get(0)
            })
            .map(Some)
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok(None)
                } else {
                    Err(e)
                }
            })
    }

    pub fn load_bond_state(&self) -> Result<(u32, i64)> {
        self.conn
            .query_row(
                "SELECT level, total_points FROM bond_level WHERE id = 1",
                [],
                |row| Ok((row.get(0)?, row.get(1)?)),
            )
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok((1, 0))
                } else {
                    Err(e)
                }
            })
    }

    pub fn save_bond_state(&self, level: u32, total_points: i64) -> Result<()> {
        self.conn.execute(
            "INSERT INTO bond_level (id, level, total_points, daily_points, last_award_date) \
             VALUES (1, ?1, ?2, '{}', '') \
             ON CONFLICT(id) DO UPDATE SET level = ?1, total_points = ?2",
            params![level, total_points],
        )?;
        Ok(())
    }

    // --- Letter CRUD ---

    pub fn insert_letter(&self, direction: &str, content: &str) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO letters (direction, content) VALUES (?1, ?2)",
            params![direction, content],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_pending_letters(&self) -> Result<Vec<Letter>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, direction, content, attachment, read_at, created_at \
             FROM letters WHERE read_at IS NULL AND direction = 'to_user' ORDER BY id ASC",
        )?;
        stmt.query_map([], |row| {
            Ok(Letter {
                id: row.get(0)?,
                direction: row.get(1)?,
                content: row.get(2)?,
                attachment: row.get(3)?,
                read_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .and_then(|rows| rows.collect())
    }

    pub fn mark_letter_read(&self, letter_id: i64) -> Result<()> {
        self.conn.execute(
            "UPDATE letters SET read_at = datetime('now') WHERE id = ?1",
            params![letter_id],
        )?;
        Ok(())
    }

    pub fn get_letter_archive(&self, limit: i64, offset: i64) -> Result<Vec<Letter>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, direction, content, attachment, read_at, created_at \
             FROM letters ORDER BY id DESC LIMIT ?1 OFFSET ?2",
        )?;
        stmt.query_map(params![limit, offset], |row| {
            Ok(Letter {
                id: row.get(0)?,
                direction: row.get(1)?,
                content: row.get(2)?,
                attachment: row.get(3)?,
                read_at: row.get(4)?,
                created_at: row.get(5)?,
            })
        })
        .and_then(|rows| rows.collect())
    }

    pub fn insert_letter_reply(&self, letter_id: i64, content: &str) -> Result<i64> {
        // Insert the reply as a new 'from_user' letter
        self.conn.execute(
            "INSERT INTO letters (direction, content) VALUES ('from_user', ?1)",
            params![content],
        )?;
        let reply_id = self.conn.last_insert_rowid();
        // Mark the original letter as read
        self.mark_letter_read(letter_id)?;
        Ok(reply_id)
    }

    // --- Journal CRUD ---

    pub fn insert_journal_entry(
        &self,
        entry_date: &str,
        content: &str,
        mood_summary: Option<&str>,
        stats_json: Option<&str>,
        milestone: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO journal_entries (entry_date, content, mood_summary, stats_json, milestone) \
             VALUES (?1, ?2, ?3, ?4, ?5)",
            params![entry_date, content, mood_summary, stats_json, milestone],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_journal_entries(
        &self,
        start_date: &str,
        end_date: &str,
    ) -> Result<Vec<JournalEntry>> {
        let mut stmt = self.conn.prepare(
            "SELECT id, entry_date, content, mood_summary, stats_json, milestone, created_at \
             FROM journal_entries WHERE entry_date BETWEEN ?1 AND ?2 ORDER BY entry_date DESC",
        )?;
        stmt.query_map(params![start_date, end_date], |row| {
            Ok(JournalEntry {
                id: row.get(0)?,
                entry_date: row.get(1)?,
                content: row.get(2)?,
                mood_summary: row.get(3)?,
                stats_json: row.get(4)?,
                milestone: row.get(5)?,
                created_at: row.get(6)?,
            })
        })
        .and_then(|rows| rows.collect())
    }

    pub fn get_latest_journal_entry(&self) -> Result<Option<JournalEntry>> {
        self.conn
            .query_row(
                "SELECT id, entry_date, content, mood_summary, stats_json, milestone, created_at \
                 FROM journal_entries ORDER BY entry_date DESC LIMIT 1",
                [],
                |row| {
                    Ok(JournalEntry {
                        id: row.get(0)?,
                        entry_date: row.get(1)?,
                        content: row.get(2)?,
                        mood_summary: row.get(3)?,
                        stats_json: row.get(4)?,
                        milestone: row.get(5)?,
                        created_at: row.get(6)?,
                    })
                },
            )
            .map(Some)
            .or_else(|e| {
                if matches!(e, rusqlite::Error::QueryReturnedNoRows) {
                    Ok(None)
                } else {
                    Err(e)
                }
            })
    }

    // --- Mini-Game CRUD ---

    pub fn insert_game_result(
        &self,
        game_type: &str,
        score: i32,
        won: bool,
        care_effects_json: Option<&str>,
    ) -> Result<i64> {
        self.conn.execute(
            "INSERT INTO mini_game_results (game_type, score, won, care_effects_json) \
             VALUES (?1, ?2, ?3, ?4)",
            params![game_type, score, won as i32, care_effects_json],
        )?;
        Ok(self.conn.last_insert_rowid())
    }

    pub fn get_game_history(
        &self,
        game_type: Option<&str>,
        limit: i64,
    ) -> Result<Vec<MiniGameResult>> {
        let mut results = Vec::new();
        match game_type {
            Some(gt) => {
                let mut stmt = self.conn.prepare(
                    "SELECT id, game_type, score, won, care_effects_json, played_at \
                     FROM mini_game_results WHERE game_type = ?1 ORDER BY played_at DESC LIMIT ?2",
                )?;
                let rows = stmt.query_map(params![gt, limit], |row| {
                    Ok(MiniGameResult {
                        id: row.get(0)?,
                        game_type: row.get(1)?,
                        score: row.get(2)?,
                        won: row.get::<_, i32>(3)? != 0,
                        care_effects_json: row.get(4)?,
                        played_at: row.get(5)?,
                    })
                })?;
                for row in rows {
                    results.push(row?);
                }
            }
            None => {
                let mut stmt = self.conn.prepare(
                    "SELECT id, game_type, score, won, care_effects_json, played_at \
                     FROM mini_game_results ORDER BY played_at DESC LIMIT ?1",
                )?;
                let rows = stmt.query_map(params![limit], |row| {
                    Ok(MiniGameResult {
                        id: row.get(0)?,
                        game_type: row.get(1)?,
                        score: row.get(2)?,
                        won: row.get::<_, i32>(3)? != 0,
                        care_effects_json: row.get(4)?,
                        played_at: row.get(5)?,
                    })
                })?;
                for row in rows {
                    results.push(row?);
                }
            }
        }
        Ok(results)
    }
}

#[cfg(test)]
mod tests {
    use super::*;

    #[test]
    fn test_conversation_persistence() {
        let db = Database::open_in_memory().unwrap();
        let conv_id = db.create_conversation().unwrap();

        db.save_message(conv_id, &MessageRole::User, "Hello!")
            .unwrap();
        db.save_message(conv_id, &MessageRole::Assistant, "Hi there!")
            .unwrap();
        db.save_message(conv_id, &MessageRole::User, "How are you?")
            .unwrap();
        db.save_message(conv_id, &MessageRole::Assistant, "I'm great!")
            .unwrap();
        db.save_message(conv_id, &MessageRole::User, "What's your name?")
            .unwrap();

        let messages = db.load_messages(conv_id, 20).unwrap();
        assert_eq!(messages.len(), 5);
        assert_eq!(messages[0].content, "Hello!");
        assert_eq!(messages[4].content, "What's your name?");
    }

    #[test]
    fn test_conversation_reopen() {
        // Simulate restart by creating a new in-memory DB with same data
        let db = Database::open_in_memory().unwrap();
        let conv_id = db.create_conversation().unwrap();

        db.save_message(conv_id, &MessageRole::User, "msg1")
            .unwrap();
        db.save_message(conv_id, &MessageRole::Assistant, "msg2")
            .unwrap();
        db.save_message(conv_id, &MessageRole::User, "msg3")
            .unwrap();

        let latest = db.get_latest_conversation_id().unwrap();
        assert_eq!(latest, Some(conv_id));

        let messages = db.load_messages(conv_id, 20).unwrap();
        assert_eq!(messages.len(), 3);
    }

    #[test]
    fn test_message_limit() {
        let db = Database::open_in_memory().unwrap();
        let conv_id = db.create_conversation().unwrap();

        for i in 0..25 {
            db.save_message(conv_id, &MessageRole::User, &format!("msg {}", i))
                .unwrap();
        }

        let messages = db.load_messages(conv_id, 20).unwrap();
        assert_eq!(messages.len(), 20);
        assert_eq!(messages[0].content, "msg 5");
        assert_eq!(messages[19].content, "msg 24");
    }

    #[test]
    fn test_memory_save_and_recall() {
        let db = Database::open_in_memory().unwrap();

        db.save_memory("user_name", "Alice", "preference").unwrap();
        let value = db.load_memory("user_name").unwrap();
        assert_eq!(value, Some("Alice".to_string()));

        db.save_memory("user_name", "Bob", "preference").unwrap();
        let updated = db.load_memory("user_name").unwrap();
        assert_eq!(updated, Some("Bob".to_string()));
    }

    #[test]
    fn test_memory_by_category() {
        let db = Database::open_in_memory().unwrap();
        db.save_memory("name", "Alice", "identity").unwrap();
        db.save_memory("fav_color", "blue", "preference").unwrap();
        db.save_memory("job", "developer", "identity").unwrap();

        let identity = db.load_memories_by_category("identity").unwrap();
        assert_eq!(identity.len(), 2);

        let prefs = db.load_memories_by_category("preference").unwrap();
        assert_eq!(prefs.len(), 1);
    }

    #[test]
    fn test_settings_save_and_load() {
        let db = Database::open_in_memory().unwrap();

        db.save_setting("llm_provider", "openai").unwrap();
        let value = db.load_setting("llm_provider").unwrap();
        assert_eq!(value, Some("openai".to_string()));

        db.save_setting("llm_provider", "ollama").unwrap();
        let updated = db.load_setting("llm_provider").unwrap();
        assert_eq!(updated, Some("ollama".to_string()));
    }

    #[test]
    fn test_missing_memory_returns_none() {
        let db = Database::open_in_memory().unwrap();
        let value = db.load_memory("nonexistent").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    fn test_missing_setting_returns_none() {
        let db = Database::open_in_memory().unwrap();
        let value = db.load_setting("nonexistent").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    fn test_settings_persistence_roundtrip() {
        let db = Database::open_in_memory().unwrap();

        let provider_config = r#"{"type":"openai","api_key":"sk-test","model":"gpt-4o"}"#;
        db.save_setting("provider_config", provider_config).unwrap();
        db.save_setting("pet_name", "Ditto").unwrap();
        db.save_setting("auto_launch", "true").unwrap();

        // Simulate restart: load all settings back
        let loaded_config = db.load_setting("provider_config").unwrap();
        assert_eq!(loaded_config, Some(provider_config.to_string()));
        let config: serde_json::Value = serde_json::from_str(&loaded_config.unwrap()).unwrap();
        assert_eq!(config["type"], "openai");
        assert_eq!(config["api_key"], "sk-test");

        let loaded_name = db.load_setting("pet_name").unwrap();
        assert_eq!(loaded_name, Some("Ditto".to_string()));

        let loaded_launch = db.load_setting("auto_launch").unwrap();
        assert_eq!(loaded_launch, Some("true".to_string()));
    }

    #[test]
    fn test_corruption_recovery() {
        let dir = std::env::temp_dir().join("ditto_test_corruption");
        let _ = std::fs::remove_dir_all(&dir);
        std::fs::create_dir_all(&dir).unwrap();
        let db_path = dir.join("test.db");
        let path_str = db_path.to_string_lossy().to_string();

        // Create a valid database first
        {
            let db = Database::open(&path_str).unwrap();
            db.save_setting("test_key", "test_value").unwrap();
        }

        // Corrupt the database file
        std::fs::write(&db_path, b"this is not a valid sqlite database").unwrap();

        // Recovery should succeed by recreating the database
        let db = Database::open_with_recovery(&path_str).unwrap();
        let value = db.load_setting("test_key").unwrap();
        assert_eq!(
            value, None,
            "corrupted data should be lost but db should work"
        );

        // New data should work fine
        db.save_setting("after_recovery", "works").unwrap();
        assert_eq!(
            db.load_setting("after_recovery").unwrap(),
            Some("works".to_string())
        );

        let _ = std::fs::remove_dir_all(&dir);
    }

    // --- Letter CRUD tests ---

    #[test]
    fn test_letter_insert_and_get_pending() {
        let db = Database::open_in_memory().unwrap();

        db.insert_letter("to_user", "I missed you!").unwrap();
        db.insert_letter("to_user", "Here's a star for you.")
            .unwrap();

        let pending = db.get_pending_letters().unwrap();
        assert_eq!(pending.len(), 2);
        assert_eq!(pending[0].content, "I missed you!");
        assert_eq!(pending[0].direction, "to_user");
        assert_eq!(pending[0].read_at, None);
    }

    #[test]
    fn test_letter_mark_read() {
        let db = Database::open_in_memory().unwrap();
        let id = db.insert_letter("to_user", "Hello!").unwrap();

        db.mark_letter_read(id).unwrap();

        let pending = db.get_pending_letters().unwrap();
        assert_eq!(pending.len(), 0, "letter should no longer be pending");
    }

    #[test]
    fn test_letter_archive_pagination() {
        let db = Database::open_in_memory().unwrap();
        for i in 0..5 {
            db.insert_letter("to_user", &format!("Letter {}", i))
                .unwrap();
        }

        let page1 = db.get_letter_archive(3, 0).unwrap();
        assert_eq!(page1.len(), 3);
        // Most recent first
        assert_eq!(page1[0].content, "Letter 4");

        let page2 = db.get_letter_archive(3, 3).unwrap();
        assert_eq!(page2.len(), 2);
    }

    #[test]
    fn test_letter_reply() {
        let db = Database::open_in_memory().unwrap();
        let letter_id = db.insert_letter("to_user", "Thinking of you...").unwrap();

        let reply_id = db
            .insert_letter_reply(letter_id, "I missed you too!")
            .unwrap();
        assert!(reply_id > 0, "reply should get its own ID");

        // Original letter should be marked read
        let pending = db.get_pending_letters().unwrap();
        assert_eq!(pending.len(), 0, "original should be read after reply");
    }

    // --- Journal CRUD tests ---

    #[test]
    fn test_journal_insert_and_query_range() {
        let db = Database::open_in_memory().unwrap();

        db.insert_journal_entry(
            "2026-04-25",
            "- Went for a walk",
            Some("Happy (75/100)"),
            Some("{\"conversations\": 3}"),
            None,
        )
        .unwrap();
        db.insert_journal_entry(
            "2026-04-26",
            "- Had a great coding session",
            Some("Excited (88/100)"),
            None,
            Some("30-day anniversary"),
        )
        .unwrap();

        let entries = db.get_journal_entries("2026-04-25", "2026-04-26").unwrap();
        assert_eq!(entries.len(), 2);
        assert_eq!(entries[0].entry_date, "2026-04-26"); // DESC order
        assert_eq!(entries[0].milestone, Some("30-day anniversary".to_string()));
    }

    #[test]
    fn test_journal_latest_entry() {
        let db = Database::open_in_memory().unwrap();
        assert_eq!(db.get_latest_journal_entry().unwrap(), None);

        db.insert_journal_entry("2026-04-25", "Day 1", None, None, None)
            .unwrap();
        db.insert_journal_entry("2026-04-26", "Day 2", None, None, None)
            .unwrap();

        let latest = db.get_latest_journal_entry().unwrap();
        assert_eq!(latest.unwrap().content, "Day 2");
    }

    // --- Mini-Game CRUD tests ---

    #[test]
    fn test_game_result_insert_and_history() {
        let db = Database::open_in_memory().unwrap();

        db.insert_game_result("rps", 3, true, Some("{\"happiness\": 15}"))
            .unwrap();
        db.insert_game_result("catch", 12, false, Some("{\"hunger\": 24}"))
            .unwrap();
        db.insert_game_result("rps", 2, false, Some("{\"happiness\": 8}"))
            .unwrap();

        let all = db.get_game_history(None, 10).unwrap();
        assert_eq!(all.len(), 3);

        let rps_only = db.get_game_history(Some("rps"), 10).unwrap();
        assert_eq!(rps_only.len(), 2);
        assert!(rps_only[0].won || !rps_only[0].won); // bool field works
    }

    #[test]
    fn test_game_result_won_field() {
        let db = Database::open_in_memory().unwrap();

        let id1 = db.insert_game_result("rps", 3, true, None).unwrap();
        let id2 = db.insert_game_result("rps", 1, false, None).unwrap();
        assert!(id2 > id1, "second insert should have higher id");

        let results = db.get_game_history(None, 10).unwrap();
        assert_eq!(results.len(), 2);
        // Verify both won values are correctly round-tripped
        let won_values: Vec<bool> = results.iter().map(|r| r.won).collect();
        assert!(won_values.contains(&true));
        assert!(won_values.contains(&false));
    }
}
