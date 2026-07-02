use serde::Serialize;
use serde_json::Value;

use super::AgentSource;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ConfigFile {
    pub id: String,
    pub source: AgentSource,
    pub path: String,
    pub kind: ConfigFileKind,
    pub raw_config: Value,
    pub agents_count: usize,
    pub permission_profiles_count: usize,
    pub instruction_sources_count: usize,
    pub validation_errors: Vec<String>,
    pub last_modified: u64,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum ConfigFileKind {
    Json,
    Jsonc,
    MarkdownAgent,
    RulesFile,
}
