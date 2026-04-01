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
  Shield,
  Wifi,
  WifiOff,
  MapPin,
  ArrowUpDown,
  Copy,
  Check,
} from "lucide-react";
import StatusBadge from "./StatusBadge";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

export default function ContainerCard({ container, vpnInfo, onRefresh }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [dependents, setDependents] = useState([]);
  const [actionLoading, setActionLoading] = useState("");
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
    const ok = await confirm({
      title: "Delete Container",
      message: `Delete container "${container.name}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
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

  const isRunning = ["running", "healthy", "unhealthy", "starting"].includes(
    container.status,
  );
  const isStopped = ["exited", "created", "removed", "dead"].includes(
    container.status,
  );

  const serverLocation =
    container.config?.SERVER_COUNTRIES ||
    container.config?.SERVER_CITIES ||
    container.config?.SERVER_REGIONS ||
    null;

  return (
    <div
      onClick={() => navigate(`/containers/${container.id}`)}
      className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all cursor-pointer group"
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-lg font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
              {container.name}
            </h3>
            {container.description && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[11px] font-medium bg-vpn-primary/15 text-vpn-primary border border-vpn-primary/30 truncate max-w-[180px]">
                {container.description}
              </span>
            )}
          </div>
          {container.docker_name &&
            container.docker_name !== `gluetun-${container.name}` &&
            container.docker_name !== container.name && (
              <p className="text-xs text-amber-400/70 mt-0.5 truncate max-w-[200px] font-mono">
                {container.docker_name}
              </p>
            )}
        </div>
        <StatusBadge status={container.status} />
      </div>

      {/* VPN Connection Info */}
      <div className="bg-vpn-input/50 rounded-lg p-3 mb-3 space-y-2">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm">
            <Shield className="w-3.5 h-3.5 text-vpn-primary" />
            <span className="text-vpn-text font-medium capitalize">
              {container.vpn_provider}
            </span>
            <span className="text-vpn-muted">·</span>
            <span className="text-vpn-muted text-xs uppercase">
              {container.vpn_type}
            </span>
          </div>
          {vpnInfo?.vpn_status && (
            <span
              className={`flex items-center gap-1 text-xs font-medium ${
                vpnInfo.vpn_status === "running"
                  ? "text-emerald-400"
                  : "text-red-400"
              }`}
            >
              {vpnInfo.vpn_status === "running" ? (
                <Wifi className="w-3 h-3" />
              ) : (
                <WifiOff className="w-3 h-3" />
              )}
              {vpnInfo.vpn_status === "running" ? "Connected" : "Disconnected"}
            </span>
          )}
        </div>

        {/* IP & Location Row */}
        {(vpnInfo?.public_ip || serverLocation) && (
          <div className="flex items-center gap-3 flex-wrap">
            {vpnInfo?.public_ip && (
              <div className="flex items-center gap-1.5 text-xs">
                <Globe className="w-3 h-3 text-vpn-primary" />
                <span className="text-vpn-primary font-mono">
                  {vpnInfo.public_ip}
                </span>
              </div>
            )}
            {(vpnInfo?.country || serverLocation) && (
              <div className="flex items-center gap-1 text-xs text-vpn-muted">
                <MapPin className="w-3 h-3" />
                <span>{vpnInfo?.country || serverLocation}</span>
                {vpnInfo?.region && (
                  <span className="text-vpn-muted/60">· {vpnInfo.region}</span>
                )}
              </div>
            )}
          </div>
        )}

        {/* Port Forwarding */}
        {vpnInfo?.port_forwarded && (
          <div className="flex items-center gap-1.5 text-xs text-vpn-muted">
            <ArrowUpDown className="w-3 h-3 text-amber-400" />
            <span>
              Port Forwarded:{" "}
              <span className="text-amber-400 font-mono">
                {vpnInfo.port_forwarded}
              </span>
            </span>
          </div>
        )}
      </div>

      {/* Ports & Network */}
      <div className="grid grid-cols-2 gap-2 mb-3">
        {container.config?.HTTPPROXY?.toLowerCase() === "on" && (
          <div
            className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50 cursor-pointer hover:border-emerald-500/30 transition-colors group/proxy"
            onClick={(e) => {
              e.stopPropagation();
              const user = container.config?.HTTPPROXY_USER;
              const pass = container.config?.HTTPPROXY_PASSWORD;
              const auth = user && pass ? `${user}:${pass}@` : "";
              const ip = container.ip_address || "<ip>";
              const url = `http://${auth}${ip}:${container.port_http_proxy}`;
              copyToClipboard(url);
            }}
            title="Click to copy proxy URL"
          >
            <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5 flex items-center gap-1">
              HTTP Proxy
              {copiedUrl?.includes(`:${container.port_http_proxy}`) ? (
                <Check className="w-2.5 h-2.5 text-emerald-400" />
              ) : (
                <Copy className="w-2.5 h-2.5 opacity-0 group-hover/proxy:opacity-100 transition-opacity" />
              )}
            </p>
            <p className="text-sm text-vpn-text font-mono">
              :{container.port_http_proxy}
            </p>
            {container.ip_address && (
              <p className="text-[9px] text-emerald-400/70 font-mono mt-0.5 truncate">
                {container.config?.HTTPPROXY_USER &&
                container.config?.HTTPPROXY_PASSWORD
                  ? `http://${container.config.HTTPPROXY_USER}:***@${container.ip_address}:${container.port_http_proxy}`
                  : `http://${container.ip_address}:${container.port_http_proxy}`}
              </p>
            )}
          </div>
        )}
        {container.config?.SHADOWSOCKS?.toLowerCase() === "on" && (
          <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50">
            <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5">
              Shadowsocks
            </p>
            <p className="text-sm text-vpn-text font-mono">
              :{container.port_shadowsocks}
            </p>
          </div>
        )}
        {container.extra_ports?.length > 0 && (
          <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50">
            <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5">
              Extra Ports
            </p>
            <p className="text-sm text-vpn-text">
              {container.extra_ports.length} mapped
            </p>
          </div>
        )}
        {container.network_name && (
          <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50">
            <p className="text-[10px] text-vpn-muted uppercase tracking-wider mb-0.5">
              Network
            </p>
            <p className="text-sm text-vpn-text truncate">
              {container.network_name}
            </p>
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
