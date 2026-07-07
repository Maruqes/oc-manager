use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::errors::AppError;
use crate::infrastructure::filesystem::path_resolver::PathResolver;
use crate::infrastructure::opencode::config_parser::stable_id;
use crate::infrastructure::opencode::config_writer::ConfigWriter;
use crate::infrastructure::opencode::jsonc_parser::JsoncParser;
use crate::services::backup_service::BackupService;

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditableAgent {
    pub id: String,
    pub name: String,
    pub description: String,
    pub enabled: bool,
    pub mode: String,
    pub provider: String,
    pub model: String,
    pub variant: Option<String>,
    pub temperature: f64,
    pub top_p: Option<f64>,
    pub steps: u64,
    pub prompt: String,
    pub simple_permissions: serde_json::Map<String, Value>,
    pub bash_policy: BashPolicy,
    pub task_policy: TaskPolicy,
    pub workspace_scope: WorkspaceScope,
    pub approval_policy: ApprovalPolicy,
    pub permission_profile: Option<String>,
    pub source_path: String,
    pub version: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BashPolicy {
    pub default: String,
    pub rules: Vec<BashRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct BashRule {
    pub pattern: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskPolicy {
    pub default: String,
    pub rules: Vec<TaskRule>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct TaskRule {
    pub agent_name: String,
    pub action: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct WorkspaceScope {
    pub allowed_paths: Vec<String>,
    pub denied_paths: Vec<String>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct ApprovalPolicy {
    pub require_plan_before_edit: bool,
    pub require_user_approval_before_edit: bool,
    pub require_user_approval_before_bash: bool,
    pub require_user_approval_before_install: bool,
    pub require_user_approval_before_delete: bool,
    pub require_user_approval_before_git_push: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditablePermissionProfile {
    pub id: String,
    pub name: String,
    pub source: String,
    pub source_path: String,
    pub rules: Vec<EditablePermissionRule>,
    pub version: u64,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(rename_all = "camelCase")]
pub struct EditablePermissionRule {
    pub tool: String,
    pub pattern: Option<String>,
    pub action: String,
}

#[derive(Debug, Clone, Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SaveAgentResult {
    pub success: bool,
    pub backup_path: Option<String>,
    pub new_version: u64,
    pub errors: Vec<String>,
}

pub struct SaveService {
    backup: BackupService,
    writer: ConfigWriter,
}

impl SaveService {
    pub fn new() -> Self {
        Self {
            backup: BackupService::new(),
            writer: ConfigWriter::new(),
        }
    }

    pub fn save_agent(&self, agent: &EditableAgent, target_path: &str) -> Result<SaveAgentResult, AppError> {
        let path = expand_home(target_path);
        ensure_default_opencode_config_is_read_only(&path)?;

        let mut config = self.read_config(&path)?;
        let agent_config = self.editable_to_config(agent);
        upsert_existing_agent_config(&path, &mut config, agent, agent_config)?;

        let backup_path = self.backup.create_backup(&path)?;
        self.writer.write(&path, &config)?;

        Ok(SaveAgentResult {
            success: true,
            backup_path: backup_path.to_str().map(|s| s.to_string()),
            new_version: agent.version + 1,
            errors: vec![],
        })
    }

    pub fn create_agent(&self, agent: &EditableAgent, target_path: &str) -> Result<SaveAgentResult, AppError> {
        let path = expand_home(target_path);
        ensure_default_opencode_config_is_read_only(&path)?;
        let mut config = self.read_config(&path).unwrap_or_else(|_| json!({}));

        let agent_config = self.editable_to_config(agent);
        insert_new_agent_config(&path, &mut config, agent, agent_config)?;

        let backup_path = self.backup.create_backup(&path)?;
        self.writer.write(&path, &config)?;

        Ok(SaveAgentResult {
            success: true,
            backup_path: backup_path.to_str().map(|s| s.to_string()),
            new_version: 1,
            errors: vec![],
        })
    }

    pub fn delete_agent(&self, agent_id: &str, config_path: &str) -> Result<(), AppError> {
        let path = expand_home(config_path);
        ensure_default_opencode_config_is_read_only(&path)?;

        if path.extension().and_then(|extension| extension.to_str()) == Some("md") {
            return self.delete_config_file(config_path);
        }

        let mut config = self.read_config(&path)?;

        for field in ["agent", "agents"] {
            if let Some(agent_map) = config.get_mut(field).and_then(Value::as_object_mut) {
                agent_map.retain(|name, _| name != agent_id && stable_id(&path, name) != agent_id);
            }
        }

        self.backup.create_backup(&path)?;
        self.writer.write(&path, &config)?;

        Ok(())
    }

    pub fn delete_config_file(&self, config_path: &str) -> Result<(), AppError> {
        let path = expand_home(config_path);
        ensure_default_opencode_config_is_read_only(&path)?;

        if !path.is_file() {
            return Err(AppError::Validation(format!(
                "Config file not found: {}",
                path.display()
            )));
        }

        self.backup.create_backup(&path)?;
        std::fs::remove_file(&path)
            .map_err(|error| AppError::Filesystem(format!("Failed to delete config file: {error}")))?;

        Ok(())
    }

    pub fn create_config_file(&self, file_path: &str, agent_name: &str) -> Result<(), AppError> {
        let path = expand_home(file_path);
        ensure_default_opencode_config_is_read_only(&path)?;

        if path.exists() {
            return Err(AppError::Validation(format!(
                "Config file already exists: {}",
                path.display()
            )));
        }

        let mut config = serde_json::Map::new();
        let mut agent_config = serde_json::Map::new();
        agent_config.insert("description".into(), json!(format!("Primary agent for {}", agent_name)));
        agent_config.insert("mode".into(), json!("primary"));
        agent_config.insert("model".into(), json!("openai/gpt-5.5"));
        agent_config.insert("temperature".into(), json!(0.2));
        agent_config.insert("steps".into(), json!(25));
        agent_config.insert("prompt".into(), json!("You are a helpful assistant."));
        agent_config.insert("disable".into(), json!(false));
        config.insert(agent_name.to_string(), json!(agent_config));

        let mut root = serde_json::Map::new();
        root.insert("agent".into(), json!(config));

        self.writer.write(&path, &json!(root))?;
        Ok(())
    }

    pub fn save_permission_profile(&self, profile: &EditablePermissionProfile, target_path: &str) -> Result<SaveAgentResult, AppError> {
        let path = expand_home(target_path);
        ensure_default_opencode_config_is_read_only(&path)?;
        let mut config = self.read_config(&path)?;

        let permission_config = self.editable_profile_to_config(profile);

        if let Some(profiles_map) = config.get_mut("permission_profiles").and_then(Value::as_object_mut) {
            profiles_map.insert(profile.name.clone(), permission_config);
        } else {
            let mut map = Map::new();
            map.insert(profile.name.clone(), permission_config);
            config["permission_profiles"] = Value::Object(map);
        }

        let backup_path = self.backup.create_backup(&path)?;
        self.writer.write(&path, &config)?;

        Ok(SaveAgentResult {
            success: true,
            backup_path: backup_path.to_str().map(|s| s.to_string()),
            new_version: profile.version + 1,
            errors: vec![],
        })
    }

    fn editable_profile_to_config(&self, profile: &EditablePermissionProfile) -> Value {
        let mut permission = Map::new();

        for rule in &profile.rules {
            let key = rule.tool.clone();
            let existing = permission.get(&key);

            if let Some(existing_value) = existing {
                if let Some(pattern) = &rule.pattern {
                    if let Some(obj) = existing_value.as_object() {
                        let mut new_obj = obj.clone();
                        new_obj.insert(pattern.clone(), json!(rule.action));
                        permission.insert(key, Value::Object(new_obj));
                    } else {
                        let mut new_obj = Map::new();
                        new_obj.insert("*".into(), existing_value.clone());
                        new_obj.insert(pattern.clone(), json!(rule.action));
                        permission.insert(key, Value::Object(new_obj));
                    }
                } else {
                    permission.insert(key, json!(rule.action));
                }
            } else if let Some(pattern) = &rule.pattern {
                let mut obj = Map::new();
                obj.insert(pattern.clone(), json!(rule.action));
                permission.insert(key, Value::Object(obj));
            } else {
                permission.insert(key, json!(rule.action));
            }
        }

        Value::Object(permission)
    }

    fn read_config(&self, path: &PathBuf) -> Result<Value, AppError> {
        let content = std::fs::read_to_string(path)
            .map_err(|error| AppError::Filesystem(format!("Failed to read config: {error}")))?;

        if path.extension().and_then(|e| e.to_str()) == Some("md") {
            return Ok(json!({ "markdownBody": content }));
        }

        JsoncParser::parse(&content)
            .map_err(|error| AppError::Parse(format!("Invalid JSON/JSONC: {error}")))
    }

    fn editable_to_config(&self, agent: &EditableAgent) -> Value {
        let mut config = Map::new();

        config.insert("description".into(), json!(agent.description));
        config.insert("mode".into(), json!(agent.mode));
        config.insert("model".into(), json!(format!("{}/{}", agent.provider, agent.model)));
        if let Some(variant) = &agent.variant {
            if !variant.trim().is_empty() {
                config.insert("variant".into(), json!(variant));
            }
        }
        config.insert("temperature".into(), json!(agent.temperature));
        config.insert("steps".into(), json!(agent.steps));
        config.insert("prompt".into(), json!(agent.prompt));
        config.insert("disable".into(), json!(!agent.enabled));

        if let Some(top_p) = agent.top_p {
            config.insert("top_p".into(), json!(top_p));
        }

        if let Some(profile) = &agent.permission_profile {
            config.insert("permission_profile".into(), json!(profile));
        }

        let permission = self.build_permission(agent);
        config.insert("permission".into(), Value::Object(permission));

        Value::Object(config)
    }

    fn build_permission(&self, agent: &EditableAgent) -> Map<String, Value> {
        let mut permission = Map::new();

        for (key, value) in &agent.simple_permissions {
            permission.insert(key.clone(), value.clone());
        }

        let mut bash = Map::new();
        bash.insert("*".into(), json!(agent.bash_policy.default));
        for rule in &agent.bash_policy.rules {
            bash.insert(rule.pattern.clone(), json!(rule.action));
        }
        permission.insert("bash".into(), Value::Object(bash));

        let mut task = Map::new();
        task.insert("*".into(), json!(agent.task_policy.default));
        for rule in &agent.task_policy.rules {
            task.insert(rule.agent_name.clone(), json!(rule.action));
        }
        permission.insert("task".into(), Value::Object(task));

        if !agent.workspace_scope.allowed_paths.is_empty() || !agent.workspace_scope.denied_paths.is_empty() {
            let mut read = Map::new();
            read.insert("*".into(), json!("allow"));
            for path in &agent.workspace_scope.allowed_paths {
                read.insert(path.clone(), json!("allow"));
            }
            for path in &agent.workspace_scope.denied_paths {
                read.insert(path.clone(), json!("deny"));
            }
            permission.insert("read".into(), Value::Object(read));
        }

        permission
    }
}

fn expand_home(path: &str) -> PathBuf {
    if path == "~" {
        return std::env::var_os("HOME").map(PathBuf::from).unwrap_or_else(|| PathBuf::from(path));
    }

    if let Some(rest) = path.strip_prefix("~/") {
        if let Some(home) = std::env::var_os("HOME") {
            return PathBuf::from(home).join(rest);
        }
    }

    PathBuf::from(path)
}

fn is_default_opencode_config(path: &PathBuf) -> bool {
    let Some(home_config_dir) = PathResolver::home_config_dir() else {
        return false;
    };

    let normalized_path = path.canonicalize().unwrap_or_else(|_| path.clone());
    ["opencode.json", "opencode.jsonc"]
        .iter()
        .map(|file_name| home_config_dir.join(file_name))
        .map(|default_path| default_path.canonicalize().unwrap_or(default_path))
        .any(|default_path| normalized_path == default_path)
}

fn ensure_default_opencode_config_is_read_only(path: &PathBuf) -> Result<(), AppError> {
    if is_default_opencode_config(path) {
        return Err(AppError::Validation(
            "Default OpenCode config is read-only in oc-manager. Create a workflow/config file instead.".into(),
        ));
    }

    Ok(())
}

fn upsert_existing_agent_config(
    path: &PathBuf,
    config: &mut Value,
    agent: &EditableAgent,
    agent_config: Value,
) -> Result<(), AppError> {
    let target = find_agent_entry(config, path, agent);

    let Some((field, original_name)) = target else {
        if has_agent_container(config) {
            return Err(AppError::Validation(format!(
                "Agent '{}' was not found in {}. Refresh agents before saving.",
                agent.name,
                display_config_path(path)
            )));
        }
        return insert_new_agent_config(path, config, agent, agent_config);
    };

    ensure_agent_name_available(config, path, &agent.name, Some((&field, &original_name)))?;

    let agent_map = config
        .get_mut(&field)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| AppError::Parse(format!("Invalid {field} container.")))?;

    if original_name != agent.name {
        agent_map.remove(&original_name);
    }
    agent_map.insert(agent.name.clone(), agent_config);

    Ok(())
}

fn insert_new_agent_config(
    path: &PathBuf,
    config: &mut Value,
    agent: &EditableAgent,
    agent_config: Value,
) -> Result<(), AppError> {
    ensure_agent_name_available(config, path, &agent.name, None)?;

    let field = preferred_agent_container(config);
    if config.get(field).is_none() {
        config[field] = Value::Object(Map::new());
    }

    let agent_map = config
        .get_mut(field)
        .and_then(Value::as_object_mut)
        .ok_or_else(|| AppError::Parse(format!("Invalid {field} container.")))?;
    agent_map.insert(agent.name.clone(), agent_config);

    Ok(())
}

fn preferred_agent_container(config: &Value) -> &'static str {
    if config.get("agent").and_then(Value::as_object).is_some() {
        "agent"
    } else if config.get("agents").and_then(Value::as_object).is_some() {
        "agents"
    } else {
        "agent"
    }
}

fn has_agent_container(config: &Value) -> bool {
    ["agent", "agents"]
        .iter()
        .any(|field| config.get(*field).and_then(Value::as_object).is_some())
}

fn find_agent_entry(config: &Value, path: &PathBuf, agent: &EditableAgent) -> Option<(String, String)> {
    for field in ["agent", "agents"] {
        let Some(map) = config.get(field).and_then(Value::as_object) else {
            continue;
        };

        for name in map.keys() {
            if stable_id(path, name) == agent.id {
                return Some((field.to_string(), name.clone()));
            }
        }
    }

    None
}

fn ensure_agent_name_available(
    config: &Value,
    path: &PathBuf,
    agent_name: &str,
    allowed_entry: Option<(&str, &str)>,
) -> Result<(), AppError> {
    for field in ["agent", "agents"] {
        let Some(map) = config.get(field).and_then(Value::as_object) else {
            continue;
        };

        if !map.contains_key(agent_name) {
            continue;
        }

        let is_allowed = allowed_entry
            .map(|(allowed_field, allowed_name)| {
                allowed_field == field && allowed_name == agent_name
            })
            .unwrap_or(false);
        if !is_allowed {
            return Err(AppError::Validation(format!(
                "Agent '{}' already exists in {}.",
                agent_name,
                display_config_path(path)
            )));
        }
    }

    Ok(())
}

fn display_config_path(path: &PathBuf) -> String {
    path.to_string_lossy().to_string()
}

#[cfg(test)]
mod tests {
    use super::*;
    use std::fs;
    use std::path::PathBuf;
    use std::time::{SystemTime, UNIX_EPOCH};

    #[test]
    fn save_agent_updates_only_matching_agent_in_shared_agent_file() {
        let path = temp_config_path("save-shared-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" },
                "beta": { "description": "Old beta", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "beta" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let agent = editable_agent(&path, "beta", "Updated beta");
        service.save_agent(&agent, &path.to_string_lossy()).unwrap();

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 2);
        assert_eq!(
            agents.get("alpha").unwrap().get("description"),
            Some(&json!("Keep me"))
        );
        assert_eq!(
            agents.get("beta").unwrap().get("description"),
            Some(&json!("Updated beta"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn create_agent_uses_existing_agents_container_without_dropping_entries() {
        let path = temp_config_path("create-agents-container");
        fs::write(
            &path,
            r#"{
              "agents": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let agent = editable_agent(&path, "beta", "New beta");
        service.create_agent(&agent, &path.to_string_lossy()).unwrap();

        let config = read_json(&path);
        assert!(config.get("agent").is_none());
        let agents = config.get("agents").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 2);
        assert!(agents.contains_key("alpha"));
        assert!(agents.contains_key("beta"));

        cleanup_temp_config(&path);
    }

    #[test]
    fn save_agent_updates_existing_agents_container() {
        let path = temp_config_path("save-agents-container");
        fs::write(
            &path,
            r#"{
              "agents": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" },
                "beta": { "description": "Old beta", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "beta" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let agent = editable_agent(&path, "beta", "Updated beta");
        service.save_agent(&agent, &path.to_string_lossy()).unwrap();

        let config = read_json(&path);
        assert!(config.get("agent").is_none());
        let agents = config.get("agents").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 2);
        assert_eq!(
            agents.get("alpha").unwrap().get("description"),
            Some(&json!("Keep me"))
        );
        assert_eq!(
            agents.get("beta").unwrap().get("description"),
            Some(&json!("Updated beta"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn save_agent_renames_matching_agent_without_leaving_stale_entry() {
        let path = temp_config_path("rename-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" },
                "beta": { "description": "Old beta", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "beta" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let mut agent = editable_agent(&path, "beta", "Renamed beta");
        agent.name = "gamma".into();
        service.save_agent(&agent, &path.to_string_lossy()).unwrap();

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 2);
        assert!(agents.contains_key("alpha"));
        assert!(!agents.contains_key("beta"));
        assert_eq!(
            agents.get("gamma").unwrap().get("description"),
            Some(&json!("Renamed beta"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn save_agent_refuses_rename_over_existing_agent() {
        let path = temp_config_path("rename-duplicate-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" },
                "beta": { "description": "Old beta", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "beta" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let mut agent = editable_agent(&path, "beta", "Would overwrite alpha");
        agent.id = stable_id(&path, "beta");
        agent.name = "alpha".into();

        let error = service.save_agent(&agent, &path.to_string_lossy()).unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 2);
        assert_eq!(
            agents.get("alpha").unwrap().get("description"),
            Some(&json!("Keep me"))
        );
        assert_eq!(
            agents.get("beta").unwrap().get("description"),
            Some(&json!("Old beta"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn save_agent_refuses_stale_id_instead_of_overwriting_by_name() {
        let path = temp_config_path("stale-id-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let mut agent = editable_agent(&path, "alpha", "Would overwrite alpha");
        agent.id = "stale-id".into();

        let error = service.save_agent(&agent, &path.to_string_lossy()).unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 1);
        assert_eq!(
            agents.get("alpha").unwrap().get("description"),
            Some(&json!("Keep me"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn create_agent_refuses_duplicate_name() {
        let path = temp_config_path("create-duplicate-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        let agent = editable_agent(&path, "alpha", "Duplicate");

        let error = service.create_agent(&agent, &path.to_string_lossy()).unwrap_err();
        assert!(matches!(error, AppError::Validation(_)));

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 1);
        assert_eq!(
            agents.get("alpha").unwrap().get("description"),
            Some(&json!("Keep me"))
        );

        cleanup_temp_config(&path);
    }

    #[test]
    fn delete_agent_removes_only_matching_id() {
        let path = temp_config_path("delete-agent");
        fs::write(
            &path,
            r#"{
              "agent": {
                "alpha": { "description": "Keep me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "alpha" },
                "beta": { "description": "Delete me", "mode": "subagent", "model": "openai/gpt-4.1", "prompt": "beta" }
              }
            }"#,
        )
        .unwrap();

        let service = SaveService::new();
        service
            .delete_agent(&stable_id(&path, "beta"), &path.to_string_lossy())
            .unwrap();

        let config = read_json(&path);
        let agents = config.get("agent").and_then(Value::as_object).unwrap();
        assert_eq!(agents.len(), 1);
        assert!(agents.contains_key("alpha"));
        assert!(!agents.contains_key("beta"));

        cleanup_temp_config(&path);
    }

    fn editable_agent(path: &PathBuf, name: &str, description: &str) -> EditableAgent {
        EditableAgent {
            id: stable_id(path, name),
            name: name.into(),
            description: description.into(),
            enabled: true,
            mode: "subagent".into(),
            provider: "openai".into(),
            model: "gpt-4.1".into(),
            variant: None,
            temperature: 0.2,
            top_p: None,
            steps: 25,
            prompt: "prompt".into(),
            simple_permissions: Map::new(),
            bash_policy: BashPolicy {
                default: "ask".into(),
                rules: vec![],
            },
            task_policy: TaskPolicy {
                default: "ask".into(),
                rules: vec![],
            },
            workspace_scope: WorkspaceScope {
                allowed_paths: vec![],
                denied_paths: vec![],
            },
            approval_policy: ApprovalPolicy {
                require_plan_before_edit: false,
                require_user_approval_before_edit: false,
                require_user_approval_before_bash: false,
                require_user_approval_before_install: false,
                require_user_approval_before_delete: false,
                require_user_approval_before_git_push: false,
            },
            permission_profile: None,
            source_path: path.to_string_lossy().to_string(),
            version: 1,
        }
    }

    fn temp_config_path(name: &str) -> PathBuf {
        let unique = SystemTime::now()
            .duration_since(UNIX_EPOCH)
            .unwrap()
            .as_nanos();
        std::env::temp_dir().join(format!("oc-manager-{name}-{unique}.json"))
    }

    fn read_json(path: &PathBuf) -> Value {
        serde_json::from_str(&fs::read_to_string(path).unwrap()).unwrap()
    }

    fn cleanup_temp_config(path: &PathBuf) {
        let _ = fs::remove_file(path);
        let stem = path
            .file_stem()
            .and_then(|stem| stem.to_str())
            .unwrap_or_default();
        if let Some(parent) = path.parent() {
            if let Ok(entries) = fs::read_dir(parent) {
                for entry in entries.flatten() {
                    let name = entry.file_name().to_string_lossy().to_string();
                    if name.starts_with(&format!("{stem}_backup_")) {
                        let _ = fs::remove_file(entry.path());
                    }
                }
            }
        }
    }
}
