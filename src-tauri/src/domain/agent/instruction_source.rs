use serde::Serialize;

use super::AgentSource;

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct InstructionSource {
    pub id: String,
    pub kind: InstructionSourceKind,
    pub agent_id: Option<String>,
    pub source: AgentSource,
    pub source_path: String,
    pub label: String,
    pub content: Option<String>,
    pub reference: Option<String>,
    pub validation_errors: Vec<String>,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub enum InstructionSourceKind {
    AgentPrompt,
    PromptFileReference,
    ConfigInstructions,
    RulesFile,
    MarkdownAgentBody,
}
