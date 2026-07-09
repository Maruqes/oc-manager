use crate::domain::agent::ScanResult;
use crate::errors::AppError;
use crate::services::save_service::{EditableAgent, EditablePermissionProfile, SaveAgentResult, SaveService};
use crate::services::scan_service::ScanService;
use serde_json::Value;
use std::collections::{BTreeMap, BTreeSet};
use std::fs;
use std::io::{BufRead, BufReader, Read};
use std::path::{Path, PathBuf};
use std::process::{Command, ExitStatus, Output, Stdio};
use std::sync::atomic::{AtomicU64, Ordering};
use std::time::{Duration, Instant};
use tauri::Emitter;

static CHAT_RUN_COUNTER: AtomicU64 = AtomicU64::new(0);
const MAX_CHAT_PIPE_BYTES: usize = 256_000;
const MAX_CHAT_EVENT_TEXT_CHARS: usize = 6_000;
const MAX_CHAT_EVENT_RAW_CHARS: usize = 12_000;
const CHAT_STREAM_FLUSH_INTERVAL: Duration = Duration::from_millis(120);

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
        AppError::Filesystem(format!("Agent location not found: {error}"))
    })?;

    if is_openable_discovered_path_shape(&canonical_path, project_root.as_deref()) {
        Ok(canonical_path)
    } else {
        Err(AppError::Validation(
            "Location does not belong to a discovered agent configuration.".into(),
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
        .map_err(|error| AppError::Filesystem(format!("Could not open location: {error}")))?;

    if status.success() {
        Ok(())
    } else {
        Err(AppError::Filesystem(format!(
            "The system refused to open the location: {}",
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

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct SkillInfo {
    pub name: String,
    pub path: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatResult {
    pub stdout: String,
    pub stderr: String,
}

#[derive(serde::Serialize)]
#[serde(rename_all = "camelCase")]
pub struct OpencodeInstallationStatus {
    pub installed: bool,
    pub version: Option<String>,
    pub error: Option<String>,
}

#[derive(serde::Serialize, Clone)]
#[serde(rename_all = "camelCase")]
pub struct AgentChatStreamEvent {
    pub stream_id: String,
    pub stream: String,
    pub kind: String,
    pub text: String,
    pub raw: String,
}

#[tauri::command]
pub async fn run_agent_chat(
    window: tauri::Window,
    model: String,
    variant: Option<String>,
    prompt: String,
    stream_id: String,
) -> Result<AgentChatResult, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let model = model.trim();
        let prompt = prompt.trim();
        if model.is_empty() || !model.contains('/') {
            return Err(AppError::Validation("Select a valid provider/model.".into()));
        }
        if prompt.is_empty() {
            return Err(AppError::Validation("Enter a prompt for the chatbot.".into()));
        }
        if prompt.len() > 24_000 {
            return Err(AppError::Validation(
                "The chatbot prompt is too large. Shorten the request or the selected agent prompt.".into(),
            ));
        }

        let run_dir = create_agent_chat_run_dir(model, variant.as_deref())?;

        let mut command = opencode_command();
        command
            .arg("run")
            .arg("--dir")
            .arg(&run_dir)
            .arg("--pure")
            .arg("--agent")
            .arg("agent-config-generator")
            .arg("--model")
            .arg(model)
            .arg("--format")
            .arg("json")
            .arg("--thinking")
            .stdin(Stdio::null())
            .stdout(Stdio::piped())
            .stderr(Stdio::piped());

        if let Some(variant) = variant.map(|value| value.trim().to_string()).filter(|value| !value.is_empty()) {
            command.arg("--variant").arg(variant);
        }

        command.arg("--").arg(prompt);

        emit_agent_chat_event(&window, &stream_id, "status", "status", "Starting OpenCode...", "");
        let output_result = command.output_with_stream_timeout(Duration::from_secs(180), window.clone(), stream_id.clone());
        let _ = fs::remove_dir_all(&run_dir);
        let output = output_result?;
        let stdout = String::from_utf8_lossy(&output.stdout).to_string();
        let stderr = String::from_utf8_lossy(&output.stderr).to_string();

        if !output.status.success() {
            return Err(AppError::Filesystem(format!(
                "opencode run failed: {}",
                if stderr.trim().is_empty() { stdout.trim() } else { stderr.trim() }
            )));
        }

        Ok(AgentChatResult { stdout, stderr })
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("agent chat thread failed: {error}")))?
}

fn create_agent_chat_run_dir(model: &str, variant: Option<&str>) -> Result<PathBuf, AppError> {
    let run_dir = std::env::temp_dir().join(format!(
        "oc-manager-chat-{}-{}-{}",
        std::process::id(),
        now_millis(),
        CHAT_RUN_COUNTER.fetch_add(1, Ordering::Relaxed)
    ));
    let config_dir = run_dir.join(".opencode");
    fs::create_dir_all(&config_dir)
        .map_err(|error| AppError::Filesystem(format!("Could not prepare chatbot sandbox: {error}")))?;

    let mut agent = serde_json::Map::new();
    agent.insert("description".into(), serde_json::json!("Generate reviewed OpenCode agent configuration proposals."));
    agent.insert("mode".into(), serde_json::json!("primary"));
    agent.insert("model".into(), serde_json::json!(model));
    if let Some(variant) = variant.map(str::trim).filter(|value| !value.is_empty()) {
        agent.insert("variant".into(), serde_json::json!(variant));
    }
    agent.insert("temperature".into(), serde_json::json!(0.2));
    agent.insert("steps".into(), serde_json::json!(12));
    agent.insert(
        "prompt".into(),
        serde_json::json!("You generate JSON proposals for OpenCode agents. Never use tools. Never edit files. Return only JSON."),
    );
    agent.insert(
        "permission".into(),
        serde_json::json!({
            "read": "deny",
            "edit": "deny",
            "bash": "deny",
            "webfetch": "deny",
            "websearch": "deny",
            "task": "deny",
            "externalDirectory": "deny"
        }),
    );

    let config = serde_json::json!({
        "agent": {
            "agent-config-generator": agent
        }
    });
    fs::write(config_dir.join("opencode.jsonc"), serde_json::to_string_pretty(&config).unwrap())
        .map_err(|error| AppError::Filesystem(format!("Could not write chatbot sandbox config: {error}")))?;

    Ok(run_dir)
}

fn now_millis() -> u128 {
    std::time::SystemTime::now()
        .duration_since(std::time::UNIX_EPOCH)
        .map(|duration| duration.as_millis())
        .unwrap_or_default()
}

#[tauri::command]
pub async fn list_skills() -> Result<Vec<SkillInfo>, AppError> {
    tauri::async_runtime::spawn_blocking(list_installed_skills)
        .await
        .map_err(|error| AppError::Filesystem(format!("list skills thread failed: {error}")))?
}

#[tauri::command]
pub async fn install_skill(skill: String) -> Result<Vec<SkillInfo>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let install_args = parse_skill_install_args(&skill)?;
        let status = npx_command()
            .arg("--yes")
            .arg("skills")
            .arg("add")
            .args(&install_args)
            .arg("-g")
            .arg("-y")
            .env("DISABLE_TELEMETRY", "1")
            .stdin(Stdio::null())
            .stdout(Stdio::null())
            .stderr(Stdio::null())
            .status_with_timeout(Duration::from_secs(120))?;

        if !status.success() {
            let display_name = install_args.join(" ");
            return Err(AppError::Filesystem(format!(
                "Failed to install skill '{display_name}'. Check the identifier on skills.sh and try again."
            )));
        }

        list_installed_skills()
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("install skill thread failed: {error}")))?
}

#[tauri::command]
pub async fn delete_skill(skill_name: String) -> Result<Vec<SkillInfo>, AppError> {
    tauri::async_runtime::spawn_blocking(move || {
        let skill_name = normalize_skill_name(&skill_name)?;
        let skills_dir = skills_dir()?;
        let skill_path = skills_dir.join(&skill_name);
        let canonical_skills_dir = skills_dir.canonicalize().map_err(|error| {
            AppError::Filesystem(format!("Could not open the skills folder: {error}"))
        })?;
        let canonical_skill_path = skill_path.canonicalize().map_err(|error| {
            AppError::Filesystem(format!("Skill '{skill_name}' not found: {error}"))
        })?;

        if canonical_skill_path.parent() != Some(canonical_skills_dir.as_path()) || !canonical_skill_path.is_dir() {
            return Err(AppError::Validation("Invalid skill path.".into()));
        }

        fs::remove_dir_all(&canonical_skill_path).map_err(|error| {
            AppError::Filesystem(format!("Could not delete skill '{skill_name}': {error}"))
        })?;

        list_installed_skills()
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("delete skill thread failed: {error}")))?
}

fn list_installed_skills() -> Result<Vec<SkillInfo>, AppError> {
    let skills_dir = skills_dir()?;
    if !skills_dir.exists() {
        return Ok(vec![]);
    }

    let mut skills = fs::read_dir(&skills_dir)
        .map_err(|error| AppError::Filesystem(format!("Could not read skills: {error}")))?
        .filter_map(Result::ok)
        .filter_map(|entry| {
            let path = entry.path();
            if !path.is_dir() || !path.join("SKILL.md").is_file() {
                return None;
            }
            let name = path.file_name()?.to_str()?.to_string();
            Some(SkillInfo {
                name,
                path: path.to_string_lossy().to_string(),
            })
        })
        .collect::<Vec<_>>();

    skills.sort_by(|a, b| a.name.cmp(&b.name));
    Ok(skills)
}

fn skills_dir() -> Result<PathBuf, AppError> {
    std::env::var_os("HOME")
        .map(PathBuf::from)
        .map(|home| home.join(".agents/skills"))
        .ok_or_else(|| AppError::Validation("Could not resolve the HOME directory.".into()))
}

fn normalize_skill_input(skill: &str) -> Result<String, AppError> {
    let skill = skill.trim();
    if skill.is_empty() {
        return Err(AppError::Validation("Enter the skill name to install.".into()));
    }

    if !skill
        .chars()
        .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '/' | '@'))
    {
        return Err(AppError::Validation(
            "Use only letters, numbers, hyphens, underscores, dots, @, or slashes in the skill identifier.".into(),
        ));
    }

    Ok(skill.to_string())
}

fn parse_skill_install_args(input: &str) -> Result<Vec<String>, AppError> {
    let input = input.trim();
    if input.is_empty() {
        return Err(AppError::Validation("Enter the skill name to install.".into()));
    }

    let input = input.strip_prefix("npx skills add ").unwrap_or(input).trim();
    let parts = input.split_whitespace().collect::<Vec<_>>();
    match parts.as_slice() {
        [skill] => Ok(vec![normalize_skill_source(skill)?]),
        [source, flag, skill_name] if *flag == "--skill" => Ok(vec![
            normalize_skill_source(source)?,
            "--skill".to_string(),
            normalize_skill_input(skill_name)?,
        ]),
        _ => Err(AppError::Validation(
            "Use a skill name, owner/repo@skill, or URL --skill name from skills.sh.".into(),
        )),
    }
}

fn normalize_skill_source(source: &str) -> Result<String, AppError> {
    let source = source.trim();
    if source.starts_with("http://") {
        return Err(AppError::Validation("Use an https URL for skill sources.".into()));
    }

    if source.starts_with("https://") {
        if !source
            .chars()
            .all(|character| character.is_ascii_alphanumeric() || matches!(character, '-' | '_' | '.' | '/' | ':' | '@'))
        {
            return Err(AppError::Validation("Invalid skill source URL.".into()));
        }
        return Ok(source.to_string());
    }

    normalize_skill_input(source)
}

fn normalize_skill_name(skill_name: &str) -> Result<String, AppError> {
    let skill_name = skill_name.trim();
    if skill_name.is_empty() || skill_name == "." || skill_name.contains('/') || skill_name.contains("..") {
        return Err(AppError::Validation("Invalid skill name.".into()));
    }

    normalize_skill_input(skill_name)
}

trait CommandTimeoutExt {
    fn status_with_timeout(&mut self, timeout: Duration) -> Result<ExitStatus, AppError>;
    fn output_with_stream_timeout(&mut self, timeout: Duration, window: tauri::Window, stream_id: String) -> Result<Output, AppError>;
}

impl CommandTimeoutExt for Command {
    fn status_with_timeout(&mut self, timeout: Duration) -> Result<ExitStatus, AppError> {
        let mut child = self
            .spawn()
            .map_err(|error| AppError::Filesystem(format!("Could not run npx skills: {error}")))?;
        let started_at = Instant::now();

        loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|error| AppError::Filesystem(format!("Failed while waiting for npx skills: {error}")))?
            {
                return Ok(status);
            }

            if started_at.elapsed() >= timeout {
                let _ = child.kill();
                let _ = child.wait();
                return Err(AppError::Filesystem(
                    "The installation took too long. Check your internet connection and try again.".into(),
                ));
            }

            std::thread::sleep(Duration::from_millis(200));
        }
    }

    fn output_with_stream_timeout(&mut self, timeout: Duration, window: tauri::Window, stream_id: String) -> Result<Output, AppError> {
        let mut child = self
            .spawn()
            .map_err(|error| AppError::Filesystem(format!("Could not run opencode: {error}")))?;
        let stdout = child.stdout.take();
        let stderr = child.stderr.take();
        let stdout_window = window.clone();
        let stdout_stream_id = stream_id.clone();
        let stdout_thread = std::thread::spawn(move || read_stream_pipe(stdout, stdout_window, stdout_stream_id, "stdout"));
        let stderr_thread = std::thread::spawn(move || read_stream_pipe(stderr, window, stream_id, "stderr"));
        let started_at = Instant::now();

        loop {
            if let Some(status) = child
                .try_wait()
                .map_err(|error| AppError::Filesystem(format!("Failed while waiting for opencode: {error}")))?
            {
                let stdout = stdout_thread.join().unwrap_or_default();
                let stderr = stderr_thread.join().unwrap_or_default();
                return Ok(Output { status, stdout, stderr });
            }

            if started_at.elapsed() >= timeout {
                let _ = child.kill();
                let _ = child.wait();
                let _ = stdout_thread.join();
                let _ = stderr_thread.join();
                return Err(AppError::Filesystem(
                    "The chatbot request took too long. Try a smaller prompt or another model.".into(),
                ));
            }

            std::thread::sleep(Duration::from_millis(100));
        }
    }
}

fn read_stream_pipe<T: Read>(pipe: Option<T>, window: tauri::Window, stream_id: String, stream: &str) -> Vec<u8> {
    let Some(pipe) = pipe else {
        return vec![];
    };

    let mut output = Vec::new();
    let mut pending = PendingChatStreamEvent::new(window, stream_id, stream.to_string());
    let mut reader = BufReader::new(pipe);
    let mut line = String::new();
    loop {
        line.clear();
        match reader.read_line(&mut line) {
            Ok(0) => break,
            Ok(_) => {
                append_bounded_bytes(&mut output, line.as_bytes(), MAX_CHAT_PIPE_BYTES);
                let raw = line.trim_end().to_string();
                if raw.is_empty() {
                    continue;
                }
                let (kind, text) = classify_agent_chat_line(&raw, stream);
                pending.push(&kind, &text, &raw);
            }
            Err(error) => {
                pending.flush();
                pending.emit_immediate(
                    "error",
                    &format!("Failed to read {stream}: {error}"),
                    "",
                );
                break;
            }
        }
    }
    pending.flush();
    output
}

struct PendingChatStreamEvent {
    window: tauri::Window,
    stream_id: String,
    stream: String,
    kind: Option<String>,
    text: String,
    raw: String,
    last_flush: Instant,
}

impl PendingChatStreamEvent {
    fn new(window: tauri::Window, stream_id: String, stream: String) -> Self {
        Self {
            window,
            stream_id,
            stream,
            kind: None,
            text: String::new(),
            raw: String::new(),
            last_flush: Instant::now(),
        }
    }

    fn push(&mut self, kind: &str, text: &str, raw: &str) {
        if !matches!(kind, "thinking" | "output") {
            self.flush();
            self.emit_immediate(kind, text, raw);
            return;
        }

        if self.kind.as_deref().is_some_and(|current| current != kind) {
            self.flush();
        }

        self.kind.get_or_insert_with(|| kind.to_string());
        append_bounded_text(&mut self.text, text, MAX_CHAT_EVENT_TEXT_CHARS);
        append_bounded_text(&mut self.raw, raw, MAX_CHAT_EVENT_RAW_CHARS);

        if self.last_flush.elapsed() >= CHAT_STREAM_FLUSH_INTERVAL {
            self.flush();
        }
    }

    fn flush(&mut self) {
        let Some(kind) = self.kind.take() else {
            return;
        };
        self.emit_immediate(&kind, &self.text, &self.raw);
        self.text.clear();
        self.raw.clear();
        self.last_flush = Instant::now();
    }

    fn emit_immediate(&self, kind: &str, text: &str, raw: &str) {
        emit_agent_chat_event(&self.window, &self.stream_id, &self.stream, kind, text, raw);
    }
}

fn append_bounded_bytes(target: &mut Vec<u8>, bytes: &[u8], max_bytes: usize) {
    target.extend_from_slice(bytes);
    if target.len() > max_bytes {
        let excess = target.len() - max_bytes;
        target.drain(..excess);
    }
}

fn append_bounded_text(target: &mut String, value: &str, max_chars: usize) {
    if !target.is_empty() {
        target.push('\n');
    }
    target.push_str(value);
    let excess = target.chars().count().saturating_sub(max_chars);
    if excess > 0 {
        let start = target
            .char_indices()
            .nth(excess)
            .map(|(index, _)| index)
            .unwrap_or(target.len());
        target.drain(..start);
    }
}

fn classify_agent_chat_line(raw: &str, stream: &str) -> (String, String) {
    if stream == "stderr" {
        return ("stderr".into(), raw.to_string());
    }

    let Ok(value) = serde_json::from_str::<Value>(raw) else {
        return ("output".into(), raw.to_string());
    };

    let type_text = value
        .get("type")
        .or_else(|| value.get("event"))
        .or_else(|| value.get("kind"))
        .and_then(Value::as_str)
        .unwrap_or_default()
        .to_lowercase();

    let extracted = extract_agent_chat_text(&value).unwrap_or_else(|| raw.to_string());
    if type_text.contains("think") || has_key_recursive(&value, "thinking") || has_key_recursive(&value, "reasoning") {
        return ("thinking".into(), extracted);
    }
    if type_text.contains("tool")
        || type_text.contains("permission")
        || type_text.contains("action")
        || has_key_recursive(&value, "tool")
        || has_key_recursive(&value, "command")
    {
        return ("action".into(), extracted);
    }
    if type_text.contains("error") {
        return ("error".into(), extracted);
    }

    ("output".into(), extracted)
}

fn extract_agent_chat_text(value: &Value) -> Option<String> {
    for key in ["text", "content", "message", "delta", "thinking", "reasoning", "title", "name", "command"] {
        if let Some(text) = value.get(key).and_then(Value::as_str) {
            if !text.trim().is_empty() {
                return Some(text.to_string());
            }
        }
    }

    match value {
        Value::Array(items) => items.iter().find_map(extract_agent_chat_text),
        Value::Object(map) => map.values().find_map(extract_agent_chat_text),
        _ => None,
    }
}

fn has_key_recursive(value: &Value, key: &str) -> bool {
    match value {
        Value::Object(map) => map.iter().any(|(name, child)| name.eq_ignore_ascii_case(key) || has_key_recursive(child, key)),
        Value::Array(items) => items.iter().any(|item| has_key_recursive(item, key)),
        _ => false,
    }
}

fn emit_agent_chat_event(window: &tauri::Window, stream_id: &str, stream: &str, kind: &str, text: &str, raw: &str) {
    let _ = window.emit("agent-chat-event", AgentChatStreamEvent {
        stream_id: stream_id.to_string(),
        stream: stream.to_string(),
        kind: kind.to_string(),
        text: text.to_string(),
        raw: raw.to_string(),
    });
}

#[tauri::command]
pub async fn check_opencode_installation() -> Result<OpencodeInstallationStatus, AppError> {
    tauri::async_runtime::spawn_blocking(|| {
        let output = opencode_command()
            .arg("--version")
            .stdin(Stdio::null())
            .output();

        match output {
            Ok(output) if output.status.success() => {
                let version = String::from_utf8_lossy(&output.stdout).trim().to_string();
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                Ok(OpencodeInstallationStatus {
                    installed: true,
                    version: if version.is_empty() {
                        (!stderr.is_empty()).then_some(stderr)
                    } else {
                        Some(version)
                    },
                    error: None,
                })
            }
            Ok(output) => {
                let stderr = String::from_utf8_lossy(&output.stderr).trim().to_string();
                let stdout = String::from_utf8_lossy(&output.stdout).trim().to_string();
                Ok(OpencodeInstallationStatus {
                    installed: false,
                    version: None,
                    error: Some(if stderr.is_empty() { stdout } else { stderr }),
                })
            }
            Err(error) => Ok(OpencodeInstallationStatus {
                installed: false,
                version: None,
                error: Some(format!("opencode was not found in PATH: {error}")),
            }),
        }
    })
    .await
    .map_err(|error| AppError::Filesystem(format!("opencode check thread failed: {error}")))?
}

#[cfg(target_os = "windows")]
const CREATE_NO_WINDOW: u32 = 0x08000000;

#[cfg(target_os = "windows")]
fn opencode_command() -> Command {
    use std::os::windows::process::CommandExt;

    let mut command = Command::new("opencode.cmd");
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(target_os = "windows"))]
fn opencode_command() -> Command {
    Command::new("opencode")
}

#[cfg(target_os = "windows")]
fn npx_command() -> Command {
    use std::os::windows::process::CommandExt;

    let mut command = Command::new("npx.cmd");
    command.creation_flags(CREATE_NO_WINDOW);
    command
}

#[cfg(not(target_os = "windows"))]
fn npx_command() -> Command {
    Command::new("npx")
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
        let output = opencode_command()
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
    let output = opencode_command()
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
