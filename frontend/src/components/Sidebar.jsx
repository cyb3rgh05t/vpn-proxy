import { NavLink, useNavigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import {
  LayoutDashboard,
  PlusCircle,
  Settings,
  LogOut,
  Shield,
  Menu,
  X,
  Boxes,
  Network,
  Activity,
  User,
  ExternalLink,
  Container,
} from "lucide-react";
import { useState, useEffect } from "react";
import api from "../services/api";

const navItemsTop = [
  { to: "/", icon: LayoutDashboard, label: "Dashboard" },
  { to: "/vpn-proxy", icon: Shield, label: "VPN-Proxy" },
  { to: "/o11", icon: Boxes, label: "O11" },
  { to: "/monitoring", icon: Activity, label: "Monitoring" },
];

const navItemsBottom = [
  { to: "/create", icon: PlusCircle, label: "New VPN-Proxy" },
  { to: "/create-o11", icon: PlusCircle, label: "New O11" },
  { to: "/settings", icon: Settings, label: "Settings" },
];

export default function Sidebar() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [mobileOpen, setMobileOpen] = useState(false);
  const [portainerUrl, setPortainerUrl] = useState("");

  useEffect(() => {
    api
      .get("/settings/portainer-url")
      .then((res) => {
        setPortainerUrl(res.data.portainer_url || "");
      })
      .catch(() => {});
  }, []);

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  const linkClass = ({ isActive }) =>
    `flex items-center gap-3 px-4 py-3 rounded-lg transition-colors ${
      isActive
        ? "bg-vpn-primary text-black font-semibold"
        : "text-vpn-muted hover:text-vpn-primary"
    }`;

  const sidebarContent = (
    <>
      <div className="flex items-center gap-3 px-4 py-6 border-b border-vpn-border">
        <Shield className="w-8 h-8 text-vpn-primary" />
        <div>
          <h1 className="text-lg font-bold text-white">VPN Proxy</h1>
          <p className="text-xs text-vpn-muted">Container Manager</p>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1">
        {navItemsTop.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={linkClass}
            onClick={() => setMobileOpen(false)}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
        {portainerUrl && (
          <a
            href={portainerUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="flex items-center gap-3 px-4 py-3 rounded-lg transition-colors text-vpn-muted hover:text-vpn-primary"
            onClick={() => setMobileOpen(false)}
          >
            <Container className="w-5 h-5" />
            <span className="flex-1">Portainer</span>
            <ExternalLink className="w-3.5 h-3.5 opacity-50" />
          </a>
        )}
        {navItemsBottom.map(({ to, icon: Icon, label }) => (
          <NavLink
            key={to}
            to={to}
            end={to === "/"}
            className={linkClass}
            onClick={() => setMobileOpen(false)}
          >
            <Icon className="w-5 h-5" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-3 py-4">
        <div className="flex items-center gap-3 px-3 py-3 rounded-xl bg-vpn-card/50">
          <div className="w-8 h-8 rounded-lg bg-vpn-primary/15 flex items-center justify-center shrink-0">
            <User className="w-4 h-4 text-vpn-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-medium text-vpn-text truncate">
              {user?.username}
            </p>
            <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
              {user?.is_admin ? "Admin" : "User"}
            </p>
          </div>
          <button
            onClick={handleLogout}
            title="Logout"
            className="p-1.5 rounded-lg text-vpn-muted hover:bg-red-500/10 hover:text-red-400 transition-colors"
          >
            <LogOut className="w-4 h-4" />
          </button>
        </div>
      </div>
    </>
  );

  return (
    <>
      {/* Mobile toggle */}
      <button
        onClick={() => setMobileOpen(!mobileOpen)}
        className="lg:hidden fixed top-4 left-4 z-50 p-2 rounded-lg bg-vpn-input text-vpn-text"
      >
        {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
      </button>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div
          className="lg:hidden fixed inset-0 bg-black/50 z-30"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* Sidebar */}
      <aside
        className={`fixed lg:relative z-40 h-full w-64 bg-vpn-bg-dark border-r border-vpn-border flex flex-col transition-transform duration-200 ${
          mobileOpen ? "translate-x-0" : "-translate-x-full lg:translate-x-0"
        }`}
      >
        {sidebarContent}
      </aside>
    </>
  );
}
