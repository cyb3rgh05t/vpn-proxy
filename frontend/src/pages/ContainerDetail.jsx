import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Download,
  RefreshCw,
  Terminal,
  Network,
  Globe,
  Shield,
  Rocket,
  Pencil,
  X,
  Save,
  Plus,
  Upload,
  File,
  FolderOpen,
  Copy,
  Check,
} from "lucide-react";
import api from "../services/api";
import CustomDropdown from "../components/CustomDropdown";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

export default function ContainerDetail() {
  const { id } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [container, setContainer] = useState(null);
  const [logs, setLogs] = useState("");
  const [loading, setLoading] = useState(true);
  const [tab, setTab] = useState("info");
  const [dependents, setDependents] = useState([]);
  const [actionLoading, setActionLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [vpnInfo, setVpnInfo] = useState(null);
  const [vpnInfoLoading, setVpnInfoLoading] = useState(true);
  const [description, setDescription] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const descFocused = useRef(false);
  const initialLoad = useRef(true);
  const [editingConfig, setEditingConfig] = useState(false);
  const [editConfig, setEditConfig] = useState({});
  const [editExtraPorts, setEditExtraPorts] = useState([]);
  const [editName, setEditName] = useState("");
  const [editHttpPort, setEditHttpPort] = useState(8888);
  const [editShadowsocksPort, setEditShadowsocksPort] = useState(8388);
  const [editHttpProxyEnabled, setEditHttpProxyEnabled] = useState(true);
  const [editShadowsocksEnabled, setEditShadowsocksEnabled] = useState(false);
  const [redeploying, setRedeploying] = useState(false);
  const [configFiles, setConfigFiles] = useState([]);
  const [uploadingConfig, setUploadingConfig] = useState(false);
  const configFileInputRef = useRef(null);
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
        toast.success("URL copied!");
        setTimeout(() => setCopiedUrl(null), 2000);
      } catch {
        toast.error("Failed to copy URL");
      }
    },
    [toast],
  );

  const fetchContainer = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}`);
      setContainer(res.data);
      // Only update description on initial load or when user is not editing
      if (initialLoad.current || !descFocused.current) {
        setDescription(res.data.description || "");
        initialLoad.current = false;
      }
    } catch {
      navigate("/");
    } finally {
      setLoading(false);
    }
  }, [id, navigate]);

  const fetchDependents = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/dependents`);
      setDependents(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDependents([]);
    }
  }, [id]);

  const fetchVpnInfo = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/vpn-info`, {
        timeout: 8000,
      });
      setVpnInfo(res.data);
    } catch {
      setVpnInfo(null);
    } finally {
      setVpnInfoLoading(false);
    }
  }, [id]);

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get(`/containers/${id}/logs`);
      setLogs(res.data.logs);
    } catch {
      setLogs("Failed to fetch logs.");
    }
  }, [id]);

  useEffect(() => {
    fetchContainer();
    fetchDependents();
    fetchVpnInfo();
  }, [fetchContainer, fetchDependents, fetchVpnInfo]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
    if (tab === "files") fetchConfigFiles();
  }, [tab, fetchLogs]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchContainer();
      fetchDependents();
      fetchVpnInfo();
    }, 10000);
    return () => clearInterval(interval);
  }, [fetchContainer, fetchDependents, fetchVpnInfo]);

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      const res = await api.post(`/containers/${id}/${action}`);
      toast.success(res.data?.message || `Container ${action}ed successfully`);
      fetchContainer();
      fetchDependents();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading("");
    }
  };

  const handleDepAction = async (depName, action) => {
    try {
      await api.post(`/containers/${id}/dependents/${depName}/${action}`);
      toast.success(`${depName} ${action}ed successfully`);
      fetchDependents();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || `Failed to ${action} ${depName}`,
      );
    }
  };

  const handleDescriptionSave = async () => {
    const trimmed = description.trim();
    if (trimmed === (container.description || "")) return;
    setDescSaving(true);
    try {
      await api.put(`/containers/${id}`, { description: trimmed || null });
      setContainer((prev) => ({ ...prev, description: trimmed || null }));
      toast.success("Description saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save description");
    } finally {
      setDescSaving(false);
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete Container",
      message: `Delete "${container.name}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/containers/${id}`);
      toast.success(`Container deleted`);
      navigate("/");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete");
    }
  };

  const handleExportCompose = async () => {
    try {
      const res = await api.get(`/containers/${id}/compose`);
      const blob = new Blob([res.data], { type: "text/yaml" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `docker-compose-${container.name}.yml`;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Failed to export compose file");
    }
  };

  const handleEditConfig = () => {
    const cfg = { ...(container.config || {}) };
    setEditHttpProxyEnabled(cfg.HTTPPROXY?.toLowerCase() === "on");
    setEditShadowsocksEnabled(cfg.SHADOWSOCKS?.toLowerCase() === "on");
    // Remove HTTPPROXY/SHADOWSOCKS from editable env vars since they have toggles now
    delete cfg.HTTPPROXY;
    delete cfg.SHADOWSOCKS;
    setEditConfig(cfg);
    setEditExtraPorts((container.extra_ports || []).map((ep) => ({ ...ep })));
    setEditName(container.name || "");
    setEditHttpPort(container.port_http_proxy || 8888);
    setEditShadowsocksPort(container.port_shadowsocks || 8388);
    setEditingConfig(true);
    fetchConfigFiles();
  };

  const fetchConfigFiles = async () => {
    try {
      const res = await api.get(`/containers/${id}/config-files`);
      setConfigFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      setConfigFiles([]);
    }
  };

  const handleConfigUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploadingConfig(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        await api.post(`/containers/${id}/upload-config`, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success("Config file(s) uploaded");
      fetchConfigFiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploadingConfig(false);
      if (configFileInputRef.current) configFileInputRef.current.value = "";
    }
  };

  const handleConfigFileDelete = async (filename) => {
    try {
      await api.delete(
        `/containers/${id}/config-files/${encodeURIComponent(filename)}`,
      );
      toast.success(`Deleted ${filename}`);
      fetchConfigFiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete file");
    }
  };

  const handleRedeploy = async () => {
    const nameChanged = editName && editName !== container.name;
    const confirmMsg = nameChanged
      ? `Redeploy and rename container to "${editName}"? Dependents will be restarted automatically.`
      : "Redeploy this container? Dependents will be restarted automatically.";
    const ok = await confirm({
      title: nameChanged ? "Rename & Redeploy" : "Redeploy Container",
      message: confirmMsg,
      confirmText: nameChanged ? "Rename & Redeploy" : "Redeploy",
      variant: "info",
    });
    if (!ok) return;
    setRedeploying(true);
    try {
      const payload = {
        config: {
          ...editConfig,
          HTTPPROXY: editHttpProxyEnabled ? "on" : "off",
          SHADOWSOCKS: editShadowsocksEnabled ? "on" : "off",
        },
        extra_ports: editExtraPorts.filter((ep) => ep.host && ep.container),
        port_http_proxy: editHttpPort,
        port_shadowsocks: editShadowsocksPort,
      };
      if (nameChanged) {
        payload.name = editName;
      }
      const res = await api.post(`/containers/${id}/redeploy`, payload);
      toast.success(res.data?.message || "Container redeployed");
      setEditingConfig(false);
      fetchContainer();
      fetchDependents();
      fetchVpnInfo();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to redeploy container");
    } finally {
      setRedeploying(false);
    }
  };

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
      </div>
    );
  }

  if (!container) return null;

  const isRunning = ["running", "healthy", "unhealthy", "starting"].includes(
    container.status,
  );
  const isStopped = ["exited", "created", "removed", "dead"].includes(
    container.status,
  );

  const maskedConfig = Object.entries(container.config || {}).map(([k, v]) => ({
    key: k,
    value: v,
  }));

  return (
    <div>
      <button
        onClick={() => navigate("/vpn-proxy")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to VPN-Proxy
      </button>

      {/* Header */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-2">
          <div>
            <h1 className="text-2xl font-bold text-white">{container.name}</h1>
            {container.docker_name &&
              container.docker_name !== `gluetun-${container.name}` &&
              container.docker_name !== container.name && (
                <p className="text-xs text-amber-400/70 font-mono mt-0.5">
                  Docker: {container.docker_name}
                </p>
              )}
            <p className="text-vpn-muted mt-1">
              {container.vpn_provider} &middot; {container.vpn_type}
            </p>
          </div>
          <StatusBadge status={container.status} />
        </div>

        <div className="mb-4 bg-vpn-input border border-vpn-border rounded-lg px-4 py-2.5">
          <input
            type="text"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            onFocus={() => (descFocused.current = true)}
            onBlur={() => {
              descFocused.current = false;
              handleDescriptionSave();
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter") e.target.blur();
            }}
            placeholder="Add a description..."
            disabled={descSaving}
            className="w-full bg-transparent border-none text-sm text-vpn-text placeholder-vpn-muted focus:outline-none focus:text-white disabled:opacity-50"
          />
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={async () => {
              setRefreshing(true);
              await fetchContainer();
              setRefreshing(false);
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          {isStopped && (
            <button
              onClick={() => handleAction("start")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-emerald-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Play
                className={`w-4 h-4 text-emerald-400 ${actionLoading === "start" ? "animate-pulse" : ""}`}
              />
              Start
            </button>
          )}
          {isRunning && (
            <button
              onClick={() => handleAction("stop")}
              disabled={!!actionLoading}
              className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-amber-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Square
                className={`w-4 h-4 text-amber-400 ${actionLoading === "stop" ? "animate-pulse" : ""}`}
              />
              Stop
            </button>
          )}
          <button
            onClick={() => handleAction("restart")}
            disabled={!!actionLoading}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg text-sm transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RotateCcw
              className={`w-4 h-4 text-vpn-primary ${actionLoading === "restart" ? "animate-spin" : ""}`}
            />
            Restart
          </button>
          <button
            onClick={handleExportCompose}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg text-sm transition-all shadow-sm"
          >
            <Download className="w-4 h-4 text-vpn-primary" />
            Export Compose
          </button>
          <button
            onClick={handleEditConfig}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-blue-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm"
          >
            <Pencil className="w-4 h-4 text-blue-400" />
            Edit & Redeploy
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-red-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm ml-auto"
          >
            <Trash2 className="w-4 h-4 text-red-400" />
            Delete
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-3 mb-4">
        {[
          { key: "info", label: "Information" },
          { key: "files", label: "Files" },
          { key: "logs", label: "Logs" },
        ].map(({ key, label }) => (
          <button
            key={key}
            onClick={() => setTab(key)}
            className={`flex-1 py-2.5 rounded-lg border font-medium text-sm transition-colors ${
              tab === key
                ? "bg-vpn-primary/20 border-vpn-primary text-vpn-primary"
                : "bg-vpn-input border-vpn-border text-vpn-muted hover:border-vpn-muted"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
        {tab === "info" && (
          <div className="space-y-6">
            {/* VPN Status */}
            {isRunning && vpnInfoLoading && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  VPN Status
                </h3>
                <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-xl p-4 flex items-center gap-3">
                  <div className="animate-spin rounded-full h-5 w-5 border-t-2 border-b-2 border-vpn-primary"></div>
                  <span className="text-sm text-vpn-muted">
                    Loading VPN status...
                  </span>
                </div>
              </div>
            )}
            {isRunning && !vpnInfoLoading && vpnInfo && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  VPN Status
                </h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">VPN</p>
                    <p
                      className={`text-sm font-semibold ${
                        vpnInfo.vpn_status === "running"
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {vpnInfo.vpn_status || "Unknown"}
                    </p>
                  </div>
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">Public IP</p>
                    <p className="text-sm font-mono text-white">
                      {vpnInfo.public_ip || "N/A"}
                    </p>
                  </div>
                  <div className="bg-vpn-input rounded-lg p-4">
                    <p className="text-xs text-vpn-muted mb-1">
                      <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
                      Location
                    </p>
                    <p className="text-sm text-white">
                      {[vpnInfo.region, vpnInfo.country]
                        .filter(Boolean)
                        .join(", ") || "N/A"}
                    </p>
                  </div>
                  {vpnInfo.port_forwarded && (
                    <div className="bg-vpn-input rounded-lg p-4">
                      <p className="text-xs text-vpn-muted mb-1">
                        Port Forward
                      </p>
                      <p className="text-sm font-mono text-vpn-primary">
                        {vpnInfo.port_forwarded}
                      </p>
                    </div>
                  )}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                Ports & Network
              </h3>
              {/* Proxy URLs */}
              {container.config?.HTTPPROXY?.toLowerCase() === "on" &&
                (() => {
                  const internalPort = container.port_http_proxy || 8888;
                  const user = container.config?.HTTPPROXY_USER;
                  const pass = container.config?.HTTPPROXY_PASSWORD;
                  const auth = user && pass ? `${user}:${pass}@` : "";
                  const authDisplay = user && pass ? `${user}:***@` : "";
                  const ip = container.ip_address || "<ip>";
                  const internalUrl = `http://${auth}${ip}:${internalPort}`;
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
                    <div className="bg-vpn-input rounded-lg p-4 mb-4 space-y-2">
                      <p className="text-xs text-vpn-muted mb-1 flex items-center gap-1.5">
                        HTTP Proxy
                        <span className="text-emerald-400 text-[10px]">
                          ● enabled
                        </span>
                      </p>
                      <div
                        className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity group/int"
                        onClick={() => copyToClipboard(internalUrl)}
                      >
                        <span className="text-[10px] text-vpn-muted font-medium uppercase w-14 shrink-0">
                          Internal
                        </span>
                        <p className="text-xs text-emerald-400/80 font-mono truncate flex-1">
                          http://{authDisplay}
                          {ip}:{internalPort}
                        </p>
                        {copiedUrl === internalUrl ? (
                          <Check className="w-3 h-3 text-emerald-400 shrink-0" />
                        ) : (
                          <Copy className="w-3 h-3 text-vpn-muted opacity-0 group-hover/int:opacity-100 transition-opacity shrink-0" />
                        )}
                      </div>
                      {externalUrl && (
                        <div
                          className="flex items-center gap-2 cursor-pointer hover:opacity-80 transition-opacity group/ext"
                          onClick={() => copyToClipboard(externalUrl)}
                        >
                          <span className="text-[10px] text-vpn-muted font-medium uppercase w-14 shrink-0">
                            External
                          </span>
                          <p className="text-xs text-blue-400/80 font-mono truncate flex-1">
                            http://{authDisplay}
                            {serverIp}:{externalPort}
                          </p>
                          {copiedUrl === externalUrl ? (
                            <Check className="w-3 h-3 text-blue-400 shrink-0" />
                          ) : (
                            <Copy className="w-3 h-3 text-vpn-muted opacity-0 group-hover/ext:opacity-100 transition-opacity shrink-0" />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })()}
              <div className="grid grid-cols-3 gap-4">
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">HTTP Proxy Port</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_http_proxy}
                  </p>
                  <p className="text-[10px] text-vpn-muted mt-0.5">
                    {container.config?.HTTPPROXY?.toLowerCase() === "on" ? (
                      <span className="text-emerald-400">● internal</span>
                    ) : (
                      <span className="text-vpn-muted/50">○ disabled</span>
                    )}
                  </p>
                </div>
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">Shadowsocks</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_shadowsocks}
                  </p>
                  <p className="text-[10px] text-vpn-muted mt-0.5">
                    {container.config?.SHADOWSOCKS?.toLowerCase() === "on" ? (
                      <span className="text-emerald-400">● enabled</span>
                    ) : (
                      <span className="text-vpn-muted/50">○ disabled</span>
                    )}
                  </p>
                </div>
                <div className="bg-vpn-input rounded-lg p-4">
                  <p className="text-xs text-vpn-muted mb-1">Gluetun API</p>
                  <p className="text-lg font-mono text-white">
                    :{container.port_control}
                  </p>
                  <p className="text-[10px] text-vpn-muted mt-0.5">
                    <span className="text-vpn-muted/50">internal only</span>
                  </p>
                </div>
              </div>
              {container.network_name && (
                <div className="mt-3">
                  <div className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-xs bg-vpn-input text-vpn-muted border border-vpn-border/50">
                    <Network className="w-3 h-3" />
                    Network:{" "}
                    <span className="text-white font-medium">
                      {container.network_name}
                    </span>
                  </div>
                </div>
              )}
              {/* Extra Ports */}
              {container.extra_ports && container.extra_ports.length > 0 && (
                <div className="mt-3">
                  <p className="text-xs text-vpn-muted mb-2">
                    Additional Port Mappings
                  </p>
                  <div className="grid grid-cols-3 gap-3">
                    {container.extra_ports.map((ep, i) => (
                      <div
                        key={i}
                        className="bg-vpn-input rounded-lg p-3 border border-vpn-border/30"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                            {ep.protocol || "tcp"}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-white">
                          <span className="text-vpn-primary">{ep.host}</span>
                          <span className="text-vpn-muted mx-1">→</span>
                          {ep.container}
                        </p>
                        <p className="text-[10px] text-vpn-muted mt-0.5">
                          host → container
                        </p>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>

            {/* Dependent Containers */}
            {dependents.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Network className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Containers using this network
                </h3>
                <div className="space-y-2">
                  {dependents.map((dep) => (
                    <div
                      key={dep.id}
                      className="flex items-center justify-between bg-vpn-input rounded-lg px-4 py-3"
                    >
                      <div className="flex items-center gap-3">
                        <div
                          className={`w-2.5 h-2.5 rounded-full ${
                            dep.status === "running"
                              ? "bg-emerald-500"
                              : dep.status === "exited"
                                ? "bg-red-500"
                                : "bg-amber-500"
                          }`}
                        />
                        <div>
                          <p className="text-sm text-white font-medium">
                            {dep.name}
                          </p>
                          <p className="text-xs text-vpn-muted font-mono">
                            {dep.image}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <span
                          className={`text-xs px-2 py-1 rounded-full ${
                            dep.status === "running"
                              ? "bg-emerald-500/10 text-emerald-400"
                              : dep.status === "exited"
                                ? "bg-red-500/10 text-red-400"
                                : "bg-amber-500/10 text-amber-400"
                          }`}
                        >
                          {dep.status}
                        </span>
                        <div className="flex items-center gap-1 ml-2">
                          {["exited", "created", "dead"].includes(
                            dep.status,
                          ) && (
                            <button
                              onClick={() => handleDepAction(dep.name, "start")}
                              className="p-1.5 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-all active:scale-90"
                              title="Start"
                            >
                              <Play className="w-3.5 h-3.5" />
                            </button>
                          )}
                          {dep.status === "running" && (
                            <button
                              onClick={() => handleDepAction(dep.name, "stop")}
                              className="p-1.5 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-all active:scale-90"
                              title="Stop"
                            >
                              <Square className="w-3.5 h-3.5" />
                            </button>
                          )}
                          <button
                            onClick={() => handleDepAction(dep.name, "restart")}
                            className="p-1.5 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-all active:scale-90"
                            title="Restart"
                          >
                            <RotateCcw className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {maskedConfig.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  Configuration
                </h3>
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                  {maskedConfig.map(({ key, value }) => (
                    <div key={key} className="flex justify-between px-4 py-3">
                      <span className="text-sm text-vpn-muted font-mono">
                        {key}
                      </span>
                      <span className="text-sm text-white font-mono">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                Details
              </h3>
              <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">Container ID</span>
                  <span className="text-sm text-white font-mono">
                    {container.container_id || "N/A"}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">Created</span>
                  <span className="text-sm text-white">
                    {container.created_at
                      ? new Date(container.created_at).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
              </div>
            </div>
          </div>
        )}

        {tab === "files" && (
          <div className="space-y-6">
            {/* Upload Section */}
            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                <Upload className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                VPN Config Files
              </h3>
              <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-xl p-4 space-y-3">
                <p className="text-xs text-vpn-muted">
                  Upload OpenVPN or WireGuard config files. Stored in{" "}
                  <span className="font-mono text-vpn-primary/70">
                    /gluetun/
                  </span>{" "}
                  inside the container.
                </p>
                <div className="flex items-center gap-3">
                  <input
                    ref={configFileInputRef}
                    type="file"
                    accept=".ovpn,.conf,.key,.crt,.pem,.txt,.cfg"
                    multiple
                    onChange={handleConfigUpload}
                    className="hidden"
                    id="config-file-upload"
                  />
                  <label
                    htmlFor="config-file-upload"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                      uploadingConfig
                        ? "bg-vpn-input text-vpn-muted cursor-not-allowed"
                        : "bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text"
                    }`}
                  >
                    <Upload
                      className={`w-4 h-4 ${uploadingConfig ? "animate-pulse" : ""}`}
                    />
                    {uploadingConfig ? "Uploading..." : "Choose Files"}
                  </label>
                </div>
              </div>
            </div>

            {/* File List */}
            <div>
              <div className="flex items-center justify-between mb-3">
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider">
                  <FolderOpen className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Uploaded Files
                </h3>
                <button
                  onClick={fetchConfigFiles}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
                >
                  <RefreshCw className="w-3 h-3 text-vpn-primary" />
                  Refresh
                </button>
              </div>

              {configFiles.length === 0 ? (
                <div className="text-center py-8 bg-vpn-input/30 border border-vpn-border/50 rounded-xl">
                  <FolderOpen className="w-10 h-10 text-vpn-border mx-auto mb-2" />
                  <p className="text-sm text-vpn-muted">
                    No config files uploaded yet
                  </p>
                </div>
              ) : (
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                  {configFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <File className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white font-mono truncate">
                            {f.name}
                          </p>
                          <p className="text-xs text-vpn-muted font-mono">
                            {f.path}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => handleConfigFileDelete(f.name)}
                        className="p-1.5 rounded-lg text-vpn-muted hover:text-red-400 hover:bg-red-500/10 transition-all flex-shrink-0"
                        title="Delete file"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {tab === "logs" && (
          <div>
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-2 text-vpn-muted">
                <Terminal className="w-4 h-4" />
                <span className="text-sm">Container Logs</span>
              </div>
              <button
                onClick={fetchLogs}
                className="flex items-center gap-1 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <RefreshCw className="w-3 h-3 text-vpn-primary" />
                Refresh
              </button>
            </div>
            <pre className="bg-vpn-bg-dark text-vpn-text text-xs font-mono p-4 rounded-lg overflow-auto max-h-[500px] whitespace-pre-wrap">
              {logs || "No logs available."}
            </pre>
          </div>
        )}
      </div>

      {/* Edit & Redeploy Modal */}
      {editingConfig && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-2xl max-h-[80vh] flex flex-col">
            <div className="flex items-center justify-between p-6 border-b border-vpn-border">
              <h2 className="text-lg font-bold text-white">
                Edit Configuration & Redeploy
              </h2>
              <button
                onClick={() => setEditingConfig(false)}
                className="p-2 rounded-lg text-vpn-muted hover:text-white hover:bg-vpn-input transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-6 space-y-3">
              {/* Container Name */}
              <div>
                <label className="text-xs text-vpn-muted font-mono block mb-1">
                  Container Name
                </label>
                <input
                  type="text"
                  value={editName}
                  onChange={(e) =>
                    setEditName(
                      e.target.value.toLowerCase().replace(/[^a-z0-9_-]/g, ""),
                    )
                  }
                  placeholder="container-name"
                  className={`w-full bg-vpn-input border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary ${
                    editName && editName !== container.name
                      ? "border-amber-500"
                      : "border-vpn-border"
                  }`}
                />
                {editName && editName !== container.name && (
                  <p className="text-xs text-amber-400 mt-1">
                    Container will be renamed from "{container.name}" to "
                    {editName}"
                  </p>
                )}
              </div>

              {Object.entries(editConfig).map(([key, value]) => (
                <div key={key} className="flex gap-3 items-start">
                  <div className="flex-1 min-w-0">
                    <label className="text-xs text-vpn-muted font-mono block mb-1">
                      {key}
                    </label>
                    <input
                      type="text"
                      value={value}
                      onChange={(e) =>
                        setEditConfig((prev) => ({
                          ...prev,
                          [key]: e.target.value,
                        }))
                      }
                      className="w-full bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary"
                    />
                  </div>
                  <button
                    onClick={() =>
                      setEditConfig((prev) => {
                        const next = { ...prev };
                        delete next[key];
                        return next;
                      })
                    }
                    className="mt-6 p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                    title="Remove"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}

              <button
                onClick={() => {
                  const key = prompt("Enter new environment variable name:");
                  if (key && key.trim()) {
                    setEditConfig((prev) => ({ ...prev, [key.trim()]: "" }));
                  }
                }}
                className="w-full py-2 border border-dashed border-vpn-border rounded-lg text-sm text-vpn-muted hover:text-vpn-primary hover:border-vpn-primary transition-colors"
              >
                + Add Variable
              </button>

              {/* Port Mappings */}
              <div className="pt-4 border-t border-vpn-border">
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  Access Ports
                </h3>
                <div className="grid grid-cols-2 gap-3 mb-3">
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-xs text-vpn-muted font-mono">
                        HTTP Proxy Port
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditHttpProxyEnabled(!editHttpProxyEnabled)
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          editHttpProxyEnabled
                            ? "bg-vpn-primary"
                            : "bg-vpn-input border border-vpn-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            editHttpProxyEnabled
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={editHttpPort}
                      onChange={(e) =>
                        setEditHttpPort(parseInt(e.target.value) || 0)
                      }
                      className={`w-full bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary ${!editHttpProxyEnabled ? "opacity-40" : ""}`}
                      min="1024"
                      max="65535"
                      disabled={!editHttpProxyEnabled}
                    />
                  </div>
                  <div>
                    <div className="flex items-center gap-2 mb-1">
                      <label className="text-xs text-vpn-muted font-mono">
                        Shadowsocks Port
                      </label>
                      <button
                        type="button"
                        onClick={() =>
                          setEditShadowsocksEnabled(!editShadowsocksEnabled)
                        }
                        className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                          editShadowsocksEnabled
                            ? "bg-vpn-primary"
                            : "bg-vpn-input border border-vpn-border"
                        }`}
                      >
                        <span
                          className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                            editShadowsocksEnabled
                              ? "translate-x-4"
                              : "translate-x-0.5"
                          }`}
                        />
                      </button>
                    </div>
                    <input
                      type="number"
                      value={editShadowsocksPort}
                      onChange={(e) =>
                        setEditShadowsocksPort(parseInt(e.target.value) || 0)
                      }
                      className={`w-full bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary ${!editShadowsocksEnabled ? "opacity-40" : ""}`}
                      min="1024"
                      max="65535"
                      disabled={!editShadowsocksEnabled}
                    />
                  </div>
                </div>
              </div>

              {/* Extra Port Mappings */}
              <div className="pt-4 border-t border-vpn-border">
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  Extra Port Mappings
                </h3>
                <div className="space-y-2">
                  {editExtraPorts.map((ep, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="number"
                        value={ep.host || ""}
                        onChange={(e) =>
                          setEditExtraPorts((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, host: e.target.value } : p,
                            ),
                          )
                        }
                        placeholder="Host"
                        className="w-24 bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary"
                      />
                      <span className="text-vpn-muted text-sm">→</span>
                      <input
                        type="number"
                        value={ep.container || ""}
                        onChange={(e) =>
                          setEditExtraPorts((prev) =>
                            prev.map((p, idx) =>
                              idx === i
                                ? { ...p, container: e.target.value }
                                : p,
                            ),
                          )
                        }
                        placeholder="Container"
                        className="w-24 bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono focus:outline-none focus:border-vpn-primary"
                      />
                      <CustomDropdown
                        value={ep.protocol || "tcp"}
                        onChange={(val) =>
                          setEditExtraPorts((prev) =>
                            prev.map((p, idx) =>
                              idx === i ? { ...p, protocol: val } : p,
                            ),
                          )
                        }
                        className="w-24"
                        options={[
                          { value: "tcp", label: "TCP" },
                          { value: "udp", label: "UDP" },
                        ]}
                      />
                      <button
                        onClick={() =>
                          setEditExtraPorts((prev) =>
                            prev.filter((_, idx) => idx !== i),
                          )
                        }
                        className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                  <button
                    onClick={() =>
                      setEditExtraPorts((prev) => [
                        ...prev,
                        { host: "", container: "", protocol: "tcp" },
                      ])
                    }
                    className="w-full py-2 border border-dashed border-vpn-border rounded-lg text-sm text-vpn-muted hover:text-vpn-primary hover:border-vpn-primary transition-colors flex items-center justify-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Add Port Mapping
                  </button>
                </div>
              </div>

              {/* VPN Config Files */}
              <div className="pt-4 border-t border-vpn-border">
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  VPN Config Files
                </h3>
                <p className="text-xs text-vpn-muted mb-3">
                  Upload OpenVPN or WireGuard config files. Stored in{" "}
                  <span className="font-mono text-vpn-primary/70">
                    /gluetun/
                  </span>{" "}
                  inside the container.
                </p>
                <input
                  ref={configFileInputRef}
                  type="file"
                  accept=".ovpn,.conf,.key,.crt,.pem,.txt,.cfg"
                  onChange={handleConfigUpload}
                  className="hidden"
                  multiple
                />
                <button
                  type="button"
                  onClick={() => configFileInputRef.current?.click()}
                  disabled={uploadingConfig}
                  className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-vpn-border hover:border-vpn-primary rounded-xl text-sm text-vpn-muted hover:text-vpn-primary transition-all disabled:opacity-50"
                >
                  {uploadingConfig ? (
                    <RefreshCw className="w-4 h-4 animate-spin" />
                  ) : (
                    <Upload className="w-4 h-4" />
                  )}
                  {uploadingConfig ? "Uploading..." : "Upload config files"}
                </button>
                {configFiles.length > 0 && (
                  <div className="mt-2 space-y-1.5">
                    {configFiles.map((f) => (
                      <div
                        key={f.name}
                        className="flex items-center justify-between bg-vpn-input rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                          <span className="text-sm text-white truncate">
                            {f.name}
                          </span>
                          <span className="text-xs text-vpn-muted font-mono flex-shrink-0">
                            {f.path}
                          </span>
                        </div>
                        <button
                          onClick={() => handleConfigFileDelete(f.name)}
                          className="p-1 text-vpn-muted hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-vpn-border">
              <button
                onClick={() => setEditingConfig(false)}
                className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-muted text-vpn-text rounded-lg text-sm transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleRedeploy}
                disabled={redeploying}
                className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-blue-400 text-vpn-text rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Rocket
                  className={`w-4 h-4 text-blue-400 ${redeploying ? "animate-pulse" : ""}`}
                />
                {redeploying ? "Redeploying..." : "Save & Redeploy"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
