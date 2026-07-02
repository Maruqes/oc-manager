import { useEffect, useMemo, useState } from "react";
import { Bot, ChevronDown, ChevronRight, FilePlus, FileText, Plus, Search, Trash2 } from "lucide-react";
import { Badge } from "../../../components/ui/Badge";
import { Button } from "../../../components/ui/Button";
import { useConfirmAction } from "../../../hooks/useConfirmAction";
import { getAgentTypeLabel } from "../utils/agentDisplay";
import { filterAgents } from "../utils/agentFilters";
import { groupAgentsByFile, shortenPath } from "../utils/groupAgentsByFile";
import { useAgentsStore } from "../store/agentsStore";
import type { AgentType } from "../types/agent.types";
import type { AgentFilter } from "../utils/agentFilters";
import { createConfigFile, deleteAgent, deleteConfigFile, scanAgents } from "../api/agentsApi";
import { CreateAgentModal } from "./modals/CreateAgentModal";
import { CreateConfigFileModal } from "./modals/CreateConfigFileModal";

const filters: Array<{ label: string; value: AgentFilter }> = [
  { label: "All", value: "any" },
  { label: "Primary", value: "primary" },
  { label: "Subagents", value: "subagent" },
  { label: "Mode all", value: "all" as AgentType },
  { label: "Unknown", value: "unknown" },
];

function isDefaultOpenCodeConfig(sourcePath: string, source: string) {
  if (source !== "global") return false;

  const normalizedPath = sourcePath.replace(/\\/g, "/");
  return /(^~\/\.config\/opencode|\/\.config\/opencode|\/opencode)\/opencode\.jsonc?$/.test(normalizedPath);
}

export function AgentSidebar() {
  const { agents, selectedAgentId, filter, search, setFilter, setSearch, selectAgent, isLoading, error, scanProjectRoot, setScanResult, setLoading, setError, startCreatingFromFile } = useAgentsStore();
  const visibleAgents = filterAgents(agents, filter, search);
  const grouped = useMemo(() => groupAgentsByFile(visibleAgents), [visibleAgents]);

  const [collapsedFiles, setCollapsedFiles] = useState<Set<string>>(new Set());
  const [showCreateFileModal, setShowCreateFileModal] = useState(false);
  const [createAgentTarget, setCreateAgentTarget] = useState<string | null>(null);
  const { requestConfirm, ConfirmDialogElement } = useConfirmAction();
  const isSearching = search.trim().length > 0;

  // Auto-expand the file group containing the selected agent.
  useEffect(() => {
    if (!selectedAgentId) return;
    const selectedAgent = agents.find((agent) => agent.id === selectedAgentId);
    if (!selectedAgent) return;
    setCollapsedFiles((previous) => {
      if (previous.has(selectedAgent.sourcePath)) {
        const next = new Set(previous);
        next.delete(selectedAgent.sourcePath);
        return next;
      }
      return previous;
    });
  }, [selectedAgentId, agents]);

  const toggleFile = (sourcePath: string) => {
    setCollapsedFiles((previous) => {
      const next = new Set(previous);
      if (next.has(sourcePath)) {
        next.delete(sourcePath);
      } else {
        next.add(sourcePath);
      }
      return next;
    });
  };

  const isFileExpanded = (sourcePath: string) => {
    // When searching, expand everything that has matches.
    if (isSearching) return true;
    return !collapsedFiles.has(sourcePath);
  };

  const reloadAgents = async () => {
    setLoading(true);
    setError(undefined);
    try {
      const result = await scanAgents(scanProjectRoot ?? null);
      setScanResult(result, scanProjectRoot ?? null);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to reload agents");
    } finally {
      setLoading(false);
    }
  };

  const handleCreateFileConfirm = async (name: string, extension: string) => {
    setShowCreateFileModal(false);
    const result = await createConfigFile(name, name, extension);
    if (result.success) {
      await reloadAgents();
    } else {
      setError(result.errors.join("\n") || "Failed to create workflow");
    }
  };

  const handleCreateAgentConfirm = (name: string) => {
    if (createAgentTarget) {
      startCreatingFromFile(createAgentTarget, name);
    }
    setCreateAgentTarget(null);
  };

  const handleDeleteAgent = (agentName: string, sourcePath: string) => {
    requestConfirm(
      {
        title: "Delete agent",
        description: `Delete agent \"${agentName}\" from ${shortenPath(sourcePath)}? This cannot be undone.`,
        confirmLabel: "Delete",
      },
      () => {
        void (async () => {
          try {
            await deleteAgent(agentName, sourcePath);
            await reloadAgents();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete agent");
          }
        })();
      },
    );
  };

  const handleDeleteFile = (sourcePath: string, agentsCount: number) => {
    requestConfirm(
      {
        title: "Delete file",
        description: `Delete ${shortenPath(sourcePath)} and ${agentsCount} agent${agentsCount === 1 ? "" : "s"}? This cannot be undone.`,
        confirmLabel: "Delete",
      },
      () => {
        void (async () => {
          try {
            await deleteConfigFile(sourcePath, scanProjectRoot ?? null);
            await reloadAgents();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Failed to delete file");
          }
        })();
      },
    );
  };

  return (
    <div className="sidebar-content">
      <div className="brand">
        <div className="brand-icon"><Bot size={17} /></div>
        <div>
          <strong>Agentes</strong>
          <span>OpenCode</span>
        </div>
        <Button variant="ghost" className="sidebar-add-button" onClick={() => setShowCreateFileModal(true)} title="Create config file">
          <FilePlus size={16} />
        </Button>
      </div>

      <label className="search-box">
        <Search size={16} />
        <input aria-label="Search agents" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search agents" />
      </label>

      <div className="filter-row">
        {filters.map((item) => (
          <button key={item.value} aria-pressed={filter === item.value} className={filter === item.value ? "filter-active" : ""} onClick={() => setFilter(item.value)}>
            {item.label}
          </button>
        ))}
      </div>

      <div className="agent-list">
        {isLoading ? <p className="muted">Loading agents...</p> : null}
        {error ? <p className="muted">{error}</p> : null}
        {!isLoading && !error && visibleAgents.length === 0 ? <p className="muted">No agents found.</p> : null}

        {grouped.map((group) => {
          const expanded = isFileExpanded(group.sourcePath);
          const hasSelected = group.agents.some((agent) => agent.id === selectedAgentId);
          const isDefaultConfig = isDefaultOpenCodeConfig(group.sourcePath, group.source);
          return (
            <div className="agent-file-group" key={group.sourcePath}>
              <div className="agent-file-header-wrapper">
                <button
                  className={`agent-file-header ${hasSelected ? "file-has-selected" : ""}`}
                  onClick={() => toggleFile(group.sourcePath)}
                  aria-expanded={expanded}
                >
                  {expanded ? <ChevronDown size={15} /> : <ChevronRight size={15} />}
                  <FileText size={15} />
                  <span title={group.sourcePath}>{shortenPath(group.sourcePath)}</span>
                  <Badge tone="slate">{group.agents.length}</Badge>
                </button>
                <button
                  type="button"
                  className="file-add-button"
                  title={`Add agent to ${shortenPath(group.sourcePath)}`}
                  onClick={() => setCreateAgentTarget(group.sourcePath)}
                  aria-label={`Add agent to ${shortenPath(group.sourcePath)}`}
                >
                  <Plus size={14} />
                </button>
                <button
                  type="button"
                  className="file-delete-button"
                  title={isDefaultConfig ? "Default OpenCode config cannot be deleted" : `Delete ${shortenPath(group.sourcePath)}`}
                  onClick={() => handleDeleteFile(group.sourcePath, group.agents.length)}
                  aria-label={isDefaultConfig ? "Default OpenCode config cannot be deleted" : `Delete ${shortenPath(group.sourcePath)}`}
                  disabled={isDefaultConfig}
                >
                  <Trash2 size={13} />
                </button>
              </div>
              {expanded ? (
                <div className="agent-file-items">
                  {group.agents.map((agent) => (
                    <div className="agent-list-item-row" key={agent.id}>
                      <button
                        className={`agent-list-item ${selectedAgentId === agent.id ? "selected" : ""}`}
                        onClick={() => selectAgent(agent.id)}
                      >
                        <Bot size={18} />
                        <span>
                          <strong>{agent.name}</strong>
                          <small>{agent.description}</small>
                        </span>
                        <Badge tone={agent.type === "primary" ? "violet" : agent.type === "subagent" ? "green" : "slate"}>{getAgentTypeLabel(agent.type)}</Badge>
                      </button>
                      <button
                        type="button"
                        className="agent-delete-button"
                        title={isDefaultConfig ? "Agents in the default OpenCode config cannot be deleted" : `Delete agent ${agent.name}`}
                        onClick={() => handleDeleteAgent(agent.name, agent.sourcePath)}
                        aria-label={isDefaultConfig ? "Agents in the default OpenCode config cannot be deleted" : `Delete agent ${agent.name}`}
                        disabled={isDefaultConfig}
                      >
                        <Trash2 size={13} />
                      </button>
                    </div>
                  ))}
                </div>
              ) : null}
            </div>
          );
        })}
      </div>

      <CreateConfigFileModal
        open={showCreateFileModal}
        onClose={() => setShowCreateFileModal(false)}
        onConfirm={handleCreateFileConfirm}
      />

      {createAgentTarget ? (
        <CreateAgentModal
          open={true}
          onClose={() => setCreateAgentTarget(null)}
          onConfirm={handleCreateAgentConfirm}
          sourcePath={createAgentTarget}
        />
      ) : null}
      {ConfirmDialogElement}
    </div>
  );
}
