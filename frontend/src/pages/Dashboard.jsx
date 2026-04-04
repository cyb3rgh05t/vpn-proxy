import { useState, useMemo } from "react";
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
} from "lucide-react";
import api from "../services/api";
import WorldMap from "../components/WorldMap";
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
  const vpnDisconnected = gluetunRunning - vpnConnected;

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
          connected: 0,
          stopped: 0,
          unhealthy: 0,
          types: new Set(),
          countries: new Set(),
          cities: new Set(),
          proxyCount: 0,
          clientCount: 0,
          portForwardCount: 0,
          ips: new Set(),
          serverLocations: new Set(),
        };
      map[p].total++;
      if (c.vpn_type) map[p].types.add(c.vpn_type);
      const info = vpnInfoMap[String(c.id)];
      if (info?.vpn_status === "running") map[p].connected++;
      if (["exited", "dead", "removed"].includes(c.status)) map[p].stopped++;
      if (c.status === "unhealthy") map[p].unhealthy++;
      if (info?.country) map[p].countries.add(info.country);
      if (info?.region) map[p].cities.add(info.region);
      if (info?.public_ip) map[p].ips.add(info.public_ip);
      if (info?.port_forwarded) map[p].portForwardCount++;
      if (c.config?.SERVER_COUNTRIES)
        c.config.SERVER_COUNTRIES.split(",").forEach((s) => {
          if (s.trim()) map[p].serverLocations.add(s.trim());
        });
      if (c.config?.SERVER_CITIES)
        c.config.SERVER_CITIES.split(",").forEach((s) => {
          if (s.trim()) map[p].serverLocations.add(s.trim());
        });
      if (
        c.config?.HTTPPROXY?.toLowerCase() === "on" ||
        c.config?.SHADOWSOCKS?.toLowerCase() === "on"
      )
        map[p].proxyCount++;
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
        serverLocations: [...data.serverLocations],
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
          httpProxyExternal,
          shadowsocks: ssEnabled
            ? `${c.ip_address || "—"}:${c.port_shadowsocks}`
            : null,
          shadowsocksExternal,
        };
      })
      .filter(
        (c) =>
          ["running", "healthy", "unhealthy", "starting"].includes(c.status) &&
          c.vpnStatus,
      );
  }, [containers, vpnInfoMap, depsMap]);

  const StatCard = ({ label, value, icon: Icon, color, bg }) => (
    <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 min-w-0 hover:border-vpn-primary/30 transition-colors">
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
            New VPN-Proxy
          </button>
          <button
            onClick={() => navigate("/create-o11")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
          >
            <PlusCircle className="w-4 h-4 text-vpn-primary" />
            New o11
          </button>
        </div>
      </div>

      {/* Stats Row */}
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
          />
          <StatCard
            label="VPN Running"
            value={gluetunRunning}
            icon={Activity}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
          />
          <StatCard
            label="Connected"
            value={vpnConnected}
            icon={Wifi}
            color="text-emerald-400"
            bg="bg-emerald-500/10"
          />
          <StatCard
            label="Disconnected"
            value={vpnDisconnected}
            icon={WifiOff}
            color="text-amber-400"
            bg="bg-amber-500/10"
          />
          <StatCard
            label="Unhealthy"
            value={gluetunUnhealthy}
            icon={HeartCrack}
            color="text-red-400"
            bg="bg-red-500/10"
          />
          <StatCard
            label="Stopped"
            value={gluetunStopped}
            icon={AlertTriangle}
            color="text-amber-400"
            bg="bg-amber-500/10"
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

      {/* World Map */}
      {vpnConnections.length > 0 && (
        <div className="mb-6">
          <WorldMap vpnConnections={vpnConnections} />
        </div>
      )}

      {/* Provider Overview + VPN Connections */}
      {containers.length > 0 && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 mb-6">
          {/* Provider Overview */}
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
                        <p className="text-sm text-white font-semibold capitalize truncate">
                          {p.name}
                        </p>
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
                    </div>
                    {/* Progress bar */}
                    <div className="flex items-center gap-2 mb-2">
                      <div className="flex-1 h-1.5 bg-vpn-input rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${p.total > 0 ? (p.connected / p.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <span className="text-[10px] text-emerald-400 font-semibold tabular-nums">
                        {p.connected}/{p.total}
                      </span>
                    </div>
                    {/* Info badges */}
                    <div className="flex items-center gap-1.5 flex-wrap">
                      {p.countries.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-vpn-input text-vpn-muted border border-vpn-border/50">
                          <MapPin className="w-2.5 h-2.5" />
                          {p.countries.length}{" "}
                          {p.countries.length === 1 ? "country" : "countries"}
                        </span>
                      )}
                      {p.proxyCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-amber-500/10 text-amber-400 border border-amber-500/20">
                          <Network className="w-2.5 h-2.5" />
                          {p.proxyCount} proxy
                        </span>
                      )}
                      {p.clientCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-blue-500/10 text-blue-400 border border-blue-500/20">
                          <Users className="w-2.5 h-2.5" />
                          {p.clientCount}
                        </span>
                      )}
                      {p.portForwardCount > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-vpn-primary/10 text-vpn-primary border border-vpn-primary/20">
                          <ArrowUpDown className="w-2.5 h-2.5" />
                          {p.portForwardCount} forwarded
                        </span>
                      )}
                      {p.ips.length > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
                          <Globe className="w-2.5 h-2.5" />
                          {p.ips.length} {p.ips.length === 1 ? "IP" : "IPs"}
                        </span>
                      )}
                      {p.unhealthy > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-red-500/10 text-red-400 border border-red-500/20">
                          <HeartCrack className="w-2.5 h-2.5" />
                          {p.unhealthy}
                        </span>
                      )}
                      {p.stopped > 0 && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] bg-vpn-input text-vpn-muted border border-vpn-border/50">
                          <AlertTriangle className="w-2.5 h-2.5" />
                          {p.stopped} off
                        </span>
                      )}
                    </div>
                    {/* Server locations */}
                    {p.serverLocations.length > 0 && (
                      <div className="flex items-center gap-1.5 flex-wrap mt-2 pt-2 border-t border-vpn-border/30">
                        {p.serverLocations.slice(0, 6).map((loc) => (
                          <span
                            key={loc}
                            className="inline-flex items-center px-1.5 py-0.5 rounded text-[9px] bg-vpn-input/70 text-vpn-muted"
                          >
                            {loc}
                          </span>
                        ))}
                        {p.serverLocations.length > 6 && (
                          <span className="text-[9px] text-vpn-muted">
                            +{p.serverLocations.length - 6} more
                          </span>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* VPN Connections Overview */}
          <div className="lg:col-span-2 bg-vpn-card border border-vpn-border rounded-xl p-5">
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
                    onClick={() => navigate(`/vpn-proxy#container-${conn.id}`)}
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
                          {conn.vpnStatus === "running" && conn.publicIp ? (
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
                      {conn.shadowsocksExternal && (
                        <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-mono bg-sky-500/10 text-sky-400 border border-sky-500/20">
                          <Globe className="w-2.5 h-2.5" />
                          SS {conn.shadowsocksExternal}
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
        </div>
      )}
    </div>
  );
}
