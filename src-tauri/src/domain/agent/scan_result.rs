use serde::Serialize;

use super::{Agent, ConfigFile, InstructionSource, PermissionProfile};

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ScanResult {
    pub agents: Vec<Agent>,
    pub permission_profiles: Vec<PermissionProfile>,
    pub instruction_sources: Vec<InstructionSource>,
    pub config_files: Vec<ConfigFile>,
}

impl ScanResult {
    pub fn empty() -> Self {
        Self {
            agents: vec![],
            permission_profiles: vec![],
            instruction_sources: vec![],
            config_files: vec![],
        }
    }
}
