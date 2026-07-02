use std::fs;
use std::path::Path;

use serde_json::Value;

use crate::errors::AppError;

pub struct ConfigWriter;

impl ConfigWriter {
    pub fn new() -> Self {
        Self
    }

    pub fn write(&self, path: &Path, config: &Value) -> Result<(), AppError> {
        let content = serde_json::to_string_pretty(config)
            .map_err(|error| AppError::Parse(format!("Failed to serialize config: {error}")))?;

        if let Some(parent) = path.parent() {
            fs::create_dir_all(parent)
                .map_err(|error| AppError::Filesystem(format!("Failed to create directory: {error}")))?;
        }

        fs::write(path, content)
            .map_err(|error| AppError::Filesystem(format!("Failed to write config: {error}")))?;

        Ok(())
    }
}
