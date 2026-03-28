import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VpnProxy from "./pages/VpnProxy";
import O11 from "./pages/O11";
import CreateContainer from "./pages/CreateContainer";
import ContainerDetail from "./pages/ContainerDetail";
import O11ContainerDetail from "./pages/O11ContainerDetail";
import Settings from "./pages/Settings";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-vpn-bg">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-vpn-primary"></div>
      </div>
    );
  }

  return (
    <Routes>
      <Route path="/login" element={user ? <Navigate to="/" /> : <Login />} />
      <Route element={<PrivateRoute />}>
        <Route element={<Layout />}>
          <Route path="/" element={<Dashboard />} />
          <Route path="/vpn-proxy" element={<VpnProxy />} />
          <Route path="/o11" element={<O11 />} />
          <Route path="/create" element={<CreateContainer />} />
          <Route path="/containers/:id" element={<ContainerDetail />} />
          <Route path="/o11/:name" element={<O11ContainerDetail />} />
          <Route path="/settings" element={<Settings />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
