import { useState } from "react";
import { MainLayout } from "../layouts/MainLayout";
import { AgentDetails } from "../features/agents/components/AgentDetails";
import { AgentSidebar } from "../features/agents/components/AgentSidebar";
import { AgentStatusPanel } from "../features/agents/components/AgentStatusPanel";
import { useAgentsBootstrap } from "../features/agents/hooks/useAgentsBootstrap";
import { PermissionsView } from "../features/agents/components/PermissionsView";

type MainView = "agents" | "permissions";

const views: Array<{ id: MainView; label: string }> = [
  { id: "agents", label: "Agents" },
  { id: "permissions", label: "Permissions" },
];

export function AgentsPage() {
  const [view, setView] = useState<MainView>("agents");
  useAgentsBootstrap();

  const main = {
    agents: <AgentDetails />,
    permissions: <PermissionsView />,
  }[view];

  return (
    <MainLayout
      sidebar={<AgentSidebar />}
      main={(
        <div className="main-with-tabs">
          <div className="top-tabs">
            {views.map((item) => (
              <button key={item.id} className={view === item.id ? "top-tab-active" : ""} onClick={() => setView(item.id)}>
                {item.label}
              </button>
            ))}
          </div>
          {main}
        </div>
      )}
      aside={<AgentStatusPanel />}
    />
  );
}
