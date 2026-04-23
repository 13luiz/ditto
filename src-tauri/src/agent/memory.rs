use crate::db::Database;
use std::collections::VecDeque;

const SHORT_TERM_LIMIT: usize = 20;

pub struct MemorySystem {
    pub short_term: VecDeque<String>,
}

impl MemorySystem {
    pub fn new() -> Self {
        Self {
            short_term: VecDeque::with_capacity(SHORT_TERM_LIMIT),
        }
    }

    pub fn add_short_term(&mut self, message: String) {
        if self.short_term.len() >= SHORT_TERM_LIMIT {
            self.short_term.pop_front();
        }
        self.short_term.push_back(message);
    }

    pub fn get_short_term(&self) -> Vec<String> {
        self.short_term.iter().cloned().collect()
    }

    pub fn save_long_term(&self, db: &Database, key: &str, value: &str) -> Result<(), String> {
        db.save_memory(key, value, "long_term")
            .map_err(|e| e.to_string())
    }

    pub fn recall_long_term(&self, db: &Database, key: &str) -> Result<Option<String>, String> {
        db.load_memory(key).map_err(|e| e.to_string())
    }

    pub fn get_all_long_term(&self, db: &Database) -> Result<Vec<String>, String> {
        let entries = db
            .load_memories_by_category("long_term")
            .map_err(|e| e.to_string())?;
        Ok(entries
            .into_iter()
            .map(|(k, v)| format!("{}: {}", k, v))
            .collect())
    }
}

#[cfg(test)]
mod tests {
    use super::*;
    use crate::db::Database;

    #[test]
    fn test_short_term_memory_limit() {
        let mut mem = MemorySystem::new();
        for i in 0..25 {
            mem.add_short_term(format!("message {}", i));
        }
        assert_eq!(mem.short_term.len(), 20);
        let messages = mem.get_short_term();
        assert_eq!(messages[0], "message 5");
        assert_eq!(messages[19], "message 24");
    }

    #[test]
    fn test_short_term_within_limit() {
        let mut mem = MemorySystem::new();
        for i in 0..10 {
            mem.add_short_term(format!("msg {}", i));
        }
        assert_eq!(mem.get_short_term().len(), 10);
    }

    #[test]
    fn test_long_term_save_and_recall() {
        let db = Database::open_in_memory().unwrap();
        let mem = MemorySystem::new();

        mem.save_long_term(&db, "user_name", "Alice").unwrap();
        let value = mem.recall_long_term(&db, "user_name").unwrap();
        assert_eq!(value, Some("Alice".to_string()));
    }

    #[test]
    fn test_long_term_recall_nonexistent() {
        let db = Database::open_in_memory().unwrap();
        let mem = MemorySystem::new();
        let value = mem.recall_long_term(&db, "nonexistent").unwrap();
        assert_eq!(value, None);
    }

    #[test]
    fn test_long_term_update() {
        let db = Database::open_in_memory().unwrap();
        let mem = MemorySystem::new();

        mem.save_long_term(&db, "color", "blue").unwrap();
        mem.save_long_term(&db, "color", "red").unwrap();
        let value = mem.recall_long_term(&db, "color").unwrap();
        assert_eq!(value, Some("red".to_string()));
    }

    #[test]
    fn test_get_all_long_term() {
        let db = Database::open_in_memory().unwrap();
        let mem = MemorySystem::new();

        mem.save_long_term(&db, "name", "Alice").unwrap();
        mem.save_long_term(&db, "job", "developer").unwrap();

        let all = mem.get_all_long_term(&db).unwrap();
        assert_eq!(all.len(), 2);
    }
}
