import { Routes, Route, Navigate } from "react-router-dom";
import { useAuth } from "./context/AuthContext";
import Layout from "./components/Layout";
import PrivateRoute from "./components/PrivateRoute";
import Login from "./pages/Login";
import Dashboard from "./pages/Dashboard";
import VpnProxy from "./pages/VpnProxy";
import O11 from "./pages/O11";
import CreateContainer from "./pages/CreateContainer";
import CreateO11Container from "./pages/CreateO11Container";
import ContainerDetail from "./pages/ContainerDetail";
import O11ContainerDetail from "./pages/O11ContainerDetail";
import Settings from "./pages/Settings";
import Monitoring from "./pages/Monitoring";
import About from "./pages/About";
import Backup from "./pages/Backup";
import AppCatalog from "./pages/AppCatalog";
import Apps from "./pages/Apps";
import Spinner from "./components/Spinner";

function App() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-vpn-bg">
        <Spinner size="xl" />
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
          <Route path="/apps" element={<Apps />} />
          <Route path="/app-catalog" element={<AppCatalog />} />
          <Route path="/create" element={<CreateContainer />} />
          <Route path="/create-o11" element={<CreateO11Container />} />
          <Route path="/containers/:id" element={<ContainerDetail />} />
          <Route path="/o11/:name" element={<O11ContainerDetail />} />
          <Route path="/apps/:name" element={<O11ContainerDetail />} />
          <Route path="/monitoring" element={<Monitoring />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/backup" element={<Backup />} />
          <Route path="/about" element={<About />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/" />} />
    </Routes>
  );
}

export default App;
