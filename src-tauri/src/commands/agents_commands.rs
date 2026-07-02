use crate::domain::agent::ScanResult;
use crate::errors::AppError;
use crate::services::save_service::{EditableAgent, EditablePermissionProfile, SaveAgentResult, SaveService};
use crate::services::scan_service::ScanService;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::path::{Path, PathBuf};
use std::process::Command;

#[tauri::command]
pub async fn scan_agents(project_root: Option<String>) -> Result<ScanResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let project_root = project_root.map(std::path::PathBuf::from);
        let service = ScanService::new(project_root);
        service.scan_agents()
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("scanner thread failed: {error}")))
}

#[tauri::command]
pub async fn open_agent_location(
    source_path: String,
    project_root: Option<String>,
) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || open_location(&source_path, project_root))
        .await
        .map_err(|error| AppError::Filesystem(format!("open location thread failed: {error}")))?
}

fn open_location(source_path: &str, project_root: Option<String>) -> Result<(), AppError> {
    let path = resolve_discovered_source_path(source_path, project_root)?;
    let location = location_to_open(&path);
    open_path(&location)
}

fn resolve_discovered_source_path(
    source_path: &str,
    project_root: Option<String>,
) -> Result<PathBuf, AppError> {
    let path = expand_home(source_path);
    let canonical_path = path.canonicalize().map_err(|error| {
        AppError::Filesystem(format!("Localização do agente não encontrada: {error}"))
    })?;

    if is_openable_discovered_path_shape(&canonical_path, project_root.as_deref()) {
        Ok(canonical_path)
    } else {
        Err(AppError::Validation(
            "Localização não pertence a uma configuração de agente descoberta.".into(),
        ))
    }
}

fn is_openable_discovered_path_shape(path: &Path, project_root: Option<&str>) -> bool {
    let Some(extension) = path.extension().and_then(|extension| extension.to_str()) else {
        return false;
    };
    if !matches!(extension, "json" | "jsonc" | "md") {
        return false;
    }

    let project_root = project_root
        .map(expand_home)
        .or_else(|| std::env::current_dir().ok())
        .and_then(|root| root.canonicalize().ok());

    if let Some(root) = project_root {
        if path.starts_with(root) {
            return true;
        }
    }

    std::env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| path.starts_with(home.join(".config/opencode")))
        .unwrap_or(false)
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

fn location_to_open(path: &Path) -> PathBuf {
    if path.is_dir() {
        return path.to_path_buf();
    }

    path.parent().map(Path::to_path_buf).unwrap_or_else(|| path.to_path_buf())
}

fn open_path(path: &Path) -> Result<(), AppError> {
    let status = platform_open_command(path)
        .status()
        .map_err(|error| AppError::Filesystem(format!("Não foi possível abrir a localização: {error}")))?;

    if status.success() {
        Ok(())
    } else {
        Err(AppError::Filesystem(format!(
            "O sistema recusou abrir a localização: {}",
            path.display()
        )))
    }
}

#[cfg(target_os = "windows")]
fn platform_open_command(path: &Path) -> Command {
    let mut command = Command::new("explorer");
    command.arg(path);
    command
}

#[cfg(target_os = "macos")]
fn platform_open_command(path: &Path) -> Command {
    let mut command = Command::new("open");
    command.arg(path);
    command
}

#[cfg(all(unix, not(target_os = "macos")))]
fn platform_open_command(path: &Path) -> Command {
    let mut command = Command::new("xdg-open");
    command.arg(path);
    command
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct ModelInfo {
    pub id: String,
    pub provider: String,
    pub model: String,
    pub variants: Vec<String>,
}

#[tauri::command]
pub async fn save_agent(agent: EditableAgent, target_path: String) -> Result<SaveAgentResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SaveService::new();
        service.save_agent(&agent, &target_path)
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("save agent thread failed: {error}")))?
}

#[tauri::command]
pub async fn create_agent(agent: EditableAgent, target_path: String) -> Result<SaveAgentResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SaveService::new();
        service.create_agent(&agent, &target_path)
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("create agent thread failed: {error}")))?
}

#[tauri::command]
pub async fn delete_agent(agent_id: String, config_path: String) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SaveService::new();
        service.delete_agent(&agent_id, &config_path)
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("delete agent thread failed: {error}")))?
}

#[tauri::command]
pub async fn delete_config_file(config_path: String, project_root: Option<String>) -> Result<(), AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_discovered_source_path(&config_path, project_root)?;
        let service = SaveService::new();
        service.delete_config_file(&path.to_string_lossy())
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("delete config file thread failed: {error}")))?
}

#[tauri::command]
pub async fn save_permission_profile(profile: EditablePermissionProfile, target_path: String) -> Result<SaveAgentResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let service = SaveService::new();
        service.save_permission_profile(&profile, &target_path)
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("save permission profile thread failed: {error}")))?
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct CreateConfigFileResult {
    pub success: bool,
    pub errors: Vec<String>,
}

#[tauri::command]
pub async fn create_config_file(file_name: String, agent_name: String, extension: String) -> Result<CreateConfigFileResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let path = resolve_workflows_path(&file_name, &extension)?;
        let service = SaveService::new();
        service.create_config_file(&path.to_string_lossy(), &agent_name)?;
        Ok(CreateConfigFileResult {
            success: true,
            errors: vec![],
        })
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("create config file thread failed: {error}")))?
}

fn resolve_workflows_path(file_name: &str, extension: &str) -> Result<PathBuf, AppError> {
    let home_config = crate::infrastructure::filesystem::path_resolver::PathResolver::home_config_dir()
        .ok_or_else(|| AppError::Validation("Could not resolve home config directory".into()))?;

    let workflows_dir = home_config.join("workflows");
    let file_name_with_ext = if file_name.ends_with(".json") || file_name.ends_with(".jsonc") {
        file_name.to_string()
    } else {
        format!("{}{}", file_name, extension)
    };

    Ok(workflows_dir.join(file_name_with_ext))
}

#[tauri::command]
pub async fn list_opencode_models() -> Result<Vec<ModelInfo>, AppError> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = Command::new("opencode")
            .arg("models")
            .output()
            .map_err(|error| AppError::Filesystem(format!("Failed to run opencode models: {error}")))?;

        if !output.status.success() {
            let stderr = String::from_utf8_lossy(&output.stderr);
            return Err(AppError::Filesystem(format!("opencode models failed: {stderr}")));
        }

        let stdout = String::from_utf8_lossy(&output.stdout);
        let model_lines = stdout
            .lines()
            .map(str::trim)
            .filter(|line| !line.is_empty())
            .map(str::to_string)
            .collect::<Vec<_>>();

        let providers = model_lines
            .iter()
            .filter_map(|line| line.split_once('/').map(|(provider, _)| provider.to_string()))
            .collect::<BTreeSet<_>>();

        let mut variants_by_model = BTreeMap::new();
        for provider in providers {
            if let Ok(provider_variants) = load_provider_model_variants(&provider) {
                variants_by_model.extend(provider_variants);
            }
        }

        let models = model_lines
            .into_iter()
            .map(|line| {
                let (provider, model) = line
                    .split_once('/')
                    .map(|(p, m)| (p.to_string(), m.to_string()))
                    .unwrap_or((line.to_string(), String::new()));
                let variants = variants_by_model.remove(&line).unwrap_or_default();
                ModelInfo {
                    id: line.to_string(),
                    provider,
                    model,
                    variants,
                }
            })
            .collect();

        Ok(models)
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("models thread failed: {error}")))?
}

fn load_provider_model_variants(provider: &str) -> Result<BTreeMap<String, Vec<String>>, AppError> {
    let output = Command::new("opencode")
        .arg("models")
        .arg(provider)
        .arg("--verbose")
        .output()
        .map_err(|error| AppError::Filesystem(format!("Failed to run opencode models {provider} --verbose: {error}")))?;

    if !output.status.success() {
        let stderr = String::from_utf8_lossy(&output.stderr);
        return Err(AppError::Filesystem(format!("opencode models {provider} --verbose failed: {stderr}")));
    }

    Ok(parse_verbose_model_variants(&String::from_utf8_lossy(&output.stdout)))
}

fn parse_verbose_model_variants(output: &str) -> BTreeMap<String, Vec<String>> {
    let mut result = BTreeMap::new();
    let lines = output.lines().collect::<Vec<_>>();
    let mut index = 0;

    while index < lines.len() {
        let model_id = lines[index].trim();
        index += 1;
        if model_id.is_empty() || !model_id.contains('/') {
            continue;
        }

        let mut json_lines = Vec::new();
        let mut depth = 0i32;
        while index < lines.len() {
            let line = lines[index];
            depth += line.matches('{').count() as i32;
            depth -= line.matches('}').count() as i32;
            json_lines.push(line);
            index += 1;
            if depth == 0 && !json_lines.is_empty() {
                break;
            }
        }

        if let Ok(value) = serde_json::from_str::<Value>(&json_lines.join("\n")) {
            let variants = value
                .get("variants")
                .and_then(Value::as_object)
                .map(|variants| variants.keys().cloned().collect::<Vec<_>>())
                .unwrap_or_default();
            result.insert(model_id.to_string(), variants);
        }
    }

    result
}
