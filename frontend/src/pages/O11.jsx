import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Boxes,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
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
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function O11() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    o11Containers: containers,
    containers: managedContainers,
    vpnInfoMap,
    loading,
    refreshO11Containers,
    refreshAll,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
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

  const running = containers.filter((d) =>
    ["running", "healthy"].includes(d.status),
  ).length;
  const stopped = containers.filter((d) =>
    ["exited", "dead", "created"].includes(d.status),
  ).length;
  const vpnConnected = containers.filter((d) => d.vpn_parent).length;

  const matchesFilter = (status) => {
    if (!statusFilter) return true;
    if (statusFilter === "running")
      return ["running", "healthy"].includes(status);
    if (statusFilter === "stopped")
      return ["exited", "dead", "created"].includes(status);
    if (statusFilter === "vpn") return true;
    return true;
  };

  const filteredContainers = containers.filter(
    (c) =>
      matchesFilter(c.status) &&
      (statusFilter !== "vpn" || c.vpn_parent) &&
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
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">O11 Overview</h1>
          <p className="text-vpn-muted mt-1">Your o11 Pro containers</p>
        </div>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, filter }) => (
          <div
            key={label}
            onClick={() =>
              setStatusFilter(statusFilter === filter ? null : filter)
            }
            className={`bg-vpn-card border rounded-xl p-5 flex items-center gap-4 cursor-pointer transition-all hover:border-vpn-muted ${
              statusFilter === filter
                ? "border-vpn-primary ring-1 ring-vpn-primary/30"
                : "border-vpn-border"
            }`}
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
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {filteredContainers.map((dep) => {
            const isRunning = ["running", "healthy"].includes(dep.status);
            const isStopped = ["exited", "created", "dead"].includes(
              dep.status,
            );
            const parentInfo = getVpnInfoForParent(dep.vpn_parent);
            return (
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
                      {dep.container_id
                        ? dep.container_id.substring(0, 12)
                        : dep.id}
                    </span>
                  </div>
                </div>

                {/* VPN Connection */}
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
                            <span className="font-mono">
                              {parentInfo.port_forwarded}
                            </span>
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-lg px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-vpn-muted" />
                      <span className="text-xs text-vpn-muted">
                        No VPN connection
                      </span>
                    </div>
                  </div>
                )}

                {/* Actions */}
                <div
                  className="flex items-center gap-2 pt-3 border-t border-vpn-border"
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
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
