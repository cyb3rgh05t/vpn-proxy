import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Shield,
  Activity,
  AlertTriangle,
  RefreshCw,
  Search,
  Server,
  Network,
  Wifi,
  WifiOff,
} from "lucide-react";
import api from "../services/api";
import ContainerCard from "../components/ContainerCard";
import { useToast } from "../context/ToastContext";
import { useContainerData } from "../context/ContainerDataContext";
import { useLocation } from "react-router-dom";

export default function VpnProxy() {
  const location = useLocation();
  const scrolledRef = useRef(false);
  const navigate = useNavigate();
  const toast = useToast();
  const {
    containers,
    vpnInfoMap,
    loading,
    error,
    refreshContainers,
    refreshAll,
  } = useContainerData();

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
  const [statusFilter, setStatusFilter] = useState(null);
  const [providerFilter, setProviderFilter] = useState("all");

  const running = containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const stopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  const vpnConnected = containers.filter((c) => {
    const info = vpnInfoMap[String(c.id)];
    return info?.vpn_status === "running" && info?.public_ip;
  }).length;
  const vpnDisconnected = running - vpnConnected;

  const stats = [
    {
      label: "Total",
      value: containers.length,
      icon: Shield,
      color: "text-vpn-primary",
      bg: "bg-vpn-primary/10",
      filter: null,
    },
    {
      label: "Running",
      value: running,
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      filter: "running",
    },
    {
      label: "VPN Connected",
      value: vpnConnected,
      icon: Wifi,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
      filter: null,
    },
    {
      label: "VPN Disconnected",
      value: vpnDisconnected,
      icon: WifiOff,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      filter: null,
    },
    {
      label: "Stopped",
      value: stopped,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
      filter: "stopped",
    },
  ];

  const matchesFilter = (status) => {
    if (!statusFilter) return true;
    if (statusFilter === "running")
      return ["running", "healthy"].includes(status);
    if (statusFilter === "stopped")
      return ["exited", "dead", "removed", "created"].includes(status);
    return true;
  };

  const providers = [
    ...new Set(containers.map((c) => c.vpn_provider).filter(Boolean)),
  ].sort();

  const filteredContainers = containers.filter(
    (c) =>
      matchesFilter(c.status) &&
      (providerFilter === "all" ||
        c.vpn_provider?.toLowerCase() === providerFilter.toLowerCase()) &&
      (searchQuery === "" ||
        c.name?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_provider?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.vpn_type?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        c.description?.toLowerCase().includes(searchQuery.toLowerCase())),
  );

  const proxyContainers = filteredContainers.filter(
    (c) =>
      c.config?.HTTPPROXY?.toLowerCase() === "on" ||
      c.config?.SHADOWSOCKS?.toLowerCase() === "on",
  );

  const vpnOnlyContainers = filteredContainers.filter(
    (c) =>
      c.config?.HTTPPROXY?.toLowerCase() !== "on" &&
      c.config?.SHADOWSOCKS?.toLowerCase() !== "on",
  );

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Shield className="w-7 h-7 text-vpn-primary" />
            VPN-PROXY
          </h1>
          <p className="text-vpn-muted mt-1">
            All managed Gluetun VPN containers
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={async () => {
              setDiscovering(true);
              try {
                const res = await api.post("/containers/discover");
                toast.success(res.data.message);
                refreshContainers();
              } catch {
                toast.error("Failed to discover containers");
              } finally {
                setDiscovering(false);
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
              await refreshAll();
              setRefreshing(false);
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
            New Container
          </button>
        </div>
      </div>

      {/* Stats */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-6">
        {stats.map(({ label, value, icon: Icon, color, bg, filter }) => (
          <div
            key={label}
            onClick={() =>
              setStatusFilter(statusFilter === filter ? null : filter)
            }
            className={`bg-vpn-card border rounded-xl p-5 flex items-center gap-4 cursor-pointer transition-all hover:border-vpn-muted ${
              statusFilter === filter
                ? "border-vpn-primary ring-1 ring-vpn-primary/30"
                : "border-vpn-border"
            }`}
          >
            <div className={`p-3 rounded-lg ${bg}`}>
              <Icon className={`w-6 h-6 ${color}`} />
            </div>
            <div>
              <p className="text-2xl font-bold text-white">{value}</p>
              <p className="text-sm text-vpn-muted">{label}</p>
            </div>
          </div>
        ))}
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
                  ? containers.filter((c) => matchesFilter(c.status)).length
                  : containers.filter(
                      (c) =>
                        matchesFilter(c.status) &&
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
          {/* Proxy Containers */}
          {proxyContainers.length > 0 && (
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-4">
                <Network className="w-5 h-5 text-vpn-primary" />
                <h2 className="text-lg font-semibold text-white">
                  Proxy Containers
                </h2>
                <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-1 rounded-full">
                  {proxyContainers.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {proxyContainers.map((container) => (
                  <div key={container.id} id={`container-${container.id}`}>
                    <ContainerCard
                      container={container}
                      vpnInfo={vpnInfoMap[String(container.id)]}
                      onRefresh={refreshContainers}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* VPN Only Containers */}
          {vpnOnlyContainers.length > 0 && (
            <div>
              <div className="flex items-center gap-3 mb-4">
                <Shield className="w-5 h-5 text-vpn-primary" />
                <h2 className="text-lg font-semibold text-white">
                  VPN Containers
                </h2>
                <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-1 rounded-full">
                  {vpnOnlyContainers.length}
                </span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
                {vpnOnlyContainers.map((container) => (
                  <div key={container.id} id={`container-${container.id}`}>
                    <ContainerCard
                      container={container}
                      vpnInfo={vpnInfoMap[String(container.id)]}
                      onRefresh={refreshContainers}
                    />
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
