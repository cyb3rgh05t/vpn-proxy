import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Server,
  Activity,
  AlertTriangle,
  HeartCrack,
  RefreshCw,
  Search,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Shield,
  Globe,
  Wifi,
  WifiOff,
  Network,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [vpnInfoMap, setVpnInfoMap] = useState({});

  const fetchContainers = useCallback(async () => {
    try {
      const res = await api.get("/containers");
      setContainers(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setError("Failed to load containers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVpnInfo = useCallback(async () => {
    try {
      const res = await api.get("/containers/vpn-info-batch");
      setVpnInfoMap(res.data || {});
    } catch {
      // Silently ignore - VPN info is optional
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    fetchVpnInfo();
    const interval = setInterval(() => {
      fetchContainers();
      fetchVpnInfo();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchContainers, fetchVpnInfo]);

  const [actionLoading, setActionLoading] = useState("");

  const running = containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const unhealthy = containers.filter((c) =>
    ["unhealthy"].includes(c.status),
  ).length;
  const stopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  const handleAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await api.post(`/containers/${id}/${action}`);
      toast.success(res.data?.message || `Container ${action}ed`);
      fetchContainers();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading("");
    }
  };

  const handleDelete = async (id, name) => {
    if (!confirm(`Delete "${name}"? This cannot be undone.`)) return;
    try {
      await api.delete(`/containers/${id}`);
      toast.success(`Container "${name}" deleted`);
      fetchContainers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const stats = [
    {
      label: "Total",
      value: containers.length,
      icon: Server,
      color: "text-vpn-primary",
      bg: "bg-vpn-primary/10",
    },
    {
      label: "Running",
      value: running,
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Unhealthy",
      value: unhealthy,
      icon: HeartCrack,
      color: "text-red-400",
      bg: "bg-red-500/10",
    },
    {
      label: "Stopped",
      value: stopped,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-vpn-muted mt-1">
            Manage your Gluetun VPN containers
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setDiscovering(true);
              try {
                const res = await api.post("/containers/discover");
                toast.success(res.data.message);
                fetchContainers();
              } catch {
                toast.error("Failed to discover containers");
              } finally {
                setDiscovering(false);
              }
            }}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <Search
              className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`}
            />
            Discover
          </button>
          <button
            onClick={async () => {
              setRefreshing(true);
              await fetchContainers();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-primary hover:bg-vpn-primary-hover text-black rounded-lg transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            New Container
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4"
          >
            <div className={`p-3 rounded-lg ${bg}`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-vpn-muted">{label}</p>
            </div>
          </div>
        ))}
      </div>

      {/* Container Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-vpn-muted">{error}</p>
          <button
            onClick={fetchContainers}
            className="mt-3 text-vpn-primary hover:text-vpn-accent"
          >
            Try again
          </button>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Server className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No containers yet
          </h3>
          <p className="text-vpn-muted mb-6">
            Create your first Gluetun VPN container to get started.
          </p>
          <button
            onClick={() => navigate("/create")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-vpn-primary hover:bg-vpn-primary-hover text-black rounded-lg transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            Create Container
          </button>
        </div>
      ) : (
        <div className="space-y-2">
          {containers.map((c) => {
            const info = vpnInfoMap[String(c.id)];
            const isRunning = [
              "running",
              "healthy",
              "unhealthy",
              "starting",
            ].includes(c.status);
            const isStopped = ["exited", "created", "removed", "dead"].includes(
              c.status,
            );
            const serverLocation =
              c.config?.SERVER_COUNTRIES ||
              c.config?.SERVER_CITIES ||
              c.config?.SERVER_REGIONS ||
              null;
            return (
              <div
                key={c.id}
                onClick={() => navigate(`/containers/${c.id}`)}
                className="bg-vpn-card border border-vpn-border rounded-xl px-5 py-4 flex items-center gap-4 hover:border-vpn-muted transition-all cursor-pointer group"
              >
                {/* Status dot */}
                <div
                  className={`w-3 h-3 rounded-full flex-shrink-0 ${
                    c.status === "healthy" || c.status === "running"
                      ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                      : c.status === "unhealthy"
                        ? "bg-red-500 shadow-lg shadow-red-500/30 animate-pulse"
                        : isStopped
                          ? "bg-red-500"
                          : "bg-amber-500"
                  }`}
                />

                {/* Name + Description */}
                <div className="min-w-0 w-48 flex-shrink-0">
                  <div className="flex items-center gap-2">
                    <h3 className="text-sm font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
                      {c.name}
                    </h3>
                    {c.description && (
                      <span className="hidden lg:inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-vpn-primary/15 text-vpn-primary border border-vpn-primary/30 truncate max-w-[120px]">
                        {c.description}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-vpn-muted capitalize">
                    {c.vpn_provider} · {c.vpn_type}
                  </p>
                </div>

                {/* Status Badge */}
                <div className="flex-shrink-0">
                  <StatusBadge status={c.status} />
                </div>

                {/* VPN Connection */}
                <div className="hidden md:flex items-center gap-3 flex-1 min-w-0">
                  {info?.vpn_status && (
                    <span
                      className={`flex items-center gap-1 text-xs font-medium ${
                        info.vpn_status === "running"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {info.vpn_status === "running" ? (
                        <Wifi className="w-3 h-3" />
                      ) : (
                        <WifiOff className="w-3 h-3" />
                      )}
                    </span>
                  )}
                  {info?.public_ip && (
                    <span className="flex items-center gap-1 text-xs text-vpn-muted">
                      <Globe className="w-3 h-3 text-vpn-primary" />
                      <span className="font-mono text-vpn-primary">
                        {info.public_ip}
                      </span>
                    </span>
                  )}
                  {(info?.country || serverLocation) && (
                    <span className="text-xs text-vpn-muted truncate">
                      {info?.country || serverLocation}
                    </span>
                  )}
                </div>

                {/* Ports */}
                <div className="hidden lg:flex items-center gap-2 flex-shrink-0">
                  <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded font-mono">
                    :{c.port_http_proxy}
                  </span>
                  <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded font-mono">
                    :{c.port_shadowsocks}
                  </span>
                </div>

                {/* Actions */}
                <div
                  className="flex items-center gap-1 flex-shrink-0 ml-auto"
                  onClick={(e) => e.stopPropagation()}
                >
                  {isStopped && (
                    <button
                      onClick={() => handleAction(c.id, "start")}
                      disabled={!!actionLoading}
                      className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90 disabled:opacity-50"
                      title="Start"
                    >
                      <Play
                        className={`w-4 h-4 ${actionLoading === `${c.id}-start` ? "animate-pulse" : ""}`}
                      />
                    </button>
                  )}
                  {isRunning && (
                    <button
                      onClick={() => handleAction(c.id, "stop")}
                      disabled={!!actionLoading}
                      className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90 disabled:opacity-50"
                      title="Stop"
                    >
                      <Square
                        className={`w-4 h-4 ${actionLoading === `${c.id}-stop` ? "animate-pulse" : ""}`}
                      />
                    </button>
                  )}
                  <button
                    onClick={() => handleAction(c.id, "restart")}
                    disabled={!!actionLoading}
                    className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90 disabled:opacity-50"
                    title="Restart"
                  >
                    <RotateCcw
                      className={`w-4 h-4 ${actionLoading === `${c.id}-restart` ? "animate-spin" : ""}`}
                    />
                  </button>
                  <button
                    onClick={() => handleDelete(c.id, c.name)}
                    disabled={!!actionLoading}
                    className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all active:scale-90 disabled:opacity-50"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
