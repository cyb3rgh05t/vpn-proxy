import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
} from "react";
import api from "../services/api";

const ContainerDataContext = createContext(null);

const MONITORING_INTERVAL = 5000;

export function ContainerDataProvider({ children }) {
  const [containers, setContainers] = useState([]);
  const [vpnInfoMap, setVpnInfoMap] = useState({});
  const [o11Containers, setO11Containers] = useState([]);
  const [depsMap, setDepsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // Monitoring state (cached across page navigations)
  const [monitoringConfigured, setMonitoringConfigured] = useState(null);
  const [monitoringProviderId, setMonitoringProviderId] = useState("");
  const [monitorData, setMonitorData] = useState(null);
  const [networkData, setNetworkData] = useState(null);
  const [proxyCount, setProxyCount] = useState(0);
  const [monitoringLoading, setMonitoringLoading] = useState(true);
  const monitoringIntervalRef = useRef(null);
  const monitoringInitRef = useRef(false);

  const fetchContainers = useCallback(async () => {
    try {
      const res = await api.get("/containers");
      const data = Array.isArray(res.data) ? res.data : [];
      setContainers(data);
      setError("");
      return data;
    } catch {
      setError("Failed to load containers");
      return null;
    }
  }, []);

  const fetchVpnInfo = useCallback(async () => {
    try {
      const res = await api.get("/containers/vpn-info-batch");
      setVpnInfoMap(res.data || {});
    } catch {
      // Silently ignore
    }
  }, []);

  const fetchAllDependents = useCallback(async () => {
    try {
      const res = await api.get("/containers/dependents");
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }, []);

  const fetchAll = useCallback(async () => {
    // Fire vpn-info fetch independently (slow endpoint, don't block the rest)
    fetchVpnInfo();

    const [containerData, allDeps] = await Promise.all([
      fetchContainers(),
      fetchAllDependents(),
    ]);

    // Set O11 containers
    setO11Containers(allDeps.filter((c) => /o11/i.test(c.name)));

    // Build depsMap client-side: group dependents by their vpn_parent → managed container id
    if (containerData?.length && allDeps.length) {
      const nameToId = {};
      for (const c of containerData) {
        // Map both vpn-proxy name and docker_name to DB id
        if (c.name) {
          nameToId[c.name] = c.id;
          nameToId[`gluetun-${c.name}`] = c.id;
        }
        if (c.docker_name) nameToId[c.docker_name] = c.id;
      }
      const map = {};
      for (const dep of allDeps) {
        if (dep.vpn_parent && nameToId[dep.vpn_parent] !== undefined) {
          const parentId = nameToId[dep.vpn_parent];
          if (!map[parentId]) map[parentId] = [];
          map[parentId].push(dep);
        }
      }
      setDepsMap(map);
    }

    setLoading(false);
  }, [fetchContainers, fetchAllDependents]);

  // --- Monitoring fetch functions ---
  const fetchMonitoringData = useCallback(
    async (silent = false, overrideProviderId = null) => {
      const pid = overrideProviderId || monitoringProviderId;
      try {
        if (!silent) setMonitoringLoading(true);
        const requests = [api.get("/monitoring")];
        if (pid) {
          requests.push(
            api.get("/monitoring/network-usage", {
              params: { provider: pid },
            }),
          );
          requests.push(
            api.get("/monitoring/proxy-count", {
              params: { provider: pid },
            }),
          );
        }
        const results = await Promise.all(requests);
        setMonitorData(results[0].data);
        if (results[1]) setNetworkData(results[1].data);
        if (results[2]) setProxyCount(results[2].data.count || 0);
      } catch {
        // silently ignore on silent refresh
      } finally {
        setMonitoringLoading(false);
      }
    },
    [monitoringProviderId],
  );

  const initMonitoring = useCallback(async () => {
    if (monitoringInitRef.current) return;
    monitoringInitRef.current = true;
    try {
      const [statusRes, settingsRes] = await Promise.all([
        api.get("/monitoring/status"),
        api.get("/settings/o11"),
      ]);
      const pid = settingsRes.data.o11_provider_id || "";
      if (pid) setMonitoringProviderId(pid);
      const isConfigured = statusRes.data.configured;
      setMonitoringConfigured(isConfigured);
      if (isConfigured) {
        await fetchMonitoringData(false, pid);
      } else {
        setMonitoringLoading(false);
      }
    } catch {
      setMonitoringConfigured(false);
      setMonitoringLoading(false);
    }
  }, [fetchMonitoringData]);

  useEffect(() => {
    fetchAll();
    initMonitoring();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, [fetchAll, initMonitoring]);

  // Auto-refresh monitoring data
  useEffect(() => {
    if (!monitoringConfigured) return;
    monitoringIntervalRef.current = setInterval(
      () => fetchMonitoringData(true),
      MONITORING_INTERVAL,
    );
    return () => clearInterval(monitoringIntervalRef.current);
  }, [monitoringConfigured, fetchMonitoringData]);

  return (
    <ContainerDataContext.Provider
      value={{
        containers,
        vpnInfoMap,
        o11Containers,
        depsMap,
        loading,
        error,
        refreshContainers: fetchContainers,
        refreshO11Containers: fetchAll,
        refreshAll: fetchAll,
        // Monitoring
        monitoringConfigured,
        monitoringProviderId,
        setMonitoringProviderId,
        monitorData,
        networkData,
        proxyCount,
        monitoringLoading,
        refreshMonitoring: fetchMonitoringData,
      }}
    >
      {children}
    </ContainerDataContext.Provider>
  );
}

export function useContainerData() {
  const ctx = useContext(ContainerDataContext);
  if (!ctx)
    throw new Error(
      "useContainerData must be used within ContainerDataProvider",
    );
  return ctx;
}
