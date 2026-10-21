import { createContext, useContext, useEffect, useState, useCallback } from 'react';
import { useAuth } from './AuthContext';
import { getCurrentWorkspace, getMyWorkspaces } from '../services/workspaces';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [membership, setMembership] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);

  const loadWorkspaceContext = useCallback(async () => {
    if (!user) {
      setCurrentWorkspace(null);
      setMembership(null);
      setWorkspaces([]);
      setLoading(false);
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // 1. Try to load current active workspace
      const currentData = await getCurrentWorkspace().catch(() => null);
      if (currentData && currentData.workspace) {
        setCurrentWorkspace(currentData.workspace);
        setMembership(currentData.membership);
        try {
          localStorage.setItem('relay_active_workspace_id', currentData.workspace._id);
        } catch {}
      } else {
        // Graceful legacy fallback: User does not have a workspace yet (pre-migration single-operator)
        setCurrentWorkspace(null);
        setMembership(null);
        try {
          localStorage.removeItem('relay_active_workspace_id');
        } catch {}
      }

      // 2. Load available workspaces for user
      const list = await getMyWorkspaces().catch(() => []);
      setWorkspaces(list || []);
    } catch (err) {
      setError(err?.response?.data?.message || err.message || 'Failed to load workspace.');
    } finally {
      setLoading(false);
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadWorkspaceContext();
    }
  }, [authLoading, user, loadWorkspaceContext]);

  const selectWorkspace = async (workspaceId) => {
    try {
      localStorage.setItem('relay_active_workspace_id', workspaceId);
    } catch {}
    await loadWorkspaceContext();
  };

  const refreshWorkspace = async () => {
    await loadWorkspaceContext();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        membership,
        workspaces,
        loading: authLoading || loading,
        error,
        selectWorkspace,
        refreshWorkspace,
      }}
    >
      {children}
    </WorkspaceContext.Provider>
  );
}

export const useWorkspace = () => {
  const context = useContext(WorkspaceContext);
  if (!context) {
    return {
      currentWorkspace: null,
      membership: null,
      workspaces: [],
      loading: false,
      error: null,
      selectWorkspace: () => Promise.resolve(),
      refreshWorkspace: () => Promise.resolve(),
    };
  }
  return context;
};

export default WorkspaceContext;
