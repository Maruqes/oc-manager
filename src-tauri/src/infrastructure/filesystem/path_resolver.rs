use std::path::PathBuf;

pub struct PathResolver;

impl PathResolver {
    pub fn home_config_dir() -> Option<PathBuf> {
        if let Some(config_home) = std::env::var_os("XDG_CONFIG_HOME") {
            return Some(PathBuf::from(config_home).join("opencode"));
        }

        std::env::var_os("HOME").map(|home| PathBuf::from(home).join(".config/opencode"))
    }
}
