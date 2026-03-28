import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Download,
  RefreshCw,
  Terminal,
  Network,
  Globe,
  Shield,
  Rocket,
  Pencil,
  X,
  Save,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";

export default function ContainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const [container, setContainer] = useState(null);
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [dependents, setDependents] = useState([]);
  const [actionLoading, setActionLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [vpnInfo, setVpnInfo] = useState(null);
  const [description, setDescription] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const descFocused = useRef(false);
  const initialLoad = useRef(true);
  const [editingConfig, setEditingConfig] = useState(false);
  const [editConfig, setEditConfig] = useState({});
  const [redeploying, setRedeploying] = useState(false);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}`);
      setContainer(res.data);
      // Only update description on initial load or when user is not editing
      if (initialLoad.current || !descFocused.current) {
        setDescription(res.data.description || "");
        initialLoad.current = false;
      }
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchDependents = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/dependents`);
      setDependents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDependents([]);
    }
  }, [id]);

  const fetchVpnInfo = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/vpn-info`);
      setVpnInfo(res.data);
    } catch {
      setVpnInfo(null);
    }
  }, [id]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/logs`);
      setLogs(res.data.logs);
    } catch {
      setLogs("Failed to fetch logs.");
    }
  }, [id]);

  useEffect(() => {
    fetchContainer();
    fetchDependents();
    fetchVpnInfo();
  }, [fetchContainer, fetchDependents, fetchVpnInfo]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchContainer();
      fetchDependents();
      fetchVpnInfo();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchContainer, fetchDependents, fetchVpnInfo]);

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      const res = await api.post(`/containers/${id}/${action}`);
      toast.success(res.data?.message || `Container ${action}ed successfully`);
      fetchContainer();
      fetchDependents();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading("");
    }
  };

  const handleDepAction = async (depName, action) => {
    try {
      await api.post(`/containers/${id}/dependents/${depName}/${action}`);
      toast.success(`${depName} ${action}ed successfully`);
      fetchDependents();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || `Failed to ${action} ${depName}`,
      );
    }
  };

  const handleDescriptionSave = async () => {
    const trimmed = description.trim();
    if (trimmed === (container.description || "")) return;
    setDescSaving(true);
    try {
      await api.put(`/containers/${id}`, { description: trimmed || null });
      setContainer((prev) => ({ ...prev, description: trimmed || null }));
      toast.success("Description saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save description");
    } finally {
      setDescSaving(false);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${container.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/containers/${id}`);
      toast.success(`Container deleted`);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const handleExportCompose = async () => {
    try {
      const res = await api.get(`/containers/${id}/compose`);
      const blob = new Blob([res.data], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `docker-compose-${container.name}.yml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export compose file");
    }
  };

  const handleEditConfig = () => {
    setEditConfig({ ...(container.config || {}) });
    setEditingConfig(true);
  };

  const handleRedeploy = async () => {
    if (
      !confirm(
        "Redeploy this container? Dependents will be restarted automatically.",
      )
    )
      return;
    setRedeploying(true);
    try {
      const res = await api.post(`/containers/${id}/redeploy`, {
        config: editConfig,
      });
      toast.success(res.data?.message || "Container redeployed");
      setEditingConfig(false);
      fetchContainer();
      fetchDependents();
      fetchVpnInfo();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to redeploy container");
    } finally {
      setRedeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
      </div>
    );
  }

  if (!container) return null;

  const isRunning = ["running", "healthy", "unhealthy", "starting"].includes(
    container.status,
  );
  const isStopped = ["exited", "created", "removed", "dead"].includes(
    container.status,
  );

  const maskedConfig = Object.entries(container.config || {}).map(([k, v]) => ({
    key: k,
    value:
      k.toLowerCase().includes("password") || k.toLowerCase().includes("key")
        ? "••••••••"
        : v,
  }));

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{container.name}</h1>
            {container.docker_name &&
              container.docker_name !== `gluetun-${container.name}` &&
              container.docker_name !== container.name && (
                <p className="text-xs text-amber-400/70 font-mono mt-0.5">
                  Docker: {container.docker_name}
                </p>
              )}
            <p className="text-vpn-muted mt-1">
              {container.vpn_provider} &middot; {container.vpn_type}
            </p>
          </div>
          <StatusBadge status={container.status} />
        </div>

        <div className="mb-4 bg-vpn-input border border-vpn-border rounded-lg px-4 py-2.5">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => (descFocused.current = true)}
            onBlur={() => {
              descFocused.current = false;
              handleDescriptionSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
            placeholder="Add a description..."
            disabled={descSaving}
            className="w-full bg-transparent border-none text-sm text-vpn-text placeholder-vpn-muted focus:outline-none focus:text-white disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true);
              await fetchContainer();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          {isStopped && (
            <button
              onClick={() => handleAction("start")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Play
                className={`w-4 h-4 ${actionLoading === "start" ? "animate-pulse" : ""}`}
              />
              Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => handleAction("stop")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors disabled:opacity-50"
            >
              <Square
                className={`w-4 h-4 ${actionLoading === "stop" ? "animate-pulse" : ""}`}
              />
              Stop
            </button>
          )}
          <button
            onClick={() => handleAction("restart")}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-primary/20 hover:bg-vpn-primary text-vpn-primary hover:text-black rounded-lg text-sm transition-colors disabled:opacity-50"
          >
            <RotateCcw
              className={`w-4 h-4 ${actionLoading === "restart" ? "animate-spin" : ""}`}
            />
            Restart
          </button>
          <button
            onClick={handleExportCompose}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg text-sm transition-all active:scale-95"
          >
            <Download className="w-4 h-4" />
            Export Compose
          </button>
          <button
            onClick={handleEditConfig}
            className="flex items-center gap-2 px-3 py-2 bg-blue-600/20 hover:bg-blue-600 text-blue-400 hover:text-white rounded-lg text-sm transition-all active:scale-95"
          >
            <Pencil className="w-4 h-4" />
            Edit & Redeploy
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm transition-all active:scale-95 ml-auto"
          >
            <Trash2 className="w-4 h-4" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 mb-4 bg-vpn-card border border-vpn-border rounded-xl p-1">
        {[
          { key: "info", label: "Information" },
          { key: "logs", label: "Logs" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg text-sm font-medium transition-colors ${
              tab === key
                ? "bg-vpn-input text-white"
                : "text-vpn-muted hover:text-vpn-text"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
        {tab === "info" && (
          <div className="space-y-6">
            {/* VPN Status */}
            {isRunning && vpnInfo && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  VPN Status
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">VPN</p>
                    <p
                      className={`text-sm font-semibold ${
                        vpnInfo.vpn_status === "running"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {vpnInfo.vpn_status || "Unknown"}
                    </p>
                  </div>
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">Public IP</p>
                    <p className="text-sm font-mono text-white">
                      {vpnInfo.public_ip || "N/A"}
                    </p>
                  </div>
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">
                      <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
                      Location
                    </p>
                    <p className="text-sm text-white">
                      {[vpnInfo.region, vpnInfo.country]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </p>
                  </div>
                  {vpnInfo.port_forwarded && (
                    <div className="bg-vpn-input rounded-lg p-4">
                      <p className="text-xs text-vpn-muted mb-1">
                        Port Forward
                      </p>
                      <p className="text-sm font-mono text-vpn-primary">
                        {vpnInfo.port_forwarded}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                Network
              </h3>
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">HTTP Proxy</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_http_proxy}
                  </p>
                </div>
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">Shadowsocks</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_shadowsocks}
                  </p>
                </div>
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">Gluetun API</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_control}
                  </p>
                </div>
              </div>
              {/* Extra Ports */}
              {container.extra_ports && container.extra_ports.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-vpn-muted mb-2">
                    Additional Ports
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {container.extra_ports.map((ep, i) => (
                      <div key={i} className="bg-vpn-input rounded-lg p-3">
                        <p className="text-xs text-vpn-muted mb-1">
                          {ep.protocol?.toUpperCase() || "TCP"}
                        </p>
                        <p className="text-sm font-mono text-white">
                          {ep.host} → {ep.container}
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dependent Containers */}
            {dependents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Network className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Containers using this network
                </h3>
                <div className="space-y-2">
                  {dependents.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between bg-vpn-input rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            dep.status === "running"
                              ? "bg-emerald-500"
                              : dep.status === "exited"
                                ? "bg-red-500"
                                : "bg-amber-500"
                          }`}
                        />
                        <div>
                          <p className="text-sm text-white font-medium">
                            {dep.name}
                          </p>
                          <p className="text-xs text-vpn-muted font-mono">
                            {dep.image}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            dep.status === "running"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : dep.status === "exited"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {dep.status}
                        </span>
                        <div className="flex items-center gap-1 ml-2">
                          {["exited", "created", "dead"].includes(
                            dep.status,
                          ) && (
                            <button
                              onClick={() => handleDepAction(dep.name, "start")}
                              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
                              title="Start"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {dep.status === "running" && (
                            <button
                              onClick={() => handleDepAction(dep.name, "stop")}
                              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90"
                              title="Stop"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDepAction(dep.name, "restart")}
                            className="p-1.5 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90"
                            title="Restart"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {maskedConfig.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  Configuration
                </h3>
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                  {maskedConfig.map(({ key, value }) => (
                    <div key={key} className="flex justify-between px-4 py-3">
                      <span className="text-sm text-vpn-muted font-mono">
                        {key}
                      </span>
                      <span className="text-sm text-white font-mono">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                Details
              </h3>
              <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">Container ID</span>
                  <span className="text-sm text-white font-mono">
                    {container.container_id || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">Created</span>
                  <span className="text-sm text-white">
                    {container.created_at
                      ? new Date(container.created_at).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-vpn-muted">
                <Terminal className="w-4 h-4" />
                <span className="text-sm">Container Logs</span>
              </div>
              <button
                onClick={fetchLogs}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg transition-colors"
              >
                <RefreshCw className="w-3 h-3" />
                Refresh
              </button>
            </div>
            <pre className="bg-vpn-bg-dark text-vpn-text text-xs font-mono p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap">
              {logs || "No logs available."}
            </pre>
          </div>
        )}
      </div>

      {/* Edit & Redeploy Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-vpn-border">
              <h2 className="text-lg font-bold text-white">
                Edit Configuration & Redeploy
              </h2>
              <button
                onClick={() => setEditingConfig(false)}
                className="p-2 rounded-lg text-vpn-muted hover:text-white hover:bg-vpn-input transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {Object.entries(editConfig).map(([key, value]) => (
                <div key={key} className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-vpn-muted font-mono block mb-1">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setEditConfig((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setEditConfig((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })
                    }
                    className="mt-6 p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  const key = prompt("Enter new environment variable name:");
                  if (key && key.trim()) {
                    setEditConfig((prev) => ({ ...prev, [key.trim()]: "" }));
                  }
                }}
                className="w-full py-2 border border-dashed border-vpn-border rounded-lg text-sm text-vpn-muted hover:text-vpn-primary hover:border-vpn-primary transition-colors"
              >
                + Add Variable
              </button>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-vpn-border">
              <button
                onClick={() => setEditingConfig(false)}
                className="px-4 py-2 rounded-lg text-sm text-vpn-muted hover:text-white hover:bg-vpn-input transition-colors"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeploy}
                disabled={redeploying}
                className="flex items-center gap-2 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors disabled:opacity-50"
              >
                <Rocket
                  className={`w-4 h-4 ${redeploying ? "animate-pulse" : ""}`}
                />
                {redeploying ? "Redeploying..." : "Save & Redeploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
