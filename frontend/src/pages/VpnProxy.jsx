import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Shield,
  Activity,
  AlertTriangle,
  HeartCrack,
  RefreshCw,
  Search,
  Server,
  Network,
  Wifi,
  WifiOff,
  CheckSquare,
  Square,
  Play,
  RotateCcw,
  Trash2,
  X,
} from "lucide-react";
import api from "../services/api";
import ContainerCard from "../components/ContainerCard";
import ActionProgressDialog from "../components/ActionProgressDialog";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import { useContainerData } from "../context/ContainerDataContext";
import { useLocation, useSearchParams } from "react-router-dom";

export default function VpnProxy() {
  const location = useLocation();
  const [searchParams, setSearchParams] = useSearchParams();
  const scrolledRef = useRef(false);
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const {
    containers,
    vpnInfoMap,
    loading,
    error,
    refreshContainers,
    refreshAll,
  } = useContainerData();

  // Selection state
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState(new Set());
  const [bulkLoading, setBulkLoading] = useState("");
  const [bulkProgress, setBulkProgress] = useState(null); // { action, total, done, success, failed }
  const [actionProgress, setActionProgress] = useState(null);

  // Scroll to container card when navigated with hash
  useEffect(() => {
    if (scrolledRef.current || !location.hash || loading) return;
    const el = document.getElementById(location.hash.slice(1));
    if (el) {
      scrolledRef.current = true;
      setTimeout(() => {
        el.scrollIntoView({ behavior: "smooth", block: "center" });
        el.classList.add("ring-2", "ring-vpn-primary", "rounded-xl");
        setTimeout(
          () => el.classList.remove("ring-2", "ring-vpn-primary", "rounded-xl"),
          2000,
        );
      }, 100);
    }
  }, [location.hash, loading]);

  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState(
    () => searchParams.get("status") || null,
  );
  const [providerFilter, setProviderFilter] = useState(
    () => searchParams.get("provider") || "all",
  );
  const [activeCategoryTab, setActiveCategoryTab] = useState("proxy");

  const running = containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const stopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;
  const created = containers.filter((c) => c.status === "created").length;

  const vpnConnected = containers.filter((c) => {
    const info = vpnInfoMap[String(c.id)];
    return info?.vpn_status === "running" && info?.public_ip;
  }).length;
  // Include unhealthy containers in disconnected count (they are still active but VPN is down)
  const active = containers.filter((c) =>
    ["running", "healthy", "unhealthy"].includes(c.status),
  ).length;
  const vpnDisconnected = active - vpnConnected;

  const unhealthy = containers.filter((c) => c.status === "unhealthy").length;

  const stats = [
    {
      label: "Total",
      value: containers.length,
      icon: Shield,
      color: "text-vpn-primary",
      bg: "bg-vpn-primary/10",
      hoverBorder: "hover:border-vpn-primary",
      activeBorder: "border-vpn-primary ring-1 ring-vpn-primary/30",
      filter: "all",
    },
    {
      label: "Running",
      value: running,
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      hoverBorder: "hover:border-emerald-400",
      activeBorder: "border-emerald-400 ring-1 ring-emerald-400/30",
      filter: "running",
    },
    {
      label: "VPN Connected",
      value: vpnConnected,
      icon: Wifi,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      hoverBorder: "hover:border-emerald-400",
      activeBorder: "border-emerald-400 ring-1 ring-emerald-400/30",
      filter: "vpn-connected",
    },
    {
      label: "VPN Disconnected",
      value: vpnDisconnected,
      icon: WifiOff,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      hoverBorder: "hover:border-amber-400",
      activeBorder: "border-amber-400 ring-1 ring-amber-400/30",
      filter: "vpn-disconnected",
    },
    {
      label: "Unhealthy",
      value: unhealthy,
      icon: HeartCrack,
      color: "text-red-400",
      bg: "bg-red-500/10",
      hoverBorder: "hover:border-red-400",
      activeBorder: "border-red-400 ring-1 ring-red-400/30",
      filter: "unhealthy",
    },
    {
      label: "Created",
      value: created,
      icon: Square,
      color: "text-sky-400",
      bg: "bg-sky-500/10",
      hoverBorder: "hover:border-sky-400",
      activeBorder: "border-sky-400 ring-1 ring-sky-400/30",
      filter: "created",
    },
    {
      label: "Stopped",
      value: stopped,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      hoverBorder: "hover:border-amber-400",
      activeBorder: "border-amber-400 ring-1 ring-amber-400/30",
      filter: "stopped",
    },
  ];

  const matchesFilter = (container) => {
    if (!statusFilter || statusFilter === "all") return true;
    const s = container.status;
    if (statusFilter === "running") return ["running", "healthy"].includes(s);
    if (statusFilter === "stopped")
      return ["exited", "dead", "removed"].includes(s);
    if (statusFilter === "created") return s === "created";
    if (statusFilter === "vpn-connected") {
      const info = vpnInfoMap[String(container.id)];
      return info?.vpn_status === "running" && !!info?.public_ip;
    }
    if (statusFilter === "vpn-disconnected") {
      if (!["running", "healthy", "unhealthy"].includes(s)) return false;
      const info = vpnInfoMap[String(container.id)];
      return !info?.public_ip || info?.vpn_status !== "running";
    }
    if (statusFilter === "unhealthy") return s === "unhealthy";
    return true;
  };

  const providers = [
    ...new Set(containers.map((c) => c.vpn_provider).filter(Boolean)),
  ].sort();

  const filteredContainers = containers.filter(
    (c) =>
      matchesFilter(c) &&
      (providerFilter === "all" ||
        c.vpn_provider?.toLowerCase() === providerFilter.toLowerCase()) &&
      (searchQuery === "" ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_provider?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  // Selection helpers
  const toggleSelect = (id) => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleContainers) next.add(c.id);
      return next;
    });
  };

  const deselectVisible = () => {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      for (const c of visibleContainers) next.delete(c.id);
      return next;
    });
  };

  const exitSelectMode = () => {
    setSelectMode(false);
    setSelectedIds(new Set());
  };

  const selectedContainers = containers.filter((c) => selectedIds.has(c.id));
  const selectedCount = selectedIds.size;

  // Bulk actions
  const bulkAction = async (action) => {
    if (selectedCount === 0) return;
    setBulkLoading(action);
    const progress = {
      action,
      total: selectedCount,
      done: 0,
      success: 0,
      failed: 0,
    };
    setBulkProgress({ ...progress });
    for (const id of selectedIds) {
      try {
        await api.post(`/containers/${id}/${action}`);
        progress.success++;
      } catch {
        progress.failed++;
      }
      progress.done++;
      setBulkProgress({ ...progress });
    }
    toast.success(
      `${action}: ${progress.success} succeeded${progress.failed ? `, ${progress.failed} failed` : ""}`,
    );
    setBulkLoading("");
    setBulkProgress(null);
    exitSelectMode();
    refreshContainers();
  };

  const bulkDelete = async () => {
    if (selectedCount === 0) return;
    const names = selectedContainers.map((c) => c.name).join(", ");
    const ok = await confirm({
      title: "Delete Selected Containers",
      message: `Delete ${selectedCount} container(s): ${names}? This cannot be undone.`,
      confirmText: "Delete All",
      variant: "danger",
    });
    if (!ok) return;
    setBulkLoading("delete");
    const progress = {
      action: "delete",
      total: selectedCount,
      done: 0,
      success: 0,
      failed: 0,
    };
    setBulkProgress({ ...progress });
    for (const id of selectedIds) {
      try {
        await api.delete(`/containers/${id}`);
        progress.success++;
      } catch {
        progress.failed++;
      }
      progress.done++;
      setBulkProgress({ ...progress });
    }
    toast.success(
      `Deleted: ${progress.success} succeeded${progress.failed ? `, ${progress.failed} failed` : ""}`,
    );
    setBulkLoading("");
    setBulkProgress(null);
    exitSelectMode();
    refreshContainers();
  };

  const bulkRedeploy = async () => {
    if (selectedCount === 0) return;
    const names = selectedContainers.map((c) => c.name).join(", ");
    const ok = await confirm({
      title: "Redeploy Selected Containers",
      message: `Redeploy ${selectedCount} container(s): ${names}? Dependents will be restarted automatically.`,
      confirmText: "Redeploy All",
      variant: "info",
    });
    if (!ok) return;
    setBulkLoading("redeploy");
    const progress = {
      action: "redeploy",
      total: selectedCount,
      done: 0,
      success: 0,
      failed: 0,
    };
    setBulkProgress({ ...progress });
    for (const id of selectedIds) {
      try {
        await api.post(`/containers/${id}/redeploy`, {});
        progress.success++;
      } catch {
        progress.failed++;
      }
      progress.done++;
      setBulkProgress({ ...progress });
    }
    toast.success(
      `Redeploy: ${progress.success} succeeded${progress.failed ? `, ${progress.failed} failed` : ""}`,
    );
    setBulkLoading("");
    setBulkProgress(null);
    exitSelectMode();
    refreshContainers();
  };

  const proxyContainers = filteredContainers.filter(
    (c) =>
      !c.socks5_enabled &&
      (c.config?.HTTPPROXY?.toLowerCase() === "on" ||
        c.config?.SHADOWSOCKS?.toLowerCase() === "on"),
  );

  const socks5Containers = filteredContainers.filter((c) => c.socks5_enabled);

  const vpnOnlyContainers = filteredContainers.filter(
    (c) =>
      !c.socks5_enabled &&
      c.config?.HTTPPROXY?.toLowerCase() !== "on" &&
      c.config?.SHADOWSOCKS?.toLowerCase() !== "on",
  );

  const categoryTabs = [
    {
      key: "proxy",
      label: "Proxy Containers",
      icon: Network,
      iconClass: "text-vpn-primary",
      items: proxyContainers,
    },
    {
      key: "socks5",
      label: "SOCKS5 Proxy Containers",
      icon: Shield,
      iconClass: "text-purple-400",
      items: socks5Containers,
    },
    {
      key: "vpn",
      label: "VPN Containers",
      icon: Shield,
      iconClass: "text-vpn-primary",
      items: vpnOnlyContainers,
    },
  ];

  const activeCategory =
    categoryTabs.find((tab) => tab.key === activeCategoryTab) ||
    categoryTabs[0];
  const visibleContainers = activeCategory?.items || [];
  const selectedVisibleCount = visibleContainers.filter((c) =>
    selectedIds.has(c.id),
  ).length;

  useEffect(() => {
    if (
      categoryTabs.some(
        (tab) => tab.key === activeCategoryTab && tab.items.length > 0,
      )
    ) {
      return;
    }
    const firstNonEmpty = categoryTabs.find((tab) => tab.items.length > 0);
    if (firstNonEmpty && firstNonEmpty.key !== activeCategoryTab) {
      setActiveCategoryTab(firstNonEmpty.key);
    }
  }, [
    activeCategoryTab,
    proxyContainers.length,
    socks5Containers.length,
    vpnOnlyContainers.length,
  ]);

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-vpn-primary" />
            VPN-PROXY
          </h1>
          <p className="text-vpn-muted mt-1">
            All managed Gluetun VPN containers
          </p>
        </div>
        <div className="flex flex-wrap gap-2 sm:gap-3">
          <button
            onClick={() =>
              selectMode ? exitSelectMode() : setSelectMode(true)
            }
            className={`flex items-center gap-2 px-4 py-2 border rounded-lg transition-all shadow-sm ${
              selectMode
                ? "bg-vpn-primary/20 border-vpn-primary text-vpn-primary"
                : "bg-vpn-card border-vpn-border hover:border-vpn-primary text-vpn-text"
            }`}
          >
            <CheckSquare className="w-4 h-4 text-vpn-primary" />
            {selectMode ? "Cancel" : "Select"}
          </button>
          <button
            onClick={async () => {
              setDiscovering(true);
              setActionProgress({ action: "discover", target: "Containers" });
              try {
                const res = await api.post("/containers/discover");
                toast.success(res.data.message);
                setActionProgress({
                  action: "discover",
                  target: "Containers",
                  finished: true,
                });
                refreshContainers();
              } catch {
                toast.error("Failed to discover containers");
                setActionProgress({
                  action: "discover",
                  target: "Containers",
                  finished: true,
                  error: "Failed to discover containers",
                });
              } finally {
                setDiscovering(false);
                setTimeout(() => setActionProgress(null), 1200);
              }
            }}
            disabled={discovering}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Search
              className={`w-4 h-4 text-vpn-primary ${discovering ? "animate-spin" : ""}`}
            />
            Discover
          </button>
          <button
            onClick={async () => {
              setRefreshing(true);
              setActionProgress({ action: "refresh", target: "Containers" });
              try {
                await refreshAll();
                setActionProgress({
                  action: "refresh",
                  target: "Containers",
                  finished: true,
                });
              } catch {
                setActionProgress({
                  action: "refresh",
                  target: "Containers",
                  finished: true,
                  error: "Failed to refresh",
                });
              } finally {
                setRefreshing(false);
                setTimeout(() => setActionProgress(null), 1200);
              }
            }}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <RefreshCw
              className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-vpn-primary" />
            New VPN-Proxy
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-7 gap-4 mb-6">
        {stats.map(
          ({
            label,
            value,
            icon: Icon,
            color,
            bg,
            hoverBorder,
            activeBorder,
            filter,
          }) => (
            <div
              key={label}
              onClick={() =>
                setStatusFilter(statusFilter === filter ? null : filter)
              }
              className={`bg-vpn-card border rounded-xl p-4 cursor-pointer transition-all ${hoverBorder} ${
                statusFilter === filter ? activeBorder : "border-vpn-border"
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
          ),
        )}
      </div>

      {/* Search */}
      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
        <input
          type="text"
          placeholder="Search VPN containers, providers..."
          value={searchQuery}
          onChange={(e) => setSearchQuery(e.target.value)}
          className="w-full pl-10 pr-4 py-2.5 bg-vpn-card border border-vpn-border rounded-lg text-sm text-vpn-text placeholder-vpn-muted focus:outline-none focus:border-vpn-primary transition-colors"
        />
      </div>

      {/* Provider Tabs */}
      {providers.length > 1 && (
        <div className="bg-vpn-card border border-vpn-border rounded-lg p-2 overflow-x-auto mb-6">
          <div className="flex gap-2 min-w-max">
            {["all", ...providers].map((prov) => {
              const count =
                prov === "all"
                  ? containers.filter((c) => matchesFilter(c)).length
                  : containers.filter(
                      (c) =>
                        matchesFilter(c) &&
                        c.vpn_provider?.toLowerCase() === prov.toLowerCase(),
                    ).length;
              return (
                <button
                  key={prov}
                  onClick={() => setProviderFilter(prov)}
                  className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap ${
                    providerFilter === prov
                      ? "bg-vpn-primary text-black shadow-md"
                      : "bg-vpn-input/50 text-vpn-muted hover:bg-vpn-primary/20 hover:text-vpn-primary"
                  }`}
                >
                  {prov === "all" ? "All" : prov}
                  <span
                    className={`ml-2 text-xs ${
                      providerFilter === prov
                        ? "text-black/70"
                        : "text-vpn-muted"
                    }`}
                  >
                    ({count})
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Bulk Action Bar */}
      {selectMode && (
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-3 mb-6 flex flex-wrap items-center gap-3">
          <div className="flex items-center gap-2">
            <button
              onClick={
                selectedVisibleCount === visibleContainers.length &&
                visibleContainers.length > 0
                  ? deselectVisible
                  : selectAllVisible
              }
              className="flex items-center gap-2 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-vpn-primary text-vpn-text text-sm rounded-lg transition-all"
            >
              {selectedVisibleCount === visibleContainers.length &&
              visibleContainers.length > 0 ? (
                <CheckSquare className="w-4 h-4 text-vpn-primary" />
              ) : (
                <Square className="w-4 h-4 text-vpn-muted" />
              )}
              {selectedVisibleCount === visibleContainers.length &&
              visibleContainers.length > 0
                ? "Deselect Visible"
                : "Select Visible"}
            </button>
            <span className="text-sm text-vpn-muted">
              {selectedVisibleCount} of {visibleContainers.length} visible
              selected
            </span>
          </div>
          {selectedCount > 0 && (
            <div className="flex items-center gap-2 ml-auto">
              <button
                onClick={() => bulkAction("start")}
                disabled={!!bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-emerald-400 text-emerald-400 text-sm rounded-lg transition-all disabled:opacity-50"
                title="Start Selected"
              >
                <Play
                  className={`w-3.5 h-3.5 ${bulkLoading === "start" ? "animate-pulse" : ""}`}
                />
                Start
              </button>
              <button
                onClick={() => bulkAction("stop")}
                disabled={!!bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-amber-400 text-amber-400 text-sm rounded-lg transition-all disabled:opacity-50"
                title="Stop Selected"
              >
                <Square
                  className={`w-3.5 h-3.5 ${bulkLoading === "stop" ? "animate-pulse" : ""}`}
                />
                Stop
              </button>
              <button
                onClick={() => bulkAction("restart")}
                disabled={!!bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-vpn-primary text-vpn-primary text-sm rounded-lg transition-all disabled:opacity-50"
                title="Restart Selected"
              >
                <RotateCcw
                  className={`w-3.5 h-3.5 ${bulkLoading === "restart" ? "animate-spin" : ""}`}
                />
                Restart
              </button>
              <button
                onClick={bulkRedeploy}
                disabled={!!bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-blue-400 text-blue-400 text-sm rounded-lg transition-all disabled:opacity-50"
                title="Redeploy Selected"
              >
                <RefreshCw
                  className={`w-3.5 h-3.5 ${bulkLoading === "redeploy" ? "animate-spin" : ""}`}
                />
                Redeploy
              </button>
              <button
                onClick={bulkDelete}
                disabled={!!bulkLoading}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-vpn-input border border-vpn-border hover:border-red-400 text-red-400 text-sm rounded-lg transition-all disabled:opacity-50"
                title="Delete Selected"
              >
                <Trash2
                  className={`w-3.5 h-3.5 ${bulkLoading === "delete" ? "animate-pulse" : ""}`}
                />
                Delete
              </button>
            </div>
          )}
        </div>
      )}

      {/* Container Grid */}
      {loading ? (
        <div className="flex justify-center py-12">
          <div className="animate-spin rounded-full h-10 w-10 border-t-2 border-b-2 border-vpn-primary"></div>
        </div>
      ) : error ? (
        <div className="text-center py-12">
          <AlertTriangle className="w-12 h-12 text-amber-400 mx-auto mb-3" />
          <p className="text-vpn-muted">{error}</p>
          <button
            onClick={refreshContainers}
            className="mt-3 text-vpn-primary hover:text-vpn-accent"
          >
            Try again
          </button>
        </div>
      ) : filteredContainers.length === 0 && (searchQuery || statusFilter) ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Server className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No matching containers
          </h3>
          <p className="text-vpn-muted">Try adjusting your search or filter.</p>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Server className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No VPN containers yet
          </h3>
          <p className="text-vpn-muted mb-6">
            Create your first Gluetun VPN container to get started.
          </p>
          <button
            onClick={() => navigate("/create")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
          >
            <PlusCircle className="w-5 h-5 text-vpn-primary" />
            Create Container
          </button>
        </div>
      ) : (
        <>
          <div className="bg-vpn-card border border-vpn-border rounded-lg p-2 overflow-x-auto mb-6">
            <div className="flex gap-2 min-w-max">
              {categoryTabs.map((tab) => {
                const Icon = tab.icon;
                const isActive = activeCategoryTab === tab.key;
                return (
                  <button
                    key={tab.key}
                    onClick={() => setActiveCategoryTab(tab.key)}
                    className={`px-4 py-2 rounded-lg text-sm font-semibold transition-all whitespace-nowrap flex items-center gap-2 ${
                      isActive
                        ? "bg-vpn-primary text-black shadow-md"
                        : "bg-vpn-input/50 text-vpn-muted hover:bg-vpn-primary/20 hover:text-vpn-primary"
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${isActive ? "text-black" : tab.iconClass}`}
                    />
                    {tab.label}
                    <span
                      className={`text-xs ${
                        isActive ? "text-black/70" : "text-vpn-muted"
                      }`}
                    >
                      ({tab.items.length})
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          <div>
            <div className="flex items-center gap-3 mb-4">
              {activeCategory && (
                <activeCategory.icon
                  className={`w-5 h-5 ${activeCategory.iconClass}`}
                />
              )}
              <h2 className="text-lg font-semibold text-white">
                {activeCategory?.label}
              </h2>
              <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-1 rounded-full">
                {visibleContainers.length}
              </span>
            </div>

            {visibleContainers.length > 0 ? (
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {visibleContainers.map((container) => (
                  <div
                    key={container.id}
                    id={`container-${container.id}`}
                    className="relative"
                  >
                    {selectMode && (
                      <div
                        onClick={(e) => {
                          e.stopPropagation();
                          toggleSelect(container.id);
                        }}
                        className={`absolute inset-0 z-10 rounded-xl cursor-pointer border-2 transition-all ${
                          selectedIds.has(container.id)
                            ? "border-vpn-primary bg-vpn-primary/10"
                            : "border-transparent hover:border-vpn-primary/50"
                        }`}
                      >
                        <div className="absolute top-3 right-3">
                          {selectedIds.has(container.id) ? (
                            <CheckSquare className="w-5 h-5 text-vpn-primary" />
                          ) : (
                            <Square className="w-5 h-5 text-vpn-muted" />
                          )}
                        </div>
                      </div>
                    )}
                    <ContainerCard
                      container={container}
                      vpnInfo={vpnInfoMap[String(container.id)]}
                      onRefresh={refreshContainers}
                    />
                  </div>
                ))}
              </div>
            ) : (
              <div className="text-center py-12 bg-vpn-card border border-vpn-border rounded-2xl">
                <Server className="w-12 h-12 text-vpn-border mx-auto mb-3" />
                <p className="text-vpn-muted">
                  No containers in this category for the current filter.
                </p>
              </div>
            )}
          </div>
        </>
      )}

      {/* Bulk Progress Dialog */}
      <ActionProgressDialog
        action={bulkProgress?.action}
        target="Containers"
        total={bulkProgress?.total}
        done={bulkProgress?.done}
        success={bulkProgress?.success}
        failed={bulkProgress?.failed}
        finished={false}
      />
      <ActionProgressDialog
        action={actionProgress?.action}
        target={actionProgress?.target}
        finished={actionProgress?.finished}
        error={actionProgress?.error}
      />
    </div>
  );
}
