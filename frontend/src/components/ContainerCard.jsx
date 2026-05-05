import { useState, useEffect, useCallback, startTransition } from "react";
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
import ActionProgressDialog from "./ActionProgressDialog";
import api from "../services/api";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

export default function ContainerCard({ container, vpnInfo, onRefresh }) {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [dependents, setDependents] = useState([]);
  const [actionLoading, setActionLoading] = useState("");
  const [actionProgress, setActionProgress] = useState(null);
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
      startTransition(() =>
        setDependents(Array.isArray(res.data) ? res.data : []),
      );
    } catch {
      startTransition(() => setDependents([]));
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
    setActionProgress({ action, target: container.name });
    try {
      const res = await api.post(`/containers/${container.id}/${action}`);
      setActionProgress({ action, target: container.name, finished: true });
      toast.success(res.data?.message || `Container ${action}ed successfully`);
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.detail || `Failed to ${action} container`;
      setActionProgress({
        action,
        target: container.name,
        finished: true,
        error: msg,
      });
      toast.error(msg);
    } finally {
      setActionLoading("");
      setTimeout(() => setActionProgress(null), 1200);
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
    setActionLoading("delete");
    setActionProgress({ action: "delete", target: container.name });
    try {
      await api.delete(`/containers/${container.id}`);
      setActionProgress({
        action: "delete",
        target: container.name,
        finished: true,
      });
      toast.success(`Container "${container.name}" deleted`);
      onRefresh();
    } catch (err) {
      const msg = err.response?.data?.detail || "Failed to delete container";
      setActionProgress({
        action: "delete",
        target: container.name,
        finished: true,
        error: msg,
      });
      toast.error(msg);
    } finally {
      setActionLoading("");
      setTimeout(() => setActionProgress(null), 1200);
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

  // Parse predefined locations into array
  const predefinedLocations = [];
  if (container.config?.SERVER_COUNTRIES)
    container.config.SERVER_COUNTRIES.split(",").forEach((s) => {
      if (s.trim()) predefinedLocations.push(s.trim());
    });
  if (container.config?.SERVER_CITIES)
    container.config.SERVER_CITIES.split(",").forEach((s) => {
      if (s.trim()) predefinedLocations.push(s.trim());
    });
  if (container.config?.SERVER_REGIONS)
    container.config.SERVER_REGIONS.split(",").forEach((s) => {
      if (s.trim()) predefinedLocations.push(s.trim());
    });

  return (
    <>
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
                  vpnInfo.vpn_status === "running" && vpnInfo.public_ip
                    ? "text-emerald-400"
                    : "text-red-400"
                }`}
              >
                {vpnInfo.vpn_status === "running" && vpnInfo.public_ip ? (
                  <Wifi className="w-3 h-3" />
                ) : (
                  <WifiOff className="w-3 h-3" />
                )}
                {vpnInfo.vpn_status === "running" && vpnInfo.public_ip
                  ? "Connected"
                  : "Disconnected"}
              </span>
            )}
          </div>

          {/* IP & Location Row */}
          {(vpnInfo?.public_ip || vpnInfo?.country) && (
            <div className="flex items-center gap-3 flex-wrap">
              {vpnInfo?.public_ip && (
                <div className="flex items-center gap-1.5 text-xs">
                  <Globe className="w-3 h-3 text-vpn-primary" />
                  <span className="text-vpn-primary font-mono">
                    {vpnInfo.public_ip}
                  </span>
                </div>
              )}
              {vpnInfo?.country && (
                <div className="flex items-center gap-1 text-xs text-vpn-muted min-w-0">
                  <MapPin className="w-3 h-3 flex-shrink-0" />
                  <span className="truncate">{vpnInfo.country}</span>
                  {vpnInfo?.region && (
                    <span className="text-vpn-muted/60 truncate">
                      · {vpnInfo.region}
                    </span>
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

          {/* Predefined Server Locations */}
          {predefinedLocations.length > 0 && (
            <div className="flex items-start gap-1.5 pt-1">
              <MapPin className="w-3 h-3 text-cyan-400 flex-shrink-0 mt-0.5" />
              <div className="flex flex-wrap gap-1">
                {predefinedLocations.map((loc, i) => (
                  <span
                    key={`${loc}-${i}`}
                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20"
                  >
                    {loc}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Ports & Network */}
        <div className="grid grid-cols-2 gap-2 mb-3">
          {container.config?.HTTPPROXY?.toLowerCase() === "on" &&
            (() => {
              const internalPort = container.port_http_proxy || 8888;
              const user = container.config?.HTTPPROXY_USER;
              const pass = container.config?.HTTPPROXY_PASSWORD;
              const auth = user && pass ? `${user}:${pass}@` : "";
              const authDisplay = user && pass ? `${user}:***@` : "";
              const ip = container.ip_address || "<ip>";
              const dockerName =
                container.docker_name || `gluetun-${container.name}`;
              const internalUrl = `http://${auth}${ip}:${internalPort}`;
              const hostnameUrl = `http://${auth}${dockerName}:${internalPort}`;
              const proxyMapping = container.extra_ports?.find(
                (ep) => parseInt(ep.container) === internalPort,
              );
              const externalPort = proxyMapping
                ? parseInt(proxyMapping.host)
                : null;
              const serverIp = window.location.hostname;
              const externalUrl = externalPort
                ? `http://${auth}${serverIp}:${externalPort}`
                : null;

              return (
                <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50 col-span-2 space-y-2">
                  <p className="text-xs text-vpn-muted uppercase tracking-wider font-semibold">
                    HTTP Proxy
                  </p>
                  {/* Internal */}
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Internal
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === internalUrl ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:border-emerald-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(internalUrl);
                      }}
                      title="Copy internal proxy URL"
                    >
                      <span className="truncate flex-1 text-left">
                        http://{authDisplay}
                        {ip}:{internalPort}
                      </span>
                      {copiedUrl === internalUrl ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  {/* Hostname */}
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Hostname
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === hostnameUrl ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:border-amber-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(hostnameUrl);
                      }}
                      title="Copy hostname proxy URL"
                    >
                      <span className="truncate flex-1 text-left">
                        http://{authDisplay}
                        {dockerName}:{internalPort}
                      </span>
                      {copiedUrl === hostnameUrl ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  {/* External */}
                  {externalUrl && (
                    <div>
                      <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                        External
                      </p>
                      <button
                        className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === externalUrl ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:border-blue-500/50"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(externalUrl);
                        }}
                        title="Copy external proxy URL"
                      >
                        <span className="truncate flex-1 text-left">
                          http://{authDisplay}
                          {serverIp}:{externalPort}
                        </span>
                        {copiedUrl === externalUrl ? (
                          <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          {container.config?.SHADOWSOCKS?.toLowerCase() === "on" &&
            (() => {
              const ssPort = container.port_shadowsocks || 8388;
              const ip = container.ip_address || "<ip>";
              const dockerName =
                container.docker_name || `gluetun-${container.name}`;
              const ssInternal = `ss://${ip}:${ssPort}`;
              const ssHostname = `ss://${dockerName}:${ssPort}`;
              const ssMapping = container.extra_ports?.find(
                (ep) => parseInt(ep.container) === ssPort,
              );
              const ssExtPort = ssMapping ? parseInt(ssMapping.host) : null;
              const serverIp = window.location.hostname;
              const ssExternal = ssExtPort
                ? `ss://${serverIp}:${ssExtPort}`
                : null;

              return (
                <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50 col-span-2 space-y-2">
                  <p className="text-xs text-vpn-muted uppercase tracking-wider font-semibold">
                    Shadowsocks
                  </p>
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Internal
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === ssInternal ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:border-emerald-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(ssInternal);
                      }}
                      title="Copy internal Shadowsocks URL"
                    >
                      <span className="truncate flex-1 text-left">
                        {ssInternal}
                      </span>
                      {copiedUrl === ssInternal ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Hostname
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === ssHostname ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:border-amber-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(ssHostname);
                      }}
                      title="Copy hostname Shadowsocks URL"
                    >
                      <span className="truncate flex-1 text-left">
                        {ssHostname}
                      </span>
                      {copiedUrl === ssHostname ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  {ssExternal && (
                    <div>
                      <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                        External
                      </p>
                      <button
                        className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === ssExternal ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:border-blue-500/50"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(ssExternal);
                        }}
                        title="Copy external Shadowsocks URL"
                      >
                        <span className="truncate flex-1 text-left">
                          {ssExternal}
                        </span>
                        {copiedUrl === ssExternal ? (
                          <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
          {container.socks5_enabled &&
            (() => {
              const ip = container.ip_address || "<ip>";
              const dockerName =
                container.docker_name || `gluetun-${container.name}`;
              const serverIp = window.location.hostname;
              const socks5Port = container.port_socks5 || 1080;
              const socks5Internal = `socks5://${ip}:${socks5Port}`;
              const socks5Hostname = `socks5://${dockerName}:${socks5Port}`;
              const socks5Mapping = container.extra_ports?.find(
                (ep) => parseInt(ep.container) === socks5Port,
              );
              const socks5ExtPort = socks5Mapping
                ? parseInt(socks5Mapping.host)
                : null;
              const socks5External = socks5ExtPort
                ? `socks5://${serverIp}:${socks5ExtPort}`
                : null;

              return (
                <div className="bg-vpn-input/50 rounded-lg px-3 py-2 border border-vpn-border/50 col-span-2 space-y-2">
                  <p className="text-xs text-vpn-muted uppercase tracking-wider font-semibold">
                    SOCKS5 Proxy
                  </p>
                  {/* Internal */}
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Internal
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === socks5Internal ? "bg-emerald-500/20 border-emerald-500/50 text-emerald-400" : "bg-emerald-500/10 border-emerald-500/25 text-emerald-400 hover:border-emerald-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(socks5Internal);
                      }}
                      title="Copy internal SOCKS5 URL"
                    >
                      <span className="truncate flex-1 text-left">
                        {socks5Internal}
                      </span>
                      {copiedUrl === socks5Internal ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  {/* Hostname */}
                  <div>
                    <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                      Hostname
                    </p>
                    <button
                      className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === socks5Hostname ? "bg-amber-500/20 border-amber-500/50 text-amber-400" : "bg-amber-500/10 border-amber-500/25 text-amber-400 hover:border-amber-500/50"}`}
                      onClick={(e) => {
                        e.stopPropagation();
                        copyToClipboard(socks5Hostname);
                      }}
                      title="Copy hostname SOCKS5 URL"
                    >
                      <span className="truncate flex-1 text-left">
                        {socks5Hostname}
                      </span>
                      {copiedUrl === socks5Hostname ? (
                        <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                      ) : (
                        <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                      )}
                    </button>
                  </div>
                  {/* External */}
                  {socks5External && (
                    <div>
                      <p className="text-[10px] text-vpn-muted uppercase tracking-wider font-semibold mb-0.5">
                        External
                      </p>
                      <button
                        className={`flex items-center w-full px-2.5 py-1.5 rounded-md text-xs font-mono border transition-all cursor-pointer ${copiedUrl === socks5External ? "bg-blue-500/20 border-blue-500/50 text-blue-400" : "bg-blue-500/10 border-blue-500/25 text-blue-400 hover:border-blue-500/50"}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          copyToClipboard(socks5External);
                        }}
                        title="Copy external SOCKS5 URL"
                      >
                        <span className="truncate flex-1 text-left">
                          {socks5External}
                        </span>
                        {copiedUrl === socks5External ? (
                          <Check className="w-3.5 h-3.5 shrink-0 ml-2" />
                        ) : (
                          <Copy className="w-3.5 h-3.5 shrink-0 ml-2 opacity-50" />
                        )}
                      </button>
                    </div>
                  )}
                </div>
              );
            })()}
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
      <ActionProgressDialog
        action={actionProgress?.action}
        target={actionProgress?.target}
        finished={actionProgress?.finished}
        error={actionProgress?.error}
      />
    </>
  );
}
