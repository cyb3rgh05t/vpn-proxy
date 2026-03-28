import {
  createContext,
  useState,
  useEffect,
  useCallback,
  useContext,
} from "react";
import api from "../services/api";

const ContainerDataContext = createContext(null);

export function ContainerDataProvider({ children }) {
  const [containers, setContainers] = useState([]);
  const [vpnInfoMap, setVpnInfoMap] = useState({});
  const [o11Containers, setO11Containers] = useState([]);
  const [depsMap, setDepsMap] = useState({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

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
    const [containerData, , allDeps] = await Promise.all([
      fetchContainers(),
      fetchVpnInfo(),
      fetchAllDependents(),
    ]);

    // Set O11 containers
    setO11Containers(allDeps.filter((c) => /o11/i.test(c.name)));

    // Build depsMap client-side: group dependents by their vpn_parent → managed container id
    if (containerData?.length && allDeps.length) {
      const nameToId = {};
      for (const c of containerData) {
        if (c.name) nameToId[c.name] = c.id;
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
  }, [fetchContainers, fetchVpnInfo, fetchAllDependents]);

  useEffect(() => {
    fetchAll();
    const interval = setInterval(fetchAll, 3000);
    return () => clearInterval(interval);
  }, [fetchAll]);

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
