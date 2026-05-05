import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppWindow,
  RefreshCw,
  Play,
  AlertTriangle,
  Shield,
  Globe,
  Search,
  PlusCircle,
  Grid3X3,
} from "lucide-react";
import api from "../services/api";
import ActionProgressDialog from "../components/ActionProgressDialog";
import O11ContainerCard, { isProxied } from "../components/O11ContainerCard";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function Apps() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    appContainers: containers,
    containers: managedContainers,
    vpnInfoMap,
    instanceNetworkData,
    o11Instances,
    loading,
    refreshO11Containers,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [actionProgress, setActionProgress] = useState(null);
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
    setActionProgress({ action, target: name });
    try {
      const res = await api.post(`/containers/dependents/${name}/${action}`);
      toast.success(res.data?.message || `${name} ${action}ed`);
      setActionProgress({ action, target: name, finished: true });
      refreshO11Containers();
    } catch (err) {
      const msg = err.response?.data?.detail || `Failed to ${action} ${name}`;
      toast.error(msg);
      setActionProgress({ action, target: name, finished: true, error: msg });
    } finally {
      setActionLoading("");
      setTimeout(() => setActionProgress(null), 1200);
    }
  };

  const handleDelete = async (name) => {
    const ok = await confirm({
      title: "Delete App Container",
      message: `Delete container "${name}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    setActionLoading(`${name}-delete`);
    setActionProgress({ action: "delete", target: name });
    try {
      await api.delete(`/containers/dependents/${name}`);
      toast.success(`Container "${name}" deleted`);
      setActionProgress({ action: "delete", target: name, finished: true });
      refreshO11Containers();
    } catch (err) {
      const msg = err.response?.data?.detail || `Failed to delete ${name}`;
      toast.error(msg);
      setActionProgress({
        action: "delete",
        target: name,
        finished: true,
        error: msg,
      });
    } finally {
      setActionLoading("");
      setTimeout(() => setActionProgress(null), 1200);
    }
  };

  const handleCopyProxyUrl = async (url) => {
    try {
      await navigator.clipboard.writeText(url);
      toast.success("URL copied");
    } catch {
      toast.error("Failed to copy URL");
    }
  };

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshO11Containers();
    setRefreshing(false);
  };

  const activeProxyEntries = (() => {
    const byUrl = new Map();
    const resolveContainerNameFromHost = (rawHost) => {
      const displayHost = String(rawHost || "")
        .replace(/^\[|\]$/g, "")
        .trim();
      const host = displayHost.toLowerCase();
      if (!host) return "";
      const matchedContainer = managedContainers.find((c) => {
        const name = String(c.name || "").toLowerCase();
        const dockerName = String(c.docker_name || "").toLowerCase();
        const gluetunName = `gluetun-${name}`;
        const ip = String(c.ip_address || "").toLowerCase();
        return (
          host === ip ||
          host === name ||
          host === dockerName ||
          host === gluetunName
        );
      });
      return matchedContainer?.name || displayHost;
    };

    for (const [instanceId, instanceData] of Object.entries(
      instanceNetworkData || {},
    )) {
      const usage = instanceData?.Usage || {};
      const instanceName =
        o11Instances.find((i) => i.id === instanceId)?.name || instanceId;
      for (const [category, categoryData] of Object.entries(usage)) {
        const proxyMap = categoryData?.Proxy || {};
        for (const [url, info] of Object.entries(proxyMap)) {
          const normalized = String(url).replace(/^[a-z]+:\/\//i, "");
          const host = normalized.split("/")[0]?.split(":")[0] || "";
          byUrl.set(`${instanceId}::${url}`, {
            url,
            category,
            instanceName,
            containerName: resolveContainerNameFromHost(host),
            streamCount: Array.isArray(info?.Streams) ? info.Streams.length : 0,
          });
        }
      }
    }
    return Array.from(byUrl.values()).sort(
      (a, b) => b.streamCount - a.streamCount,
    );
  })();

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
      icon: AppWindow,
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
  ];

  return (
    <>
      <div>
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <AppWindow className="w-7 h-7 text-vpn-primary" />
              Apps
            </h1>
            <p className="text-vpn-muted mt-1">
              Installed apps from the App Catalog — running behind VPN or proxy.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <button
              onClick={handleRefresh}
              disabled={refreshing}
              className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <RefreshCw
                className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
            <button
              onClick={() => navigate("/app-catalog")}
              className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <Grid3X3 className="w-4 h-4 text-vpn-primary" />
              Catalog
            </button>
            <button
              onClick={() => navigate("/create-o11?type=app")}
              className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-vpn-primary" />
              New App
            </button>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-4 mb-6">
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
            placeholder="Search apps..."
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
            <AppWindow className="w-16 h-16 text-vpn-border mx-auto mb-4" />
            <h3 className="text-xl font-semibold text-vpn-text mb-2">
              {searchQuery || statusFilter
                ? "No matching apps"
                : "No apps installed yet"}
            </h3>
            <p className="text-vpn-muted mb-6">
              {searchQuery || statusFilter
                ? "Try adjusting your search or filter."
                : "Install apps from the App Catalog and connect them to your VPN."}
            </p>
            {!searchQuery && !statusFilter && (
              <button
                onClick={() => navigate("/app-catalog")}
                className="inline-flex items-center gap-2 px-5 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm"
              >
                <Grid3X3 className="w-4 h-4 text-vpn-primary" />
                Browse App Catalog
              </button>
            )}
          </div>
        ) : (
          <div className="space-y-8">
            {/* VPN Connected */}
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
                <div className="grid grid-cols-1 gap-4">
                  {filteredContainers
                    .filter((c) => c.vpn_parent)
                    .map((dep) => (
                      <O11ContainerCard
                        key={dep.id}
                        dep={dep}
                        parentInfo={getVpnInfoForParent(dep.vpn_parent)}
                        actionLoading={actionLoading}
                        activeProxyEntries={activeProxyEntries}
                        onAction={handleAction}
                        onDelete={handleDelete}
                        onCopyProxyUrl={handleCopyProxyUrl}
                        detailBasePath="/apps"
                      />
                    ))}
                </div>
              </div>
            )}

            {/* Proxy Connected */}
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
                <div className="grid grid-cols-1 gap-4">
                  {filteredContainers
                    .filter((c) => isProxied(c))
                    .map((dep) => (
                      <O11ContainerCard
                        key={dep.id}
                        dep={dep}
                        parentInfo={null}
                        actionLoading={actionLoading}
                        activeProxyEntries={activeProxyEntries}
                        onAction={handleAction}
                        onDelete={handleDelete}
                        onCopyProxyUrl={handleCopyProxyUrl}
                        detailBasePath="/apps"
                      />
                    ))}
                </div>
              </div>
            )}

            {/* No VPN / No Proxy */}
            {filteredContainers.filter((c) => !c.vpn_parent && !isProxied(c))
              .length > 0 && (
              <div>
                <div className="flex items-center gap-3 mb-4">
                  <div className="flex items-center gap-2">
                    <AppWindow className="w-5 h-5 text-vpn-primary" />
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
                <div className="grid grid-cols-1 gap-4">
                  {filteredContainers
                    .filter((c) => !c.vpn_parent && !isProxied(c))
                    .map((dep) => (
                      <O11ContainerCard
                        key={dep.id}
                        dep={dep}
                        parentInfo={null}
                        actionLoading={actionLoading}
                        activeProxyEntries={activeProxyEntries}
                        onAction={handleAction}
                        onDelete={handleDelete}
                        onCopyProxyUrl={handleCopyProxyUrl}
                        detailBasePath="/apps"
                      />
                    ))}
                </div>
              </div>
            )}
          </div>
        )}
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
