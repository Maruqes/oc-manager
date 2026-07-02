import type {
  AgentDto,
  AgentSource,
  AgentType,
  ConfigFileDto,
  InstructionSourceDto,
  PermissionProfileDto,
  PermissionRuleDto,
  RiskLevel,
  ScanResultDto,
} from "../../../../shared/types/agent.dto";

export type { AgentSource, AgentType, RiskLevel };
export type AgentPermission = AgentDto["permissions"][number];
export type Agent = AgentDto;
export type PermissionProfile = PermissionProfileDto;
export type PermissionRule = PermissionRuleDto;
export type InstructionSource = InstructionSourceDto;
export type ConfigFile = ConfigFileDto;
export type ScanResult = ScanResultDto;
