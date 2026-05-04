import { useState, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  AppWindow,
  RefreshCw,
  Play,
  Square,
  RotateCcw,
  Trash2,
  Eye,
  Search,
  PlusCircle,
  Grid3X3,
  Shield,
  WifiOff,
  Globe,
} from "lucide-react";
import api from "../services/api";
import StatusBadge from "../components/StatusBadge";
import ActionProgressDialog from "../components/ActionProgressDialog";
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
    loading,
    refreshO11Containers,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
  const [actionLoading, setActionLoading] = useState("");
  const [actionProgress, setActionProgress] = useState(null);
  const [searchQuery, setSearchQuery] = useState("");

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

  const handleRefresh = async () => {
    setRefreshing(true);
    await refreshO11Containers();
    setRefreshing(false);
  };

  const filtered = containers.filter(
    (c) =>
      searchQuery === "" ||
      c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
      c.image?.toLowerCase().includes(searchQuery.toLowerCase()),
  );

  const running = containers.filter((d) =>
    ["running", "healthy"].includes(d.status),
  ).length;
  const vpnConnected = containers.filter((d) => d.vpn_parent).length;

  return (
    <div className="space-y-6">
      {actionProgress && (
        <ActionProgressDialog
          action={actionProgress.action}
          target={actionProgress.target}
          finished={actionProgress.finished}
          error={actionProgress.error}
          onClose={() => setActionProgress(null)}
        />
      )}

      {/* Header */}
      <div className="flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <AppWindow className="w-7 h-7 text-vpn-primary" />
            Apps
          </h1>
          <p className="text-vpn-muted mt-1 text-sm">
            Installed apps from the App Catalog — running behind VPN or proxy.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => navigate("/app-catalog")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm"
          >
            <Grid3X3 className="w-4 h-4 text-vpn-primary" />
            Catalog
          </button>
          <button
            onClick={handleRefresh}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            <RefreshCw
              className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => navigate("/create-o11?type=app")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm"
          >
            <PlusCircle className="w-4 h-4 text-vpn-primary" />
            New App
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-vpn-primary/10">
            <AppWindow className="w-5 h-5 text-vpn-primary" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{containers.length}</p>
            <p className="text-xs text-vpn-muted">Total Apps</p>
          </div>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-emerald-500/10">
            <Play className="w-5 h-5 text-emerald-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{running}</p>
            <p className="text-xs text-vpn-muted">Running</p>
          </div>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 flex items-center gap-3">
          <div className="p-2 rounded-lg bg-blue-500/10">
            <Shield className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <p className="text-2xl font-bold text-white">{vpnConnected}</p>
            <p className="text-xs text-vpn-muted">VPN-protected</p>
          </div>
        </div>
      </div>

      {/* Search */}
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
        <input
          type="text"
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          placeholder="Search apps..."
          className="w-full pl-10 pr-4 py-2.5 bg-vpn-card border border-vpn-border rounded-xl text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
        />
      </div>

      {/* Empty state */}
      {!loading && filtered.length === 0 && (
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-12 text-center">
          <AppWindow className="w-12 h-12 text-vpn-muted mx-auto mb-4 opacity-40" />
          <h3 className="text-lg font-semibold text-white mb-2">
            {searchQuery
              ? "No apps match your search"
              : "No apps installed yet"}
          </h3>
          <p className="text-vpn-muted text-sm mb-6">
            {searchQuery
              ? "Try a different search term."
              : "Install apps from the App Catalog and connect them to your VPN."}
          </p>
          {!searchQuery && (
            <button
              onClick={() => navigate("/app-catalog")}
              className="inline-flex items-center gap-2 px-5 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm"
            >
              <Grid3X3 className="w-4 h-4 text-vpn-primary" />
              Browse App Catalog
            </button>
          )}
        </div>
      )}

      {/* Container cards */}
      {filtered.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-2 xl:grid-cols-3 gap-4">
          {filtered.map((c) => {
            const vpnInfo = getVpnInfoForParent(c.vpn_parent);
            const isLoading = (act) => actionLoading === `${c.name}-${act}`;

            return (
              <div
                key={c.name}
                className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex flex-col gap-3 hover:border-vpn-primary/40 transition-colors"
              >
                {/* Title + status */}
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <h3 className="font-semibold text-white truncate">
                      {c.name}
                    </h3>
                    <p className="text-xs text-vpn-muted truncate mt-0.5">
                      {c.image}
                    </p>
                  </div>
                  <StatusBadge status={c.status} />
                </div>

                {/* VPN / network badge */}
                <div className="flex items-center gap-2">
                  {c.vpn_parent ? (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-emerald-500/10 border border-emerald-500/20 text-emerald-400 text-xs">
                      <Shield className="w-3.5 h-3.5" />
                      <span className="truncate max-w-[120px]">
                        {c.vpn_parent}
                      </span>
                      {vpnInfo?.country && (
                        <span className="opacity-70">· {vpnInfo.country}</span>
                      )}
                    </div>
                  ) : (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-vpn-input border border-vpn-border text-vpn-muted text-xs">
                      <WifiOff className="w-3.5 h-3.5" />
                      No VPN
                    </div>
                  )}
                  {c.ports && Object.keys(c.ports).length > 0 && (
                    <div className="flex items-center gap-1.5 px-2 py-1 rounded-full bg-vpn-input border border-vpn-border text-vpn-muted text-xs">
                      <Globe className="w-3.5 h-3.5" />
                      {Object.entries(c.ports)
                        .slice(0, 2)
                        .map(([k, v]) => `${v}→${k.split("/")[0]}`)
                        .join(", ")}
                    </div>
                  )}
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2 mt-auto pt-2 border-t border-vpn-border">
                  <button
                    onClick={() => navigate(`/o11/${c.name}`)}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-vpn-input border border-vpn-border text-vpn-muted hover:text-vpn-primary hover:border-vpn-primary transition-colors"
                  >
                    <Eye className="w-3.5 h-3.5" />
                    Details
                  </button>

                  {["running", "healthy"].includes(c.status) ? (
                    <button
                      onClick={() => handleAction(c.name, "stop")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-vpn-input border border-vpn-border text-amber-400 hover:bg-amber-500/10 transition-colors disabled:opacity-50"
                    >
                      <Square className="w-3.5 h-3.5" />
                      Stop
                    </button>
                  ) : (
                    <button
                      onClick={() => handleAction(c.name, "start")}
                      disabled={!!actionLoading}
                      className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-vpn-input border border-vpn-border text-emerald-400 hover:bg-emerald-500/10 transition-colors disabled:opacity-50"
                    >
                      <Play className="w-3.5 h-3.5" />
                      Start
                    </button>
                  )}

                  <button
                    onClick={() => handleAction(c.name, "restart")}
                    disabled={!!actionLoading}
                    className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-vpn-input border border-vpn-border text-vpn-muted hover:text-blue-400 hover:bg-blue-500/10 transition-colors disabled:opacity-50"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    Restart
                  </button>

                  <button
                    onClick={() => handleDelete(c.name)}
                    disabled={!!actionLoading}
                    className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs bg-vpn-input border border-vpn-border text-vpn-muted hover:text-red-400 hover:bg-red-500/10 transition-colors disabled:opacity-50"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                    Delete
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
