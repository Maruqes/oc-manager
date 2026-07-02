use serde::Serialize;
use serde_json::Value;

use super::RiskLevel;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentPermission {
    pub key: String,
    pub value: Value,
    pub risk: RiskLevel,
}
