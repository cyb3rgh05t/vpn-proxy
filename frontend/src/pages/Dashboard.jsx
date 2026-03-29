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
      if (!map[p]) map[p] = { total: 0, connected: 0, types: new Set() };
      map[p].total++;
      if (c.vpn_type) map[p].types.add(c.vpn_type);
      const info = vpnInfoMap[String(c.id)];
      if (info?.vpn_status === "running") map[p].connected++;
    }
    return Object.entries(map)
      .sort((a, b) => b[1].total - a[1].total)
      .map(([name, data]) => ({
        name,
        ...data,
        types: [...data.types],
      }));
  }, [containers, vpnInfoMap]);

  // --- VPN connections overview ---
  const vpnConnections = useMemo(() => {
    return containers
      .map((c) => {
        const info = vpnInfoMap[String(c.id)];
        const deps = depsMap[c.id] || [];
        const httpEnabled = c.config?.HTTPPROXY?.toLowerCase() === "on";
        const ssEnabled = c.config?.SHADOWSOCKS?.toLowerCase() === "on";
        return {
          id: c.id,
          name: c.name,
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
          shadowsocks: ssEnabled
            ? `${c.ip_address || "—"}:${c.port_shadowsocks}`
            : null,
        };
      })
      .filter(
        (c) =>
          ["running", "healthy", "unhealthy", "starting"].includes(c.status) &&
          c.vpnStatus,
      );
  }, [containers, vpnInfoMap, depsMap]);

  const StatCard = ({ label, value, icon: Icon, color, bg }) => (
    <div className="bg-vpn-card border border-vpn-border rounded-xl p-4 flex items-center gap-3">
      <div className={`p-2.5 rounded-lg ${bg}`}>
        <Icon className={`w-5 h-5 ${color}`} />
      </div>
      <div>
        <p className="text-xl font-bold text-white">{value}</p>
        <p className="text-xs text-vpn-muted">{label}</p>
      </div>
    </div>
  );

  return (
    <div>
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-white">Dashboard</h1>
          <p className="text-vpn-muted mt-1">
            Manage your Gluetun VPN containers
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
            className="flex items-center gap-2 px-4 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <Search
              className={`w-4 h-4 ${discovering ? "animate-spin" : ""}`}
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
            className="flex items-center gap-2 px-4 py-2 bg-vpn-input hover:bg-vpn-border text-vpn-text rounded-lg transition-all active:scale-95 disabled:opacity-50"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
          <button
            onClick={() => navigate("/create")}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-primary hover:bg-vpn-primary-hover text-black rounded-lg transition-all active:scale-95"
          >
            <PlusCircle className="w-4 h-4" />
            New Container
          </button>
        </div>
      </div>

      {/* Stats: Gluetun + O11 side by side */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 mb-6">
        {/* Gluetun Stats */}
        <div>
          <div className="flex items-center gap-2 mb-3">
            <Shield className="w-4 h-4 text-vpn-primary" />
            <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider">
              Gluetun VPN
            </h3>
          </div>
          <div className="grid grid-cols-4 gap-3">
            <StatCard
              label="Total"
              value={containers.length}
              icon={Server}
              color="text-vpn-primary"
              bg="bg-vpn-primary/10"
            />
            <StatCard
              label="Running"
              value={gluetunRunning}
              icon={Activity}
              color="text-emerald-400"
              bg="bg-emerald-500/10"
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
          </div>
        </div>

        {/* O11 Stats */}
        {o11Containers.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Boxes className="w-4 h-4 text-vpn-primary" />
              <h3 className="text-sm font-semibold text-vpn-muted uppercase tracking-wider">
                O11 Containers
              </h3>
            </div>
            <div className="grid grid-cols-4 gap-3">
              <StatCard
                label="Total"
                value={o11Containers.length}
                icon={Boxes}
                color="text-vpn-primary"
                bg="bg-vpn-primary/10"
              />
              <StatCard
                label="Running"
                value={o11Running}
                icon={Activity}
                color="text-emerald-400"
                bg="bg-emerald-500/10"
              />
              <StatCard
                label="Unhealthy"
                value={o11Unhealthy}
                icon={HeartCrack}
                color="text-red-400"
                bg="bg-red-500/10"
              />
              <StatCard
                label="Stopped"
                value={o11Stopped}
                icon={AlertTriangle}
                color="text-amber-400"
                bg="bg-amber-500/10"
              />
            </div>
          </div>
        )}
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
            </div>
            {providerStats.length === 0 ? (
              <p className="text-sm text-vpn-muted">No providers</p>
            ) : (
              <div className="space-y-3">
                {providerStats.map((p) => (
                  <div
                    key={p.name}
                    className="flex items-center justify-between"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-lg bg-purple-500/10 flex items-center justify-center flex-shrink-0">
                        <Shield className="w-4 h-4 text-purple-400" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm text-white font-medium capitalize truncate">
                          {p.name}
                        </p>
                        <p className="text-[10px] text-vpn-muted">
                          {p.types.join(", ")}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <span className="text-xs text-emerald-400 font-medium">
                        {p.connected}/{p.total}
                      </span>
                      <div className="w-16 h-1.5 bg-vpn-input rounded-full overflow-hidden">
                        <div
                          className="h-full bg-emerald-500 rounded-full transition-all"
                          style={{
                            width: `${p.total > 0 ? (p.connected / p.total) * 100 : 0}%`,
                          }}
                        />
                      </div>
                    </div>
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
              <span className="text-xs text-vpn-muted bg-vpn-input px-2 py-0.5 rounded-full ml-auto">
                {vpnConnections.length} active
              </span>
            </div>
            {vpnConnections.length === 0 ? (
              <p className="text-sm text-vpn-muted py-4 text-center">
                No active VPN connections
              </p>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="text-[10px] text-vpn-muted uppercase tracking-wider border-b border-vpn-border">
                      <th className="text-left pb-2 pr-3">Container</th>
                      <th className="text-left pb-2 pr-3">Provider</th>
                      <th className="text-left pb-2 pr-3">Type</th>
                      <th className="text-left pb-2 pr-3">Status</th>
                      <th className="text-left pb-2 pr-3">Public IP</th>
                      <th className="text-left pb-2 pr-3">Location</th>
                      <th className="text-left pb-2 pr-3">Proxy</th>
                      <th className="text-left pb-2">Clients</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-vpn-border/50">
                    {vpnConnections.map((conn) => (
                      <tr
                        key={conn.id}
                        onClick={() =>
                          navigate(`/vpn-proxy#container-${conn.id}`)
                        }
                        className="hover:bg-vpn-input/50 cursor-pointer transition-colors"
                      >
                        <td className="py-2.5 pr-3">
                          <span className="text-white font-medium">
                            {conn.name}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-purple-400 capitalize">
                            {conn.provider}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-cyan-400 uppercase">
                            {conn.vpnType}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span
                            className={`inline-flex items-center gap-1 text-xs font-medium ${
                              conn.vpnStatus === "running"
                                ? "text-emerald-400"
                                : "text-red-400"
                            }`}
                          >
                            {conn.vpnStatus === "running" ? (
                              <Wifi className="w-3 h-3" />
                            ) : (
                              <WifiOff className="w-3 h-3" />
                            )}
                            {conn.vpnStatus === "running"
                              ? "Connected"
                              : "Disconnected"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-vpn-primary font-mono">
                            {conn.publicIp || "—"}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <span className="text-xs text-vpn-muted">
                            {conn.country || conn.location || "—"}
                            {conn.region && (
                              <span className="text-vpn-muted/50">
                                {" "}
                                · {conn.region}
                              </span>
                            )}
                          </span>
                        </td>
                        <td className="py-2.5 pr-3">
                          <div className="space-y-0.5">
                            {conn.httpProxy && (
                              <div className="text-[10px] text-vpn-muted font-mono">
                                <span className="text-amber-400">HTTP</span>{" "}
                                {conn.httpProxy}
                              </div>
                            )}
                            {conn.shadowsocks && (
                              <div className="text-[10px] text-vpn-muted font-mono">
                                <span className="text-blue-400">SS</span>{" "}
                                {conn.shadowsocks}
                              </div>
                            )}
                            {!conn.httpProxy && !conn.shadowsocks && (
                              <span className="text-xs text-vpn-muted">—</span>
                            )}
                          </div>
                        </td>
                        <td className="py-2.5">
                          {conn.deps.length > 0 ? (
                            <div className="space-y-0.5">
                              {conn.deps.map((dep) => (
                                <div
                                  key={dep.name}
                                  className="flex items-center gap-1.5 text-[10px]"
                                >
                                  <span
                                    className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${
                                      ["running", "healthy"].includes(
                                        dep.status,
                                      )
                                        ? "bg-emerald-400"
                                        : "bg-red-400"
                                    }`}
                                  />
                                  <span className="text-vpn-text truncate max-w-[120px]">
                                    {dep.name}
                                  </span>
                                </div>
                              ))}
                            </div>
                          ) : (
                            <span className="text-xs text-vpn-muted">—</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
