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

  const fetchO11Containers = useCallback(async () => {
    try {
      const res = await api.get("/containers/dependents");
      const all = Array.isArray(res.data) ? res.data : [];
      setO11Containers(all.filter((c) => /o11/i.test(c.name)));
    } catch {
      // ignore
    }
  }, []);

  const fetchDependents = useCallback(async (containerList) => {
    if (!containerList?.length) return;
    const map = {};
    await Promise.all(
      containerList.map(async (c) => {
        try {
          const res = await api.get(`/containers/${c.id}/dependents`);
          map[c.id] = Array.isArray(res.data) ? res.data : [];
        } catch {
          map[c.id] = [];
        }
      }),
    );
    setDepsMap(map);
  }, []);

  const fetchAll = useCallback(async () => {
    const [containerData] = await Promise.all([
      fetchContainers(),
      fetchVpnInfo(),
      fetchO11Containers(),
    ]);
    if (containerData?.length) {
      await fetchDependents(containerData);
    }
    setLoading(false);
  }, [fetchContainers, fetchVpnInfo, fetchO11Containers, fetchDependents]);

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
        refreshO11Containers: fetchO11Containers,
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
