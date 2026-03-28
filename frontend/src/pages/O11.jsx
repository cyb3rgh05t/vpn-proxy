import { useState, useEffect, useCallback } from "react";
import {
  Boxes,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Shield,
  AlertTriangle,
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
      setContainers(Array.isArray(res.data) ? res.data : []);
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
          <p className="text-vpn-muted mt-1">
            All Docker containers on this host
          </p>
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
            <p className="text-2xl font-bold text-white">
              {containers.length}
            </p>
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

      {/* Container List */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Boxes className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No containers found
          </h3>
          <p className="text-vpn-muted">
            Other Docker containers on this host will appear here.
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {containers.map((dep) => {
            const isRunning = ["running", "healthy"].includes(dep.status);
            const isStopped = ["exited", "created", "dead"].includes(
              dep.status,
            );
            return (
              <div
                key={dep.id}
                className="bg-vpn-card border border-vpn-border rounded-xl p-4 flex items-center justify-between hover:border-vpn-muted transition-all"
              >
                <div className="flex items-center gap-4 min-w-0 flex-1">
                  <div
                    className={`w-3 h-3 rounded-full flex-shrink-0 ${
                      isRunning
                        ? "bg-emerald-500 shadow-lg shadow-emerald-500/30"
                        : isStopped
                          ? "bg-red-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <div className="min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <h3 className="text-sm font-semibold text-white truncate">
                        {dep.name}
                      </h3>
                      <StatusBadge status={dep.status} />
                      {dep.vpn_parent && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Shield className="w-3 h-3" />
                          {dep.vpn_parent}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-vpn-muted font-mono truncate max-w-[350px] mt-1">
                      {dep.image}
                    </p>
                  </div>
                </div>

                <div className="flex items-center gap-1 flex-shrink-0 ml-4">
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
