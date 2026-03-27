import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import { Shield, AlertCircle } from "lucide-react";
import api from "../services/api";

export default function Login() {
  const { login, register } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const [setupRequired, setSetupRequired] = useState(false);
  const [checkingSetup, setCheckingSetup] = useState(true);

  useEffect(() => {
    api
      .get("/auth/setup-status")
      .then((res) => setSetupRequired(res.data.setup_required))
      .catch(() => {})
      .finally(() => setCheckingSetup(false));
  }, []);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      if (setupRequired) {
        await register(username, password);
      } else {
        await login(username, password);
      }
      navigate("/");
    } catch (err) {
      const detail = err.response?.data?.detail;
      if (Array.isArray(detail)) {
        setError(detail.map((d) => d.msg || String(d)).join(", "));
      } else if (typeof detail === "string") {
        setError(detail);
      } else {
        setError("An error occurred");
      }
    } finally {
      setLoading(false);
    }
  };

  if (checkingSetup) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-vpn-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vpn-primary"></div>
      </div>
    );
  }

  return (
    <div className="flex items-center justify-center min-h-screen bg-vpn-bg px-4">
      <div className="w-full max-w-md">
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 rounded-2xl bg-vpn-primary/20 mb-4">
            <Shield className="w-8 h-8 text-vpn-primary" />
          </div>
          <h1 className="text-2xl font-bold text-white">VPN Proxy Manager</h1>
          <p className="text-vpn-muted mt-1">
            {setupRequired
              ? "Create your admin account to get started"
              : "Sign in to manage your VPN containers"}
          </p>
        </div>

        <form
          onSubmit={handleSubmit}
          className="bg-vpn-card border border-vpn-border rounded-2xl p-8 space-y-5"
        >
          <h2 className="text-xl font-semibold text-white text-center">
            {setupRequired ? "Setup Admin Account" : "Sign In"}
          </h2>

          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{error}</span>
            </div>
          )}

          <div>
            <label className="block text-sm font-medium text-vpn-muted mb-1.5">
              Username
            </label>
            <input
              type="text"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              className="w-full px-4 py-2.5 bg-vpn-input border border-vpn-border rounded-lg text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
              placeholder="Enter your username"
              required
              autoComplete="username"
              autoFocus
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-vpn-muted mb-1.5">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full px-4 py-2.5 bg-vpn-input border border-vpn-border rounded-lg text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
              placeholder="Enter your password"
              required
              autoComplete={setupRequired ? "new-password" : "current-password"}
            />
          </div>

          <button
            type="submit"
            disabled={loading}
            className="w-full py-2.5 bg-vpn-primary hover:bg-vpn-primary-hover disabled:opacity-50 disabled:cursor-not-allowed text-black font-medium rounded-lg transition-colors"
          >
            {loading
              ? "Please wait..."
              : setupRequired
                ? "Create Account"
                : "Sign In"}
          </button>
        </form>
      </div>
    </div>
  );
}
