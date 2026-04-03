import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Shield,
  AlertTriangle,
  Box,
  Eye,
  Image,
  Wifi,
  WifiOff,
  Globe,
  MapPin,
  ArrowUpDown,
  Search,
  Network,
  HardDrive,
  PlusCircle,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function O11() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    o11Containers: containers,
    containers: managedContainers,
    vpnInfoMap,
    loading,
    refreshO11Containers,
    refreshAll,
    proxyCount,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(null);

  const getVpnInfoForParent = useCallback(
    (vpnParent) => {
      if (!vpnParent) return null;
      const mc = managedContainers.find(
        (m) =>
          m.docker_name === vpnParent ||
          `gluetun-${m.name}` === vpnParent ||
          m.name === vpnParent,
      );
      if (!mc) return null;
      return vpnInfoMap[String(mc.id)] || null;
    },
    [managedContainers, vpnInfoMap],
  );

  const handleAction = async (name, action) => {
    setActionLoading(`${name}-${action}`);
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

  const handleDelete = async (name) => {
    const ok = await confirm({
      title: "Delete Container",
      message: `Delete container "${name}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading(`${name}-delete`);
    try {
      await api.delete(`/containers/dependents/${name}`);
      toast.success(`Container "${name}" deleted`);
      refreshO11Containers();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to delete ${name}`);
    } finally {
      setActionLoading("");
    }
  };

  const isProxied = (c) =>
    !c.vpn_parent &&
    (c.networks || []).some((n) => n.toLowerCase().includes("proxy"));

  const running = containers.filter((d) =>
    ["running", "healthy"].includes(d.status),
  ).length;
  const stopped = containers.filter((d) =>
    ["exited", "dead", "created"].includes(d.status),
  ).length;
  const vpnConnected = containers.filter((d) => d.vpn_parent).length;
  const proxyConnected = containers.filter((d) => isProxied(d)).length;

  const matchesFilter = (status) => {
    if (!statusFilter) return true;
    if (statusFilter === "running")
      return ["running", "healthy"].includes(status);
    if (statusFilter === "stopped")
      return ["exited", "dead", "created"].includes(status);
    if (statusFilter === "vpn") return true;
    if (statusFilter === "proxied") return true;
    return true;
  };

  const filteredContainers = containers.filter(
    (c) =>
      matchesFilter(c.status) &&
      (statusFilter !== "vpn" || c.vpn_parent) &&
      (statusFilter !== "proxied" || isProxied(c)) &&
      (searchQuery === "" ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.image?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_parent?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const stats = [
    {
      label: "Total",
      value: containers.length,
      icon: Boxes,
      color: "text-vpn-primary",
      bg: "bg-vpn-primary/10",
      filter: null,
    },
    {
      label: "Running",
      value: running,
      icon: Play,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      filter: "running",
    },
    {
      label: "Stopped",
      value: stopped,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      filter: "stopped",
    },
    {
      label: "VPN Routed",
      value: vpnConnected,
      icon: Shield,
      color: "text-blue-400",
      bg: "bg-blue-500/10",
      filter: "vpn",
    },
    {
      label: "Proxy Connected",
      value: proxyConnected,
      icon: Globe,
      color: "text-purple-400",
      bg: "bg-purple-500/10",
      filter: "proxied",
    },
    {
      label: "Proxied",
      value: proxyCount,
      icon: Network,
      color: "text-cyan-400",
      bg: "bg-cyan-500/10",
      filter: null,
    },
  ];

  const renderContainerCard = (dep, isRunning, isStopped, parentInfo) => (
    <div
      key={dep.id}
      onClick={() => navigate(`/o11/${encodeURIComponent(dep.name)}`)}
      className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all group cursor-pointer"
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <h3 className="text-lg font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
            {dep.name}
          </h3>
          {dep.description && (
            <p className="text-xs text-vpn-muted mt-0.5 truncate">
              {dep.description}
            </p>
          )}
        </div>
        <StatusBadge status={dep.status} />
      </div>

      {/* Image Info */}
      <div className="bg-vpn-input/50 rounded-lg p-3 mb-3 space-y-2">
        <div className="flex items-center gap-2 text-sm">
          <Image className="w-3.5 h-3.5 text-vpn-primary flex-shrink-0" />
          <span className="text-vpn-text font-mono text-xs truncate">
            {dep.image}
          </span>
        </div>
        <div className="flex items-center gap-2 text-sm">
          <Box className="w-3.5 h-3.5 text-vpn-muted flex-shrink-0" />
          <span className="text-vpn-muted font-mono text-xs truncate">
            {dep.container_id ? dep.container_id.substring(0, 12) : dep.id}
          </span>
        </div>
      </div>

      {/* VPN / Proxy Connection */}
      {dep.vpn_parent ? (
        <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2.5 mb-3 space-y-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <Shield className="w-3.5 h-3.5 text-blue-400" />
              <span className="text-xs text-blue-400 font-medium">
                VPN Routed
              </span>
              <span className="text-xs text-white font-medium truncate">
                via {dep.vpn_parent}
              </span>
            </div>
            {parentInfo?.vpn_status && (
              <span
                className={`flex items-center gap-1 text-xs font-medium ${
                  parentInfo.vpn_status === "running"
                    ? "text-emerald-400"
                    : "text-red-400"
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
          </div>
          {parentInfo && (
            <div className="flex items-center gap-3 flex-wrap">
              {parentInfo.public_ip && (
                <span className="flex items-center gap-1 text-xs">
                  <Globe className="w-3 h-3 text-vpn-primary" />
                  <span className="text-vpn-primary font-mono">
                    {parentInfo.public_ip}
                  </span>
                </span>
              )}
              {(parentInfo.country || parentInfo.region) && (
                <span className="flex items-center gap-1 text-xs text-vpn-muted">
                  <MapPin className="w-3 h-3" />
                  {[parentInfo.region, parentInfo.country]
                    .filter(Boolean)
                    .join(", ")}
                </span>
              )}
              {parentInfo.port_forwarded && (
                <span className="flex items-center gap-1 text-xs text-amber-400">
                  <ArrowUpDown className="w-3 h-3" />
                  <span className="font-mono">{parentInfo.port_forwarded}</span>
                </span>
              )}
            </div>
          )}
        </div>
      ) : isProxied(dep) ? (
        <div className="bg-purple-500/5 border border-purple-500/20 rounded-lg px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Globe className="w-3.5 h-3.5 text-purple-400" />
            <span className="text-xs text-purple-400 font-medium">
              Proxy Connected
            </span>
            <span className="text-xs text-vpn-muted font-mono">
              {(dep.networks || []).find((n) =>
                n.toLowerCase().includes("proxy"),
              ) || "proxy"}
            </span>
          </div>
        </div>
      ) : (
        <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-lg px-3 py-2.5 mb-3">
          <div className="flex items-center gap-2">
            <Shield className="w-3.5 h-3.5 text-vpn-muted" />
            <span className="text-xs text-vpn-muted">No VPN connection</span>
          </div>
        </div>
      )}

      {/* Ports & Network */}
      {(Object.keys(dep.ports || {}).length > 0 || dep.network_mode) && (
        <div className="grid grid-cols-2 gap-2 mb-3">
          {Object.entries(dep.ports || {}).map(([internal, host]) => {
            const [cPort, proto] = internal.split("/");
            return (
              <div
                key={internal}
                className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50"
              >
                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase mb-1">
                  {proto || "tcp"}
                </span>
                <p className="text-sm font-mono text-white">
                  <span className="text-vpn-primary">{host || "—"}</span>
                  <span className="text-vpn-muted mx-1">→</span>
                  {cPort}
                </p>
                <p className="text-[10px] text-vpn-muted mt-0.5">
                  host → container
                </p>
              </div>
            );
          })}
          {dep.network_mode &&
            !dep.network_mode.startsWith("container:") &&
            dep.network_mode !== "default" && (
              <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50">
                <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5">
                  Network
                </p>
                <p className="text-sm text-vpn-text truncate">
                  {dep.network_mode}
                </p>
              </div>
            )}
          {dep.mounts_count > 0 && (
            <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50">
              <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5">
                Volumes
              </p>
              <p className="text-sm text-vpn-text">
                {dep.mounts_count} mount{dep.mounts_count !== 1 ? "s" : ""}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Actions */}
      <div
        className="flex items-center gap-2 pt-3 border-t border-vpn-border"
        onClick={(e) => e.stopPropagation()}
      >
        <button
          onClick={() => navigate(`/o11/${encodeURIComponent(dep.name)}`)}
          className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-all active:scale-90"
          title="Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isStopped && (
          <button
            onClick={() => handleAction(dep.name, "start")}
            disabled={!!actionLoading}
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90 disabled:opacity-50"
            title="Start"
          >
            <Play
              className={`w-4 h-4 ${actionLoading === `${dep.name}-start` ? "animate-pulse" : ""}`}
            />
          </button>
        )}
        {isRunning && (
          <button
            onClick={() => handleAction(dep.name, "stop")}
            disabled={!!actionLoading}
            className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90 disabled:opacity-50"
            title="Stop"
          >
            <Square
              className={`w-4 h-4 ${actionLoading === `${dep.name}-stop` ? "animate-pulse" : ""}`}
            />
          </button>
        )}
        <button
          onClick={() => handleAction(dep.name, "restart")}
          disabled={!!actionLoading}
          className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90 disabled:opacity-50"
          title="Restart"
        >
          <RotateCcw
            className={`w-4 h-4 ${actionLoading === `${dep.name}-restart` ? "animate-spin" : ""}`}
          />
        </button>
        <button
          onClick={() => handleDelete(dep.name)}
          disabled={!!actionLoading}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all active:scale-90 disabled:opacity-50 ml-auto"
          title="Delete"
        >
          <Trash2
            className={`w-4 h-4 ${actionLoading === `${dep.name}-delete` ? "animate-pulse" : ""}`}
          />
        </button>
      </div>
    </div>
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Boxes className="w-7 h-7 text-vpn-primary" />
            O11 Overview
          </h1>
          <p className="text-vpn-muted mt-1">Your o11 Pro containers</p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setDiscovering(true);
              try {
                await refreshO11Containers();
                toast.success("O11 containers discovered");
              } catch {
                toast.error("Failed to discover containers");
              } finally {
                setDiscovering(false);
              }
            }}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search
              className={`w-4 h-4 text-vpn-primary ${discovering ? "animate-spin" : ""}`}
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
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => navigate("/create-o11")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-vpn-primary" />
            New O11
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, filter }) => (
          <div
            key={label}
            onClick={() =>
              filter !== null
                ? setStatusFilter(statusFilter === filter ? null : filter)
                : undefined
            }
            className={`bg-vpn-card border rounded-xl p-4 ${filter !== null ? "cursor-pointer" : ""} transition-all hover:border-vpn-muted ${
              statusFilter === filter && filter !== null
                ? "border-vpn-primary ring-1 ring-vpn-primary/30"
                : "border-vpn-border"
            }`}
          >
            <div className="flex items-center gap-2 mb-2">
              <div className={`p-1.5 rounded-md ${bg}`}>
                <Icon className={`w-3.5 h-3.5 ${color}`} />
              </div>
              <p className="text-[11px] font-semibold text-vpn-muted uppercase tracking-wider truncate">
                {label}
              </p>
            </div>
            <p className="text-2xl font-bold text-white pl-0.5">{value}</p>
          </div>
        ))}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
        <input
          type="text"
          placeholder="Search O11 containers..."
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
      ) : filteredContainers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Boxes className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            {searchQuery || statusFilter
              ? "No matching containers"
              : "No O11 containers found"}
          </h3>
          <p className="text-vpn-muted">
            {searchQuery || statusFilter
              ? "Try adjusting your search or filter."
              : 'Docker containers with "o11" in their name will appear here.'}
          </p>
        </div>
      ) : (
        <div className="space-y-8">
          {/* VPN Connected Containers */}
          {filteredContainers.filter((c) => c.vpn_parent).length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Shield className="w-5 h-5 text-vpn-primary" />
                  <h2 className="text-lg font-semibold text-white">
                    VPN Connected
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                  {filteredContainers.filter((c) => c.vpn_parent).length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredContainers
                  .filter((c) => c.vpn_parent)
                  .map((dep) => {
                    const isRunning = ["running", "healthy"].includes(
                      dep.status,
                    );
                    const isStopped = ["exited", "created", "dead"].includes(
                      dep.status,
                    );
                    const parentInfo = getVpnInfoForParent(dep.vpn_parent);
                    return renderContainerCard(
                      dep,
                      isRunning,
                      isStopped,
                      parentInfo,
                    );
                  })}
              </div>
            </div>
          )}

          {/* Proxy Connected Containers */}
          {filteredContainers.filter((c) => isProxied(c)).length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Globe className="w-5 h-5 text-purple-400" />
                  <h2 className="text-lg font-semibold text-white">
                    Proxy Connected
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20">
                  {filteredContainers.filter((c) => isProxied(c)).length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredContainers
                  .filter((c) => isProxied(c))
                  .map((dep) => {
                    const isRunning = ["running", "healthy"].includes(
                      dep.status,
                    );
                    const isStopped = ["exited", "created", "dead"].includes(
                      dep.status,
                    );
                    return renderContainerCard(dep, isRunning, isStopped, null);
                  })}
              </div>
            </div>
          )}

          {/* Non-VPN Non-Proxy Containers */}
          {filteredContainers.filter((c) => !c.vpn_parent && !isProxied(c))
            .length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <div className="flex items-center gap-2">
                  <Boxes className="w-5 h-5 text-vpn-primary" />
                  <h2 className="text-lg font-semibold text-white">
                    No VPN Connection
                  </h2>
                </div>
                <span className="px-2.5 py-0.5 rounded-full text-xs font-medium bg-vpn-input text-vpn-muted border border-vpn-border">
                  {
                    filteredContainers.filter(
                      (c) => !c.vpn_parent && !isProxied(c),
                    ).length
                  }
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {filteredContainers
                  .filter((c) => !c.vpn_parent && !isProxied(c))
                  .map((dep) => {
                    const isRunning = ["running", "healthy"].includes(
                      dep.status,
                    );
                    const isStopped = ["exited", "created", "dead"].includes(
                      dep.status,
                    );
                    return renderContainerCard(dep, isRunning, isStopped, null);
                  })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
