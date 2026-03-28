import { useState, useEffect, useCallback } from "react";
import {
  Boxes,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Shield,
  AlertTriangle,
  Box,
  Image,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";

export default function O11() {
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");

  const fetchContainers = useCallback(async () => {
    try {
      const res = await api.get("/containers/dependents");
      const all = Array.isArray(res.data) ? res.data : [];
      setContainers(all.filter((c) => /o11/i.test(c.name)));
    } catch {
      setContainers([]);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    const interval = setInterval(fetchContainers, 15000);
    return () => clearInterval(interval);
  }, [fetchContainers]);

  const handleAction = async (name, action) => {
    setActionLoading(`${name}-${action}`);
    try {
      const res = await api.post(`/containers/dependents/${name}/${action}`);
      toast.success(res.data?.message || `${name} ${action}ed`);
      fetchContainers();
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

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white">O11 Overview</h1>
          <p className="text-vpn-muted mt-1">Your O11 & O11 Pro containers</p>
        </div>
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
      </div>

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-4 gap-4 mb-8">
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-vpn-primary/10">
            <Boxes className="w-6 h-6 text-vpn-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{containers.length}</p>
            <p className="text-sm text-vpn-muted">Total</p>
          </div>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-emerald-500/10">
            <Play className="w-6 h-6 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{running}</p>
            <p className="text-sm text-vpn-muted">Running</p>
          </div>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-amber-500/10">
            <AlertTriangle className="w-6 h-6 text-amber-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{stopped}</p>
            <p className="text-sm text-vpn-muted">Stopped</p>
          </div>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4">
          <div className="p-3 rounded-lg bg-blue-500/10">
            <Shield className="w-6 h-6 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{vpnConnected}</p>
            <p className="text-sm text-vpn-muted">VPN Routed</p>
          </div>
        </div>
      </div>

      {/* Container Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Boxes className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No O11 containers found
          </h3>
          <p className="text-vpn-muted">
            Docker containers with &quot;o11&quot; in their name will appear
            here.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {containers.map((dep) => {
            const isRunning = ["running", "healthy"].includes(dep.status);
            const isStopped = ["exited", "created", "dead"].includes(
              dep.status,
            );
            return (
              <div
                key={dep.id}
                className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all group"
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
                {dep.vpn_parent && (
                  <div className="bg-blue-500/5 border border-blue-500/20 rounded-lg px-3 py-2.5 mb-3">
                    <div className="flex items-center gap-2">
                      <Shield className="w-3.5 h-3.5 text-blue-400" />
                      <span className="text-xs text-blue-400 font-medium">
                        VPN Routed
                      </span>
                    </div>
                    <p className="text-sm text-white font-medium mt-1 truncate">
                      {dep.vpn_parent}
                    </p>
                  </div>
                )}

                {!dep.vpn_parent && (
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
                <div className="flex items-center gap-2 pt-3 border-t border-vpn-border">
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
