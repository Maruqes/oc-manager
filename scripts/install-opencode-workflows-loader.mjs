#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = dirname(fileURLToPath(import.meta.url));
const HOME = process.env.HOME;
const XDG_CONFIG_HOME = process.env.XDG_CONFIG_HOME;

if (!HOME && !XDG_CONFIG_HOME) {
  throw new Error("HOME or XDG_CONFIG_HOME must be set.");
}

const opencodeDir = join(XDG_CONFIG_HOME || join(HOME, ".config"), "opencode");
const pluginsDir = join(opencodeDir, "plugins");
const workflowsDir = join(opencodeDir, "workflows");
const configPath = join(opencodeDir, "opencode.jsonc");
const legacyJsonPath = join(opencodeDir, "opencode.json");
const pluginPath = join(pluginsDir, "workflows-loader.ts");
const pluginEntry = "./plugins/workflows-loader.ts";

mkdirSync(pluginsDir, { recursive: true });
mkdirSync(workflowsDir, { recursive: true });

writeFileSync(pluginPath, workflowsLoaderPlugin(), "utf8");
ensureConfigLoadsPlugin();
ensureEmptyLegacyJsonIsValid();

console.log(`Installed OpenCode workflows loader: ${pluginPath}`);
console.log(`Workflows directory: ${workflowsDir}`);
console.log("Restart opencode for config/plugin changes to take effect.");

function ensureConfigLoadsPlugin() {
  if (!existsSync(configPath)) {
    writeFileSync(
      configPath,
      `${JSON.stringify(
        {
          $schema: "https://opencode.ai/config.json",
          plugin: [pluginEntry],
        },
        null,
        2,
      )}\n`,
      "utf8",
    );
    return;
  }

  const existing = readFileSync(configPath, "utf8");
  if (existing.includes(pluginEntry)) return;

  const parsed = parseJsoncObject(existing);
  if (parsed) {
    const plugins = Array.isArray(parsed.plugin) ? parsed.plugin : parsed.plugin ? [parsed.plugin] : [];
    parsed.plugin = [...plugins, pluginEntry];
    if (!parsed.$schema) parsed.$schema = "https://opencode.ai/config.json";
    writeFileSync(configPath, `${JSON.stringify(parsed, null, 2)}\n`, "utf8");
    return;
  }

  const updated = insertPluginEntryIntoJsonc(existing, pluginEntry);
  if (updated) {
    writeFileSync(configPath, updated, "utf8");
    return;
  }

  const backupPath = `${configPath}.backup-${Date.now()}`;
  writeFileSync(backupPath, existing, "utf8");
  writeFileSync(
    configPath,
    `${JSON.stringify(
      {
        $schema: "https://opencode.ai/config.json",
        plugin: [pluginEntry],
      },
      null,
      2,
    )}\n`,
    "utf8",
  );
  console.warn(`Could not safely update opencode.jsonc. Backup written to ${backupPath}.`);
}

function ensureEmptyLegacyJsonIsValid() {
  if (!existsSync(legacyJsonPath)) return;

  const existing = readFileSync(legacyJsonPath, "utf8");
  if (existing.trim() === "") {
    writeFileSync(legacyJsonPath, "{}\n", "utf8");
  }
}

function parseJsoncObject(content) {
  try {
    const withoutComments = stripJsoncComments(content);
    const withoutTrailingCommas = withoutComments.replace(/,\s*([}\]])/g, "$1");
    const parsed = JSON.parse(withoutTrailingCommas);
    return parsed && typeof parsed === "object" && !Array.isArray(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function stripJsoncComments(content) {
  let output = "";
  let inString = false;
  let stringQuote = "";
  let escaping = false;

  for (let index = 0; index < content.length; index += 1) {
    const char = content[index];
    const next = content[index + 1];

    if (inString) {
      output += char;
      if (escaping) {
        escaping = false;
      } else if (char === "\\") {
        escaping = true;
      } else if (char === stringQuote) {
        inString = false;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      stringQuote = char;
      output += char;
      continue;
    }

    if (char === "/" && next === "/") {
      while (index < content.length && content[index] !== "\n") index += 1;
      output += "\n";
      continue;
    }

    if (char === "/" && next === "*") {
      index += 2;
      while (index < content.length && !(content[index] === "*" && content[index + 1] === "/")) index += 1;
      index += 1;
      continue;
    }

    output += char;
  }

  return output;
}

function insertPluginEntryIntoJsonc(content, entry) {
  const pluginKey = content.match(/([\n\r]\s*)["']?plugin["']?\s*:\s*\[/);
  if (pluginKey?.index !== undefined) {
    const arrayStart = content.indexOf("[", pluginKey.index);
    const arrayEnd = findMatchingBracket(content, arrayStart);
    if (arrayEnd !== -1) {
      const beforeEnd = content.slice(0, arrayEnd).replace(/\s*$/, "");
      const afterEnd = content.slice(arrayEnd);
      const separator = beforeEnd.endsWith("[") ? "" : ",";
      return `${beforeEnd}${separator}\n    ${JSON.stringify(entry)}${afterEnd}`;
    }
  }

  const objectEnd = content.lastIndexOf("}");
  if (objectEnd === -1) return null;

  const body = content.slice(0, objectEnd).replace(/\s*$/, "");
  const tail = content.slice(objectEnd);
  const separator = body.endsWith("{") ? "" : ",";
  return `${body}${separator}\n  "plugin": [\n    ${JSON.stringify(entry)}\n  ]\n${tail}`;
}

function findMatchingBracket(content, start) {
  let depth = 0;
  let inString = false;
  let quote = "";
  let escaping = false;

  for (let index = start; index < content.length; index += 1) {
    const char = content[index];

    if (inString) {
      if (escaping) escaping = false;
      else if (char === "\\") escaping = true;
      else if (char === quote) inString = false;
      continue;
    }

    if (char === '"' || char === "'") {
      inString = true;
      quote = char;
      continue;
    }

    if (char === "[") depth += 1;
    if (char === "]") {
      depth -= 1;
      if (depth === 0) return index;
    }
  }

  return -1;
}

function workflowsLoaderPlugin() {
  return `import { existsSync, readdirSync, readFileSync } from "fs"\nimport { basename, join } from "path"\nimport type { Plugin } from "@opencode-ai/plugin"\n\ntype PermissionProfile = Record<string, unknown>\n\ntype WorkflowAgent = Record<string, unknown> & {\n  permission_profile?: string\n  permission?: PermissionProfile\n  prompt?: string | string[]\n}\n\ntype WorkflowDefinition = {\n  default_agent?: string\n  models?: {\n    default?: string\n    small?: string\n    agent?: Record<string, string>\n  }\n  permission_profiles?: Record<string, PermissionProfile>\n  agent?: Record<string, WorkflowAgent>\n  command?: Record<string, unknown>\n}\n\nconst workflowsDir = new URL("../workflows/", import.meta.url)\n\nfunction normalizeAgent(workflow: WorkflowDefinition, name: string, agent: WorkflowAgent) {\n  const { permission_profile, permission, prompt, ...rest } = agent\n  const profile = permission_profile ? workflow.permission_profiles?.[permission_profile] : undefined\n\n  if (permission_profile && !profile) {\n    throw new Error(\`Unknown permission profile \"\${permission_profile}\" for agent \"\${name}\"\`)\n  }\n\n  return {\n    ...rest,\n    ...(profile || permission ? { permission: { ...(profile ?? {}), ...(permission ?? {}) } } : {}),\n    ...(prompt === undefined ? {} : { prompt: Array.isArray(prompt) ? prompt.join("\\n") : prompt }),\n  }\n}\n\nfunction loadWorkflows() {\n  if (!existsSync(workflowsDir)) return [] as Array<{ path: string; workflow: WorkflowDefinition }>\n\n  return readdirSync(workflowsDir)\n    .filter((file) => file.endsWith(".json") && !file.includes("_backup_"))\n    .sort((left, right) => left.localeCompare(right))\n    .map((file) => {\n      const path = join(workflowsDir.pathname, file)\n      try {\n        return { path, workflow: JSON.parse(readFileSync(path, "utf8")) as WorkflowDefinition }\n      } catch (error) {\n        throw new Error(\`Could not load workflow \"\${basename(path)}\": \${error instanceof Error ? error.message : String(error)}\`)\n      }\n    })\n}\n\nexport default (async () => {\n  return {\n    config: (cfg) => {\n      for (const { workflow } of loadWorkflows()) {\n        cfg.default_agent = workflow.default_agent ?? cfg.default_agent\n        cfg.model = workflow.models?.default ?? cfg.model\n        cfg.small_model = workflow.models?.small ?? cfg.small_model\n\n        cfg.agent = cfg.agent ?? {}\n        for (const [name, agent] of Object.entries(workflow.agent ?? {})) {\n          cfg.agent[name] = {\n            ...(cfg.agent[name] ?? {}),\n            ...normalizeAgent(workflow, name, agent),\n            ...(workflow.models?.agent?.[name] ? { model: workflow.models.agent[name] } : {}),\n          }\n        }\n\n        cfg.command = {\n          ...(cfg.command ?? {}),\n          ...(workflow.command ?? {}),\n        }\n      }\n    },\n  }\n}) satisfies Plugin\n`;
}
