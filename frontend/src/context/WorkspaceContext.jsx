import { createContext, useContext, useEffect, useState, useCallback, useRef } from 'react';
import { useAuth } from './AuthContext';
import { getCurrentWorkspace, getMyWorkspaces } from '../services/workspaces';
import { getWorkspaceIndustryConfig } from '../services/industries';

const WorkspaceContext = createContext(null);

export function WorkspaceProvider({ children }) {
  const { user, loading: authLoading } = useAuth();
  const [currentWorkspace, setCurrentWorkspace] = useState(null);
  const [industryConfig, setIndustryConfig] = useState(null);
  const [membership, setMembership] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [resolvedUserId, setResolvedUserId] = useState(null);
  const requestVersion = useRef(0);

  const loadWorkspaceContext = useCallback(async () => {
    const version = ++requestVersion.current;
    if (!user) {
      setCurrentWorkspace(null);
      setIndustryConfig(null);
      setMembership(null);
      setWorkspaces([]);
      setLoading(false);
      setResolvedUserId(null);
      return;
    }

    setLoading(true);
    setError(null);
    setIndustryConfig(null);

    try {
      // 1. Try to load current active workspace
      const [currentData, list] = await Promise.all([getCurrentWorkspace(), getMyWorkspaces()]);
      if (version !== requestVersion.current) return;
      if (currentData && currentData.workspace) {
        const config = await getWorkspaceIndustryConfig(currentData.workspace._id);
        if (version !== requestVersion.current) return;
        setIndustryConfig(config);
        setCurrentWorkspace(currentData.workspace);
        setMembership(currentData.membership);
        try {
          sessionStorage.setItem('relay_active_workspace_id', currentData.workspace._id);
        } catch {}
      } else {
        // Graceful legacy fallback: User does not have a workspace yet (pre-migration single-operator)
        setCurrentWorkspace(null);
        setMembership(null);
        try {
          sessionStorage.removeItem('relay_active_workspace_id');
        } catch {}
      }

      // 2. Load available workspaces for user
      setWorkspaces(list || []);
    } catch (err) {
      if (version !== requestVersion.current) return;
      setCurrentWorkspace(null);
      setMembership(null);
      setWorkspaces([]);
      setIndustryConfig(null);
      setError(err?.response?.data?.message || err.message || 'Failed to load workspace.');
    } finally {
      if (version === requestVersion.current) {
        setResolvedUserId(user?.id || null);
        setLoading(false);
      }
    }
  }, [user]);

  useEffect(() => {
    if (!authLoading) {
      loadWorkspaceContext();
    }
  }, [authLoading, user, loadWorkspaceContext]);

  const selectWorkspace = async (workspaceId) => {
    try {
      sessionStorage.setItem('relay_active_workspace_id', workspaceId);
    } catch {}
    await loadWorkspaceContext();
  };

  useEffect(() => {
    document.title = currentWorkspace?.name ? `${currentWorkspace.name} | Relay` : 'Relay';
  }, [currentWorkspace?.name]);

  const refreshWorkspace = async () => {
    await loadWorkspaceContext();
  };

  return (
    <WorkspaceContext.Provider
      value={{
        currentWorkspace,
        industryConfig,
        membership,
        workspaces,
        loading: authLoading || loading || Boolean(user && resolvedUserId !== user.id),
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
      industryConfig: null,
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
