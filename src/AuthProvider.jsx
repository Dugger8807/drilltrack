import { useState, useEffect, createContext, useContext } from "react";
import { supabase } from "./supabaseClient.js";
import { theme } from "./constants.js";
import { Icon, Btn } from "./ui.jsx";
import { TE_LOGO } from "./logo.js";

const AuthContext = createContext(null);

export function useAuth() {
  return useContext(AuthContext);
}

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null); // staff_members row
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Check session on mount + listen for changes
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session: s } }) => {
      setSession(s);
      if (s) loadUserProfile(s.user.id);
      else setLoading(false);
    });

    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, s) => {
      setSession(s);
      if (s) loadUserProfile(s.user.id);
      else { setUser(null); setLoading(false); }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadUserProfile = async (authId) => {
    const { data, error: err } = await supabase
      .from('staff_members')
      .select('*')
      .eq('auth_user_id', authId)
      .single();

    if (err || !data) {
      console.error('No staff profile linked to auth user:', err);
      setUser(null);
      setError('Your account is not linked to a staff profile. Contact your admin.');
    } else {
      setUser(data);
      setError(null);
    }
    setLoading(false);
  };

  const signIn = async (email, password) => {
    setError(null);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    if (err) {
      setError(err.message);
      return false;
    }
    return true;
  };

  const signOut = async () => {
    await supabase.auth.signOut();
    setSession(null);
    setUser(null);
  };

  const value = {
    session,
    user,
    loading,
    error,
    signIn,
    signOut,
    isAdmin: user?.app_role === 'admin',
    isManager: user?.app_role === 'admin' || user?.app_role === 'manager',
    isDriller: user?.app_role === 'driller',
    isViewer: user?.app_role === 'viewer',
    role: user?.app_role || 'viewer',
    orgId: user?.org_id,
    staffId: user?.id,
    fullName: user ? `${user.first_name} ${user.last_name}` : '',
  };

  // Loading state
  if (loading) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center" }}>
        <div style={{ textAlign: "center" }}>
          <img src={TE_LOGO} alt="Thompson Engineering" style={{ height: 40, marginBottom: 16 }} />
          <div style={{ fontSize: 18, fontWeight: 800, color: theme.text, marginBottom: 4 }}>DRILLTRACK</div>
          <div style={{ fontSize: 10, color: theme.textMuted, textTransform: "uppercase", letterSpacing: "0.12em" }}>Geotechnical Field Operations</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginTop: 12 }}>Checking authentication...</div>
        </div>
      </div>
    );
  }

  // Not logged in → show login
  if (!session) {
    return <LoginScreen onSignIn={signIn} error={error} />;
  }

  // Logged in but no profile
  if (!user && error) {
    return (
      <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
        <div style={{ background: theme.surface, borderRadius: 16, padding: 32, maxWidth: 400, width: "100%", textAlign: "center", border: `1px solid ${theme.border}` }}>
          <div style={{ width: 48, height: 48, borderRadius: 12, background: "rgba(239,68,68,0.15)", display: "flex", alignItems: "center", justifyContent: "center", margin: "0 auto 16px" }}>
            <Icon name="alert" size={24} color={theme.danger} />
          </div>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 8 }}>Account Not Linked</div>
          <div style={{ fontSize: 13, color: theme.textMuted, marginBottom: 20 }}>{error}</div>
          <Btn variant="secondary" onClick={signOut}>Sign Out</Btn>
        </div>
      </div>
    );
  }

  return (
    <AuthContext.Provider value={value}>
      {children}
    </AuthContext.Provider>
  );
}

// ─── Login Screen ────────────────────────────────────────────────────
function LoginScreen({ onSignIn, error }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!email || !password) return;
    setLoading(true);
    await onSignIn(email, password);
    setLoading(false);
  };

  return (
    <div style={{ minHeight: "100vh", background: theme.bg, display: "flex", alignItems: "center", justifyContent: "center", padding: 24 }}>
      <div style={{ width: "100%", maxWidth: 380 }}>
        {/* Logo */}
        <div style={{ textAlign: "center", marginBottom: 32 }}>
          <img src={TE_LOGO} alt="Thompson Engineering" style={{ height: 48, marginBottom: 20 }} />
          <div style={{ fontSize: 24, fontWeight: 800, color: theme.text, letterSpacing: "-0.02em" }}>DRILLTRACK</div>
          <div style={{ fontSize: 10, color: theme.accent, textTransform: "uppercase", letterSpacing: "0.18em", marginTop: 4, fontWeight: 600 }}>Geotechnical Field Operations Management Platform</div>
        </div>

        {/* Login card */}
        <div style={{ background: theme.surface, borderRadius: 16, padding: 28, border: `1px solid ${theme.border}`, boxShadow: "0 8px 32px rgba(0,0,0,0.3)" }}>
          <div style={{ fontSize: 16, fontWeight: 700, color: theme.text, marginBottom: 4 }}>Sign In</div>
          <div style={{ fontSize: 12, color: theme.textMuted, marginBottom: 20 }}>Enter your credentials to continue</div>

          {error && (
            <div style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", borderRadius: 8, padding: "10px 14px", marginBottom: 16, fontSize: 12, color: theme.danger }}>
              {error}
            </div>
          )}

          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Email</label>
              <input
                type="email"
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="you@company.com"
                autoComplete="email"
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <div>
              <label style={{ display: "block", fontSize: 11, fontWeight: 600, color: theme.textMuted, marginBottom: 4, textTransform: "uppercase", letterSpacing: "0.06em" }}>Password</label>
              <input
                type="password"
                value={password}
                onChange={e => setPassword(e.target.value)}
                placeholder="••••••••"
                autoComplete="current-password"
                onKeyDown={e => e.key === 'Enter' && handleSubmit(e)}
                style={{ width: "100%", padding: "12px 14px", borderRadius: 8, border: `1px solid ${theme.border}`, background: theme.bg, color: theme.text, fontSize: 14, fontFamily: "inherit", outline: "none", boxSizing: "border-box" }}
              />
            </div>
            <button
              onClick={handleSubmit}
              disabled={loading || !email || !password}
              style={{
                width: "100%", padding: "12px", borderRadius: 8, border: "none",
                background: loading ? theme.textMuted : `linear-gradient(135deg, ${theme.accent}, #e08520)`,
                color: "#0f1117", fontSize: 14, fontWeight: 700, cursor: loading ? "not-allowed" : "pointer",
                fontFamily: "inherit", marginTop: 4, opacity: (!email || !password) ? 0.5 : 1,
              }}
            >
              {loading ? "Signing in..." : "Sign In"}
            </button>
          </div>
        </div>

        <div style={{ textAlign: "center", marginTop: 16, fontSize: 11, color: theme.textMuted }}>
          Contact your admin if you need an account
        </div>
      </div>
    </div>
  );
}
