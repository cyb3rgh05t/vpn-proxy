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

  // Monitoring state (multi-instance, cached across page navigations)
  const [monitoringConfigured, setMonitoringConfigured] = useState(null);
  const [o11Instances, setO11Instances] = useState([]); // [{id, name, provider_id, configured}]
  const [activeInstanceId, setActiveInstanceId] = useState(null);
  const [instanceMonitorData, setInstanceMonitorData] = useState({}); // {id: monitorData}
  const [instanceNetworkData, setInstanceNetworkData] = useState({}); // {id: networkData}
  const [instanceProxyCount, setInstanceProxyCount] = useState({}); // {id: count}
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

    const [containerData, allDeps, o11DbInfo] = await Promise.all([
      fetchContainers(),
      fetchAllDependents(),
      api
        .get("/containers/dependents/db-info-batch")
        .then((r) => r.data)
        .catch(() => ({})),
    ]);

    // Set O11 containers — identified by the managed-by label, merged with DB info
    const o11List = allDeps.filter(
      (c) => c.labels?.["managed-by"] === "vpn-proxy-o11",
    );
    setO11Containers(
      o11List.map((c) => ({
        ...c,
        description: o11DbInfo[c.name]?.description || null,
      })),
    );

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

  // --- Monitoring fetch functions (multi-instance) ---
  const fetchMonitoringData = useCallback(
    async (silent = false) => {
      try {
        if (!silent) setMonitoringLoading(true);
        const configured = o11Instances.filter((i) => i.configured);
        if (configured.length === 0) return;

        const results = await Promise.all(
          configured.map(async (inst) => {
            try {
              const requests = [api.get(`/monitoring/instance/${inst.id}`)];
              if (inst.provider_id) {
                requests.push(
                  api.get(`/monitoring/instance/${inst.id}/network-usage`, {
                    params: { provider: inst.provider_id },
                  }),
                );
                requests.push(
                  api.get(`/monitoring/instance/${inst.id}/proxy-count`, {
                    params: { provider: inst.provider_id },
                  }),
                );
              }
              const res = await Promise.all(requests);
              return {
                id: inst.id,
                monitor: res[0].data,
                network: res[1]?.data || null,
                proxy: res[2]?.data?.count || 0,
              };
            } catch {
              return { id: inst.id, monitor: null, network: null, proxy: 0 };
            }
          }),
        );

        const newMonitor = {};
        const newNetwork = {};
        const newProxy = {};
        for (const r of results) {
          newMonitor[r.id] = r.monitor;
          newNetwork[r.id] = r.network;
          newProxy[r.id] = r.proxy;
        }
        setInstanceMonitorData(newMonitor);
        setInstanceNetworkData(newNetwork);
        setInstanceProxyCount(newProxy);
      } catch {
        // silently ignore
      } finally {
        setMonitoringLoading(false);
      }
    },
    [o11Instances],
  );

  const initMonitoring = useCallback(async () => {
    if (monitoringInitRef.current) return;
    monitoringInitRef.current = true;
    try {
      const [statusRes, instancesRes] = await Promise.all([
        api.get("/monitoring/status"),
        api.get("/settings/o11/instances"),
      ]);
      const instances = Array.isArray(instancesRes.data)
        ? instancesRes.data
        : [];
      setO11Instances(instances);
      const isConfigured = statusRes.data.configured;
      setMonitoringConfigured(isConfigured);
      if (instances.length > 0) {
        setActiveInstanceId(instances[0].id);
      }
      if (isConfigured && instances.length > 0) {
        // Fetch data for all configured instances immediately
        const configured = instances.filter((i) => i.configured);
        if (configured.length > 0) {
          const results = await Promise.all(
            configured.map(async (inst) => {
              try {
                const requests = [api.get(`/monitoring/instance/${inst.id}`)];
                if (inst.provider_id) {
                  requests.push(
                    api.get(`/monitoring/instance/${inst.id}/network-usage`, {
                      params: { provider: inst.provider_id },
                    }),
                  );
                  requests.push(
                    api.get(`/monitoring/instance/${inst.id}/proxy-count`, {
                      params: { provider: inst.provider_id },
                    }),
                  );
                }
                const res = await Promise.all(requests);
                return {
                  id: inst.id,
                  monitor: res[0].data,
                  network: res[1]?.data || null,
                  proxy: res[2]?.data?.count || 0,
                };
              } catch {
                return { id: inst.id, monitor: null, network: null, proxy: 0 };
              }
            }),
          );
          const newMonitor = {};
          const newNetwork = {};
          const newProxy = {};
          for (const r of results) {
            newMonitor[r.id] = r.monitor;
            newNetwork[r.id] = r.network;
            newProxy[r.id] = r.proxy;
          }
          setInstanceMonitorData(newMonitor);
          setInstanceNetworkData(newNetwork);
          setInstanceProxyCount(newProxy);
        }
        setMonitoringLoading(false);
      } else {
        setMonitoringLoading(false);
      }
    } catch {
      setMonitoringConfigured(false);
      setMonitoringLoading(false);
    }
  }, []);

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
        // Monitoring (multi-instance)
        monitoringConfigured,
        o11Instances,
        activeInstanceId,
        setActiveInstanceId,
        instanceMonitorData,
        instanceNetworkData,
        instanceProxyCount,
        // Convenience getters for active instance
        monitorData: instanceMonitorData[activeInstanceId] || null,
        networkData: instanceNetworkData[activeInstanceId] || null,
        proxyCount: Object.values(instanceProxyCount).reduce(
          (s, v) => s + v,
          0,
        ),
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
