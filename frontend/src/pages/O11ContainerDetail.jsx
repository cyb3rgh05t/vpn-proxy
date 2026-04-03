import { useState, useEffect, useCallback, useRef } from "react";
import { useParams, useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Play,
  Square,
  RotateCcw,
  Trash2,
  RefreshCw,
  Terminal,
  Network,
  Globe,
  Shield,
  Wifi,
  WifiOff,
  MapPin,
  ArrowUpDown,
  Box,
  Image,
  HardDrive,
  Tag,
  Clock,
  Settings,
  Save,
  AlertTriangle,
  Upload,
  File,
  FolderOpen,
  X,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function O11ContainerDetail() {
  const { name } = useParams();
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    containers: managedContainers,
    vpnInfoMap,
    o11Containers,
    refreshO11Containers,
  } = useContainerData();

  // Use cached data from context for instant rendering
  const cachedContainer = o11Containers.find((c) => c.name === name);

  const [container, setContainer] = useState(cachedContainer || null);
  const [loading, setLoading] = useState(!cachedContainer);
  const [logs, setLogs] = useState("");
  const [tab, setTab] = useState("info");
  const [actionLoading, setActionLoading] = useState("");
  const [refreshing, setRefreshing] = useState(false);

  // Network mode change
  const [showNetworkModal, setShowNetworkModal] = useState(false);
  const [newNetworkMode, setNewNetworkMode] = useState("");
  const [networkModeLoading, setNetworkModeLoading] = useState(false);
  const [gluetunContainers, setGluetunContainers] = useState([]);
  const [dockerNetworks, setDockerNetworks] = useState([]);

  // File management
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadTargetPath, setUploadTargetPath] = useState("");
  const [filesLoading, setFilesLoading] = useState(false);
  const fileInputRef = useRef(null);

  // Description
  const [description, setDescription] = useState("");
  const [descSaving, setDescSaving] = useState(false);
  const descFocused = useRef(false);
  const initialDescLoad = useRef(true);

  const fetchContainer = useCallback(async () => {
    try {
      const res = await api.get(
        `/containers/dependents/${encodeURIComponent(name)}/inspect`,
      );
      setContainer(res.data);
    } catch {
      navigate("/o11");
    } finally {
      setLoading(false);
    }
  }, [name, navigate]);

  const fetchDbInfo = useCallback(async () => {
    try {
      const res = await api.get(
        `/containers/dependents/${encodeURIComponent(name)}/db-info`,
      );
      if (initialDescLoad.current || !descFocused.current) {
        setDescription(res.data.description || "");
        initialDescLoad.current = false;
      }
    } catch {
      // ignore
    }
  }, [name]);

  const handleDescriptionSave = async () => {
    const trimmed = description.trim();
    if (trimmed === (container?.description || "")) return;
    setDescSaving(true);
    try {
      await api.put(
        `/containers/dependents/${encodeURIComponent(name)}/description`,
        { description: trimmed || null },
      );
      toast.success("Description saved");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save description");
    } finally {
      setDescSaving(false);
    }
  };

  const fetchLogs = useCallback(async () => {
    try {
      const res = await api.get(
        `/containers/dependents/${encodeURIComponent(name)}/logs`,
      );
      setLogs(res.data.logs);
    } catch {
      setLogs("Failed to fetch logs.");
    }
  }, [name]);

  const fetchGluetunContainers = useCallback(async () => {
    try {
      const res = await api.get("/containers");
      setGluetunContainers(Array.isArray(res.data) ? res.data : []);
    } catch {
      setGluetunContainers([]);
    }
  }, []);

  const fetchDockerNetworks = useCallback(async () => {
    try {
      const res = await api.get("/containers/networks");
      setDockerNetworks(Array.isArray(res.data) ? res.data : []);
    } catch {
      setDockerNetworks([]);
    }
  }, []);

  const fetchFiles = useCallback(async () => {
    setFilesLoading(true);
    try {
      const res = await api.get(
        `/containers/dependents/files/${encodeURIComponent(name)}`,
      );
      setUploadedFiles(Array.isArray(res.data) ? res.data : []);
    } catch {
      setUploadedFiles([]);
    } finally {
      setFilesLoading(false);
    }
  }, [name]);

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const targetClean = uploadTargetPath.trim().replace(/^\/+|\/+$/g, "");
        const url = `/containers/dependents/upload-files/${encodeURIComponent(name)}${targetClean ? `?target_path=${encodeURIComponent(targetClean)}` : ""}`;
        await api.post(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
        });
      }
      toast.success(
        `${files.length} file${files.length > 1 ? "s" : ""} uploaded`,
      );
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeFile = async (storedPath) => {
    try {
      await api.delete(
        `/containers/dependents/files/${encodeURIComponent(name)}/${storedPath}`,
      );
      toast.success("File deleted");
      fetchFiles();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete file");
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  useEffect(() => {
    fetchContainer();
    fetchDbInfo();
  }, [fetchContainer, fetchDbInfo]);

  useEffect(() => {
    if (tab === "logs") fetchLogs();
    if (tab === "files") fetchFiles();
  }, [tab, fetchLogs, fetchFiles]);

  useEffect(() => {
    const interval = setInterval(() => {
      fetchContainer();
      fetchDbInfo();
    }, 5000);
    return () => clearInterval(interval);
  }, [fetchContainer, fetchDbInfo]);

  const getVpnInfoForParent = (vpnParentName) => {
    if (!vpnParentName) return null;
    const mc = managedContainers.find(
      (m) =>
        m.docker_name === vpnParentName ||
        `gluetun-${m.name}` === vpnParentName ||
        m.name === vpnParentName,
    );
    if (!mc) return null;
    return vpnInfoMap[String(mc.id)] || null;
  };

  const handleAction = async (action) => {
    setActionLoading(action);
    try {
      const res = await api.post(
        `/containers/dependents/${encodeURIComponent(name)}/${action}`,
      );
      toast.success(res.data?.message || `Container ${action}ed`);
      fetchContainer();
      refreshO11Containers();
    } catch (err) {
      toast.error(err.response?.data?.detail || `Failed to ${action}`);
    } finally {
      setActionLoading("");
    }
  };

  const handleDelete = async () => {
    const ok = await confirm({
      title: "Delete Container",
      message: `Delete container "${name}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/containers/dependents/${encodeURIComponent(name)}`);
      toast.success(`Container "${name}" deleted`);
      refreshO11Containers();
      navigate("/o11");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete container");
    }
  };

  const openNetworkModal = () => {
    fetchGluetunContainers();
    fetchDockerNetworks();
    setNewNetworkMode(container?.network_mode || "");
    setShowNetworkModal(true);
  };

  const handleNetworkModeChange = async () => {
    if (!newNetworkMode.trim()) return;
    if (newNetworkMode === container?.network_mode) {
      setShowNetworkModal(false);
      return;
    }
    setNetworkModeLoading(true);
    try {
      const res = await api.post(
        `/containers/dependents/${encodeURIComponent(name)}/network-mode`,
        { network_mode: newNetworkMode },
      );
      toast.success(res.data?.message || "Network mode changed");
      setShowNetworkModal(false);
      fetchContainer();
      refreshO11Containers();
    } catch (err) {
      toast.error(
        err.response?.data?.detail || "Failed to change network mode",
      );
    } finally {
      setNetworkModeLoading(false);
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

  // Determine VPN parent from network_mode
  const networkMode = container.network_mode || "";
  const vpnParentName = networkMode.startsWith("container:")
    ? networkMode.split(":")[1]
    : null;
  const parentInfo = getVpnInfoForParent(vpnParentName);

  return (
    <div>
      <button
        onClick={() => navigate("/o11")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to O11
      </button>

      {/* Header */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <div className="flex items-start justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold text-white">{container.name}</h1>
            <p className="text-vpn-muted mt-1 font-mono text-sm">
              {container.image}
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

        <div className="flex items-center gap-2 flex-wrap">
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
            onClick={openNetworkModal}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-blue-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm ml-auto"
          >
            <Network className="w-4 h-4 text-blue-400" />
            Change Network Mode
          </button>
          <button
            onClick={handleDelete}
            className="flex items-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-red-400 text-vpn-text rounded-lg text-sm transition-all shadow-sm"
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
            {/* VPN Connection */}
            {vpnParentName ? (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  VPN Connection
                </h3>
                <div className="bg-blue-500/5 border border-blue-500/20 rounded-xl p-4 space-y-3">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-2">
                      <Shield className="w-4 h-4 text-blue-400" />
                      <span className="text-sm text-blue-400 font-medium">
                        VPN Routed via
                      </span>
                      <span className="text-sm text-white font-semibold">
                        {vpnParentName}
                      </span>
                    </div>
                    {parentInfo?.vpn_status && (
                      <span
                        className={`flex items-center gap-1.5 text-sm font-medium ${
                          parentInfo.vpn_status === "running"
                            ? "text-emerald-400"
                            : "text-red-400"
                        }`}
                      >
                        {parentInfo.vpn_status === "running" ? (
                          <Wifi className="w-4 h-4" />
                        ) : (
                          <WifiOff className="w-4 h-4" />
                        )}
                        {parentInfo.vpn_status === "running"
                          ? "Connected"
                          : "Disconnected"}
                      </span>
                    )}
                  </div>
                  {parentInfo && (
                    <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                      {parentInfo.public_ip && (
                        <div className="bg-vpn-input rounded-lg p-3">
                          <p className="text-xs text-vpn-muted mb-1">
                            <Globe className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Public IP
                          </p>
                          <p className="text-sm font-mono text-vpn-primary">
                            {parentInfo.public_ip}
                          </p>
                        </div>
                      )}
                      {(parentInfo.country || parentInfo.region) && (
                        <div className="bg-vpn-input rounded-lg p-3">
                          <p className="text-xs text-vpn-muted mb-1">
                            <MapPin className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Location
                          </p>
                          <p className="text-sm text-white">
                            {[parentInfo.region, parentInfo.country]
                              .filter(Boolean)
                              .join(", ")}
                          </p>
                        </div>
                      )}
                      {parentInfo.port_forwarded && (
                        <div className="bg-vpn-input rounded-lg p-3">
                          <p className="text-xs text-vpn-muted mb-1">
                            <ArrowUpDown className="w-3 h-3 inline mr-1 -mt-0.5" />
                            Port Forward
                          </p>
                          <p className="text-sm font-mono text-amber-400">
                            {parentInfo.port_forwarded}
                          </p>
                        </div>
                      )}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Shield className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  VPN Connection
                </h3>
                <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-xl p-4">
                  <div className="flex items-center gap-2">
                    <Shield className="w-4 h-4 text-vpn-muted" />
                    <span className="text-sm text-vpn-muted">
                      No VPN connection
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* Proxy Connection */}
            {(() => {
              const netNames = container.networks
                ? Array.isArray(container.networks)
                  ? container.networks
                  : Object.keys(container.networks)
                : [];
              const proxyNets = netNames.filter((n) =>
                n.toLowerCase().includes("proxy"),
              );
              if (!vpnParentName && proxyNets.length > 0) {
                return (
                  <div>
                    <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                      <Globe className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                      Proxy Connection
                    </h3>
                    <div className="bg-purple-500/5 border border-purple-500/20 rounded-xl p-4">
                      <div className="flex items-center gap-2 mb-3">
                        <Globe className="w-4 h-4 text-purple-400" />
                        <span className="text-sm text-purple-400 font-medium">
                          Proxy Connected
                        </span>
                      </div>
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {proxyNets.map((netName) => {
                          const netInfo =
                            !Array.isArray(container.networks) &&
                            container.networks?.[netName];
                          return (
                            <div
                              key={netName}
                              className="bg-vpn-input rounded-lg p-3"
                            >
                              <p className="text-xs text-vpn-muted mb-1">
                                <Network className="w-3 h-3 inline mr-1 -mt-0.5" />
                                Network
                              </p>
                              <p className="text-sm text-purple-400 font-medium">
                                {netName}
                              </p>
                              {netInfo?.ip && (
                                <p className="text-xs text-vpn-muted font-mono mt-1">
                                  {netInfo.ip}
                                </p>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  </div>
                );
              }
              return null;
            })()}

            {/* Network */}
            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                <Network className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                Ports & Network
              </h3>
              <div className="grid grid-cols-3 gap-3">
                {Object.entries(container.ports || {}).map(
                  ([internal, host]) => {
                    const [cPort, proto] = internal.split("/");
                    return (
                      <div
                        key={internal}
                        className="bg-vpn-input rounded-lg p-3 border border-vpn-border/30"
                      >
                        <div className="flex items-center justify-between mb-1">
                          <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                            {proto || "tcp"}
                          </span>
                        </div>
                        <p className="text-sm font-mono text-white">
                          <span className="text-vpn-primary">
                            {host || "—"}
                          </span>
                          <span className="text-vpn-muted mx-1">→</span>
                          {cPort}
                        </p>
                        <p className="text-[10px] text-vpn-muted mt-0.5">
                          host → container
                        </p>
                      </div>
                    );
                  },
                )}
              </div>
              <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border mt-3">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">Network Mode</span>
                  <span className="text-sm text-white font-mono">
                    {networkMode || "default"}
                  </span>
                </div>
                {container.hostname && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-vpn-muted">Hostname</span>
                    <span className="text-sm text-white font-mono">
                      {container.hostname}
                    </span>
                  </div>
                )}
                {Object.entries(container.networks || {}).map(
                  ([netName, netInfo]) => (
                    <div
                      key={netName}
                      className="flex justify-between px-4 py-3"
                    >
                      <span className="text-sm text-vpn-muted">{netName}</span>
                      <span className="text-sm text-white font-mono">
                        {netInfo.ip || "—"}
                      </span>
                    </div>
                  ),
                )}
              </div>
            </div>

            {/* Mounts */}
            {container.mounts?.length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <HardDrive className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Volumes
                </h3>
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                  {container.mounts.map((m, i) => (
                    <div
                      key={i}
                      className="flex justify-between px-4 py-3 gap-4"
                    >
                      <span className="text-sm text-vpn-muted font-mono truncate flex-1">
                        {m.source}
                      </span>
                      <span className="text-vpn-muted text-sm">→</span>
                      <span className="text-sm text-white font-mono truncate flex-1 text-right">
                        {m.target}
                      </span>
                      <span className="text-xs text-vpn-muted bg-vpn-card px-2 py-0.5 rounded">
                        {m.mode}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Environment */}
            {Object.keys(container.env || {}).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Settings className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Environment Variables
                </h3>
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border max-h-80 overflow-auto">
                  {Object.entries(container.env).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between px-4 py-3 gap-4"
                    >
                      <span className="text-sm text-vpn-muted font-mono">
                        {key}
                      </span>
                      <span className="text-sm text-white font-mono truncate max-w-[50%] text-right">
                        {value}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Labels */}
            {Object.keys(container.labels || {}).length > 0 && (
              <div>
                <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                  <Tag className="w-4 h-4 inline mr-1.5 -mt-0.5" />
                  Labels
                </h3>
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border max-h-60 overflow-auto">
                  {Object.entries(container.labels).map(([key, value]) => (
                    <div
                      key={key}
                      className="flex justify-between px-4 py-3 gap-4"
                    >
                      <span className="text-sm text-vpn-muted font-mono truncate">
                        {key}
                      </span>
                      <span className="text-sm text-white font-mono truncate max-w-[50%] text-right">
                        {value || "—"}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Details */}
            <div>
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider mb-3">
                Details
              </h3>
              <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">
                    <Box className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                    Container ID
                  </span>
                  <span className="text-sm text-white font-mono">
                    {container.container_id
                      ? container.container_id.substring(0, 12)
                      : "N/A"}
                  </span>
                </div>
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">
                    <Image className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                    Image
                  </span>
                  <span className="text-sm text-white font-mono">
                    {container.image}
                  </span>
                </div>
                {container.restart_policy?.Name && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-vpn-muted">
                      Restart Policy
                    </span>
                    <span className="text-sm text-white">
                      {container.restart_policy.Name}
                    </span>
                  </div>
                )}
                <div className="flex justify-between px-4 py-3">
                  <span className="text-sm text-vpn-muted">
                    <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                    Created
                  </span>
                  <span className="text-sm text-white">
                    {container.created
                      ? new Date(container.created).toLocaleString()
                      : "N/A"}
                  </span>
                </div>
                {container.started && (
                  <div className="flex justify-between px-4 py-3">
                    <span className="text-sm text-vpn-muted">
                      <Clock className="w-3.5 h-3.5 inline mr-1.5 -mt-0.5" />
                      Started
                    </span>
                    <span className="text-sm text-white">
                      {new Date(container.started).toLocaleString()}
                    </span>
                  </div>
                )}
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
                Upload Files
              </h3>
              <div className="bg-vpn-input/30 border border-vpn-border/50 rounded-xl p-4 space-y-3">
                <div>
                  <label className="block text-xs font-medium text-vpn-muted mb-1.5">
                    Container Target Path (optional subfolder)
                  </label>
                  <input
                    type="text"
                    value={uploadTargetPath}
                    onChange={(e) => setUploadTargetPath(e.target.value)}
                    placeholder="e.g. config or data/epg"
                    className="w-full bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white font-mono placeholder-vpn-muted focus:outline-none focus:border-vpn-primary transition-colors"
                  />
                </div>
                <div className="flex items-center gap-3">
                  <input
                    ref={fileInputRef}
                    type="file"
                    multiple
                    onChange={handleFileUpload}
                    className="hidden"
                    id="file-upload-detail"
                  />
                  <label
                    htmlFor="file-upload-detail"
                    className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium cursor-pointer transition-all ${
                      uploading
                        ? "bg-vpn-input text-vpn-muted cursor-not-allowed"
                        : "bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text"
                    }`}
                  >
                    <Upload
                      className={`w-4 h-4 ${uploading ? "animate-pulse" : ""}`}
                    />
                    {uploading ? "Uploading..." : "Choose Files"}
                  </label>
                  {uploadTargetPath.trim() && (
                    <span className="text-xs text-vpn-muted">
                      Target:{" "}
                      <span className="text-vpn-primary font-mono">
                        {uploadTargetPath.trim()}
                      </span>
                    </span>
                  )}
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
                  onClick={fetchFiles}
                  disabled={filesLoading}
                  className="flex items-center gap-1 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50"
                >
                  <RefreshCw
                    className={`w-3 h-3 text-vpn-primary ${filesLoading ? "animate-spin" : ""}`}
                  />
                  Refresh
                </button>
              </div>

              {filesLoading ? (
                <div className="flex justify-center py-8">
                  <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vpn-primary"></div>
                </div>
              ) : uploadedFiles.length === 0 ? (
                <div className="text-center py-8 bg-vpn-input/30 border border-vpn-border/50 rounded-xl">
                  <FolderOpen className="w-10 h-10 text-vpn-border mx-auto mb-2" />
                  <p className="text-sm text-vpn-muted">
                    No files uploaded yet
                  </p>
                </div>
              ) : (
                <div className="bg-vpn-input rounded-lg divide-y divide-vpn-border">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.stored_path}
                      className="flex items-center justify-between px-4 py-3 gap-3"
                    >
                      <div className="flex items-center gap-3 min-w-0 flex-1">
                        <File className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                        <div className="min-w-0">
                          <p className="text-sm text-white font-mono truncate">
                            {f.stored_path}
                          </p>
                          <p className="text-xs text-vpn-muted">
                            {formatFileSize(f.size)}
                            {f.target_path && (
                              <span className="ml-2">
                                Target:{" "}
                                <span className="text-purple-400">
                                  {f.target_path}
                                </span>
                              </span>
                            )}
                          </p>
                        </div>
                      </div>
                      <button
                        onClick={() => removeFile(f.stored_path)}
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

      {/* Network Mode Modal */}
      {showNetworkModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-50 flex items-center justify-center p-4">
          <div className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-lg">
            <div className="flex items-center justify-between p-6 border-b border-vpn-border">
              <h2 className="text-lg font-bold text-white flex items-center gap-2">
                <Network className="w-5 h-5 text-vpn-primary" />
                Change Network Mode
              </h2>
              <button
                onClick={() => setShowNetworkModal(false)}
                className="p-2 rounded-lg text-vpn-muted hover:text-white hover:bg-vpn-input transition-colors"
              >
                ✕
              </button>
            </div>

            <div className="p-6 space-y-4">
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 text-amber-400 mt-0.5 flex-shrink-0" />
                  <p className="text-xs text-amber-400">
                    Changing network mode will recreate the container. It will
                    be stopped and removed, then recreated with the new network
                    mode. All data in non-persistent volumes will be lost.
                  </p>
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  Current Network Mode
                </label>
                <div className="bg-vpn-input rounded-lg px-4 py-2.5 text-sm text-vpn-muted font-mono">
                  {container.network_mode || "default"}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  New Network Mode
                </label>
                <div className="space-y-2">
                  {/* Quick select: Gluetun containers */}
                  {gluetunContainers.length > 0 && (
                    <div>
                      <p className="text-xs text-vpn-muted mb-1.5">
                        Route through VPN (container mode):
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {gluetunContainers.map((gc) => {
                          const dockerName =
                            gc.docker_name || `gluetun-${gc.name}`;
                          const mode = `container:${dockerName}`;
                          return (
                            <button
                              key={gc.id}
                              onClick={() => setNewNetworkMode(mode)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                newNetworkMode === mode
                                  ? "bg-vpn-primary text-black"
                                  : "bg-vpn-input text-vpn-text hover:bg-vpn-border"
                              }`}
                            >
                              <Shield className="w-3 h-3 inline mr-1 -mt-0.5" />
                              {gc.name}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}

                  {/* Quick select: common modes */}
                  <div>
                    <p className="text-xs text-vpn-muted mb-1.5">
                      Standard modes:
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {["bridge", "host", "none"].map((mode) => (
                        <button
                          key={mode}
                          onClick={() => setNewNetworkMode(mode)}
                          className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                            newNetworkMode === mode
                              ? "bg-vpn-primary text-black"
                              : "bg-vpn-input text-vpn-text hover:bg-vpn-border"
                          }`}
                        >
                          {mode}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Docker networks */}
                  {dockerNetworks.filter(
                    (n) => !["bridge", "host", "none"].includes(n.name),
                  ).length > 0 && (
                    <div>
                      <p className="text-xs text-vpn-muted mb-1.5">
                        Docker networks:
                      </p>
                      <div className="flex flex-wrap gap-2">
                        {dockerNetworks
                          .filter(
                            (n) => !["bridge", "host", "none"].includes(n.name),
                          )
                          .map((net) => (
                            <button
                              key={net.name}
                              onClick={() => setNewNetworkMode(net.name)}
                              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-all ${
                                newNetworkMode === net.name
                                  ? "bg-vpn-primary text-black"
                                  : "bg-vpn-input text-vpn-text hover:bg-vpn-border"
                              }`}
                            >
                              {net.name}
                              <span className="text-[9px] ml-1 opacity-60">
                                ({net.driver})
                              </span>
                            </button>
                          ))}
                      </div>
                    </div>
                  )}

                  {/* Manual input */}
                  <input
                    type="text"
                    value={newNetworkMode}
                    onChange={(e) => setNewNetworkMode(e.target.value)}
                    placeholder="e.g. container:gluetun-vpn or bridge"
                    className="w-full bg-vpn-input border border-vpn-border rounded-lg px-4 py-2.5 text-sm text-white font-mono placeholder-vpn-muted focus:outline-none focus:border-vpn-primary"
                  />
                </div>
              </div>
            </div>

            <div className="flex items-center justify-end gap-3 p-6 border-t border-vpn-border">
              <button
                onClick={() => setShowNetworkModal(false)}
                className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-muted text-vpn-text rounded-lg text-sm transition-all shadow-sm"
              >
                Cancel
              </button>
              <button
                onClick={handleNetworkModeChange}
                disabled={
                  networkModeLoading ||
                  !newNetworkMode.trim() ||
                  newNetworkMode === container.network_mode
                }
                className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-blue-400 text-vpn-text rounded-lg text-sm font-medium transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Save
                  className={`w-4 h-4 text-blue-400 ${networkModeLoading ? "animate-pulse" : ""}`}
                />
                {networkModeLoading ? "Applying..." : "Apply & Recreate"}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
