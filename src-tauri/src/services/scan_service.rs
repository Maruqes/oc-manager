use std::path::{Path, PathBuf};

use crate::domain::agent::{ConfigFile, ConfigFileKind, InstructionSource, InstructionSourceKind, ScanResult};
use crate::infrastructure::filesystem::fs_repository::FsRepository;
use crate::infrastructure::opencode::config_discovery::ConfigDiscovery;
use crate::infrastructure::opencode::config_parser::ConfigParser;
use crate::infrastructure::opencode::jsonc_parser::JsoncParser;
use crate::infrastructure::opencode::markdown_agent_parser::MarkdownAgentParser;

const MAX_CANDIDATE_FILE_BYTES: u64 = 2 * 1024 * 1024;

pub struct ScanService {
    discovery: ConfigDiscovery,
    fs: FsRepository,
    parser: ConfigParser,
}

impl ScanService {
    pub fn new(project_root: Option<PathBuf>) -> Self {
        Self {
            discovery: ConfigDiscovery::new(project_root),
            fs: FsRepository::new(),
            parser: ConfigParser::new(),
        }
    }

    pub fn scan_agents(&self) -> ScanResult {
        let mut result = ScanResult::empty();

        for candidate in self.discovery.discover_config_files() {
            if is_backup_file(&candidate.path) {
                continue;
            }

            let last_modified = self.fs.last_modified_millis(&candidate.path);

            if self
                .fs
                .file_size_bytes(&candidate.path)
                .map(|size| size > MAX_CANDIDATE_FILE_BYTES && !is_likely_opencode_path(&candidate.path))
                .unwrap_or(false)
            {
                continue;
            }

            match self.fs.read_to_string(&candidate.path) {
                Ok(content) => self.scan_candidate(&mut result, &candidate, &content, last_modified),
                Err(error) => {
                    if is_likely_opencode_path(&candidate.path) {
                        result.agents.push(self.parser.parse_error_agent(
                            &candidate,
                            format!("Não foi possível ler o ficheiro: {error}"),
                            last_modified,
                        ));
                    }
                }
            }
        }
        result
    }

    fn scan_candidate(
        &self,
        result: &mut ScanResult,
        candidate: &crate::infrastructure::opencode::config_discovery::ConfigCandidate,
        content: &str,
        last_modified: u64,
    ) {
        let is_markdown = candidate
            .path
            .extension()
            .and_then(|extension| extension.to_str())
            == Some("md");

        let parsed = if is_markdown {
            Ok(MarkdownAgentParser::parse(content))
        } else {
            JsoncParser::parse(content).map_err(|error| format!("JSON/JSONC inválido: {error}"))
        };

        match parsed {
            Ok(config) => {
                let agents = self.parser.extract_agents(candidate, &config, last_modified);

                let permissions = self.parser.extract_permission_profiles(candidate, &config, &agents);
                let mut instructions = self.parser.extract_instruction_sources(candidate, &config, &agents);

                if is_markdown {
                    for agent in &agents {
                        instructions.push(InstructionSource {
                            id: format!("{}-markdown-body", agent.id),
                            kind: InstructionSourceKind::MarkdownAgentBody,
                            agent_id: Some(agent.id.clone()),
                            source: candidate.source,
                            source_path: agent.source_path.clone(),
                            label: format!("{} markdown body", agent.name),
                            content: config.get("markdownBody").and_then(|value| value.as_str()).map(str::to_string),
                            reference: None,
                            validation_errors: vec![],
                        });
                    }
                }

                if agents.is_empty()
                    && (!is_likely_opencode_path(&candidate.path)
                        || (permissions.is_empty() && instructions.is_empty()))
                {
                    return;
                }

                result.config_files.push(self.parser.config_file_from_json(
                    candidate,
                    &config,
                    agents.len(),
                    permissions.len(),
                    instructions.len(),
                    vec![],
                    last_modified,
                ));
                result.agents.extend(agents);
                result.permission_profiles.extend(permissions);
                result.instruction_sources.extend(instructions);
            }
            Err(message) => {
                if is_likely_opencode_path(&candidate.path) {
                    result.agents.push(self.parser.parse_error_agent(candidate, message.clone(), last_modified));
                    result.config_files.push(ConfigFile {
                        id: format!("{}-parse-error", candidate.path.display()),
                        source: candidate.source,
                        path: candidate.path.display().to_string(),
                        kind: if is_markdown { ConfigFileKind::MarkdownAgent } else { ConfigFileKind::Jsonc },
                        raw_config: serde_json::Value::Null,
                        agents_count: 0,
                        permission_profiles_count: 0,
                        instruction_sources_count: 0,
                        validation_errors: vec![message],
                        last_modified,
                    });
                }
            }
        }
    }
}

fn is_likely_opencode_path(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();

    if matches!(file_name, "opencode.json" | "opencode.jsonc" | "AGENTS.md" | "CLAUDE.md") {
        return true;
    }

    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        matches!(name.as_ref(), ".opencode" | "agents" | "agent")
    })
}

fn is_backup_file(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    file_name.contains("_backup_")
}
