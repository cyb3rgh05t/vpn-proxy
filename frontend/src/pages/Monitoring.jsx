import { useState, useEffect, useRef, useCallback } from "react";
import {
  Activity,
  RefreshCw,
  Cpu,
  HardDrive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Wifi,
  AlertTriangle,
  Tv,
  MonitorPlay,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import api from "../services/api";
import { useToast } from "../context/ToastContext";

const AUTO_REFRESH_INTERVAL = 5000;
const CATEGORIES = ["Script", "Manifest", "Media"];

function bwColorClass(color) {
  switch (color) {
    case "green":
      return "text-green-400";
    case "yellow":
      return "text-yellow-400";
    case "orange":
      return "text-orange-400";
    case "red":
      return "text-red-400";
    default:
      return "text-vpn-text";
  }
}

function NetworkUsageGrid({ usage }) {
  const [expandedCards, setExpandedCards] = useState({});

  const rows = [];
  for (const cat of CATEGORIES) {
    const proxy = usage[cat]?.Proxy || {};
    for (const [url, info] of Object.entries(proxy)) {
      rows.push({
        category: cat,
        url,
        streams: info?.Streams || [],
        maxStreams: info?.MaxStreams || 0,
        mbps: info?.Mbps || 0,
        mbpsFormatted: info?.MbpsFormatted || "",
      });
    }
  }

  const toggleCard = (key) =>
    setExpandedCards((p) => ({ ...p, [key]: !p[key] }));

  const catColors = {
    Script: "text-blue-400 bg-blue-400/10 border-blue-400/30",
    Manifest: "text-purple-400 bg-purple-400/10 border-purple-400/30",
    Media: "text-amber-400 bg-amber-400/10 border-amber-400/30",
  };

  if (rows.length === 0) {
    return (
      <div className="bg-vpn-card border border-vpn-border rounded-xl p-8 text-center">
        <Wifi className="w-10 h-10 text-vpn-muted mx-auto mb-3" />
        <p className="text-vpn-muted">No proxy data available</p>
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
      {rows.map((row) => {
        const key = `${row.category}-${row.url}`;
        const expanded = expandedCards[key];
        const streamCount = row.streams.length;
        return (
          <div
            key={key}
            className="bg-vpn-card border border-vpn-border rounded-xl p-4 hover:border-vpn-primary/30 transition-colors"
          >
            <div className="flex items-center justify-between mb-3">
              <span
                className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${catColors[row.category]}`}
              >
                {row.category}
              </span>
              {row.mbpsFormatted ? (
                <span
                  className={`text-sm font-bold ${row.mbps > 0 ? "text-green-400" : "text-red-400"}`}
                >
                  {row.mbpsFormatted}
                </span>
              ) : (
                <span className="text-vpn-muted text-sm">—</span>
              )}
            </div>

            <p
              className="text-vpn-primary font-mono text-xs truncate mb-3"
              title={row.url}
            >
              {row.url}
            </p>

            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div>
                  <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                    Streams
                  </p>
                  <p className="text-sm font-bold text-white">{streamCount}</p>
                </div>
                <div>
                  <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                    Max
                  </p>
                  <p className="text-sm font-bold text-white">
                    {row.maxStreams}
                  </p>
                </div>
              </div>
              {streamCount > 0 && (
                <button
                  onClick={() => toggleCard(key)}
                  className="flex items-center gap-1 text-xs text-vpn-muted hover:text-vpn-primary transition-colors"
                >
                  {expanded ? (
                    <>
                      Hide <ChevronUp className="w-3.5 h-3.5" />
                    </>
                  ) : (
                    <>
                      Show <ChevronDown className="w-3.5 h-3.5" />
                    </>
                  )}
                </button>
              )}
            </div>

            {expanded && streamCount > 0 && (
              <div className="mt-3 pt-3 border-t border-vpn-border/50">
                <div className="flex flex-wrap gap-1.5">
                  {row.streams.map((s, i) => (
                    <span
                      key={i}
                      className="text-xs text-vpn-text bg-vpn-input px-2 py-1 rounded border border-vpn-border/50"
                    >
                      {s}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export default function Monitoring() {
  const toast = useToast();
  const [monitorData, setMonitorData] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [configured, setConfigured] = useState(null);
  const [refreshing, setRefreshing] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [providerId, setProviderId] = useState("demagentatv");
  const [tab, setTab] = useState("network");
  const intervalRef = useRef(null);

  const fetchData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setRefreshing(true);
        const [monRes, netRes] = await Promise.all([
          api.get("/monitoring"),
          api.get("/monitoring/network-usage", {
            params: { provider: providerId },
          }),
        ]);
        setMonitorData(monRes.data);
        setNetworkData(netRes.data);
      } catch (err) {
        if (!silent) toast.error("Failed to fetch monitoring data");
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [toast, providerId],
  );

  const checkStatus = useCallback(async () => {
    try {
      const res = await api.get("/monitoring/status");
      setConfigured(res.data.configured);
      if (res.data.configured) fetchData();
      else setLoading(false);
    } catch {
      setConfigured(false);
      setLoading(false);
    }
  }, [fetchData]);

  useEffect(() => {
    checkStatus();
  }, [checkStatus]);

  useEffect(() => {
    if (!autoRefresh || !configured) return;
    intervalRef.current = setInterval(
      () => fetchData(true),
      AUTO_REFRESH_INTERVAL,
    );
    return () => clearInterval(intervalRef.current);
  }, [autoRefresh, configured, fetchData]);

  const readers = monitorData?.Readers || [];
  const filteredReaders = readers.filter((r) => {
    if (!searchQuery) return true;
    const q = searchQuery.toLowerCase();
    return (
      r.StreamName?.toLowerCase().includes(q) ||
      r.ProviderName?.toLowerCase().includes(q) ||
      r.User?.toLowerCase().includes(q) ||
      r.Ip?.toLowerCase().includes(q)
    );
  });

  const usage = networkData?.Usage || {};

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vpn-primary" />
      </div>
    );
  }

  if (!configured) {
    return (
      <div className="space-y-6">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-7 h-7 text-vpn-primary" />
          Monitoring
        </h1>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-8 text-center">
          <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-white mb-2">
            Monitoring Not Configured
          </h2>
          <p className="text-vpn-muted max-w-md mx-auto">
            Go to{" "}
            <span className="text-vpn-primary font-medium">
              Settings → System
            </span>{" "}
            to configure your O11 monitoring connection.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Activity className="w-7 h-7 text-vpn-primary" />
          Monitoring
        </h1>
        <button
          onClick={() => fetchData()}
          disabled={refreshing}
          className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <RefreshCw
            className={`w-4 h-4 text-vpn-primary ${refreshing ? "animate-spin" : ""}`}
          />
          Refresh
        </button>
      </div>

      {/* System Stats */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-vpn-muted text-sm mb-1">
            <ArrowDownToLine className="w-4 h-4" />
            Bandwidth In
          </div>
          <p className="text-2xl font-bold text-green-400">
            {monitorData?.TotalBwIn || "—"}
          </p>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-vpn-muted text-sm mb-1">
            <ArrowUpFromLine className="w-4 h-4" />
            Bandwidth Out
          </div>
          <p className="text-2xl font-bold text-blue-400">
            {monitorData?.TotalBwOut || "—"}
          </p>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-vpn-muted text-sm mb-1">
            <Cpu className="w-4 h-4" />
            CPU Load
          </div>
          <p
            className={`text-2xl font-bold ${bwColorClass(monitorData?.CpuLoadColor)}`}
          >
            {monitorData?.CpuLoad || "—"}
          </p>
        </div>
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-4">
          <div className="flex items-center gap-2 text-vpn-muted text-sm mb-1">
            <HardDrive className="w-4 h-4" />
            Memory
          </div>
          <p className="text-2xl font-bold text-purple-400">
            {monitorData?.Memory || "—"}
          </p>
        </div>
      </div>

      {/* Tabs */}
      <div className="space-y-4">
        <div className="flex items-center gap-1 border-b border-vpn-border">
          <button
            onClick={() => setTab("network")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "network"
                ? "border-vpn-primary text-vpn-primary"
                : "border-transparent text-vpn-muted hover:text-vpn-text"
            }`}
          >
            <Wifi className="w-4 h-4" />
            Network Usage
          </button>
          <button
            onClick={() => setTab("streams")}
            className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px ${
              tab === "streams"
                ? "border-vpn-primary text-vpn-primary"
                : "border-transparent text-vpn-muted hover:text-vpn-text"
            }`}
          >
            <MonitorPlay className="w-4 h-4" />
            Active Streams
            <span className="px-1.5 py-0.5 bg-vpn-primary/10 text-vpn-primary text-xs font-bold rounded-full">
              {readers.length}
            </span>
          </button>
        </div>

        {/* Network Usage Tab */}
        {tab === "network" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
                <input
                  type="text"
                  placeholder="Provider ID..."
                  value={providerId}
                  onChange={(e) => setProviderId(e.target.value)}
                  onBlur={() => fetchData()}
                  onKeyDown={(e) => e.key === "Enter" && fetchData()}
                  className="w-48 pl-9 pr-4 py-2 bg-vpn-input border border-vpn-border rounded-lg text-vpn-text placeholder-vpn-muted text-sm focus:outline-none focus:border-vpn-primary/50"
                />
              </div>
            </div>
            <NetworkUsageGrid usage={usage} />
          </div>
        )}

        {/* Active Streams Tab */}
        {tab === "streams" && (
          <div className="space-y-4">
            <div className="flex items-center justify-end">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-vpn-muted" />
                <input
                  type="text"
                  placeholder="Search streams..."
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  className="w-full sm:w-64 pl-9 pr-4 py-2 bg-vpn-input border border-vpn-border rounded-lg text-vpn-text placeholder-vpn-muted focus:outline-none focus:border-vpn-primary/50"
                />
              </div>
            </div>

            {filteredReaders.length === 0 ? (
              <div className="bg-vpn-card border border-vpn-border rounded-xl p-8 text-center">
                <Tv className="w-10 h-10 text-vpn-muted mx-auto mb-3" />
                <p className="text-vpn-muted">
                  {readers.length === 0
                    ? "No active streams"
                    : "No streams match your search"}
                </p>
              </div>
            ) : (
              <div className="bg-vpn-card border border-vpn-border rounded-xl overflow-hidden">
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-vpn-border text-vpn-muted text-left">
                        <th className="px-4 py-3 font-medium">Stream</th>
                        <th className="px-4 py-3 font-medium">Provider</th>
                        <th className="px-4 py-3 font-medium">Quality</th>
                        <th className="px-4 py-3 font-medium">Bandwidth</th>
                        <th className="px-4 py-3 font-medium">Uptime</th>
                        <th className="px-4 py-3 font-medium">Errors</th>
                      </tr>
                    </thead>
                    <tbody>
                      {filteredReaders.map((r, i) => (
                        <tr
                          key={`${r.StreamName}-${r.User}-${i}`}
                          className="border-b border-vpn-border/50 hover:bg-white/[0.02] transition-colors"
                        >
                          <td className="px-4 py-3 text-white font-medium">
                            {r.StreamName}
                          </td>
                          <td className="px-4 py-3 text-vpn-muted">
                            {r.ProviderName}
                          </td>
                          <td className="px-4 py-3">
                            <span className="px-2 py-0.5 bg-vpn-primary/10 text-vpn-primary text-xs font-medium rounded">
                              {r.Quality}
                            </span>
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-medium ${bwColorClass(r.BwColor)}`}
                            >
                              {r.Bw}
                            </span>
                          </td>
                          <td className="px-4 py-3 text-vpn-text">
                            {r.Uptime}
                          </td>
                          <td className="px-4 py-3">
                            <span
                              className={`font-medium ${bwColorClass(r.ErrorsColor)}`}
                            >
                              {r.Errors}
                            </span>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
