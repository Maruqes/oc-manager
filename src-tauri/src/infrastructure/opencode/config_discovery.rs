use std::path::PathBuf;

use crate::domain::agent::AgentSource;
use crate::infrastructure::filesystem::fs_repository::FsRepository;
use crate::infrastructure::filesystem::path_resolver::PathResolver;

const MAX_CONFIG_SCAN_DEPTH: usize = 8;

#[derive(Debug, Clone)]
pub struct ConfigCandidate {
    pub path: PathBuf,
    pub source: AgentSource,
}

pub struct ConfigDiscovery {
    fs: FsRepository,
    project_root: Option<PathBuf>,
}

impl ConfigDiscovery {
    pub fn new(project_root: Option<PathBuf>) -> Self {
        Self {
            fs: FsRepository::new(),
            project_root,
        }
    }

    pub fn discover_candidate_paths(&self) -> Vec<PathBuf> {
        self.discover_config_files()
            .into_iter()
            .map(|candidate| candidate.path)
            .collect()
    }

    pub fn discover_config_files(&self) -> Vec<ConfigCandidate> {
        let mut candidates = Vec::new();

        self.add_project_candidates(&mut candidates);
        self.add_global_candidates(&mut candidates);

        candidates.sort_by(|left, right| left.path.cmp(&right.path));
        candidates.dedup_by(|left, right| left.path == right.path);

        candidates
    }

    fn add_project_candidates(&self, candidates: &mut Vec<ConfigCandidate>) {
        let project_root = self
            .project_root
            .clone()
            .or_else(|| std::env::current_dir().ok())
            .unwrap_or_else(|| PathBuf::from("."));

        self.add_dir_candidates(candidates, project_root, AgentSource::Project);
    }

    fn add_global_candidates(&self, candidates: &mut Vec<ConfigCandidate>) {
        if let Some(global_config) = PathResolver::home_config_dir() {
            self.add_dir_candidates(candidates, global_config, AgentSource::Global);
        }
    }

    fn add_dir_candidates(
        &self,
        candidates: &mut Vec<ConfigCandidate>,
        dir: PathBuf,
        source: AgentSource,
    ) {
        if !self.fs.is_dir(&dir) {
            return;
        }

        for path in self.fs.collect_opencode_candidate_files(&dir, MAX_CONFIG_SCAN_DEPTH) {
            candidates.push(ConfigCandidate {
                path: self.fs.canonicalize_or_original(path),
                source,
            });
        }
    }
}
