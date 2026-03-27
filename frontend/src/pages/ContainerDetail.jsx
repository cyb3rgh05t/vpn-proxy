import { useState, useEffect, useCallback } from "react";
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
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";

export default function ContainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [container, setContainer] = useState(null);
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [dependents, setDependents] = useState([]);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}`);
      setContainer(res.data);
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
  }, [fetchContainer, fetchDependents]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
  }, [tab, fetchLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchContainer();
      fetchDependents();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchContainer, fetchDependents]);

  const handleAction = async (action) => {
    try {
      await api.post(`/containers/${id}/${action}`);
      fetchContainer();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action}`);
    }
  };

  const handleDelete = async () => {
    if (!confirm(`Delete "${container.name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/containers/${id}`);
      navigate("/");
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete");
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
      alert("Failed to export compose file");
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

  const isRunning = container.status === "running";
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
    <div className="max-w-4xl mx-auto">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      {/* Header */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{container.name}</h1>
            <p className="text-vpn-muted mt-1">
              {container.vpn_provider} &middot; {container.vpn_type}
            </p>
          </div>
          <StatusBadge status={container.status} />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => fetchContainer()}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg text-sm transition-colors"
          >
            <RefreshCw className="w-4 h-4" />
            Refresh
          </button>
          {isStopped && (
            <button
              onClick={() => handleAction("start")}
              className="flex items-center gap-2 px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-lg text-sm transition-colors"
            >
              <Play className="w-4 h-4" />
              Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => handleAction("stop")}
              className="flex items-center gap-2 px-3 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm transition-colors"
            >
              <Square className="w-4 h-4" />
              Stop
            </button>
          )}
          <button
            onClick={() => handleAction("restart")}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-primary/20 hover:bg-vpn-primary text-vpn-primary hover:text-black rounded-lg text-sm transition-colors"
          >
            <RotateCcw className="w-4 h-4" />
            Restart
          </button>
          <button
            onClick={handleExportCompose}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg text-sm transition-colors"
          >
            <Download className="w-4 h-4" />
            Export Compose
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 bg-red-600/20 hover:bg-red-600 text-red-400 hover:text-white rounded-lg text-sm transition-colors ml-auto"
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
    </div>
  );
}
