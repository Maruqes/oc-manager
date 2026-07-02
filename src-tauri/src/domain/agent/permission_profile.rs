use serde::Serialize;
use serde_json::Value;

use super::{AgentSource, RiskLevel};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionProfile {
    pub id: String,
    pub name: String,
    pub kind: PermissionProfileKind,
    pub agent_id: Option<String>,
    pub source: AgentSource,
    pub source_path: String,
    pub rules: Vec<PermissionRule>,
    pub risk: RiskLevel,
    pub raw_config: Value,
    pub validation_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum PermissionProfileKind {
    Global,
    CustomProfile,
    AgentOverride,
    Effective,
    LegacyTools,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct PermissionRule {
    pub tool: String,
    pub pattern: Option<String>,
    pub action: String,
    pub source: String,
    pub risk: RiskLevel,
}
