use serde::Serialize;
use serde_json::Value;

use super::AgentPermission;

#[derive(Debug, Clone, Copy, PartialEq, Eq, PartialOrd, Ord, Serialize)]
#[serde(rename_all = "lowercase")]
pub enum RiskLevel {
    Low,
    Medium,
    High,
}

impl RiskLevel {
    pub fn for_permission(key: &str, value: &Value) -> Self {
        if is_disabled(value) {
            return Self::Low;
        }

        let last_segment = key
            .rsplit('.')
            .next()
            .unwrap_or(key)
            .to_ascii_lowercase();

        if matches!(
            last_segment.as_str(),
            "write" | "edit" | "delete" | "remove" | "bash" | "shell" | "command" | "exec" | "execute"
        ) {
            return Self::High;
        }

        if matches!(
            last_segment.as_str(),
            "network" | "web" | "http" | "https" | "fetch" | "webfetch"
        ) {
            return Self::Medium;
        }

        Self::Low
    }

    pub fn aggregate(permissions: &[AgentPermission]) -> Self {
        permissions
            .iter()
            .map(|permission| permission.risk)
            .max()
            .unwrap_or(Self::Low)
    }
}

fn is_disabled(value: &Value) -> bool {
    match value {
        Value::Bool(false) | Value::Null => true,
        Value::Number(number) => number.as_i64() == Some(0) || number.as_u64() == Some(0),
        Value::String(text) => matches!(
            text.trim().to_ascii_lowercase().as_str(),
            "" | "false" | "off" | "never" | "disabled" | "none" | "no" | "deny" | "denied" | "forbidden" | "blocked" | "prohibited"
        ),
        _ => false,
    }
}

#[cfg(test)]
mod tests {
    use serde_json::json;

    use super::RiskLevel;

    #[test]
    fn deny_actions_are_low_risk() {
        assert_eq!(RiskLevel::for_permission("bash", &json!("deny")), RiskLevel::Low);
        assert_eq!(RiskLevel::for_permission("edit", &json!("blocked")), RiskLevel::Low);
    }

}
