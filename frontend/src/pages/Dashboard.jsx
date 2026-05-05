import { useState, useMemo, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Server,
  Activity,
  AlertTriangle,
  HeartCrack,
  RefreshCw,
  Search,
  Shield,
  Globe,
  Wifi,
  WifiOff,
  Boxes,
  Layers,
  Network,
  ArrowUpDown,
  MapPin,
  Users,
  ChevronRight,
  LayoutDashboard,
  SlidersHorizontal,
  Eye,
  EyeOff,
} from "lucide-react";
import api from "../services/api";
import WorldMap from "../components/WorldMap";
import ActionProgressDialog from "../components/ActionProgressDialog";
import { useToast } from "../context/ToastContext";
import { useContainerData } from "../context/ContainerDataContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const {
    containers,
    vpnInfoMap,
    depsMap,
    o11Containers,
    refreshContainers,
    refreshAll,
  } = useContainerData();

  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [actionProgress, setActionProgress] = useState(null);
  const [customizeOpen, setCustomizeOpen] = useState(false);
  const customizeRef = useRef(null);

  // Dashboard section visibility (persisted to localStorage)
  const [visibility, setVisibility] = useState(() => {
    try {
      const saved = localStorage.getItem("dashboard-visibility");
      if (saved) return JSON.parse(saved);
    } catch {}
    return { stats: true, worldmap: true, providers: true, connections: true };
  });

  useEffect(() => {
    localStorage.setItem("dashboard-visibility", JSON.stringify(visibility));
  }, [visibility]);

  // Close customize dropdown on outside click
  useEffect(() => {
    const handler = (e) => {
      if (customizeRef.current && !customizeRef.current.contains(e.target)) {
        setCustomizeOpen(false);
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, []);

  const toggleSection = (key) =>
    setVisibility((prev) => ({ ...prev, [key]: !prev[key] }));

  // --- Gluetun stats ---
  const gluetunRunning = containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const gluetunUnhealthy = containers.filter(
    (c) => c.status === "unhealthy",
  ).length;
  const gluetunStopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  // --- VPN connected (actually has public IP) ---
  const vpnConnected = containers.filter((c) => {
    const info = vpnInfoMap[String(c.id)];
    return info?.vpn_status === "running" && info?.public_ip;
  }).length;
  // Include unhealthy containers in disconnected count (they are still active but VPN is down)
  const gluetunActive = containers.filter((c) =>
    ["running", "healthy", "unhealthy"].includes(c.status),
  ).length;
  const vpnDisconnected = gluetunActive - vpnConnected;

  // --- O11 stats ---
  const o11Running = o11Containers.filter((c) =>
    ["running", "healthy"].includes(c.status),
  ).length;
  const o11Unhealthy = o11Containers.filter(
    (c) => c.status === "unhealthy",
  ).length;
  const o11Stopped = o11Containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  // --- Provider overview ---
  const providerStats = useMemo(() => {
    const map = {};
    for (const c of containers) {
      const p = c.vpn_provider || "unknown";
      if (!map[p])
        map[p] = {
          total: 0,
          running: 0,
          connected: 0,
          disconnected: 0,
          stopped: 0,
          unhealthy: 0,
          types: new Set(),
          countries: new Set(),
          cities: new Set(),
          proxyCount: 0,
          httpProxyCount: 0,
          shadowsocksCount: 0,
          socks5Count: 0,
          clientCount: 0,
          portForwardCount: 0,
          ips: new Set(),
          locationMap: {},
          countriesMap: {},
          citiesMap: {},
          ipsMap: {},
          httpProxyItems: [],
          shadowsocksItems: [],
          socks5Items: [],
          portForwardItems: [],
          connectedItems: [],
          disconnectedItems: [],
          unhealthyItems: [],
          stoppedItems: [],
        };
      map[p].total++;
      if (c.vpn_type) map[p].types.add(c.vpn_type);
      const info = vpnInfoMap[String(c.id)];
      const isRunning = ["running", "healthy"].includes(c.status);
      const isActive = ["running", "healthy", "unhealthy"].includes(c.status);
      const isConnected = info?.vpn_status === "running" && info?.public_ip;
      if (isRunning) map[p].running++;
      if (isConnected) {
        map[p].connected++;
        map[p].connectedItems.push({ id: c.id, name: c.name });
      } else if (isActive) {
        map[p].disconnected++;
        map[p].disconnectedItems.push({ id: c.id, name: c.name });
      }
      if (["exited", "dead", "removed"].includes(c.status)) {
        map[p].stopped++;
        map[p].stoppedItems.push({ id: c.id, name: c.name });
      }
      if (c.status === "unhealthy") {
        map[p].unhealthy++;
        map[p].unhealthyItems.push({ id: c.id, name: c.name });
      }
      if (info?.country) {
        map[p].countries.add(info.country);
        if (!map[p].countriesMap[info.country])
          map[p].countriesMap[info.country] = [];
        map[p].countriesMap[info.country].push({ id: c.id, name: c.name });
      }
      if (info?.region) {
        map[p].cities.add(info.region);
        if (!map[p].citiesMap[info.region])
          map[p].citiesMap[info.region] = [];
        map[p].citiesMap[info.region].push({ id: c.id, name: c.name });
      }
      if (info?.public_ip) {
        map[p].ips.add(info.public_ip);
        if (!map[p].ipsMap[info.public_ip])
          map[p].ipsMap[info.public_ip] = [];
        map[p].ipsMap[info.public_ip].push({ id: c.id, name: c.name });
      }
      if (info?.port_forwarded) {
        map[p].portForwardCount++;
        map[p].portForwardItems.push({ id: c.id, name: c.name });
      }
      if (c.config?.SERVER_COUNTRIES)
        c.config.SERVER_COUNTRIES.split(",").forEach((s) => {
          const loc = s.trim();
          if (loc) {
            if (!map[p].locationMap[loc]) map[p].locationMap[loc] = [];
            map[p].locationMap[loc].push({ id: c.id, name: c.name });
          }
        });
      if (c.config?.SERVER_CITIES)
        c.config.SERVER_CITIES.split(",").forEach((s) => {
          const loc = s.trim();
          if (loc) {
            if (!map[p].locationMap[loc]) map[p].locationMap[loc] = [];
            map[p].locationMap[loc].push({ id: c.id, name: c.name });
          }
        });
      if (c.config?.HTTPPROXY?.toLowerCase() === "on") {
        map[p].proxyCount++;
        map[p].httpProxyCount++;
        map[p].httpProxyItems.push({ id: c.id, name: c.name });
      }
      if (c.config?.SHADOWSOCKS?.toLowerCase() === "on") {
        map[p].proxyCount++;
        map[p].shadowsocksCount++;
        map[p].shadowsocksItems.push({ id: c.id, name: c.name });
      }
      if (c.socks5_enabled) {
        map[p].socks5Count++;
        map[p].socks5Items.push({ id: c.id, name: c.name });
      }
      const deps = depsMap[c.id] || [];
      map[p].clientCount += deps.length;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name,
        ...data,
        types: [...data.types],
        countries: [...data.countries],
        cities: [...data.cities],
        ips: [...data.ips],
        locationMap: data.locationMap,
        countriesMap: data.countriesMap,
        citiesMap: data.citiesMap,
        ipsMap: data.ipsMap,
      }));
  }, [containers, vpnInfoMap, depsMap]);

  // --- VPN connections overview ---
  const vpnConnections = useMemo(() => {
    const serverIp = window.location.hostname;
    return containers
      .map((c) => {
        const info = vpnInfoMap[String(c.id)];
        const deps = depsMap[c.id] || [];
        const httpEnabled = c.config?.HTTPPROXY?.toLowerCase() === "on";
        const ssEnabled = c.config?.SHADOWSOCKS?.toLowerCase() === "on";

        // Compute external URLs from extra_ports mappings
        let httpProxyExternal = null;
        let shadowsocksExternal = null;
        if (httpEnabled && c.port_http_proxy) {
          const mapping = c.extra_ports?.find(
            (ep) => parseInt(ep.container) === c.port_http_proxy,
          );
          if (mapping) {
            httpProxyExternal = `${serverIp}:${mapping.host}`;
          }
        }
        if (ssEnabled && c.port_shadowsocks) {
          const mapping = c.extra_ports?.find(
            (ep) => parseInt(ep.container) === c.port_shadowsocks,
          );
          if (mapping) {
            shadowsocksExternal = `${serverIp}:${mapping.host}`;
          }
        }

        // SOCKS5 proxy info
        let socks5External = null;
        if (c.socks5_enabled) {
          const socks5Port = c.port_socks5 || 1080;
          const mapping = c.extra_ports?.find(
            (ep) => parseInt(ep.container) === socks5Port,
          );
          if (mapping) {
            socks5External = `${serverIp}:${mapping.host}`;
          }
        }

        return {
          id: c.id,
          name: c.name,
          description: c.description,
          provider: c.vpn_provider,
          vpnType: c.vpn_type,
          status: c.status,
          vpnStatus: info?.vpn_status,
          publicIp: info?.public_ip,
          country: info?.country,
          region: info?.region,
          portForwarded: info?.port_forwarded,
          location:
            c.config?.SERVER_COUNTRIES ||
            c.config?.SERVER_CITIES ||
            c.config?.SERVER_REGIONS,
          deps,
          httpProxy: httpEnabled
            ? `${c.ip_address || "—"}:${c.port_http_proxy}`
            : null,
          httpProxyHost: httpEnabled
            ? `${c.docker_name || `gluetun-${c.name}`}:${c.port_http_proxy}`
            : null,
          httpProxyExternal,
          shadowsocks: ssEnabled
            ? `${c.ip_address || "—"}:${c.port_shadowsocks}`
            : null,
          shadowsocksHost: ssEnabled
            ? `${c.docker_name || `gluetun-${c.name}`}:${c.port_shadowsocks}`
            : null,
          shadowsocksExternal,
          socks5: c.socks5_enabled
            ? `${c.ip_address || "—"}:${c.port_socks5 || 1080}`
            : null,
          socks5Host: c.socks5_enabled
            ? `${c.docker_name || `gluetun-${c.name}`}:${c.port_socks5 || 1080}`
            : null,
          socks5External,
        };
      })
      .filter(
        (c) =>
          ["running", "healthy", "unhealthy", "starting"].includes(c.status) &&
          c.vpnStatus,
      );
  }, [containers, vpnInfoMap, depsMap]);

  const StatCard = ({ label, value, icon: Icon, color, bg, filter }) => (
    <div
      onClick={() => filter && navigate(`/vpn-proxy?status=${filter}`)}
      className={`bg-vpn-card border border-vpn-border rounded-xl p-4 min-w-0 hover:border-vpn-primary/30 transition-colors ${filter ? "cursor-pointer" : ""}`}
    >
      <div className="flex items-center gap-2.5">
        <div className={`p-2 rounded-lg ${bg}`}>
          <Icon className={`w-4 h-4 ${color}`} />
        </div>
        <div className="min-w-0">
          <p className="text-xl font-bold text-white leading-tight">{value}</p>
          <p className="text-[10px] font-semibold text-vpn-muted uppercase tracking-wider truncate">
            {label}
          </p>
        </div>
      </div>
    </div>
  );

  return (
    <>
      <div>
        {/* Header */}
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 mb-6">
          <div>
            <h1 className="text-2xl font-bold text-white flex items-center gap-3">
              <LayoutDashboard className="w-7 h-7 text-vpn-primary" />
              Dashboard
            </h1>
            <p className="text-vpn-muted mt-1">
              Manage your Gluetun VPN containers
            </p>
          </div>
          <div className="flex flex-wrap gap-2 sm:gap-3">
            <div className="relative" ref={customizeRef}>
              <button
                onClick={() => setCustomizeOpen((v) => !v)}
                className={`flex items-center gap-2 px-4 py-2 bg-vpn-card border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm ${customizeOpen ? "border-vpn-primary" : "border-vpn-border"}`}
              >
                <SlidersHorizontal className="w-4 h-4 text-vpn-primary" />
                Customize
              </button>
              {customizeOpen && (
                <div className="absolute right-0 mt-2 w-56 bg-vpn-card border border-vpn-border rounded-xl shadow-xl z-50 p-2">
                  {[
                    { key: "stats", label: "Stats Cards" },
                    { key: "worldmap", label: "World Map" },
                    { key: "providers", label: "VPN Providers" },
                    { key: "connections", label: "Active Connections" },
                  ].map(({ key, label }) => (
                    <button
                      key={key}
                      onClick={() => toggleSection(key)}
                      className="flex items-center gap-3 w-full px-3 py-2 rounded-lg hover:bg-vpn-bg/60 transition-colors text-left"
                    >
                      {visibility[key] ? (
                        <Eye className="w-4 h-4 text-emerald-400 flex-shrink-0" />
                      ) : (
                        <EyeOff className="w-4 h-4 text-vpn-muted flex-shrink-0" />
                      )}
                      <span
                        className={`text-sm ${visibility[key] ? "text-white" : "text-vpn-muted"}`}
                      >
                        {label}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </div>
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
            <button
              onClick={() => navigate("/create-o11")}
              className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <PlusCircle className="w-4 h-4 text-vpn-primary" />
              New App
            </button>
          </div>
        </div>

        {/* Stats Row */}
        {visibility.stats && (
          <div className="mb-6">
            <div
              className={`grid gap-3 ${
                o11Containers.length > 0
                  ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-9"
                  : "grid-cols-2 sm:grid-cols-3 xl:grid-cols-6"
              }`}
            >
              <StatCard
                label="VPN Total"
                value={containers.length}
                icon={Server}
                color="text-vpn-primary"
                bg="bg-vpn-primary/10"
                filter="all"
              />
              <StatCard
                label="VPN Running"
                value={gluetunRunning}
                icon={Activity}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                filter="running"
              />
              <StatCard
                label="Connected"
                value={vpnConnected}
                icon={Wifi}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
                filter="vpn-connected"
              />
              <StatCard
                label="Disconnected"
                value={vpnDisconnected}
                icon={WifiOff}
                color="text-amber-400"
                bg="bg-amber-500/10"
                filter="vpn-disconnected"
              />
              <StatCard
                label="Unhealthy"
                value={gluetunUnhealthy}
                icon={HeartCrack}
                color="text-red-400"
                bg="bg-red-500/10"
                filter="unhealthy"
              />
              <StatCard
                label="Stopped"
                value={gluetunStopped}
                icon={AlertTriangle}
                color="text-amber-400"
                bg="bg-amber-500/10"
                filter="stopped"
              />
              {o11Containers.length > 0 && (
                <>
                  <StatCard
                    label="O11 Total"
                    value={o11Containers.length}
                    icon={Boxes}
                    color="text-vpn-primary"
                    bg="bg-vpn-primary/10"
                  />
                  <StatCard
                    label="O11 Running"
                    value={o11Running}
                    icon={Activity}
                    color="text-emerald-400"
                    bg="bg-emerald-500/10"
                  />
                  <StatCard
                    label="O11 Stopped"
                    value={o11Stopped}
                    icon={AlertTriangle}
                    color="text-amber-400"
                    bg="bg-amber-500/10"
                  />
                </>
              )}
            </div>
          </div>
        )}

        {/* World Map */}
        {visibility.worldmap && vpnConnections.length > 0 && (
          <div className="mb-6">
            <WorldMap vpnConnections={vpnConnections} />
          </div>
        )}

        {/* Provider Overview + VPN Connections */}
        {containers.length > 0 &&
          (visibility.providers || visibility.connections) && (
            <div
              className={`grid grid-cols-1 ${visibility.providers && visibility.connections ? "lg:grid-cols-3" : ""} gap-4 mb-6`}
            >
              {/* Provider Overview */}
              {visibility.providers && (
                <div className="bg-vpn-card border border-vpn-border rounded-xl p-5">
                  <div className="flex items-center gap-2 mb-4">
                    <Layers className="w-4 h-4 text-vpn-primary" />
                    <h3 className="text-sm font-semibold text-white">
                      VPN Providers
                    </h3>
                    <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-0.5 rounded-full ml-auto">
                      {providerStats.length}
                    </span>
                  </div>
                  {providerStats.length === 0 ? (
                    <p className="text-sm text-vpn-muted">No providers</p>
                  ) : (
                    <div className="space-y-3">
                      {providerStats.map((p) => (
                        <div
                          key={p.name}
                          onClick={() =>
                            navigate(
                              `/vpn-proxy?provider=${encodeURIComponent(p.name)}`,
                            )
                          }
                          className="bg-vpn-bg/50 border border-vpn-border/50 rounded-lg p-3 hover:border-vpn-muted/50 transition-colors cursor-pointer"
                        >
                          {/* Provider header */}
                          <div className="flex items-center gap-3 mb-2.5">
                            <div className="w-9 h-9 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                              <Shield className="w-4 h-4 text-purple-400" />
                            </div>
                            <div className="min-w-0 flex-1">
                              <div className="flex items-center gap-2">
                                <p className="text-sm text-white font-semibold capitalize truncate">
                                  {p.name}
                                </p>
                                <span className="text-[10px] text-vpn-muted bg-vpn-input px-1.5 py-0.5 rounded-full font-medium tabular-nums">
                                  {p.total}{" "}
                                  {p.total === 1 ? "container" : "containers"}
                                </span>
                              </div>
                              <div className="flex items-center gap-1.5 mt-0.5">
                                {p.types.map((t) => (
                                  <span
                                    key={t}
                                    className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase"
                                  >
                                    {t}
                                  </span>
                                ))}
                              </div>
                            </div>
                            <ChevronRight className="w-4 h-4 text-vpn-muted flex-shrink-0" />
                          </div>

                          {/* Status mini-cards */}
                          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-2.5">
                            <div className="flex items-center gap-2 bg-emerald-500/5 border border-emerald-500/10 rounded-lg px-2.5 py-1.5">
                              <Wifi className="w-3 h-3 text-emerald-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-emerald-400 leading-tight">
                                  {p.connected}
                                </p>
                                <p className="text-[9px] text-emerald-400/60 uppercase tracking-wider">
                                  Connected
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-amber-500/5 border border-amber-500/10 rounded-lg px-2.5 py-1.5">
                              <WifiOff className="w-3 h-3 text-amber-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-amber-400 leading-tight">
                                  {p.disconnected}
                                </p>
                                <p className="text-[9px] text-amber-400/60 uppercase tracking-wider">
                                  Disconnected
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-red-500/5 border border-red-500/10 rounded-lg px-2.5 py-1.5">
                              <HeartCrack className="w-3 h-3 text-red-400 flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-red-400 leading-tight">
                                  {p.unhealthy}
                                </p>
                                <p className="text-[9px] text-red-400/60 uppercase tracking-wider">
                                  Unhealthy
                                </p>
                              </div>
                            </div>
                            <div className="flex items-center gap-2 bg-vpn-input/50 border border-vpn-border/30 rounded-lg px-2.5 py-1.5">
                              <AlertTriangle className="w-3 h-3 text-vpn-muted flex-shrink-0" />
                              <div className="min-w-0">
                                <p className="text-xs font-bold text-vpn-muted leading-tight">
                                  {p.stopped}
                                </p>
                                <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider">
                                  Stopped
                                </p>
                              </div>
                            </div>
                          </div>

                          {/* Progress bar */}
                          <div className="flex items-center gap-2 mb-2.5">
                            <div className="flex-1 h-1.5 bg-vpn-input rounded-full overflow-hidden flex">
                              {p.total > 0 && (
                                <>
                                  <div
                                    className="h-full bg-emerald-500 transition-all"
                                    style={{
                                      width: `${(p.connected / p.total) * 100}%`,
                                    }}
                                  />
                                  {p.disconnected > 0 && (
                                    <div
                                      className="h-full bg-amber-500 transition-all"
                                      style={{
                                        width: `${(p.disconnected / p.total) * 100}%`,
                                      }}
                                    />
                                  )}
                                  {p.unhealthy > 0 && (
                                    <div
                                      className="h-full bg-red-500 transition-all"
                                      style={{
                                        width: `${(p.unhealthy / p.total) * 100}%`,
                                      }}
                                    />
                                  )}
                                </>
                              )}
                            </div>
                            <span className="text-[10px] text-emerald-400 font-semibold tabular-nums whitespace-nowrap">
                              {p.connected}/{p.total}
                            </span>
                          </div>

                          {/* Clickable container mini-cards per status */}
                          {(p.unhealthyItems.length > 0 ||
                            p.disconnectedItems.length > 0 ||
                            p.stoppedItems.length > 0) && (
                            <div className="space-y-1.5 mb-2.5">
                              {p.disconnectedItems.length > 0 && (
                                <div>
                                  <p className="text-[9px] text-amber-400/60 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <WifiOff className="w-2.5 h-2.5" />
                                    Disconnected
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {p.disconnectedItems.map((item) => (
                                      <button
                                        key={item.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(
                                            `/vpn-proxy#container-${item.id}`,
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-amber-500/10 text-amber-400 border border-amber-500/20 hover:bg-amber-500/20 hover:border-amber-500/40 transition-colors"
                                      >
                                        <WifiOff className="w-2.5 h-2.5" />
                                        {item.name}
                                        <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {p.unhealthyItems.length > 0 && (
                                <div>
                                  <p className="text-[9px] text-red-400/60 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <HeartCrack className="w-2.5 h-2.5" />
                                    Unhealthy
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {p.unhealthyItems.map((item) => (
                                      <button
                                        key={item.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(
                                            `/vpn-proxy#container-${item.id}`,
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-red-500/10 text-red-400 border border-red-500/20 hover:bg-red-500/20 hover:border-red-500/40 transition-colors"
                                      >
                                        <HeartCrack className="w-2.5 h-2.5" />
                                        {item.name}
                                        <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                              {p.stoppedItems.length > 0 && (
                                <div>
                                  <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                    <AlertTriangle className="w-2.5 h-2.5" />
                                    Stopped
                                  </p>
                                  <div className="flex flex-wrap gap-1">
                                    {p.stoppedItems.map((item) => (
                                      <button
                                        key={item.id}
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          navigate(
                                            `/vpn-proxy#container-${item.id}`,
                                          );
                                        }}
                                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[10px] font-medium bg-vpn-input text-vpn-muted border border-vpn-border/50 hover:bg-vpn-input/80 hover:border-vpn-border transition-colors"
                                      >
                                        <AlertTriangle className="w-2.5 h-2.5" />
                                        {item.name}
                                        <ChevronRight className="w-2.5 h-2.5 opacity-50" />
                                      </button>
                                    ))}
                                  </div>
                                </div>
                              )}
                            </div>
                          )}

                          {/* Info badges */}
                          {(() => {
                            const BadgeWithTooltip = ({
                              children,
                              tooltip,
                              className,
                            }) => (
                              <div className="group/badge relative">
                                <span
                                  className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] cursor-default ${className}`}
                                >
                                  {children}
                                </span>
                                {tooltip && (
                                  <div className="absolute bottom-full left-0 mb-1 hidden group-hover/badge:block z-50">
                                    <div className="bg-vpn-card border border-vpn-border rounded-lg shadow-xl p-2 min-w-[160px]">
                                      {tooltip}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                            const ContainerLinkList = ({ items }) => (
                              <div className="space-y-0.5">
                                {items.map((item) => (
                                  <button
                                    key={item.id}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      navigate(
                                        `/vpn-proxy#container-${item.id}`,
                                      );
                                    }}
                                    className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded text-[10px] text-vpn-text hover:bg-vpn-bg/60 hover:text-vpn-primary transition-colors text-left"
                                  >
                                    <Server className="w-2.5 h-2.5 flex-shrink-0" />
                                    <span className="truncate">
                                      {item.name}
                                    </span>
                                    <ChevronRight className="w-2.5 h-2.5 ml-auto opacity-50 flex-shrink-0" />
                                  </button>
                                ))}
                              </div>
                            );
                            const GroupedTooltip = ({ map: m, label }) => (
                              <div className="space-y-1.5">
                                <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium">
                                  {label}
                                </p>
                                {Object.entries(m).map(([key, items]) => (
                                  <div key={key}>
                                    <p className="text-[9px] text-vpn-muted px-1.5 mb-0.5">
                                      {key}
                                    </p>
                                    <ContainerLinkList items={items} />
                                  </div>
                                ))}
                              </div>
                            );

                            const reachBadges = (
                              <>
                                {p.countries.length > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-vpn-input text-vpn-muted border border-vpn-border/50"
                                    tooltip={
                                      <GroupedTooltip
                                        m={p.countriesMap}
                                        label="Countries"
                                      />
                                    }
                                  >
                                    <MapPin className="w-2.5 h-2.5" />
                                    {p.countries.length}{" "}
                                    {p.countries.length === 1
                                      ? "country"
                                      : "countries"}
                                  </BadgeWithTooltip>
                                )}
                                {p.cities.length > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-vpn-input text-vpn-muted border border-vpn-border/50"
                                    tooltip={
                                      <GroupedTooltip
                                        m={p.citiesMap}
                                        label="Regions"
                                      />
                                    }
                                  >
                                    <Globe className="w-2.5 h-2.5" />
                                    {p.cities.length}{" "}
                                    {p.cities.length === 1
                                      ? "region"
                                      : "regions"}
                                  </BadgeWithTooltip>
                                )}
                                {p.ips.length > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    tooltip={
                                      <GroupedTooltip
                                        m={p.ipsMap}
                                        label="Public IPs"
                                      />
                                    }
                                  >
                                    <Globe className="w-2.5 h-2.5" />
                                    {p.ips.length}{" "}
                                    {p.ips.length === 1 ? "IP" : "IPs"}
                                  </BadgeWithTooltip>
                                )}
                              </>
                            );

                            const proxyBadges = (
                              <>
                                {p.httpProxyCount > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-amber-500/10 text-amber-400 border border-amber-500/20"
                                    tooltip={
                                      <>
                                        <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1">
                                          HTTP proxy
                                        </p>
                                        <ContainerLinkList
                                          items={p.httpProxyItems}
                                        />
                                      </>
                                    }
                                  >
                                    <Network className="w-2.5 h-2.5" />
                                    {p.httpProxyCount} HTTP proxy
                                  </BadgeWithTooltip>
                                )}
                                {p.shadowsocksCount > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-blue-500/10 text-blue-400 border border-blue-500/20"
                                    tooltip={
                                      <>
                                        <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1">
                                          Shadowsocks
                                        </p>
                                        <ContainerLinkList
                                          items={p.shadowsocksItems}
                                        />
                                      </>
                                    }
                                  >
                                    <Network className="w-2.5 h-2.5" />
                                    {p.shadowsocksCount} Shadowsocks
                                  </BadgeWithTooltip>
                                )}
                                {p.socks5Count > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-purple-500/10 text-purple-400 border border-purple-500/20"
                                    tooltip={
                                      <>
                                        <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1">
                                          SOCKS5
                                        </p>
                                        <ContainerLinkList
                                          items={p.socks5Items}
                                        />
                                      </>
                                    }
                                  >
                                    <Shield className="w-2.5 h-2.5" />
                                    {p.socks5Count} SOCKS5
                                  </BadgeWithTooltip>
                                )}
                                {p.portForwardCount > 0 && (
                                  <BadgeWithTooltip
                                    className="bg-vpn-primary/10 text-vpn-primary border border-vpn-primary/20"
                                    tooltip={
                                      <>
                                        <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1">
                                          Port forwarded
                                        </p>
                                        <ContainerLinkList
                                          items={p.portForwardItems}
                                        />
                                      </>
                                    }
                                  >
                                    <ArrowUpDown className="w-2.5 h-2.5" />
                                    {p.portForwardCount} forwarded
                                  </BadgeWithTooltip>
                                )}
                                {p.clientCount > 0 && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                    <Users className="w-2.5 h-2.5" />
                                    {p.clientCount}{" "}
                                    {p.clientCount === 1 ? "client" : "clients"}
                                  </span>
                                )}
                              </>
                            );

                            const hasReach =
                              p.countries.length > 0 ||
                              p.cities.length > 0 ||
                              p.ips.length > 0;
                            const hasProxy =
                              p.httpProxyCount > 0 ||
                              p.shadowsocksCount > 0 ||
                              p.socks5Count > 0 ||
                              p.portForwardCount > 0 ||
                              p.clientCount > 0;

                            return (
                              <div className="space-y-2">
                                {hasReach && (
                                  <div>
                                    <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                      <Globe className="w-2.5 h-2.5" />
                                      Reach (live)
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {reachBadges}
                                    </div>
                                  </div>
                                )}
                                {hasProxy && (
                                  <div>
                                    <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1 flex items-center gap-1">
                                      <Network className="w-2.5 h-2.5" />
                                      Proxies & Routing
                                    </p>
                                    <div className="flex items-center gap-1.5 flex-wrap">
                                      {proxyBadges}
                                    </div>
                                  </div>
                                )}
                              </div>
                            );
                          })()}
                          {/* Server locations with containers */}
                          {Object.keys(p.locationMap).length > 0 && (
                            <div className="mt-2 pt-2 border-t border-vpn-border/30 space-y-1.5">
                              <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium flex items-center gap-1">
                                <MapPin className="w-2.5 h-2.5" />
                                Server Locations
                              </p>
                              <div className="flex flex-wrap gap-1">
                                {Object.entries(p.locationMap)
                                  .slice(0, 8)
                                  .map(([loc, items]) => (
                                    <div
                                      key={loc}
                                      className="group/loc relative"
                                    >
                                      <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-vpn-input/70 text-vpn-muted cursor-default">
                                        <MapPin className="w-2.5 h-2.5" />
                                        {loc}
                                        <span className="text-vpn-muted/50 ml-0.5">
                                          ({items.length})
                                        </span>
                                      </span>
                                      {/* Tooltip with container links */}
                                      <div className="absolute bottom-full left-0 mb-1 hidden group-hover/loc:block z-50">
                                        <div className="bg-vpn-card border border-vpn-border rounded-lg shadow-xl p-2 min-w-[140px]">
                                          <p className="text-[9px] text-vpn-muted/60 uppercase tracking-wider font-medium mb-1">
                                            {loc}
                                          </p>
                                          <div className="space-y-0.5">
                                            {items.map((item) => (
                                              <button
                                                key={item.id}
                                                onClick={(e) => {
                                                  e.stopPropagation();
                                                  navigate(
                                                    `/vpn-proxy#container-${item.id}`,
                                                  );
                                                }}
                                                className="flex items-center gap-1.5 w-full px-1.5 py-1 rounded text-[10px] text-vpn-text hover:bg-vpn-bg/60 hover:text-vpn-primary transition-colors text-left"
                                              >
                                                <Server className="w-2.5 h-2.5 flex-shrink-0" />
                                                <span className="truncate">
                                                  {item.name}
                                                </span>
                                                <ChevronRight className="w-2.5 h-2.5 ml-auto opacity-50 flex-shrink-0" />
                                              </button>
                                            ))}
                                          </div>
                                        </div>
                                      </div>
                                    </div>
                                  ))}
                                {Object.keys(p.locationMap).length > 8 && (
                                  <span className="text-[9px] text-vpn-muted px-1.5 py-0.5">
                                    +{Object.keys(p.locationMap).length - 8}{" "}
                                    more
                                  </span>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* VPN Connections Overview */}
              {visibility.connections && (
                <div
                  className={`${visibility.providers ? "lg:col-span-2" : ""} bg-vpn-card border border-vpn-border rounded-xl p-5`}
                >
                  <div className="flex items-center gap-2 mb-4">
                    <Globe className="w-4 h-4 text-vpn-primary" />
                    <h3 className="text-sm font-semibold text-white">
                      Active VPN Connections
                    </h3>
                    <span className="text-[10px] text-vpn-muted bg-vpn-input px-2 py-0.5 rounded-full ml-auto">
                      {vpnConnections.length} active
                    </span>
                  </div>
                  {vpnConnections.length === 0 ? (
                    <p className="text-sm text-vpn-muted py-4 text-center">
                      No active VPN connections
                    </p>
                  ) : (
                    <div className="space-y-2">
                      {vpnConnections.map((conn) => (
                        <div
                          key={conn.id}
                          onClick={() =>
                            navigate(`/vpn-proxy#container-${conn.id}`)
                          }
                          className="bg-vpn-bg/50 border border-vpn-border/50 rounded-lg p-3 hover:border-vpn-muted/50 cursor-pointer transition-all group"
                        >
                          {/* Row 1: Name + Status */}
                          <div className="flex items-center gap-2 mb-2">
                            <span
                              className={`w-2 h-2 rounded-full flex-shrink-0 ${
                                conn.vpnStatus === "running" && conn.publicIp
                                  ? "bg-emerald-500 shadow-sm shadow-emerald-500/50"
                                  : "bg-red-500"
                              }`}
                            />
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              <span className="text-sm text-white font-semibold group-hover:text-vpn-primary transition-colors truncate">
                                {conn.name}
                              </span>
                              {conn.description && (
                                <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-vpn-primary/10 text-vpn-primary border border-vpn-primary/20 truncate max-w-[200px]">
                                  {conn.description}
                                </span>
                              )}
                            </div>
                            <div className="flex items-center gap-1.5 flex-shrink-0 flex-wrap">
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium bg-purple-500/10 text-purple-400 border border-purple-500/20 capitalize">
                                {conn.provider}
                              </span>
                              <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] font-medium bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 uppercase">
                                {conn.vpnType}
                              </span>
                              <span
                                className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-medium ${
                                  conn.vpnStatus === "running" && conn.publicIp
                                    ? "bg-emerald-500/10 text-emerald-400 border border-emerald-500/20"
                                    : "bg-red-500/10 text-red-400 border border-red-500/20"
                                }`}
                              >
                                {conn.vpnStatus === "running" &&
                                conn.publicIp ? (
                                  <Wifi className="w-2.5 h-2.5" />
                                ) : (
                                  <WifiOff className="w-2.5 h-2.5" />
                                )}
                                {conn.vpnStatus === "running" && conn.publicIp
                                  ? "Connected"
                                  : "Disconnected"}
                              </span>
                              <ChevronRight className="w-3.5 h-3.5 text-vpn-muted group-hover:text-vpn-primary transition-colors" />
                            </div>
                          </div>
                          {/* Row 2: Info badges */}
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {conn.publicIp && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-vpn-primary/10 text-vpn-primary border border-vpn-primary/20">
                                <Globe className="w-2.5 h-2.5" />
                                {conn.publicIp}
                              </span>
                            )}
                            {(conn.country || conn.location) && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-vpn-input text-vpn-muted border border-vpn-border/50">
                                <MapPin className="w-2.5 h-2.5" />
                                {conn.country || conn.location}
                                {conn.region && (
                                  <span className="text-vpn-muted/50">
                                    · {conn.region}
                                  </span>
                                )}
                              </span>
                            )}
                            {conn.portForwarded && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <ArrowUpDown className="w-2.5 h-2.5" />
                                {conn.portForwarded}
                              </span>
                            )}
                            {conn.httpProxy && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-400 border border-amber-500/20">
                                <Network className="w-2.5 h-2.5" />
                                HTTP {conn.httpProxy}
                              </span>
                            )}
                            {conn.httpProxyHost && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-amber-500/10 text-amber-300 border border-amber-500/20">
                                <Server className="w-2.5 h-2.5" />
                                HTTP {conn.httpProxyHost}
                              </span>
                            )}
                            {conn.httpProxyExternal && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-orange-500/10 text-orange-400 border border-orange-500/20">
                                <Globe className="w-2.5 h-2.5" />
                                HTTP {conn.httpProxyExternal}
                              </span>
                            )}
                            {conn.shadowsocks && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Network className="w-2.5 h-2.5" />
                                SS {conn.shadowsocks}
                              </span>
                            )}
                            {conn.shadowsocksHost && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-blue-500/10 text-blue-300 border border-blue-500/20">
                                <Server className="w-2.5 h-2.5" />
                                SS {conn.shadowsocksHost}
                              </span>
                            )}
                            {conn.shadowsocksExternal && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                                <Globe className="w-2.5 h-2.5" />
                                SS {conn.shadowsocksExternal}
                              </span>
                            )}
                            {conn.socks5 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-400 border border-purple-500/20">
                                <Network className="w-2.5 h-2.5" />
                                SOCKS5 {conn.socks5}
                              </span>
                            )}
                            {conn.socks5Host && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-purple-500/10 text-purple-300 border border-purple-500/20">
                                <Server className="w-2.5 h-2.5" />
                                SOCKS5 {conn.socks5Host}
                              </span>
                            )}
                            {conn.socks5External && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-violet-500/10 text-violet-400 border border-violet-500/20">
                                <Globe className="w-2.5 h-2.5" />
                                SOCKS5 {conn.socks5External}
                              </span>
                            )}
                            {conn.deps.length > 0 && (
                              <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                                <Users className="w-2.5 h-2.5" />
                                {conn.deps.length} client
                                {conn.deps.length !== 1 ? "s" : ""}
                                <span className="text-blue-400/60 ml-0.5">
                                  (
                                  {conn.deps
                                    .slice(0, 2)
                                    .map((d) => d.name)
                                    .join(", ")}
                                  {conn.deps.length > 2 ? ", ..." : ""})
                                </span>
                              </span>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
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
