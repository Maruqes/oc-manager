# OpenCode Configuration Format

Working document for mapping real formats found in OpenCode configs.

## Initial Candidates

- `.json`, `.jsonc`, and `.md` files found recursively in the current project.
- `.json`, `.jsonc`, and `.md` files found recursively in `~/.config/opencode/`.
- Obvious build/cache/dependency folders are ignored.
- Very large non-OpenCode candidate files are ignored to avoid excessive read/parsing cost.

The scanner reads candidates broadly, but only adds files to the result when they contain OpenCode/agent signals:

- `agent` or `agents` map.
- File inside an `agents/` or `agent/` folder.
- `opencode.json` or `opencode.jsonc`.
- Markdown frontmatter with agent fields.
- `permission`/`instructions` in a likely OpenCode path.

To avoid false positives, Markdown without frontmatter does not become an agent only because it is inside a folder named `agents`. JSON/Markdown outside likely paths needs explicit agent signals such as `mode`, `model`, `permission`, `tools`, or execution limits.

## MVP Normalized Fields

- `name`
- `type`
- `description`
- `model`
- `instructions`
- `permissions`

## Recognized Structures

### `agent` Map

```jsonc
{
  "agent": {
    "reviewer": {
      "mode": "subagent",
      "description": "Code reviewer",
      "model": "provider/model",
      "prompt": "Instructions...",
      "tools": {
        "read": true,
        "write": false
      }
    }
  }
}
```

### `agents` Map

Also accepted for compatibility.

### Individual Files In `agents/`

A JSON/JSONC file inside a folder named `agents` is treated as a subagent.

## Current Heuristics

- `mode/type/agentType = primary|main|default` => primary agent.
- `mode/type/agentType = subagent|sub-agent|sub` => subagent.
- Files inside `agents/` => subagent.
- Top-level configs with `model`, `prompt`, `instructions`, `system`, `tools`, or `permissions` => individual agent.
- Permissions with `write`, `edit`, `delete`, `bash`, `shell`, `command`, or `exec` => high risk when active.
- Permissions with `network`, `web`, `http`, or `fetch` => medium risk.

The real scanner must preserve `rawConfig` to avoid data loss when saving.

## Real OpenCode Permission Model

The official schema does not define an entity called `permissionProfiles`. The application uses that name only as a derived view of:

- Global `permission`.
- `agent.<name>.permission` as an agent override.
- Legacy `tools`, marked as deprecated.
- Effective permissions calculated for each agent.

Valid actions are:

- `allow`
- `ask`
- `deny`

Granular rules can use patterns:

```jsonc
{
  "permission": {
    "bash": {
      "*": "ask",
      "git *": "allow",
      "rm *": "deny"
    },
    "task": {
      "*": "deny",
      "reviewer": "allow"
    }
  }
}
```

## Markdown Agents

`*.md` files in `agents/` directories are also recognized. The MVP parser reads simple frontmatter and treats the markdown body as the agent prompt.
