use std::fs;
use std::path::Path;

use crate::errors::AppError;

pub struct BackupService;

impl BackupService {
    pub fn new() -> Self {
        Self
    }

    pub fn create_backup(&self, path: &Path) -> Result<std::path::PathBuf, AppError> {
        if !path.exists() {
            return Ok(std::path::PathBuf::from(path));
        }

        let timestamp = current_timestamp();
        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("config");
        let extension = path.extension().and_then(|s| s.to_str()).unwrap_or("json");

        let backup_name = format!("{stem}_backup_{timestamp}.{extension}");
        let backup_path = path.with_file_name(backup_name);

        fs::copy(path, &backup_path).map_err(|error| {
            AppError::Filesystem(format!("Failed to create backup: {error}"))
        })?;

        self.prune_old_backups(path)?;

        Ok(backup_path)
    }

    fn prune_old_backups(&self, path: &Path) -> Result<(), AppError> {
        let dir = path.parent().ok_or_else(|| {
            AppError::Filesystem("Cannot determine parent directory for backup pruning.".into())
        })?;

        let stem = path
            .file_stem()
            .and_then(|s| s.to_str())
            .unwrap_or("config");

        let prefix = format!("{stem}_backup_");

        let mut backups: Vec<(std::path::PathBuf, std::time::SystemTime)> = fs::read_dir(dir)
            .map_err(|error| AppError::Filesystem(format!("Failed to read backup directory: {error}")))?
            .filter_map(|entry| entry.ok())
            .filter_map(|entry| {
                let name = entry.file_name().to_string_lossy().to_string();
                if name.starts_with(&prefix) {
                    let modified = entry.metadata().ok()?.modified().ok()?;
                    Some((entry.path(), modified))
                } else {
                    None
                }
            })
            .collect();

        backups.sort_by(|a, b| b.1.cmp(&a.1));

        const MAX_BACKUPS: usize = 10;
        for (old_path, _) in backups.into_iter().skip(MAX_BACKUPS) {
            let _ = fs::remove_file(old_path);
        }

        Ok(())
    }
}

fn current_timestamp() -> String {
    let now = std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .unwrap_or_default()
        .as_secs();
    format!("{now}")
}
