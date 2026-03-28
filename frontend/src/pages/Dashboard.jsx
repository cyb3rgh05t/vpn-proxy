import { useState, useEffect, useCallback } from "react";
import { useNavigate } from "react-router-dom";
import {
  PlusCircle,
  Server,
  Activity,
  AlertTriangle,
  RefreshCw,
  Search,
} from "lucide-react";
import api from "../services/api";
import ContainerCard from "../components/ContainerCard";
import { useToast } from "../context/ToastContext";

export default function Dashboard() {
  const navigate = useNavigate();
  const toast = useToast();
  const [containers, setContainers] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [refreshing, setRefreshing] = useState(false);
  const [discovering, setDiscovering] = useState(false);
  const [vpnInfoMap, setVpnInfoMap] = useState({});

  const fetchContainers = useCallback(async () => {
    try {
      const res = await api.get("/containers");
      setContainers(Array.isArray(res.data) ? res.data : []);
      setError("");
    } catch (err) {
      setError("Failed to load containers");
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchVpnInfo = useCallback(async () => {
    try {
      const res = await api.get("/containers/vpn-info-batch");
      setVpnInfoMap(res.data || {});
    } catch {
      // Silently ignore - VPN info is optional
    }
  }, []);

  useEffect(() => {
    fetchContainers();
    fetchVpnInfo();
    const interval = setInterval(() => {
      fetchContainers();
      fetchVpnInfo();
    }, 15000);
    return () => clearInterval(interval);
  }, [fetchContainers, fetchVpnInfo]);

  const running = containers.filter((c) => c.status === "running").length;
  const stopped = containers.filter((c) =>
    ["exited", "dead", "removed"].includes(c.status),
  ).length;

  const stats = [
    {
      label: "Total Containers",
      value: containers.length,
      icon: Server,
      color: "text-vpn-primary",
      bg: "bg-vpn-primary/10",
    },
    {
      label: "Running",
      value: running,
      icon: Activity,
      color: "text-emerald-400",
      bg: "bg-emerald-500/10",
    },
    {
      label: "Stopped",
      value: stopped,
      icon: AlertTriangle,
      color: "text-amber-400",
      bg: "bg-amber-500/10",
    },
  ];

  return (
    <div>
      <div className="flex items-center justify-between mb-8">
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
                fetchContainers();
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
              await fetchContainers();
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

      {/* Stats */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        {stats.map(({ label, value, icon: Icon, color, bg }) => (
          <div
            key={label}
            className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex items-center gap-4"
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
            onClick={fetchContainers}
            className="mt-3 text-vpn-primary hover:text-vpn-accent"
          >
            Try again
          </button>
        </div>
      ) : containers.length === 0 ? (
        <div className="text-center py-16 bg-vpn-card border border-vpn-border rounded-2xl">
          <Server className="w-16 h-16 text-vpn-border mx-auto mb-4" />
          <h3 className="text-xl font-semibold text-vpn-text mb-2">
            No containers yet
          </h3>
          <p className="text-vpn-muted mb-6">
            Create your first Gluetun VPN container to get started.
          </p>
          <button
            onClick={() => navigate("/create")}
            className="inline-flex items-center gap-2 px-6 py-3 bg-vpn-primary hover:bg-vpn-primary-hover text-black rounded-lg transition-colors"
          >
            <PlusCircle className="w-5 h-5" />
            Create Container
          </button>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {containers.map((container) => (
            <ContainerCard
              key={container.id}
              container={container}
              vpnInfo={vpnInfoMap[String(container.id)]}
              onRefresh={fetchContainers}
            />
          ))}
        </div>
      )}
    </div>
  );
}
