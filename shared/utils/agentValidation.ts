import type {
  AgentValidationResult,
  BashPolicy,
  EditableAgent,
  PermissionValue,
  TaskPolicy,
  ValidationError,
} from "../types/editable-agent.dto";

const NAME_PATTERN = /^[a-z0-9-]+$/;
const MODEL_PATTERN = /^[a-zA-Z0-9][a-zA-Z0-9._/-]*$/;
const GLOB_PATTERN = /^[^\n\r]*$/;

function pushError(errors: ValidationError[], field: string, message: string) {
  errors.push({ field, message });
}

export function validateAgentName(name: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const trimmed = name.trim();

  if (!trimmed) {
    pushError(errors, "name", "Name is required.");
    return errors;
  }

  if (trimmed.length < 2 || trimmed.length > 50) {
    pushError(errors, "name", "Name must be between 2 and 50 characters.");
  }

  if (!NAME_PATTERN.test(trimmed)) {
    pushError(
      errors,
      "name",
      "Name must be lowercase, with no spaces, no accents, only letters, numbers, and hyphens.",
    );
  }

  return errors;
}

export function validateAgentDescription(description: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const trimmed = description.trim();

  if (!trimmed) {
    pushError(errors, "description", "Description is required.");
    return errors;
  }

  if (trimmed.length < 10) {
    pushError(errors, "description", "Description must be at least 10 characters.");
  }

  if (trimmed.length > 500) {
    pushError(errors, "description", "Description must be at most 500 characters.");
  }

  return errors;
}

export function validateAgentModel(provider: string, model: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const trimmedModel = model.trim();

  if (!trimmedModel) {
    pushError(errors, "model", "Model is required.");
    return errors;
  }

  if (!provider.trim()) {
    pushError(errors, "provider", "Provider is required.");
  }

  if (!MODEL_PATTERN.test(trimmedModel)) {
    pushError(errors, "model", "Model contains invalid characters.");
  }

  return errors;
}

export function validateAgentTemperature(temperature: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (Number.isNaN(temperature)) {
    pushError(errors, "temperature", "Temperature must be a number.");
  } else if (temperature < 0 || temperature > 2) {
    pushError(errors, "temperature", "Temperature must be between 0.0 and 2.0.");
  }

  return errors;
}

export function validateAgentSteps(steps: number): ValidationError[] {
  const errors: ValidationError[] = [];

  if (!Number.isInteger(steps)) {
    pushError(errors, "steps", "Steps must be an integer.");
  } else if (steps < 1 || steps > 1000) {
    pushError(errors, "steps", "Steps must be between 1 and 1000.");
  }

  return errors;
}

export function validateAgentPrompt(prompt: string): ValidationError[] {
  const errors: ValidationError[] = [];
  const trimmed = prompt.trim();

  if (trimmed.length < 50) {
    pushError(errors, "prompt", "Prompt must be at least 50 characters.");
  }

  return errors;
}

export function validateBashPolicy(policy: BashPolicy): ValidationError[] {
  const errors: ValidationError[] = [];

  policy.rules.forEach((rule, index) => {
    if (!rule.pattern.trim()) {
      pushError(errors, `bash.rules[${index}].pattern`, "Bash pattern is required.");
    } else if (!GLOB_PATTERN.test(rule.pattern)) {
      pushError(errors, `bash.rules[${index}].pattern`, "Bash pattern contains invalid characters.");
    }
  });

  return errors;
}

export function validateTaskPolicy(policy: TaskPolicy): ValidationError[] {
  const errors: ValidationError[] = [];

  policy.rules.forEach((rule, index) => {
    if (!rule.agentName.trim()) {
      pushError(errors, `task.rules[${index}].agentName`, "Agent name is required.");
    } else if (!NAME_PATTERN.test(rule.agentName)) {
      pushError(
        errors,
        `task.rules[${index}].agentName`,
        "Agent name must be lowercase with no spaces.",
      );
    }
  });

  return errors;
}

export function validateAgent(agent: EditableAgent): AgentValidationResult {
  const errors: ValidationError[] = [
    ...validateAgentName(agent.name),
    ...validateAgentDescription(agent.description),
    ...validateAgentModel(agent.provider, agent.model),
    ...validateAgentTemperature(agent.temperature),
    ...validateAgentSteps(agent.steps),
    ...validateAgentPrompt(agent.prompt),
    ...validateBashPolicy(agent.bashPolicy),
    ...validateTaskPolicy(agent.taskPolicy),
  ];

  return { valid: errors.length === 0, errors };
}

export function isValidPermissionValue(value: string): value is PermissionValue {
  return value === "allow" || value === "ask" || value === "deny";
}
