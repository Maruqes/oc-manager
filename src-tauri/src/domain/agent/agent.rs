use serde::Serialize;
use serde_json::Value;

use super::{AgentPermission, AgentSource, AgentType, RiskLevel};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct Agent {
    pub id: String,
    pub name: String,
    #[serde(rename = "type")]
    pub agent_type: AgentType,
    pub source: AgentSource,
    pub source_path: String,
    pub description: Option<String>,
    pub model: Option<String>,
    pub effective_model: Option<String>,
    pub model_source: Option<String>,
    pub variant: Option<String>,
    pub permission_profile: Option<String>,
    pub mode: Option<String>,
    pub disabled: Option<bool>,
    pub hidden: Option<bool>,
    pub color: Option<String>,
    pub temperature: Option<f64>,
    pub top_p: Option<f64>,
    pub steps: Option<u64>,
    pub commands: Vec<String>,
    pub instructions: Option<String>,
    pub permissions: Vec<AgentPermission>,
    pub raw_config: Value,
    pub risk: RiskLevel,
    pub validation_errors: Vec<String>,
    pub last_modified: u64,
}
