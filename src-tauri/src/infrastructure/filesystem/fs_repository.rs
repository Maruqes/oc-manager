use std::collections::HashSet;
use std::fs;
use std::io;
use std::path::{Path, PathBuf};
use std::time::UNIX_EPOCH;

const IGNORED_SCAN_DIRS: &[&str] = &[
    "node_modules",
    "target",
    "dist",
    "build",
    "out",
    "coverage",
    "vendor",
    "bower_components",
    "venv",
    ".venv",
    "__pycache__",
    ".pytest_cache",
    ".mypy_cache",
    ".ruff_cache",
    ".next",
    ".nuxt",
    ".svelte-kit",
    ".turbo",
    ".idea",
    ".vscode",
    ".gradle",
    ".terraform",
    ".dart_tool",
    ".parcel-cache",
    ".angular",
    "Pods",
    "DerivedData",
    "release",
    "artifacts",
    "cache",
    ".git",
    ".svn",
    ".hg",
    ".cache",
    ".vite",
    "log",
    "logs",
    "history",
    "memory",
    "projects",
    "sessions",
    "storage",
    "state",
    "tmp",
    "temp",
];

pub struct FsRepository;

impl FsRepository {
    pub fn new() -> Self {
        Self
    }

    pub fn exists(&self, path: &Path) -> bool {
        path.exists()
    }

    pub fn is_file(&self, path: &Path) -> bool {
        path.is_file()
    }

    pub fn is_dir(&self, path: &Path) -> bool {
        path.is_dir()
    }

    pub fn read_to_string(&self, path: &Path) -> io::Result<String> {
        fs::read_to_string(path)
    }

    pub fn last_modified_millis(&self, path: &Path) -> u64 {
        fs::metadata(path)
            .and_then(|metadata| metadata.modified())
            .ok()
            .and_then(|modified| modified.duration_since(UNIX_EPOCH).ok())
            .map(|duration| duration.as_millis() as u64)
            .unwrap_or_default()
    }

    pub fn file_size_bytes(&self, path: &Path) -> Option<u64> {
        fs::metadata(path).ok().map(|metadata| metadata.len())
    }

    pub fn canonicalize_or_original(&self, path: PathBuf) -> PathBuf {
        fs::canonicalize(&path).unwrap_or(path)
    }

    pub fn collect_opencode_candidate_files(&self, dir: &Path, max_depth: usize) -> Vec<PathBuf> {
        let mut files = Vec::new();
        let mut visited_dirs = HashSet::new();
        self.collect_opencode_candidate_files_inner(dir, max_depth, &mut visited_dirs, &mut files);
        files
    }

    fn collect_opencode_candidate_files_inner(
        &self,
        dir: &Path,
        depth: usize,
        visited_dirs: &mut HashSet<PathBuf>,
        files: &mut Vec<PathBuf>,
    ) {
        if depth == 0 || !dir.is_dir() {
            return;
        }

        let canonical_dir = self.canonicalize_or_original(dir.to_path_buf());
        if !visited_dirs.insert(canonical_dir) {
            return;
        }

        let Ok(entries) = fs::read_dir(dir) else {
            return;
        };

        for entry in entries.flatten() {
            let path = entry.path();
            let Ok(metadata) = fs::symlink_metadata(&path) else {
                continue;
            };

            if metadata.file_type().is_symlink() {
                continue;
            }

            if metadata.is_dir() {
                if should_skip_dir(&path) {
                    continue;
                }
                self.collect_opencode_candidate_files_inner(&path, depth - 1, visited_dirs, files);
            } else if metadata.is_file() && is_supported_opencode_file(&path) {
                files.push(path);
            }
        }
    }
}

fn should_skip_dir(path: &Path) -> bool {
    path.file_name()
        .and_then(|name| name.to_str())
        .map(|name| IGNORED_SCAN_DIRS.iter().any(|ignored| name.eq_ignore_ascii_case(ignored)))
        .unwrap_or(false)
}

pub fn is_supported_opencode_file(path: &Path) -> bool {
    matches!(
        path.extension().and_then(|extension| extension.to_str()),
        Some("json" | "jsonc" | "md")
    )
}
