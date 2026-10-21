import { createContext, useContext, useEffect, useState, useMemo } from 'react';
import api from '../services/api';

const AuthContext = createContext(null);

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [workspaces, setWorkspaces] = useState([]);
  const [hasWorkspace, setHasWorkspace] = useState(false);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let mounted = true;
    api
      .get('/auth/me')
      .then(({ data }) => {
        if (mounted) {
          setUser(data.user);
          setWorkspaces(data.workspaces || []);
          setHasWorkspace(Boolean(data.hasWorkspace || (data.workspaces && data.workspaces.length > 0)));
        }
      })
      .catch(() => {
        if (mounted) {
          setUser(null);
          setWorkspaces([]);
          setHasWorkspace(false);
        }
      })
      .finally(() => {
        if (mounted) setLoading(false);
      });

    // Handle 401 session expiration gracefully
    const interceptor = api.interceptors.response.use(
      (response) => response,
      (error) => {
        if (error.response?.status === 401) {
          const url = error.config?.url || '';
          // Don't trigger auto-logout on failed login attempt or initial me check
          if (!url.includes('/auth/login') && !url.includes('/auth/register') && !url.includes('/auth/verify-email')) {
            try { localStorage.removeItem('relay_auth_token'); } catch {}
            setUser(null);
            setWorkspaces([]);
            setHasWorkspace(false);
          }
        }
        return Promise.reject(error);
      }
    );

    return () => {
      mounted = false;
      api.interceptors.response.eject(interceptor);
    };
  }, []);

  const register = async (payload) => {
    const { data } = await api.post('/auth/register', payload);
    return data;
  };

  const login = async (payload) => {
    const { data } = await api.post('/auth/login', payload);
    if (data.token) {
      try { localStorage.setItem('relay_auth_token', data.token); } catch {}
    }
    setUser(data.user);
    const userWorkspaces = data.workspaces || [];
    setWorkspaces(userWorkspaces);
    const hasWs = Boolean(data.hasWorkspace || userWorkspaces.length > 0);
    setHasWorkspace(hasWs);
    return {
      user: data.user,
      workspaces: userWorkspaces,
      hasWorkspace: hasWs,
      token: data.token,
    };
  };

  const logout = async () => {
    try {
      await api.post('/auth/logout');
    } finally {
      try { localStorage.removeItem('relay_auth_token'); } catch {}
      try { localStorage.removeItem('relay_active_workspace_id'); } catch {}
      setUser(null);
      setWorkspaces([]);
      setHasWorkspace(false);
    }
  };

  const verifyEmail = async (token) => {
    const { data } = await api.post('/auth/verify-email', { token });
    if (data.user) {
      setUser(data.user);
    }
    return data;
  };

  const resendVerification = async (email) => {
    const { data } = await api.post('/auth/resend-verification', { email });
    return data;
  };

  const forgotPassword = async (email) => {
    const { data } = await api.post('/auth/forgot-password', { email });
    return data;
  };

  const resetPassword = async (payload) => {
    const { data } = await api.post('/auth/reset-password', payload);
    return data;
  };

  const refreshUser = async () => {
    const { data } = await api.get('/auth/me');
    setUser(data.user);
    setWorkspaces(data.workspaces || []);
    setHasWorkspace(Boolean(data.hasWorkspace || (data.workspaces && data.workspaces.length > 0)));
    return data;
  };

  const updateUser = (partial) => {
    setUser((prev) => (prev ? { ...prev, ...partial } : prev));
  };

  // Authoritative Derived Auth State
  const authState = useMemo(() => {
    if (loading) return 'AUTH_LOADING';
    if (!user) return 'UNAUTHENTICATED';
    if (user.accountStatus === 'SUSPENDED' || user.accountStatus === 'DISABLED') {
      return 'ACCOUNT_RESTRICTED';
    }
    if (!user.isEmailVerified || user.accountStatus === 'PENDING_EMAIL_VERIFICATION') {
      return 'EMAIL_VERIFICATION_REQUIRED';
    }
    if (!hasWorkspace && workspaces.length === 0) {
      return 'AUTHENTICATED_NO_WORKSPACE';
    }
    return 'AUTHENTICATED_WITH_WORKSPACE';
  }, [user, loading, hasWorkspace, workspaces]);

  return (
    <AuthContext.Provider
      value={{
        user,
        workspaces,
        hasWorkspace,
        loading,
        authState,
        register,
        login,
        logout,
        verifyEmail,
        resendVerification,
        forgotPassword,
        resetPassword,
        refreshUser,
        updateUser,
      }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => useContext(AuthContext);
export default AuthContext;
