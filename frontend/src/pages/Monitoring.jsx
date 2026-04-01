import { useState, useEffect, useRef, useCallback, Fragment } from "react";
import {
  Activity,
  RefreshCw,
  Cpu,
  HardDrive,
  ArrowDownToLine,
  ArrowUpFromLine,
  Search,
  Radio,
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

function NetworkUsageTable({ usage }) {
  const [expandedRows, setExpandedRows] = useState({});

  // Flatten all proxy entries across categories into table rows
  const rows = [];
  for (const cat of CATEGORIES) {
    const proxy = usage[cat]?.Proxy || {};
    for (const [url, info] of Object.entries(proxy)) {
      rows.push({
        category: cat,
        url,
        streams: info?.Streams || [],
        mbps: info?.Mbps || 0,
        mbpsFormatted: info?.MbpsFormatted || "",
      });
    }
  }

  const toggleRow = (key) => setExpandedRows((p) => ({ ...p, [key]: !p[key] }));

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
    <div className="bg-vpn-card border border-vpn-border rounded-xl overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-vpn-border bg-vpn-input/30">
              <th className="px-4 py-3 text-left text-vpn-muted font-medium w-28">
                Category
              </th>
              <th className="px-4 py-3 text-left text-vpn-muted font-medium">
                Proxy URL
              </th>
              <th className="px-4 py-3 text-center text-vpn-muted font-medium w-24">
                Streams
              </th>
              <th className="px-4 py-3 text-right text-vpn-muted font-medium w-28">
                Bandwidth
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const rowKey = `${row.category}-${row.url}`;
              const expanded = expandedRows[rowKey];
              const streamCount = row.streams.length;
              return (
                <Fragment key={rowKey}>
                  <tr
                    className="border-b border-vpn-border/50 hover:bg-white/[0.02] transition-colors cursor-pointer"
                    onClick={() => streamCount > 0 && toggleRow(rowKey)}
                  >
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center px-2 py-0.5 rounded text-xs font-semibold border ${catColors[row.category]}`}
                      >
                        {row.category}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-vpn-primary font-mono text-xs">
                        {row.url}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-center">
                      <span className="inline-flex items-center gap-1.5">
                        {streamCount > 0 &&
                          (expanded ? (
                            <ChevronUp className="w-3.5 h-3.5 text-vpn-muted" />
                          ) : (
                            <ChevronDown className="w-3.5 h-3.5 text-vpn-muted" />
                          ))}
                        <span className="bg-vpn-primary/15 text-vpn-primary text-xs font-bold px-2 py-0.5 rounded-full min-w-[24px]">
                          {streamCount}
                        </span>
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {row.mbpsFormatted ? (
                        <span className="font-medium text-xs text-green-400">
                          {row.mbpsFormatted}
                        </span>
                      ) : (
                        <span className="text-vpn-muted text-xs">—</span>
                      )}
                    </td>
                  </tr>
                  {expanded && streamCount > 0 && (
                    <tr className="border-b border-vpn-border/30">
                      <td colSpan={4} className="px-6 py-3 bg-vpn-input/20">
                        <div className="flex flex-wrap gap-2">
                          {row.streams.map((s, i) => (
                            <span
                              key={i}
                              className="text-xs text-vpn-text bg-vpn-input px-2.5 py-1 rounded border border-vpn-border/50"
                            >
                              {s}
                            </span>
                          ))}
                        </div>
                      </td>
                    </tr>
                  )}
                </Fragment>
              );
            })}
          </tbody>
        </table>
      </div>
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
        <div className="flex items-center gap-3">
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
              autoRefresh
                ? "bg-green-500/20 text-green-400 border border-green-500/30"
                : "bg-vpn-input text-vpn-muted border border-vpn-border"
            }`}
          >
            <Radio
              className={`w-4 h-4 inline mr-1.5 ${autoRefresh ? "animate-pulse" : ""}`}
            />
            Live
          </button>
          <button
            onClick={() => fetchData()}
            disabled={refreshing}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-input border border-vpn-border text-vpn-text rounded-lg hover:border-vpn-primary/50 transition-colors"
          >
            <RefreshCw
              className={`w-4 h-4 ${refreshing ? "animate-spin" : ""}`}
            />
            Refresh
          </button>
        </div>
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

      {/* Network Usage - Proxy View */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Wifi className="w-5 h-5 text-vpn-primary" />
            Network Usage
          </h2>
          <div className="flex items-center gap-3">
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
        </div>

        <NetworkUsageTable usage={usage} />
      </div>

      {/* Active Streams Table */}
      <div className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <h2 className="text-lg font-semibold text-white flex items-center gap-2">
              <MonitorPlay className="w-5 h-5 text-vpn-primary" />
              Active Streams
            </h2>
            <span className="px-2.5 py-0.5 bg-vpn-primary/10 text-vpn-primary text-sm font-medium rounded-full">
              {filteredReaders.length}
            </span>
          </div>
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
                      <td className="px-4 py-3 text-vpn-text">{r.Uptime}</td>
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
    </div>
  );
}
