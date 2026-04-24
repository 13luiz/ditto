pub mod migrations;
pub mod models;

use models::{Message, MessageRole};
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
        let config: serde_json::Value =
            serde_json::from_str(&loaded_config.unwrap()).unwrap();
        assert_eq!(config["type"], "openai");
        assert_eq!(config["api_key"], "sk-test");

        let loaded_name = db.load_setting("pet_name").unwrap();
        assert_eq!(loaded_name, Some("Ditto".to_string()));

        let loaded_launch = db.load_setting("auto_launch").unwrap();
        assert_eq!(loaded_launch, Some("true".to_string()));
    }
}
