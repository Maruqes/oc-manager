use std::path::PathBuf;

use serde::{Deserialize, Serialize};
use serde_json::{json, Map, Value};

use crate::errors::AppError;
use crate::infrastructure::filesystem::path_resolver::PathResolver;
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
        let original_name = extract_original_name(&path, &agent.id, &agent.name);

        let mut config = self.read_config(&path)?;
        let agent_config = self.editable_to_config(agent);

        if let Some(agent_map) = config.get_mut("agent").and_then(Value::as_object_mut) {
            if agent.name != original_name {
                agent_map.remove(&original_name);
            }
            agent_map.insert(agent.name.clone(), agent_config);
        } else if let Some(agent_map) = config.get_mut("agents").and_then(Value::as_object_mut) {
            if agent.name != original_name {
                agent_map.remove(&original_name);
            }
            agent_map.insert(agent.name.clone(), agent_config);
        } else {
            let mut map = Map::new();
            map.insert(agent.name.clone(), agent_config);
            config["agent"] = Value::Object(map);
        }

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
        let mut config = self.read_config(&path).unwrap_or_else(|_| json!({}));

        let agent_config = self.editable_to_config(agent);

        if let Some(agent_map) = config.get_mut("agent").and_then(Value::as_object_mut) {
            agent_map.insert(agent.name.clone(), agent_config);
        } else {
            let mut map = Map::new();
            map.insert(agent.name.clone(), agent_config);
            config["agent"] = Value::Object(map);
        }

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
        if is_default_opencode_config(&path) {
            return Err(AppError::Validation(
                "Default OpenCode config agents cannot be deleted.".into(),
            ));
        }

        if path.extension().and_then(|extension| extension.to_str()) == Some("md") {
            return self.delete_config_file(config_path);
        }

        let mut config = self.read_config(&path)?;

        for field in ["agent", "agents"] {
            if let Some(agent_map) = config.get_mut(field).and_then(Value::as_object_mut) {
                agent_map.retain(|name, _| name != agent_id);
            }
        }

        self.backup.create_backup(&path)?;
        self.writer.write(&path, &config)?;

        Ok(())
    }

    pub fn delete_config_file(&self, config_path: &str) -> Result<(), AppError> {
        let path = expand_home(config_path);
        if is_default_opencode_config(&path) {
            return Err(AppError::Validation(
                "Default OpenCode config cannot be deleted.".into(),
            ));
        }

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

fn extract_original_name(path: &PathBuf, _agent_id: &str, fallback: &str) -> String {
    let content = std::fs::read_to_string(path).unwrap_or_default();
    if let Ok(config) = JsoncParser::parse(&content) {
        for field in ["agent", "agents"] {
            if let Some(map) = config.get(field).and_then(Value::as_object) {
                for (name, value) in map {
                    if value.get("description").is_some() {
                        return name.clone();
                    }
                }
            }
        }
    }
    fallback.to_string()
}
