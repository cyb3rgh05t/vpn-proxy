import { useState, useCallback, useMemo } from "react";
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
  ArrowUpDown,
  MapPin,
  Eye,
  Boxes,
  Box,
  Image,
  Copy,
  Check,
  Layers,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    containers,
    vpnInfoMap,
    depsMap,
    o11Containers,
    loading,
    error,
    refreshContainers,
    refreshO11Containers,
    refreshAll,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);
  const [copiedUrl, setCopiedUrl] = useState(null);

  const copyToClipboard = useCallback(
    (url) => {
      try {
        if (navigator.clipboard && window.isSecureContext) {
          navigator.clipboard.writeText(url);
        } else {
          const ta = document.createElement("textarea");
          ta.value = url;
          ta.style.position = "fixed";
          ta.style.left = "-9999px";
          document.body.appendChild(ta);
          ta.select();
          document.execCommand("copy");
          document.body.removeChild(ta);
        }
        setCopiedUrl(url);
        toast.success("Proxy URL copied!");
        setTimeout(() => setCopiedUrl(null), 2000);
      } catch {
        toast.error("Failed to copy URL");
      }
    },
    [toast],
  );

  const getVpnInfoForParent = useCallback(
    (vpnParent) => {
      if (!vpnParent) return null;
      const mc = containers.find(
        (m) =>
          m.docker_name === vpnParent ||
          `gluetun-${m.name}` === vpnParent ||
          m.name === vpnParent,
      );
      if (!mc) return null;
      return vpnInfoMap[String(mc.id)] || null;
    },
    [containers, vpnInfoMap],
  );

  const [actionLoading, setActionLoading] = useState("");

  // --- Gluetun stats ---
  const gluetunRunning = containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const gluetunUnhealthy = containers.filter(
    (c) => c.status === "unhealthy",
  ).length;
  const gluetunStopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  // --- O11 stats ---
  const o11Running = o11Containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const o11Unhealthy = o11Containers.filter(
    (c) => c.status === "unhealthy",
  ).length;
  const o11Stopped = o11Containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  // --- Provider overview ---
  const providerStats = useMemo(() => {
    const map = {};
    for (const c of containers) {
      const p = c.vpn_provider || "unknown";
      if (!map[p]) map[p] = { total: 0, connected: 0, types: new Set() };
      map[p].total++;
      if (c.vpn_type) map[p].types.add(c.vpn_type);
      const info = vpnInfoMap[String(c.id)];
      if (info?.vpn_status === "running") map[p].connected++;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name,
        ...data,
        types: [...data.types],
      }));
  }, [containers, vpnInfoMap]);

  // --- VPN connections overview ---
  const vpnConnections = useMemo(() => {
    return containers
      .map((c) => {
        const info = vpnInfoMap[String(c.id)];
        const deps = depsMap[c.id] || [];
        return {
          id: c.id,
          name: c.name,
          provider: c.vpn_provider,
          vpnType: c.vpn_type,
          status: c.status,
          vpnStatus: info?.vpn_status,
          publicIp: info?.public_ip,
          country: info?.country,
          region: info?.region,
          portForwarded: info?.port_forwarded,
          location:
            c.config?.SERVER_COUNTRIES ||
            c.config?.SERVER_CITIES ||
            c.config?.SERVER_REGIONS,
          depCount: deps.length,
        };
      })
      .filter(
        (c) =>
          ["running", "healthy", "unhealthy", "starting"].includes(c.status) &&
          c.vpnStatus,
      );
  }, [containers, vpnInfoMap, depsMap]);

  const handleO11Action = async (name, action) => {
    setActionLoading(`o11-${name}-${action}`);
    try {
      const res = await api.post(`/containers/dependents/${name}/${action}`);
      toast.success(res.data?.message || `${name} ${action}ed`);
      refreshO11Containers();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action} ${name}`);
    } finally {
      setActionLoading("");
    }
  };

  const handleAction = async (id, action) => {
    setActionLoading(`${id}-${action}`);
    try {
      const res = await api.post(`/containers/${id}/${action}`);
      toast.success(res.data?.message || `Container ${action}ed`);
      refreshContainers();
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
      refreshContainers();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const matchesFilter = (status) => {
    if (!statusFilter) return true;
    if (statusFilter === "running")
      return ["running", "healthy"].includes(status);
    if (statusFilter === "unhealthy") return status === "unhealthy";
    if (statusFilter === "stopped")
      return ["exited", "dead", "removed", "created"].includes(status);
    return true;
  };

  const filteredContainers = containers.filter(
    (c) =>
      matchesFilter(c.status) &&
      (searchQuery === "" ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_provider?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const filteredO11 = o11Containers.filter(
    (c) =>
      matchesFilter(c.status) &&
      (searchQuery === "" ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const StatCard = ({
    label,
    value,
    icon: Icon,
    color,
    bg,
    active,
    onClick,
  }) => (
    <div
      onClick={onClick}
      className={`bg-vpn-card border rounded-xl p-4 flex items-center gap-3 cursor-pointer transition-all hover:border-vpn-muted ${
        active
          ? "border-vpn-primary ring-1 ring-vpn-primary/30"
          : "border-vpn-border"
      }`}
    >
      <div className={`p-2.5 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-vpn-muted">{label}</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
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
                refreshContainers();
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
              await refreshAll();
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

      {/* Stats: Gluetun + O11 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Gluetun Stats */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-vpn-primary" />
            <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider">
              Gluetun VPN
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total"
              value={containers.length}
              icon={Server}
              color="text-vpn-primary"
              bg="bg-vpn-primary/10"
              active={statusFilter === null}
              onClick={() => setStatusFilter(null)}
            />
            <StatCard
              label="Running"
              value={gluetunRunning}
              icon={Activity}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
              active={statusFilter === "running"}
              onClick={() =>
                setStatusFilter(statusFilter === "running" ? null : "running")
              }
            />
            <StatCard
              label="Unhealthy"
              value={gluetunUnhealthy}
              icon={HeartCrack}
              color="text-red-400"
              bg="bg-red-500/10"
              active={statusFilter === "unhealthy"}
              onClick={() =>
                setStatusFilter(
                  statusFilter === "unhealthy" ? null : "unhealthy",
                )
              }
            />
            <StatCard
              label="Stopped"
              value={gluetunStopped}
              icon={AlertTriangle}
              color="text-amber-400"
              bg="bg-amber-500/10"
              active={statusFilter === "stopped"}
              onClick={() =>
                setStatusFilter(statusFilter === "stopped" ? null : "stopped")
              }
            />
          </div>
        </div>

        {/* O11 Stats */}
        {o11Containers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="w-4 h-4 text-vpn-primary" />
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider">
                O11 Containers
              </h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={o11Containers.length}
                icon={Boxes}
                color="text-vpn-primary"
                bg="bg-vpn-primary/10"
                active={false}
                onClick={() => {}}
              />
              <StatCard
                label="Running"
                value={o11Running}
                icon={Activity}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                active={false}
                onClick={() => {}}
              />
              <StatCard
                label="Unhealthy"
                value={o11Unhealthy}
                icon={HeartCrack}
                color="text-red-400"
                bg="bg-red-500/10"
                active={false}
                onClick={() => {}}
              />
              <StatCard
                label="Stopped"
                value={o11Stopped}
                icon={AlertTriangle}
                color="text-amber-400"
                bg="bg-amber-500/10"
                active={false}
                onClick={() => {}}
              />
            </div>
          </div>
        )}
      </div>

      {/* Provider Overview + VPN Connections */}
      {containers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Provider Overview */}
          <div className="bg-vpn-card border border-vpn-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Layers className="w-4 h-4 text-vpn-primary" />
              <h3 className="text-sm font-semibold text-white">
                VPN Providers
              </h3>
            </div>
            {providerStats.length === 0 ? (
              <p className="text-sm text-vpn-muted">No providers</p>
            ) : (
              <div className="space-y-3">
                {providerStats.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium capitalize truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-vpn-muted">
                          {p.types.join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-emerald-400 font-medium">
                        {p.connected}/{p.total}
                      </span>
                      <div className="w-16 h-1.5 bg-vpn-input rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${p.total > 0 ? (p.connected / p.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VPN Connections Overview */}
          <div className="lg:col-span-2 bg-vpn-card border border-vpn-border rounded-xl p-5">
            <div className="flex items-center gap-2 mb-4">
              <Globe className="w-4 h-4 text-vpn-primary" />
              <h3 className="text-sm font-semibold text-white">
                Active VPN Connections
              </h3>
              <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-0.5 rounded-full ml-auto">
                {vpnConnections.length} active
              </span>
            </div>
            {vpnConnections.length === 0 ? (
              <p className="text-sm text-vpn-muted py-4 text-center">
                No active VPN connections
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-vpn-muted uppercase tracking-wider border-b border-vpn-border">
                      <th className="text-left pb-2 pr-4">Container</th>
                      <th className="text-left pb-2 pr-4">Provider</th>
                      <th className="text-left pb-2 pr-4">Status</th>
                      <th className="text-left pb-2 pr-4">Public IP</th>
                      <th className="text-left pb-2 pr-4">Location</th>
                      <th className="text-right pb-2">Clients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vpn-border/50">
                    {vpnConnections.map((conn) => (
                      <tr
                        key={conn.id}
                        onClick={() => navigate(`/containers/${conn.id}`)}
                        className="hover:bg-vpn-input/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 pr-4">
                          <span className="text-white font-medium">
                            {conn.name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs text-purple-400 capitalize">
                            {conn.provider}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              conn.vpnStatus === "running"
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {conn.vpnStatus === "running" ? (
                              <Wifi className="w-3 h-3" />
                            ) : (
                              <WifiOff className="w-3 h-3" />
                            )}
                            {conn.vpnStatus === "running"
                              ? "Connected"
                              : "Disconnected"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs text-vpn-primary font-mono">
                            {conn.publicIp || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-4">
                          <span className="text-xs text-vpn-muted">
                            {conn.country || conn.location || "—"}
                            {conn.region && (
                              <span className="text-vpn-muted/50">
                                {" "}
                                · {conn.region}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 text-right">
                          {conn.depCount > 0 ? (
                            <span className="inline-flex items-center gap-1 text-xs text-blue-400">
                              <Network className="w-3 h-3" />
                              {conn.depCount}
                            </span>
                          ) : (
                            <span className="text-xs text-vpn-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
        <input
          type="text"
          placeholder="Search containers, providers, types..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-vpn-card border border-vpn-border rounded-lg text-sm text-vpn-text placeholder-vpn-muted focus:outline-none focus:border-vpn-primary transition-colors"
        />
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
            onClick={refreshContainers}
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
        <>
          <div className="flex items-center gap-3 mb-4">
            <Shield className="w-5 h-5 text-vpn-primary" />
            <h2 className="text-lg font-semibold text-white">
              Gluetun VPN Containers
            </h2>
            <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-1 rounded-full">
              {filteredContainers.length}
            </span>
          </div>
          <div className="space-y-3">
            {filteredContainers.map((c) => {
              const info = vpnInfoMap[String(c.id)];
              const deps = depsMap[c.id] || [];
              const isRunning = [
                "running",
                "healthy",
                "unhealthy",
                "starting",
              ].includes(c.status);
              const isStopped = [
                "exited",
                "created",
                "removed",
                "dead",
              ].includes(c.status);
              const serverLocation =
                c.config?.SERVER_COUNTRIES ||
                c.config?.SERVER_CITIES ||
                c.config?.SERVER_REGIONS ||
                null;
              return (
                <div
                  key={c.id}
                  onClick={() => navigate(`/containers/${c.id}`)}
                  className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all cursor-pointer group"
                >
                  {/* Row 1: Header */}
                  <div className="flex items-center gap-4 mb-3">
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
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
                          {c.name}
                        </h3>
                        {c.description && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-vpn-primary/15 text-vpn-primary border border-vpn-primary/30 truncate max-w-[160px]">
                            {c.description}
                          </span>
                        )}
                        {c.vpn_provider && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-purple-500/15 text-purple-400 border border-purple-500/30 capitalize">
                            {c.vpn_provider}
                          </span>
                        )}
                        {c.vpn_type && (
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium bg-cyan-500/15 text-cyan-400 border border-cyan-500/30 capitalize">
                            {c.vpn_type}
                          </span>
                        )}
                      </div>
                    </div>
                    <StatusBadge status={c.status} />
                    {/* Actions */}
                    <div
                      className="flex items-center gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() => navigate(`/containers/${c.id}`)}
                        className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-all active:scale-90"
                        title="Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
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

                  {/* Row 2: VPN + Ports Info */}
                  <div className="flex items-center gap-3 flex-wrap mb-3">
                    {/* VPN Status */}
                    {info?.vpn_status && (
                      <span
                        className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                          info.vpn_status === "running"
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {info.vpn_status === "running" ? (
                          <Wifi className="w-3 h-3" />
                        ) : (
                          <WifiOff className="w-3 h-3" />
                        )}
                        {info.vpn_status === "running"
                          ? "Connected"
                          : "Disconnected"}
                      </span>
                    )}
                    {/* Public IP */}
                    {info?.public_ip && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-vpn-input text-vpn-primary font-mono">
                        <Globe className="w-3 h-3" />
                        {info.public_ip}
                      </span>
                    )}
                    {/* Location */}
                    {(info?.country || serverLocation) && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-vpn-input text-vpn-muted">
                        <MapPin className="w-3 h-3" />
                        {info?.country || serverLocation}
                        {info?.region && (
                          <span className="text-vpn-muted/60">
                            · {info.region}
                          </span>
                        )}
                      </span>
                    )}
                    {/* Port Forwarding */}
                    {info?.port_forwarded && (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-amber-500/10 text-amber-400 font-mono">
                        <ArrowUpDown className="w-3 h-3" />
                        {info.port_forwarded}
                      </span>
                    )}
                  </div>

                  {/* Row 3: Proxy URLs + Ports + Network + Dependents */}
                  <div className="flex items-center gap-2 flex-wrap">
                    {c.config?.HTTPPROXY?.toLowerCase() === "on" && (
                      <>
                        <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded font-mono border border-vpn-border/50">
                          HTTP :{c.port_http_proxy}
                        </span>
                        {c.ip_address && (
                          <button
                            onClick={(e) => {
                              e.stopPropagation();
                              const user = c.config?.HTTPPROXY_USER;
                              const pass = c.config?.HTTPPROXY_PASSWORD;
                              const auth =
                                user && pass ? `${user}:${pass}@` : "";
                              const url = `http://${auth}${c.ip_address}:${c.port_http_proxy}`;
                              copyToClipboard(url);
                            }}
                            className="inline-flex items-center gap-1 text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-1 rounded font-mono border border-emerald-500/20 hover:bg-emerald-500/20 transition-colors"
                            title="Copy HTTP Proxy URL"
                          >
                            {copiedUrl?.includes(`:${c.port_http_proxy}`) ? (
                              <Check className="w-3 h-3" />
                            ) : (
                              <Copy className="w-3 h-3" />
                            )}
                            http://{c.ip_address}:{c.port_http_proxy}
                          </button>
                        )}
                      </>
                    )}
                    {c.config?.SHADOWSOCKS?.toLowerCase() === "on" && (
                      <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded font-mono border border-vpn-border/50">
                        SS :{c.port_shadowsocks}
                      </span>
                    )}
                    {c.extra_ports?.length > 0 && (
                      <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded border border-vpn-border/50">
                        +{c.extra_ports.length} ports
                      </span>
                    )}
                    {c.network_name && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded border border-vpn-border/50">
                        <Network className="w-3 h-3" />
                        {c.network_name}
                      </span>
                    )}
                    {deps.length > 0 && (
                      <span className="inline-flex items-center gap-1 text-[10px] text-blue-400 bg-blue-500/10 px-2 py-1 rounded border border-blue-500/20">
                        <Network className="w-3 h-3" />
                        {deps.length} client{deps.length !== 1 ? "s" : ""}
                        <span className="text-blue-400/60 ml-1">
                          (
                          {deps
                            .slice(0, 3)
                            .map((d) => d.name)
                            .join(", ")}
                          {deps.length > 3 ? ", ..." : ""})
                        </span>
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </>
      )}

      {/* O11 Containers Section */}
      {filteredO11.length > 0 && (
        <div className="mt-8">
          <div className="flex items-center gap-3 mb-4">
            <Boxes className="w-5 h-5 text-vpn-primary" />
            <h2 className="text-lg font-semibold text-white">O11 Containers</h2>
            <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-1 rounded-full">
              {filteredO11.length}
            </span>
          </div>
          <div className="space-y-3">
            {filteredO11.map((dep) => {
              const isRunning = ["running", "healthy"].includes(dep.status);
              const isStopped = ["exited", "created", "dead"].includes(
                dep.status,
              );
              const parentInfo = getVpnInfoForParent(dep.vpn_parent);
              return (
                <div
                  key={dep.id}
                  onClick={() =>
                    navigate(`/o11/${encodeURIComponent(dep.name)}`)
                  }
                  className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all group cursor-pointer"
                >
                  {/* Row 1: Header */}
                  <div className="flex items-center gap-4 mb-3">
                    <div
                      className={`w-3 h-3 rounded-full flex-shrink-0 ${
                        isRunning
                          ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                          : isStopped
                            ? "bg-red-500"
                            : "bg-amber-500"
                      }`}
                    />
                    <div className="min-w-0 flex-1">
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-base font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
                          {dep.name}
                        </h3>
                      </div>
                    </div>
                    <StatusBadge status={dep.status} />
                    {/* Actions */}
                    <div
                      className="flex items-center gap-1 flex-shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        onClick={() =>
                          navigate(`/o11/${encodeURIComponent(dep.name)}`)
                        }
                        className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-all active:scale-90"
                        title="Details"
                      >
                        <Eye className="w-4 h-4" />
                      </button>
                      {isStopped && (
                        <button
                          onClick={() => handleO11Action(dep.name, "start")}
                          disabled={!!actionLoading}
                          className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90 disabled:opacity-50"
                          title="Start"
                        >
                          <Play
                            className={`w-4 h-4 ${actionLoading === `o11-${dep.name}-start` ? "animate-pulse" : ""}`}
                          />
                        </button>
                      )}
                      {isRunning && (
                        <button
                          onClick={() => handleO11Action(dep.name, "stop")}
                          disabled={!!actionLoading}
                          className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90 disabled:opacity-50"
                          title="Stop"
                        >
                          <Square
                            className={`w-4 h-4 ${actionLoading === `o11-${dep.name}-stop` ? "animate-pulse" : ""}`}
                          />
                        </button>
                      )}
                      <button
                        onClick={() => handleO11Action(dep.name, "restart")}
                        disabled={!!actionLoading}
                        className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90 disabled:opacity-50"
                        title="Restart"
                      >
                        <RotateCcw
                          className={`w-4 h-4 ${actionLoading === `o11-${dep.name}-restart` ? "animate-spin" : ""}`}
                        />
                      </button>
                    </div>
                  </div>

                  {/* Row 2: Image + Container ID */}
                  <div className="flex items-center gap-4 flex-wrap mb-3">
                    <span className="inline-flex items-center gap-1 text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded border border-vpn-border/50 font-mono">
                      <Image className="w-3 h-3" />
                      {dep.image}
                    </span>
                    <span className="inline-flex items-center gap-1 text-[10px] text-vpn-muted bg-vpn-input px-2 py-1 rounded border border-vpn-border/50 font-mono">
                      <Box className="w-3 h-3" />
                      {dep.container_id
                        ? dep.container_id.substring(0, 12)
                        : dep.id}
                    </span>
                  </div>

                  {/* Row 3: VPN Info */}
                  <div className="flex items-center gap-3 flex-wrap">
                    {dep.vpn_parent ? (
                      <>
                        <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-blue-500/10 text-blue-400 font-medium">
                          <Shield className="w-3 h-3" />
                          via {dep.vpn_parent}
                        </span>
                        {parentInfo?.vpn_status && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs font-medium ${
                              parentInfo.vpn_status === "running"
                                ? "bg-emerald-500/10 text-emerald-400"
                                : "bg-red-500/10 text-red-400"
                            }`}
                          >
                            {parentInfo.vpn_status === "running" ? (
                              <Wifi className="w-3 h-3" />
                            ) : (
                              <WifiOff className="w-3 h-3" />
                            )}
                            {parentInfo.vpn_status === "running"
                              ? "Connected"
                              : "Disconnected"}
                          </span>
                        )}
                        {parentInfo?.public_ip && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-vpn-input text-vpn-primary font-mono">
                            <Globe className="w-3 h-3" />
                            {parentInfo.public_ip}
                          </span>
                        )}
                        {(parentInfo?.country || parentInfo?.region) && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-vpn-input text-vpn-muted">
                            <MapPin className="w-3 h-3" />
                            {[parentInfo?.region, parentInfo?.country]
                              .filter(Boolean)
                              .join(", ")}
                          </span>
                        )}
                        {parentInfo?.port_forwarded && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-amber-500/10 text-amber-400 font-mono">
                            <ArrowUpDown className="w-3 h-3" />
                            {parentInfo.port_forwarded}
                          </span>
                        )}
                      </>
                    ) : (
                      <span className="inline-flex items-center gap-1 px-2 py-1 rounded-lg text-xs bg-vpn-input/30 text-vpn-muted">
                        <Shield className="w-3 h-3" />
                        No VPN connection
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
}
