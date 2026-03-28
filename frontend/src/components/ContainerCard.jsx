import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  Eye,
  Network,
  Globe,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

export default function ContainerCard({ container, vpnInfo, onRefresh }) {
  const navigate = useNavigate();
  const toast = useToast();
  const [dependents, setDependents] = useState([]);
  const [actionLoading, setActionLoading] = useState("");

  const fetchDependents = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${container.id}/dependents`);
      setDependents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDependents([]);
    }
  }, [container.id]);

  useEffect(() => {
    fetchDependents();
    const interval = setInterval(fetchDependents, 15000);
    return () => clearInterval(interval);
  }, [fetchDependents]);

  const handleAction = async (e, action) => {
    e.stopPropagation();
    setActionLoading(action);
    try {
      const res = await api.post(`/containers/${container.id}/${action}`);
      toast.success(res.data?.message || `Container ${action}ed successfully`);
      onRefresh();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || `Failed to ${action} container`,
      );
    } finally {
      setActionLoading("");
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (
      !confirm(`Delete container "${container.name}"? This cannot be undone.`)
    )
      return;
    try {
      await api.delete(`/containers/${container.id}`);
      toast.success(`Container "${container.name}" deleted`);
      onRefresh();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete container");
    }
  };

  const handleDepAction = async (e, depName, action) => {
    e.stopPropagation();
    try {
      await api.post(
        `/containers/${container.id}/dependents/${depName}/${action}`,
      );
      toast.success(`${depName} ${action}ed successfully`);
      fetchDependents();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || `Failed to ${action} ${depName}`,
      );
    }
  };

  const isRunning = container.status === "running";
  const isStopped = ["exited", "created", "removed", "dead"].includes(
    container.status,
  );

  return (
    <div
      onClick={() => navigate(`/containers/${container.id}`)}
      className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-vpn-primary transition-colors">
            {container.name}
          </h3>
          {container.docker_name &&
            container.docker_name !== `gluetun-${container.name}` &&
            container.docker_name !== container.name && (
              <p className="text-xs text-amber-400/70 mt-0.5 truncate max-w-[200px] font-mono">
                {container.docker_name}
              </p>
            )}
          {container.description && (
            <p className="text-xs text-vpn-muted mt-0.5 truncate max-w-[200px]">
              {container.description}
            </p>
          )}
          <p className="text-sm text-vpn-muted mt-0.5">
            {container.vpn_provider}
          </p>
        </div>
        <StatusBadge status={container.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="text-vpn-muted">
          Type: <span className="text-vpn-text">{container.vpn_type}</span>
        </div>
        <div className="text-vpn-muted">
          HTTP:{" "}
          <span className="text-vpn-text">:{container.port_http_proxy}</span>
        </div>
        <div className="text-vpn-muted">
          SOCKS:{" "}
          <span className="text-vpn-text">:{container.port_shadowsocks}</span>
        </div>
        {vpnInfo?.public_ip ? (
          <div className="text-vpn-muted">
            <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
            <span className="text-vpn-primary text-xs font-mono">
              {vpnInfo.public_ip}
            </span>
          </div>
        ) : (
          <div className="text-vpn-muted">
            Control:{" "}
            <span className="text-vpn-text">:{container.port_control}</span>
          </div>
        )}
      </div>

      {/* Dependent Containers */}
      {dependents.length > 0 && (
        <div className="mb-4">
          <p className="text-xs text-vpn-muted mb-2 flex items-center gap-1">
            <Network className="w-3.5 h-3.5" />
            Network Clients ({dependents.length})
          </p>
          <div className="space-y-1.5">
            {dependents.map((dep) => (
              <div
                key={dep.id}
                className="flex items-center justify-between bg-vpn-input rounded-lg px-3 py-2"
              >
                <div className="flex items-center gap-2 min-w-0">
                  <div
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${
                      dep.status === "running"
                        ? "bg-emerald-500"
                        : dep.status === "exited"
                          ? "bg-red-500"
                          : "bg-amber-500"
                    }`}
                  />
                  <span className="text-xs text-white truncate">
                    {dep.name}
                  </span>
                </div>
                <div className="flex items-center gap-1 flex-shrink-0 ml-2">
                  {["exited", "created", "dead"].includes(dep.status) && (
                    <button
                      onClick={(e) => handleDepAction(e, dep.name, "start")}
                      className="p-1 rounded text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
                      title="Start"
                    >
                      <Play className="w-3 h-3" />
                    </button>
                  )}
                  {dep.status === "running" && (
                    <button
                      onClick={(e) => handleDepAction(e, dep.name, "stop")}
                      className="p-1 rounded text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90"
                      title="Stop"
                    >
                      <Square className="w-3 h-3" />
                    </button>
                  )}
                  <button
                    onClick={(e) => handleDepAction(e, dep.name, "restart")}
                    className="p-1 rounded text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90"
                    title="Restart"
                  >
                    <RotateCcw className="w-3 h-3" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="flex items-center gap-2 pt-3 border-t border-vpn-border">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/containers/${container.id}`);
          }}
          className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-all active:scale-90"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isStopped && (
          <button
            onClick={(e) => handleAction(e, "start")}
            disabled={!!actionLoading}
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90 disabled:opacity-50"
            title="Start"
          >
            <Play
              className={`w-4 h-4 ${actionLoading === "start" ? "animate-pulse" : ""}`}
            />
          </button>
        )}
        {isRunning && (
          <button
            onClick={(e) => handleAction(e, "stop")}
            disabled={!!actionLoading}
            className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90 disabled:opacity-50"
            title="Stop"
          >
            <Square
              className={`w-4 h-4 ${actionLoading === "stop" ? "animate-pulse" : ""}`}
            />
          </button>
        )}
        <button
          onClick={(e) => handleAction(e, "restart")}
          disabled={!!actionLoading}
          className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90 disabled:opacity-50"
          title="Restart"
        >
          <RotateCcw
            className={`w-4 h-4 ${actionLoading === "restart" ? "animate-spin" : ""}`}
          />
        </button>
        <button
          onClick={handleDelete}
          disabled={!!actionLoading}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-all active:scale-90 ml-auto disabled:opacity-50"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
