import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
  useRef,
  startTransition,
} from "react";
import api from "../services/api";

const ContainerDataContext = createContext(null);

const MONITORING_INTERVAL = 10000;
const NAME_COLLATOR = new Intl.Collator("de", {
  sensitivity: "base",
  numeric: true,
});

const getStatusPriority = (status) => {
  const normalized = (status || "").toLowerCase();
  if (["running", "healthy"].includes(normalized)) return 0;
  if (normalized === "unhealthy") return 1;
  if (["starting", "restarting", "paused"].includes(normalized)) return 2;
  if (["created"].includes(normalized)) return 3;
  if (["exited", "dead", "removed", "error"].includes(normalized)) return 4;
  return 5;
};

const sortContainersByStatusAndName = (items) =>
  [...items].sort((a, b) => {
    const statusDiff =
      getStatusPriority(a?.status) - getStatusPriority(b?.status);
    if (statusDiff !== 0) return statusDiff;

    const nameA = a?.name || "";
    const nameB = b?.name || "";
    const nameDiff = NAME_COLLATOR.compare(nameA, nameB);
    if (nameDiff !== 0) return nameDiff;

    return String(a?.id || "").localeCompare(String(b?.id || ""));
  });

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

  // AbortControllers to cancel stale polling requests
  const fetchAllAbortRef = useRef(null);
  const monitoringAbortRef = useRef(null);

  // Settings state (shared across components)
  const [portainerUrl, setPortainerUrl] = useState("");
  const [containerImages, setContainerImages] = useState({
    gluetun_image: "qmcgaw/gluetun:latest",
    o11_images: [],
  });

  const fetchContainers = useCallback(async (signal) => {
    try {
      const res = await api.get("/containers", { signal });
      const data = Array.isArray(res.data) ? res.data : [];
      startTransition(() => {
        setContainers(sortContainersByStatusAndName(data));
        setError("");
      });
      return data;
    } catch (e) {
      if (e?.name === "CanceledError" || signal?.aborted) return null;
      startTransition(() => setError("Failed to load containers"));
      return null;
    }
  }, []);

  const fetchVpnInfo = useCallback(async (signal) => {
    try {
      const res = await api.get("/containers/vpn-info-batch", { signal });
      startTransition(() => setVpnInfoMap(res.data || {}));
    } catch {
      // Silently ignore
    }
  }, []);

  const fetchAllDependents = useCallback(async (signal) => {
    try {
      const res = await api.get("/containers/dependents", { signal });
      return Array.isArray(res.data) ? res.data : [];
    } catch {
      return [];
    }
  }, []);

  const fetchAll = useCallback(async () => {
    // Cancel any previous in-flight fetchAll
    fetchAllAbortRef.current?.abort();
    const controller = new AbortController();
    fetchAllAbortRef.current = controller;
    const { signal } = controller;

    // Fire vpn-info fetch independently (slow endpoint, don't block the rest)
    fetchVpnInfo(signal);

    const [containerData, allDeps, o11DbInfo] = await Promise.all([
      fetchContainers(signal),
      fetchAllDependents(signal),
      api
        .get("/containers/dependents/db-info-batch", { signal })
        .then((r) => r.data)
        .catch(() => ({})),
    ]);

    if (signal.aborted) return;

    // Set O11 containers — identified by the managed-by label, merged with DB info
    const o11List = allDeps.filter(
      (c) => c.labels?.["managed-by"] === "vpn-proxy-o11",
    );

    startTransition(() => {
      setO11Containers(
        sortContainersByStatusAndName(
          o11List.map((c) => ({
            ...c,
            description: o11DbInfo[c.name]?.description || null,
          })),
        ),
      );

      // Build depsMap client-side: group dependents by their vpn_parent → managed container id
      if (containerData?.length && allDeps.length) {
        const nameToId = {};
        for (const c of containerData) {
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
    });
  }, [fetchContainers, fetchAllDependents]);

  // --- Monitoring fetch functions (multi-instance) ---
  const fetchMonitoringData = useCallback(
    async (silent = false) => {
      // Cancel any previous in-flight monitoring request
      monitoringAbortRef.current?.abort();
      const controller = new AbortController();
      monitoringAbortRef.current = controller;
      const { signal } = controller;

      try {
        if (!silent) setMonitoringLoading(true);
        const configured = o11Instances.filter((i) => i.configured);
        if (configured.length === 0) return;

        const results = await Promise.all(
          configured.map(async (inst) => {
            try {
              const requests = [
                api.get(`/monitoring/instance/${inst.id}`, { signal }),
              ];
              if (inst.provider_id) {
                requests.push(
                  api.get(`/monitoring/instance/${inst.id}/network-usage`, {
                    params: { provider: inst.provider_id },
                    signal,
                  }),
                );
                requests.push(
                  api.get(`/monitoring/instance/${inst.id}/proxy-count`, {
                    params: { provider: inst.provider_id },
                    signal,
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

        if (signal.aborted) return;

        const newMonitor = {};
        const newNetwork = {};
        const newProxy = {};
        for (const r of results) {
          newMonitor[r.id] = r.monitor;
          newNetwork[r.id] = r.network;
          newProxy[r.id] = r.proxy;
        }
        startTransition(() => {
          setInstanceMonitorData(newMonitor);
          setInstanceNetworkData(newNetwork);
          setInstanceProxyCount(newProxy);
        });
      } catch {
        // silently ignore (includes aborted requests)
      } finally {
        if (!signal.aborted) setMonitoringLoading(false);
      }
    },
    [o11Instances],
  );

  const initMonitoring = useCallback(async () => {
    if (monitoringInitRef.current) return;
    monitoringInitRef.current = true;
    try {
      const [statusRes, instancesRes, portainerRes, imagesRes] =
        await Promise.all([
          api.get("/monitoring/status"),
          api.get("/settings/o11/instances"),
          api.get("/settings/portainer-url").catch(() => ({ data: {} })),
          api.get("/settings/container-images").catch(() => ({ data: {} })),
        ]);
      const instances = Array.isArray(instancesRes.data)
        ? instancesRes.data
        : [];
      setO11Instances(instances);
      setPortainerUrl(portainerRes.data?.portainer_url || "");
      setContainerImages({
        gluetun_image: imagesRes.data?.gluetun_image || "qmcgaw/gluetun:latest",
        o11_images: Array.isArray(imagesRes.data?.o11_images)
          ? imagesRes.data.o11_images
          : [],
      });
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
          startTransition(() => {
            setInstanceMonitorData(newMonitor);
            setInstanceNetworkData(newNetwork);
            setInstanceProxyCount(newProxy);
          });
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

  const refreshSettings = useCallback(async () => {
    try {
      const [instancesRes, statusRes, portainerRes, imagesRes] =
        await Promise.all([
          api.get("/settings/o11/instances"),
          api.get("/monitoring/status"),
          api.get("/settings/portainer-url").catch(() => ({ data: {} })),
          api.get("/settings/container-images").catch(() => ({ data: {} })),
        ]);
      const instances = Array.isArray(instancesRes.data)
        ? instancesRes.data
        : [];
      setO11Instances(instances);
      setMonitoringConfigured(statusRes.data.configured);
      setPortainerUrl(portainerRes.data?.portainer_url || "");
      setContainerImages({
        gluetun_image: imagesRes.data?.gluetun_image || "qmcgaw/gluetun:latest",
        o11_images: Array.isArray(imagesRes.data?.o11_images)
          ? imagesRes.data.o11_images
          : [],
      });
      if (
        instances.length > 0 &&
        !instances.find((i) => i.id === activeInstanceId)
      ) {
        setActiveInstanceId(instances[0].id);
      }
    } catch {
      // silently ignore
    }
  }, [activeInstanceId]);

  useEffect(() => {
    fetchAll();
    initMonitoring();
    const interval = setInterval(fetchAll, 5000);
    return () => {
      clearInterval(interval);
      fetchAllAbortRef.current?.abort();
    };
  }, [fetchAll, initMonitoring]);

  // Auto-refresh monitoring data
  useEffect(() => {
    if (!monitoringConfigured) return;
    monitoringIntervalRef.current = setInterval(
      () => fetchMonitoringData(true),
      MONITORING_INTERVAL,
    );
    return () => {
      clearInterval(monitoringIntervalRef.current);
      monitoringAbortRef.current?.abort();
    };
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
        // Settings (shared)
        portainerUrl,
        containerImages,
        refreshSettings,
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
