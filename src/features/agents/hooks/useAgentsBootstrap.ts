import { useEffect } from "react";
import { scanAgents } from "../api/agentsApi";
import { useAgentsStore } from "../store/agentsStore";

function getErrorMessage(error: unknown) {
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error !== null && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return "Failed to load agents";
}

export function useAgentsBootstrap(projectRoot?: string | null) {
  const setScanResult = useAgentsStore((state) => state.setScanResult);
  const setLoading = useAgentsStore((state) => state.setLoading);
  const setError = useAgentsStore((state) => state.setError);

  useEffect(() => {
    let isMounted = true;

    async function loadAgents() {
      setLoading(true);
      setError(undefined);

      try {
        const result = await scanAgents(projectRoot ?? null);
        if (isMounted) setScanResult(result, projectRoot ?? null);
      } catch (error) {
        if (isMounted) {
          setError(getErrorMessage(error));
        }
      } finally {
        if (isMounted) setLoading(false);
      }
    }

    void loadAgents();

    return () => {
      isMounted = false;
    };
  }, [projectRoot, setScanResult, setError, setLoading]);
}
