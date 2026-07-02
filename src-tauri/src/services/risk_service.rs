use crate::domain::agent::{AgentPermission, RiskLevel};

pub struct RiskService;

impl RiskService {
    pub fn new() -> Self {
        Self
    }

    pub fn aggregate(permissions: &[AgentPermission]) -> RiskLevel {
        RiskLevel::aggregate(permissions)
    }
}
