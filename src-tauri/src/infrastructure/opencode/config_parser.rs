use std::path::Path;

use serde_json::{json, Map, Value};

use crate::domain::agent::{
    Agent, AgentPermission, ConfigFile, ConfigFileKind, InstructionSource, InstructionSourceKind,
    AgentType, PermissionProfile, PermissionProfileKind, PermissionRule, RiskLevel,
};
use crate::infrastructure::opencode::config_discovery::ConfigCandidate;

pub struct ConfigParser;

impl ConfigParser {
    pub fn new() -> Self {
        Self
    }

    pub fn extract_agents(
        &self,
        candidate: &ConfigCandidate,
        root: &Value,
        last_modified: u64,
    ) -> Vec<Agent> {
        let mut agents = Vec::new();

        if let Some(agent_map) = root.get("agent").and_then(Value::as_object) {
            for (name, config) in agent_map {
                agents.push(self.agent_from_value(
                    name,
                    config,
                    root,
                    AgentType::Subagent,
                    candidate,
                    last_modified,
                ));
            }
        }

        if let Some(agent_map) = root.get("agents").and_then(Value::as_object) {
            for (name, config) in agent_map {
                agents.push(self.agent_from_value(
                    name,
                    config,
                    root,
                    AgentType::Subagent,
                    candidate,
                    last_modified,
                ));
            }
        }

        if self.looks_like_single_agent(root, &candidate.path) {
            let name = infer_name(root, &candidate.path);
            let fallback_type = if is_agent_file(&candidate.path) {
                AgentType::Subagent
            } else {
                AgentType::Primary
            };
            agents.push(self.agent_from_value(
                &name,
                root,
                root,
                fallback_type,
                candidate,
                last_modified,
            ));
        }

        if agents.is_empty()
            && contains_object_agent_container(root)
            && (is_agent_file(&candidate.path) || is_opencode_config_file(&candidate.path))
        {
            agents.push(self.empty_config_agent(
                candidate,
                "Configuration contains an agent block, but no agent was recognized.".into(),
                last_modified,
            ));
        }

        agents
    }

    pub fn parse_error_agent(
        &self,
        candidate: &ConfigCandidate,
        message: String,
        last_modified: u64,
    ) -> Agent {
        let name = candidate
            .path
            .file_stem()
            .and_then(|file_name| file_name.to_str())
            .unwrap_or("invalid-config")
            .to_string();

        Agent {
            id: stable_id(&candidate.path, &name),
            name,
            agent_type: AgentType::Unknown,
            source: candidate.source,
            source_path: display_path(&candidate.path),
            description: Some("Configuration found, but it could not be parsed.".into()),
            model: None,
            effective_model: None,
            model_source: None,
            variant: None,
            permission_profile: None,
            mode: None,
            disabled: None,
            hidden: None,
            color: None,
            temperature: None,
            top_p: None,
            steps: None,
            commands: vec![],
            instructions: None,
            permissions: vec![],
            raw_config: json!(null),
            risk: RiskLevel::Medium,
            validation_errors: vec![message],
            last_modified,
        }
    }

    pub fn config_file_from_json(
        &self,
        candidate: &ConfigCandidate,
        root: &Value,
        agents_count: usize,
        permission_profiles_count: usize,
        instruction_sources_count: usize,
        validation_errors: Vec<String>,
        last_modified: u64,
    ) -> ConfigFile {
        ConfigFile {
            id: stable_id(&candidate.path, "config"),
            source: candidate.source,
            path: display_path(&candidate.path),
            kind: config_file_kind(&candidate.path),
            raw_config: root.clone(),
            agents_count,
            permission_profiles_count,
            instruction_sources_count,
            validation_errors,
            last_modified,
        }
    }

    pub fn extract_permission_profiles(
        &self,
        candidate: &ConfigCandidate,
        root: &Value,
        agents: &[Agent],
    ) -> Vec<PermissionProfile> {
        let mut profiles = Vec::new();

        if let Some(permission) = root.get("permission") {
            profiles.push(permission_profile_from_value(
                "global-permission",
                "Global Permission",
                PermissionProfileKind::Global,
                None,
                candidate,
                permission,
            ));
        }

        if let Some(tools) = root.get("tools") {
            profiles.push(permission_profile_from_value(
                "legacy-tools",
                "Legacy Tools",
                PermissionProfileKind::LegacyTools,
                None,
                candidate,
                &legacy_tools_to_permission(tools),
            ));
        }

        if let Some(profile_map) = root.get("permission_profiles").and_then(Value::as_object) {
            for (name, profile) in profile_map {
                profiles.push(permission_profile_from_value(
                    &format!("custom-profile-{name}"),
                    &format!("{name} Profile"),
                    PermissionProfileKind::CustomProfile,
                    None,
                    candidate,
                    profile,
                ));
            }
        }

        for (name, agent_config) in agent_entries(root) {
            let agent_id = agents
                .iter()
                .find(|agent| agent.name == name)
                .map(|agent| agent.id.clone());

            if let Some(permission) = agent_config.get("permission") {
                profiles.push(permission_profile_from_value(
                    &format!("agent-{name}-permission"),
                    &format!("{name} Override"),
                    PermissionProfileKind::AgentOverride,
                    agent_id.clone(),
                    candidate,
                    permission,
                ));
            }

            if let Some(tools) = agent_config.get("tools") {
                profiles.push(permission_profile_from_value(
                    &format!("agent-{name}-legacy-tools"),
                    &format!("{name} Legacy Tools"),
                    PermissionProfileKind::LegacyTools,
                    agent_id,
                    candidate,
                    &legacy_tools_to_permission(tools),
                ));
            }
        }

        for agent in agents.iter().filter(|agent| agent.source_path == display_path(&candidate.path)) {
            let mut effective = Map::new();
            if let Some(global) = root.get("permission").and_then(Value::as_object) {
                effective.extend(global.clone());
            }
            if let Some(agent_config) = find_agent_config(root, &agent.name) {
                if let Some(profile_name) = get_string(agent_config, &["permission_profile", "permissionProfile"]) {
                    if let Some(profile) = root
                        .get("permission_profiles")
                        .and_then(Value::as_object)
                        .and_then(|profiles| profiles.get(&profile_name))
                        .and_then(Value::as_object)
                    {
                        effective.extend(profile.clone());
                    }
                }
                if let Some(override_permission) = agent_config.get("permission").and_then(Value::as_object) {
                    effective.extend(override_permission.clone());
                }
            }

            if !effective.is_empty() {
                profiles.push(permission_profile_from_value(
                    &format!("agent-{}-effective", agent.name),
                    &format!("{} Effective", agent.name),
                    PermissionProfileKind::Effective,
                    Some(agent.id.clone()),
                    candidate,
                    &Value::Object(effective),
                ));
            }
        }

        profiles
    }

    pub fn extract_instruction_sources(
        &self,
        candidate: &ConfigCandidate,
        root: &Value,
        agents: &[Agent],
    ) -> Vec<InstructionSource> {
        let mut sources = Vec::new();

        if let Some(instructions) = root.get("instructions") {
            match instructions {
                Value::Array(items) => {
                    for (index, item) in items.iter().enumerate() {
                        if let Some(reference) = item.as_str() {
                            sources.push(instruction_source(
                                candidate,
                                format!("config-instructions-{index}"),
                                InstructionSourceKind::ConfigInstructions,
                                None,
                                format!("Instruction reference #{index}"),
                                None,
                                Some(reference.to_string()),
                            ));
                        }
                    }
                }
                Value::String(reference) => sources.push(instruction_source(
                    candidate,
                    "config-instructions".into(),
                    InstructionSourceKind::ConfigInstructions,
                    None,
                    "Instruction reference".into(),
                    None,
                    Some(reference.clone()),
                )),
                _ => {}
            }
        }

        for (name, agent_config) in agent_entries(root) {
            let agent_id = agents
                .iter()
                .find(|agent| agent.name == name)
                .map(|agent| agent.id.clone());

            if let Some(prompt) = get_prompt_text(agent_config) {
                let is_file_reference = prompt.trim().starts_with("{file:");
                sources.push(instruction_source(
                    candidate,
                    format!("agent-{name}-prompt"),
                    if is_file_reference {
                        InstructionSourceKind::PromptFileReference
                    } else {
                        InstructionSourceKind::AgentPrompt
                    },
                    agent_id,
                    format!("{name} prompt"),
                    if is_file_reference { None } else { Some(prompt.clone()) },
                    if is_file_reference { Some(prompt) } else { None },
                ));
            }
        }

        sources
    }

    fn empty_config_agent(
        &self,
        candidate: &ConfigCandidate,
        message: String,
        last_modified: u64,
    ) -> Agent {
        let name = candidate
            .path
            .file_stem()
            .and_then(|file_name| file_name.to_str())
            .unwrap_or("config-without-agents")
            .to_string();

        Agent {
            id: stable_id(&candidate.path, &name),
            name,
            agent_type: AgentType::Unknown,
            source: candidate.source,
            source_path: display_path(&candidate.path),
            description: Some("Configuration found, but no agents were recognized.".into()),
            model: None,
            effective_model: None,
            model_source: None,
            variant: None,
            permission_profile: None,
            mode: None,
            disabled: None,
            hidden: None,
            color: None,
            temperature: None,
            top_p: None,
            steps: None,
            commands: vec![],
            instructions: None,
            permissions: vec![],
            raw_config: json!(null),
            risk: RiskLevel::Low,
            validation_errors: vec![message],
            last_modified,
        }
    }

    fn agent_from_value(
        &self,
        name: &str,
        value: &Value,
        root: &Value,
        fallback_type: AgentType,
        candidate: &ConfigCandidate,
        last_modified: u64,
    ) -> Agent {
        let agent_type = infer_agent_type(value).unwrap_or(fallback_type);
        let permissions = extract_permissions(value);
        let risk = RiskLevel::aggregate(&permissions);
        let mut validation_errors = validate_agent_value(name, value);
        let model = get_string(value, &["model"]);
        let (effective_model, model_source) = resolve_model(name, root, model.clone());
        let permission_profile = get_string(value, &["permission_profile", "permissionProfile"]);
        if let Some(profile_name) = &permission_profile {
            let exists = root
                .get("permission_profiles")
                .and_then(Value::as_object)
                .map(|profiles| profiles.contains_key(profile_name))
                .unwrap_or(false);
            if !exists {
                validation_errors.push(format!("Permission profile not found: {profile_name}."));
            }
        }

        Agent {
            id: stable_id(&candidate.path, name),
            name: name.to_string(),
            agent_type,
            source: candidate.source,
            source_path: display_path(&candidate.path),
            description: get_string(value, &["description", "summary"]),
            model,
            effective_model,
            model_source,
            variant: get_string(value, &["variant"]),
            permission_profile,
            mode: get_string(value, &["mode", "type", "agentType"]),
            disabled: value.get("disable").or_else(|| value.get("disabled")).and_then(Value::as_bool),
            hidden: value.get("hidden").and_then(Value::as_bool),
            color: get_string(value, &["color"]),
            temperature: value.get("temperature").and_then(Value::as_f64),
            top_p: value.get("top_p").or_else(|| value.get("topP")).and_then(Value::as_f64),
            steps: value.get("steps").or_else(|| value.get("maxSteps")).and_then(Value::as_u64),
            commands: commands_for_agent(name, root),
            instructions: get_prompt_text(value),
            permissions,
            raw_config: value.clone(),
            risk,
            validation_errors,
            last_modified,
        }
    }

    fn looks_like_single_agent(&self, value: &Value, path: &Path) -> bool {
        let Some(object) = value.as_object() else {
            return false;
        };

        if object.contains_key("agent") || object.contains_key("agents") {
            return false;
        }

        if is_agent_file(path) || is_opencode_config_file(path) {
            return has_explicit_agent_hint(object);
        }

        has_agent_identity_fields(object) && has_explicit_agent_hint(object)
    }
}

fn agent_entries(root: &Value) -> Vec<(String, &Value)> {
    let mut entries = Vec::new();
    for field in ["agent", "agents"] {
        if let Some(map) = root.get(field).and_then(Value::as_object) {
            for (name, value) in map {
                entries.push((name.clone(), value));
            }
        }
    }
    entries
}

fn find_agent_config<'a>(root: &'a Value, name: &str) -> Option<&'a Value> {
    for field in ["agent", "agents"] {
        if let Some(value) = root.get(field).and_then(|value| value.get(name)) {
            return Some(value);
        }
    }
    None
}

fn permission_profile_from_value(
    id_suffix: &str,
    name: &str,
    kind: PermissionProfileKind,
    agent_id: Option<String>,
    candidate: &ConfigCandidate,
    value: &Value,
) -> PermissionProfile {
    let rules = permission_rules(value, name);
    let risk = rules.iter().map(|rule| rule.risk).max().unwrap_or(RiskLevel::Low);

    PermissionProfile {
        id: stable_id(&candidate.path, id_suffix),
        name: name.to_string(),
        kind,
        agent_id,
        source: candidate.source,
        source_path: display_path(&candidate.path),
        rules,
        risk,
        raw_config: value.clone(),
        validation_errors: vec![],
    }
}

fn permission_rules(value: &Value, source: &str) -> Vec<PermissionRule> {
    let mut rules = Vec::new();
    match value {
        Value::String(action) => rules.push(permission_rule("*", None, action, source)),
        Value::Object(map) => {
            for (tool, config) in map {
                match config {
                    Value::String(action) => rules.push(permission_rule(tool, None, action, source)),
                    Value::Object(patterns) => {
                        for (pattern, action) in patterns {
                            if let Some(action) = action.as_str() {
                                rules.push(permission_rule(tool, Some(pattern.clone()), action, source));
                            }
                        }
                    }
                    Value::Bool(enabled) => rules.push(permission_rule(
                        tool,
                        None,
                        if *enabled { "allow" } else { "deny" },
                        source,
                    )),
                    _ => rules.push(permission_rule(tool, None, "unknown", source)),
                }
            }
        }
        _ => {}
    }
    rules
}

fn permission_rule(tool: &str, pattern: Option<String>, action: &str, source: &str) -> PermissionRule {
    let normalized_action = action.to_ascii_lowercase();
    let risk = match normalized_action.as_str() {
        "deny" => RiskLevel::Low,
        "ask" if tool == "*" => RiskLevel::Medium,
        "allow" if tool == "*" => RiskLevel::High,
        "unknown" => RiskLevel::High,
        _ => RiskLevel::for_permission(tool, &json!(true)),
    };
    PermissionRule {
        tool: tool.to_string(),
        pattern,
        action: normalized_action,
        source: source.to_string(),
        risk,
    }
}

fn legacy_tools_to_permission(tools: &Value) -> Value {
    let Some(map) = tools.as_object() else {
        return tools.clone();
    };

    Value::Object(
        map.iter()
            .map(|(tool, enabled)| {
                let action = if enabled.as_bool().unwrap_or(false) { "allow" } else { "deny" };
                (tool.clone(), json!(action))
            })
            .collect(),
    )
}

fn instruction_source(
    candidate: &ConfigCandidate,
    id_suffix: String,
    kind: InstructionSourceKind,
    agent_id: Option<String>,
    label: String,
    content: Option<String>,
    reference: Option<String>,
) -> InstructionSource {
    InstructionSource {
        id: stable_id(&candidate.path, &id_suffix),
        kind,
        agent_id,
        source: candidate.source,
        source_path: display_path(&candidate.path),
        label,
        content,
        reference,
        validation_errors: vec![],
    }
}

fn config_file_kind(path: &Path) -> ConfigFileKind {
    match path.extension().and_then(|extension| extension.to_str()) {
        Some("json") => ConfigFileKind::Json,
        Some("jsonc") => ConfigFileKind::Jsonc,
        Some("md") => ConfigFileKind::MarkdownAgent,
        _ => ConfigFileKind::Json,
    }
}

fn contains_object_agent_container(value: &Value) -> bool {
    value
        .as_object()
        .map(|object| {
            object.get("agent").and_then(Value::as_object).is_some()
                || object.get("agents").and_then(Value::as_object).is_some()
        })
        .unwrap_or(false)
}

fn infer_agent_type(value: &Value) -> Option<AgentType> {
    let mode = get_string(value, &["mode", "type", "agentType"])?;
    match mode.to_lowercase().as_str() {
        "primary" | "main" | "default" => Some(AgentType::Primary),
        "subagent" | "sub-agent" | "sub" => Some(AgentType::Subagent),
        "all" => Some(AgentType::All),
        _ => Some(AgentType::Unknown),
    }
}

fn resolve_model(name: &str, root: &Value, explicit_model: Option<String>) -> (Option<String>, Option<String>) {
    if let Some(model) = explicit_model {
        return (Some(model), Some("agent.model".into()));
    }

    if let Some(model) = root
        .get("models")
        .and_then(|models| models.get("agent"))
        .and_then(|agents| agents.get(name))
        .and_then(Value::as_str)
    {
        return (Some(model.to_string()), Some("models.agent".into()));
    }
    if let Some(model) = root.get("model").and_then(Value::as_str) {
        return (Some(model.to_string()), Some("model".into()));
    }
    if let Some(model) = root.get("models").and_then(|models| models.get("default")).and_then(Value::as_str) {
        return (Some(model.to_string()), Some("models.default".into()));
    }

    (None, None)
}

fn commands_for_agent(name: &str, root: &Value) -> Vec<String> {
    root.get("command")
        .and_then(Value::as_object)
        .map(|commands| {
            commands
                .iter()
                .filter_map(|(command_name, config)| {
                    (config.get("agent").and_then(Value::as_str) == Some(name)).then(|| command_name.clone())
                })
                .collect()
        })
        .unwrap_or_default()
}

fn infer_name(value: &Value, path: &Path) -> String {
    get_string(value, &["name", "id"])
        .or_else(|| path.file_stem().and_then(|file_name| file_name.to_str()).map(str::to_string))
        .unwrap_or_else(|| "agent".into())
}

fn get_string(value: &Value, keys: &[&str]) -> Option<String> {
    for key in keys {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            if !text.trim().is_empty() {
                return Some(text.to_string());
            }
        }
    }

    None
}

fn get_prompt_text(value: &Value) -> Option<String> {
    for key in ["instructions", "instruction", "prompt", "system", "systemPrompt"] {
        match value.get(key) {
            Some(Value::String(text)) if !text.trim().is_empty() => return Some(text.clone()),
            Some(Value::Array(items)) => {
                let lines = items
                    .iter()
                    .filter_map(Value::as_str)
                    .collect::<Vec<_>>();
                if !lines.is_empty() {
                    return Some(lines.join("\n"));
                }
            }
            _ => {}
        }
    }
    None
}

fn extract_permissions(value: &Value) -> Vec<AgentPermission> {
    let mut permissions = Vec::new();

    for field in ["permissions", "permission", "tools", "tool"] {
        if let Some(raw_permissions) = value.get(field) {
            collect_permissions(field, raw_permissions, &mut permissions);
        }
    }

    permissions
}

fn collect_permissions(prefix: &str, value: &Value, permissions: &mut Vec<AgentPermission>) {
    match value {
        Value::Object(map) => collect_object_permissions(prefix, map, permissions),
        Value::Array(items) => {
            for item in items {
                if let Some(name) = item.as_str() {
                    push_permission(permissions, format!("{prefix}.{name}"), json!(true));
                }
            }
        }
        Value::String(name) => push_permission(permissions, format!("{prefix}.{name}"), json!(true)),
        _ => push_permission(permissions, prefix.to_string(), value.clone()),
    }
}

fn collect_object_permissions(
    prefix: &str,
    map: &Map<String, Value>,
    permissions: &mut Vec<AgentPermission>,
) {
    for (key, value) in map {
        let permission_key = format!("{prefix}.{key}");
        if value.is_object() {
            collect_permissions(&permission_key, value, permissions);
        } else {
            push_permission(permissions, permission_key, value.clone());
        }
    }
}

fn push_permission(permissions: &mut Vec<AgentPermission>, key: String, value: Value) {
    let risk = RiskLevel::for_permission(&key, &value);
    permissions.push(AgentPermission { key, value, risk });
}

fn validate_agent_value(name: &str, value: &Value) -> Vec<String> {
    let mut errors = Vec::new();

    if name.trim().is_empty() {
        errors.push("Agent has no name.".into());
    }

    if get_string(value, &["model"]).is_none() {
        errors.push("Model is not defined.".into());
    }

    if get_prompt_text(value).is_none() {
        errors.push("Instructions are not defined.".into());
    }

    errors
}

fn is_agent_file(path: &Path) -> bool {
    let file_name = path.file_name().and_then(|name| name.to_str()).unwrap_or_default();
    if matches!(file_name, "AGENTS.md" | "CLAUDE.md") {
        return true;
    }

    path.components().any(|component| {
        let name = component.as_os_str().to_string_lossy();
        name.eq_ignore_ascii_case("agents") || name.eq_ignore_ascii_case("agent")
    })
}

fn is_opencode_config_file(path: &Path) -> bool {
    path.file_name()
        .and_then(|file_name| file_name.to_str())
        .map(|file_name| matches!(file_name, "opencode.json" | "opencode.jsonc"))
        .unwrap_or(false)
}

fn has_agent_identity_fields(object: &Map<String, Value>) -> bool {
    ["name", "id", "mode", "type", "agentType"]
        .iter()
        .any(|field| object.contains_key(*field))
}

fn has_explicit_agent_hint(object: &Map<String, Value>) -> bool {
    if let Some(mode) = object.get("mode").and_then(Value::as_str) {
        if matches!(mode.to_lowercase().as_str(), "primary" | "main" | "default" | "subagent" | "sub-agent" | "sub" | "all") {
            return true;
        }
    }

    [
        "model",
        "permission",
        "permissions",
        "tools",
        "temperature",
        "top_p",
        "steps",
        "maxSteps",
    ]
    .iter()
    .any(|field| object.contains_key(*field))
}

pub(crate) fn stable_id(path: &Path, name: &str) -> String {
    let canonical = std::fs::canonicalize(path).unwrap_or_else(|_| path.to_path_buf());
    let raw = format!("{}::{name}", canonical.display());
    let normalized = raw
        .chars()
        .map(|ch| if ch.is_ascii_alphanumeric() { ch.to_ascii_lowercase() } else { '-' })
        .collect::<String>();

    normalized
        .split('-')
        .filter(|part| !part.is_empty())
        .collect::<Vec<_>>()
        .join("-")
}

fn display_path(path: &Path) -> String {
    let raw = path.display().to_string();
    let Some(home) = std::env::var_os("HOME") else {
        return raw;
    };

    let home = home.to_string_lossy();
    if let Some(suffix) = raw.strip_prefix(home.as_ref()) {
        format!("~{suffix}")
    } else {
        raw
    }
}

#[cfg(test)]
mod tests {
    use std::path::PathBuf;

    use serde_json::json;

    use crate::domain::agent::{AgentSource, AgentType, PermissionProfileKind};
    use crate::infrastructure::opencode::config_discovery::ConfigCandidate;

    use super::ConfigParser;

    #[test]
    fn random_user_agent_json_is_not_agent() {
        let parser = ConfigParser::new();
        let candidate = ConfigCandidate {
            path: PathBuf::from("fixtures/browser.json"),
            source: AgentSource::Project,
        };
        let agents = parser.extract_agents(&candidate, &json!({ "agent": "Mozilla/5.0" }), 0);
        assert!(agents.is_empty());
    }

    #[test]
    fn markdown_in_random_agents_folder_without_frontmatter_is_not_agent() {
        let parser = ConfigParser::new();
        let candidate = ConfigCandidate {
            path: PathBuf::from("docs/agents/guide.md"),
            source: AgentSource::Project,
        };
        let agents = parser.extract_agents(&candidate, &json!({ "markdownBody": "Docs about agents" }), 0);
        assert!(agents.is_empty());
    }

    #[test]
    fn explicit_agent_map_is_detected() {
        let parser = ConfigParser::new();
        let candidate = ConfigCandidate {
            path: PathBuf::from("opencode.json"),
            source: AgentSource::Project,
        };
        let agents = parser.extract_agents(
            &candidate,
            &json!({ "agent": { "reviewer": { "mode": "subagent", "model": "x/y", "prompt": "Review code" } } }),
            0,
        );
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].name, "reviewer");
    }

    #[test]
    fn custom_profile_model_map_prompt_array_and_all_mode_are_detected() {
        let parser = ConfigParser::new();
        let candidate = ConfigCandidate {
            path: PathBuf::from("opencode.jsonc"),
            source: AgentSource::Project,
        };
        let root = json!({
            "models": {
                "default": "openai/default",
                "agent": { "maruqes": "openai/gpt-5.5" }
            },
            "permission_profiles": {
                "autonomous_coder": { "edit": "allow", "bash": { "*": "ask", "npm test*": "allow" } }
            },
            "command": {
                "workmaruqes": { "agent": "maruqes", "template": "Task: $ARGUMENTS" }
            },
            "agent": {
                "maruqes": {
                    "mode": "all",
                    "permission_profile": "autonomous_coder",
                    "prompt": ["line one", "line two"],
                    "steps": 12
                }
            }
        });

        let agents = parser.extract_agents(&candidate, &root, 0);
        assert_eq!(agents.len(), 1);
        assert_eq!(agents[0].agent_type, AgentType::All);
        assert_eq!(agents[0].effective_model.as_deref(), Some("openai/gpt-5.5"));
        assert_eq!(agents[0].model_source.as_deref(), Some("models.agent"));
        assert_eq!(agents[0].permission_profile.as_deref(), Some("autonomous_coder"));
        assert_eq!(agents[0].instructions.as_deref(), Some("line one\nline two"));
        assert_eq!(agents[0].steps, Some(12));
        assert_eq!(agents[0].commands, vec!["workmaruqes"]);

        let profiles = parser.extract_permission_profiles(&candidate, &root, &agents);
        assert!(profiles.iter().any(|profile| matches!(profile.kind, PermissionProfileKind::CustomProfile)));
        assert!(profiles.iter().any(|profile| matches!(profile.kind, PermissionProfileKind::Effective)));
    }

    #[test]
    fn missing_custom_profile_is_validation_error() {
        let parser = ConfigParser::new();
        let candidate = ConfigCandidate {
            path: PathBuf::from("opencode.jsonc"),
            source: AgentSource::Project,
        };
        let agents = parser.extract_agents(
            &candidate,
            &json!({ "agent": { "reviewer": { "mode": "subagent", "permission_profile": "missing", "model": "x/y", "prompt": "review" } } }),
            0,
        );

        assert!(agents[0]
            .validation_errors
            .iter()
            .any(|error| error.contains("Permission profile not found")));
    }
}
