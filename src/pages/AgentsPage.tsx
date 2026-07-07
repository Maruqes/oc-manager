import { useState } from "react";
import { MainLayout } from "../layouts/MainLayout";
import { AgentDetails } from "../features/agents/components/AgentDetails";
import { AgentSidebar } from "../features/agents/components/AgentSidebar";
import { AgentStatusPanel } from "../features/agents/components/AgentStatusPanel";
import { useAgentsBootstrap } from "../features/agents/hooks/useAgentsBootstrap";
import { PermissionsView } from "../features/agents/components/PermissionsView";
import { SkillsView } from "../features/skills/components/SkillsView";
import { ChatbotView } from "../features/chatbot/components/ChatbotView";

type MainView = "agents" | "permissions" | "skills" | "chat";

const views: Array<{ id: MainView; label: string }> = [
  { id: "agents", label: "Agents" },
  { id: "chat", label: "Chat" },
  { id: "permissions", label: "Permissions" },
  { id: "skills", label: "Skills" },
];

export function AgentsPage() {
  const [view, setView] = useState<MainView>("agents");
  useAgentsBootstrap();

  return (
    <MainLayout
      sidebar={<AgentSidebar />}
      main={(
        <div className="main-with-tabs">
          <div className="top-tabs">
            {views.map((item) => (
              <button key={item.id} className={view === item.id ? "top-tab-active" : ""} onClick={() => setView(item.id)} aria-selected={view === item.id}>
                {item.label}
              </button>
            ))}
          </div>
          <div className="main-view-stack">
            <section className={`main-view-panel ${view === "agents" ? "active" : ""}`} aria-hidden={view !== "agents"}>
              <AgentDetails />
            </section>
            <section className={`main-view-panel ${view === "chat" ? "active" : ""}`} aria-hidden={view !== "chat"}>
              <ChatbotView />
            </section>
            <section className={`main-view-panel ${view === "permissions" ? "active" : ""}`} aria-hidden={view !== "permissions"}>
              <PermissionsView />
            </section>
            <section className={`main-view-panel ${view === "skills" ? "active" : ""}`} aria-hidden={view !== "skills"}>
              <SkillsView />
            </section>
          </div>
        </div>
      )}
      aside={<AgentStatusPanel />}
    />
  );
}
