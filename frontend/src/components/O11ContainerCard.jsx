import { useNavigate } from "react-router-dom";
import {
  Play,
  Square,
  RotateCcw,
  Trash2,
  Shield,
  Box,
  Eye,
  Image,
  Wifi,
  WifiOff,
  Globe,
  MapPin,
  ArrowUpDown,
  Copy,
} from "lucide-react";
import StatusBadge from "./StatusBadge";

export const getCategoryBadgeClasses = (category) => {
  const key = String(category || "").toLowerCase();
  if (key === "script") {
    return "bg-blue-500/15 text-blue-300 border border-blue-400/30";
  }
  if (key === "manifest") {
    return "bg-purple-500/15 text-purple-300 border border-purple-400/30";
  }
  if (key === "media") {
    return "bg-amber-500/15 text-amber-300 border border-amber-400/30";
  }
  return "bg-vpn-input/80 text-vpn-muted border border-vpn-border/60";
};

export const isProxied = (c) =>
  !c?.vpn_parent &&
  (c?.networks || []).some((n) => n.toLowerCase().includes("proxy"));

/**
 * Shared container card used in both the O11 (OTT Panel) and Apps pages so
 * they share the same look, layout and behaviour.
 *
 * Props:
 *   dep: container object (from /containers/dependents)
 *   parentInfo: vpn parent info (or null)
 *   actionLoading: string action key currently loading ("name-action") or ""
 *   activeProxyEntries: array of proxy entries (or [])
 *   onAction(name, action): start/stop/restart handler
 *   onDelete(name): delete handler
 *   onCopyProxyUrl(url): copy handler
 *   detailBasePath: e.g. "/o11" or "/apps" — `${base}/${name}` is opened on click
 */
export default function O11ContainerCard({
  dep,
  parentInfo,
  actionLoading,
  activeProxyEntries = [],
  onAction,
  onDelete,
  onCopyProxyUrl,
  detailBasePath = "/o11",
}) {
  const navigate = useNavigate();
  const isRunning = ["running", "healthy"].includes(dep.status);
  const isStopped = ["exited", "created", "dead"].includes(dep.status);
  const proxied = isProxied(dep);

  return (
    <div
      key={dep.id}
      onClick={() =>
        navigate(`${detailBasePath}/${encodeURIComponent(dep.name)}`)
      }
      className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all group cursor-pointer"
    >
      {/* Header: Name + Status */}
      <div className="flex items-start justify-between mb-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <h3 className="text-lg font-semibold text-white group-hover:text-vpn-primary transition-colors truncate">
              {dep.name}
            </h3>
            {dep.description && (
              <span className="shrink-0 px-2 py-0.5 bg-vpn-primary/10 border border-vpn-primary/30 rounded text-[10px] text-vpn-primary font-medium truncate max-w-[150px]">
                {dep.description}
              </span>
            )}
          </div>
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
      ) : proxied ? (
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
          {activeProxyEntries.length > 0 && (
            <div className="mt-2 grid grid-cols-1 gap-1.5">
              {activeProxyEntries.slice(0, 3).map((entry) => (
                <div
                  key={`${dep.id}-${entry.url}`}
                  className="bg-vpn-input/70 border border-vpn-border/60 rounded px-2 py-1.5"
                >
                  <div className="flex items-center gap-1.5 mb-1 flex-wrap">
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-vpn-input/80 text-vpn-muted border border-vpn-border/60 max-w-[180px] truncate">
                      {entry.containerName}
                    </span>
                    <span className="text-[9px] px-1.5 py-0.5 rounded bg-vpn-primary/15 text-vpn-primary border border-vpn-primary/30">
                      {entry.instanceName}
                    </span>
                    <span
                      className={`text-[9px] px-1.5 py-0.5 rounded ${getCategoryBadgeClasses(entry.category)}`}
                    >
                      {entry.category}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <p className="text-[11px] text-purple-300 font-mono truncate flex-1 min-w-0">
                      {entry.url}
                    </p>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onCopyProxyUrl?.(entry.url);
                      }}
                      className="shrink-0 inline-flex items-center justify-center p-1 rounded border border-vpn-border/70 text-vpn-muted hover:text-white hover:border-vpn-primary/50 transition-colors"
                      title="Copy URL"
                      aria-label="Copy URL"
                    >
                      <Copy className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
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
          onClick={() =>
            navigate(`${detailBasePath}/${encodeURIComponent(dep.name)}`)
          }
          className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-all active:scale-90"
          title="Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isStopped && (
          <button
            onClick={() => onAction?.(dep.name, "start")}
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
            onClick={() => onAction?.(dep.name, "stop")}
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
          onClick={() => onAction?.(dep.name, "restart")}
          disabled={!!actionLoading}
          className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90 disabled:opacity-50"
          title="Restart"
        >
          <RotateCcw
            className={`w-4 h-4 ${actionLoading === `${dep.name}-restart` ? "animate-spin" : ""}`}
          />
        </button>
        <button
          onClick={() => onDelete?.(dep.name)}
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
}
