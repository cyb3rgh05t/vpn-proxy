import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import {
  AlertCircle,
  CheckCircle,
  UserPlus,
  Trash2,
  Shield,
  User,
  Container,
  RefreshCw,
  Server,
  Cpu,
  HardDrive,
  Wifi,
  WifiOff,
  Key,
  Copy,
  Plus,
  Eye,
  EyeOff,
  Lock,
  UserCog,
  Users,
  Wrench,
  Activity,
  Pencil,
  Settings as SettingsIcon,
} from "lucide-react";
import api from "../services/api";

export default function Settings() {
  const { user, refreshUser } = useAuth();
  const toast = useToast();
  const confirm = useConfirm();

  const [settingsTab, setSettingsTab] = useState("system");

  // Docker socket
  const [dockerStatus, setDockerStatus] = useState(null);
  const [dockerLoading, setDockerLoading] = useState(false);
  const [dockerTesting, setDockerTesting] = useState(false);

  // Username change
  const [newUsername, setNewUsername] = useState("");
  const [usernamePassword, setUsernamePassword] = useState("");
  const [usernameError, setUsernameError] = useState("");
  const [usernameSuccess, setUsernameSuccess] = useState("");
  const [usernameLoading, setUsernameLoading] = useState(false);

  // Password change
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");
  const [passwordLoading, setPasswordLoading] = useState(false);

  // User management
  const [users, setUsers] = useState([]);
  const [showCreateUser, setShowCreateUser] = useState(false);
  const [newUser, setNewUser] = useState({
    username: "",
    password: "",
    is_admin: true,
  });
  const [userError, setUserError] = useState("");
  const [userSuccess, setUserSuccess] = useState("");
  const [userLoading, setUserLoading] = useState(false);

  // API Keys
  const [apiKeys, setApiKeys] = useState([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [newKeyName, setNewKeyName] = useState("");
  const [createdKey, setCreatedKey] = useState(null);
  const [apiKeyLoading, setApiKeyLoading] = useState(false);
  const [keyCopied, setKeyCopied] = useState(false);

  // O11 Monitoring (multi-instance)
  const [o11Instances, setO11Instances] = useState([]);
  const [o11Loading, setO11Loading] = useState(false);
  const [o11Testing, setO11Testing] = useState(null); // instance id being tested
  const [o11Editing, setO11Editing] = useState(null); // instance id being edited, or "new"
  const [o11Form, setO11Form] = useState({
    name: "",
    url: "",
    username: "",
    password: "",
    provider_id: "",
  });
  const [o11FormLoading, setO11FormLoading] = useState(false);
  const [showO11Password, setShowO11Password] = useState(false);

  useEffect(() => {
    if (user?.is_admin) {
      fetchUsers();
    }
    fetchDockerStatus();
    fetchApiKeys();
    fetchO11Instances();
  }, [user]);

  const fetchO11Instances = async () => {
    try {
      const res = await api.get("/settings/o11/instances");
      setO11Instances(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  const handleAddO11 = () => {
    setO11Editing("new");
    setO11Form({
      name: "",
      url: "",
      username: "",
      password: "",
      provider_id: "",
    });
    setShowO11Password(false);
  };

  const handleEditO11 = (inst) => {
    setO11Editing(inst.id);
    setO11Form({
      name: inst.name || "",
      url: inst.url || "",
      username: inst.username || "",
      password: inst.password || "",
      provider_id: inst.provider_id || "",
    });
    setShowO11Password(false);
  };

  const handleCancelO11Form = () => {
    setO11Editing(null);
    setO11Form({
      name: "",
      url: "",
      username: "",
      password: "",
      provider_id: "",
    });
  };

  const handleSaveO11Instance = async (e) => {
    e.preventDefault();
    setO11FormLoading(true);
    try {
      if (o11Editing === "new") {
        await api.post("/settings/o11/instances", o11Form);
        toast.success("O11 instance added");
      } else {
        await api.put(`/settings/o11/instances/${o11Editing}`, o11Form);
        toast.success("O11 instance updated");
      }
      setO11Editing(null);
      fetchO11Instances();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save O11 instance");
    } finally {
      setO11FormLoading(false);
    }
  };

  const handleDeleteO11 = async (inst) => {
    const ok = await confirm({
      title: "Delete O11 Instance",
      message: `Are you sure you want to delete "${inst.name}"?`,
      confirmText: "Delete",
      danger: true,
    });
    if (!ok) return;
    try {
      await api.delete(`/settings/o11/instances/${inst.id}`);
      toast.success("O11 instance deleted");
      if (o11Editing === inst.id) setO11Editing(null);
      fetchO11Instances();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete instance");
    }
  };

  const handleTestO11Instance = async (inst) => {
    setO11Testing(inst.id);
    try {
      const res = await api.post(`/settings/o11/instances/${inst.id}/test`);
      if (res.data.success) {
        toast.success(`"${inst.name}" connection successful`);
      } else {
        toast.error(res.data.error || `"${inst.name}" connection failed`);
      }
    } catch (err) {
      toast.error(err.response?.data?.detail || "Connection test failed");
    } finally {
      setO11Testing(null);
    }
  };

  const fetchDockerStatus = async () => {
    setDockerLoading(true);
    try {
      const res = await api.get("/system/docker-status");
      setDockerStatus(res.data);
    } catch {
      setDockerStatus({ connected: false, error: "Failed to reach API" });
    } finally {
      setDockerLoading(false);
    }
  };

  const testDockerConnection = async () => {
    setDockerTesting(true);
    try {
      const res = await api.get("/system/docker-status");
      setDockerStatus(res.data);
      if (res.data.connected) {
        toast.success("Docker connection successful");
      } else {
        toast.error(res.data.error || "Docker connection failed");
      }
    } catch {
      setDockerStatus({ connected: false, error: "Failed to reach API" });
      toast.error("Failed to reach API");
    } finally {
      setDockerTesting(false);
    }
  };

  const fetchUsers = async () => {
    try {
      const res = await api.get("/auth/users");
      setUsers(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  const handleChangeUsername = async (e) => {
    e.preventDefault();
    setUsernameError("");
    setUsernameSuccess("");
    setUsernameLoading(true);
    try {
      await api.post("/auth/change-username", {
        new_username: newUsername,
        password: usernamePassword,
      });
      setUsernameSuccess("Username changed successfully");
      toast.success("Username changed successfully");
      setNewUsername("");
      setUsernamePassword("");
      await refreshUser();
      fetchUsers();
    } catch (err) {
      setUsernameError(
        err.response?.data?.detail || "Failed to change username",
      );
      toast.error(err.response?.data?.detail || "Failed to change username");
    } finally {
      setUsernameLoading(false);
    }
  };

  const handleChangePassword = async (e) => {
    e.preventDefault();
    setPasswordError("");
    setPasswordSuccess("");

    if (newPassword !== confirmPassword) {
      setPasswordError("Passwords do not match");
      return;
    }

    setPasswordLoading(true);
    try {
      await api.post("/auth/change-password", {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setPasswordSuccess("Password changed successfully");
      toast.success("Password changed successfully");
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err.response?.data?.detail || "Failed to change password",
      );
      toast.error(err.response?.data?.detail || "Failed to change password");
    } finally {
      setPasswordLoading(false);
    }
  };

  const handleCreateUser = async (e) => {
    e.preventDefault();
    setUserError("");
    setUserSuccess("");
    setUserLoading(true);
    try {
      await api.post("/auth/users", newUser);
      setUserSuccess("User created successfully");
      toast.success("User created successfully");
      setNewUser({ username: "", password: "", is_admin: true });
      setShowCreateUser(false);
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.detail || "Failed to create user");
      toast.error(err.response?.data?.detail || "Failed to create user");
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    const ok = await confirm({
      title: "Delete User",
      message: `Delete user "${username}"?`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      toast.success(`User "${username}" deleted`);
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.detail || "Failed to delete user");
    }
  };

  // API Key handlers
  const fetchApiKeys = async () => {
    try {
      const res = await api.get("/api-keys");
      setApiKeys(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  const handleCreateApiKey = async (e) => {
    e.preventDefault();
    setApiKeyLoading(true);
    setCreatedKey(null);
    try {
      const res = await api.post("/api-keys", { name: newKeyName });
      setCreatedKey(res.data);
      toast.success("API key created");
      setNewKeyName("");
      fetchApiKeys();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create API key");
    } finally {
      setApiKeyLoading(false);
    }
  };

  const handleRevokeApiKey = async (keyId, keyName) => {
    const ok = await confirm({
      title: "Revoke API Key",
      message: `Revoke API key "${keyName}"? This cannot be undone.`,
      confirmText: "Revoke",
      variant: "warning",
    });
    if (!ok) return;
    try {
      await api.delete(`/api-keys/${keyId}`);
      toast.success(`API key "${keyName}" revoked`);
      fetchApiKeys();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to revoke API key");
    }
  };

  const copyToClipboard = async (text) => {
    try {
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(text);
      } else {
        const textarea = document.createElement("textarea");
        textarea.value = text;
        textarea.style.position = "fixed";
        textarea.style.left = "-9999px";
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand("copy");
        document.body.removeChild(textarea);
      }
      setKeyCopied(true);
      toast.success("API key copied to clipboard");
      setTimeout(() => setKeyCopied(false), 2000);
    } catch {
      toast.error("Failed to copy to clipboard");
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-vpn-input border border-vpn-border rounded-lg text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent";

  const Alert = ({ type, message }) => (
    <div
      className={`flex items-center gap-2 p-3 mb-4 rounded-lg text-sm ${
        type === "error"
          ? "bg-red-500/10 border border-red-500/30 text-red-400"
          : "bg-emerald-500/10 border border-emerald-500/30 text-emerald-400"
      }`}
    >
      {type === "error" ? (
        <AlertCircle className="w-4 h-4 shrink-0" />
      ) : (
        <CheckCircle className="w-4 h-4 shrink-0" />
      )}
      <span>{message}</span>
    </div>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
          <SettingsIcon className="w-7 h-7 text-vpn-primary" />
          Settings
        </h1>
        <p className="text-vpn-muted">
          Manage your account and system settings
        </p>
      </div>

      {/* Tab Navigation */}
      <div className="inline-flex gap-1 bg-vpn-card border border-vpn-border rounded-xl p-1">
        {[
          { id: "system", label: "System", icon: Wrench },
          { id: "monitoring", label: "Monitoring", icon: Activity },
          { id: "users", label: "User Management", icon: Users },
        ].map(({ id, label, icon: Icon }) => (
          <button
            key={id}
            onClick={() => setSettingsTab(id)}
            className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
              settingsTab === id
                ? "bg-vpn-primary text-black"
                : "text-vpn-muted hover:text-vpn-primary"
            }`}
          >
            <Icon className="w-4 h-4" />
            {label}
          </button>
        ))}
      </div>

      {/* System Tab */}
      {settingsTab === "system" && (
        <div className="space-y-6">
          {/* Docker Socket Connection */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Container className="w-5 h-5 text-vpn-primary" />
                <h2 className="text-lg font-semibold text-white">
                  Docker Socket Connection
                </h2>
              </div>
              <button
                onClick={testDockerConnection}
                disabled={dockerTesting}
                className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text text-sm rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <RefreshCw
                  className={`w-4 h-4 text-vpn-primary ${dockerTesting ? "animate-spin" : ""}`}
                />
                {dockerTesting ? "Testing..." : "Test Connection"}
              </button>
            </div>

            {dockerLoading && !dockerStatus ? (
              <div className="flex justify-center py-8">
                <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-vpn-primary"></div>
              </div>
            ) : dockerStatus ? (
              <div className="space-y-4">
                {/* Connection Status Banner */}
                <div
                  className={`flex items-center gap-3 p-4 rounded-xl ${
                    dockerStatus.connected
                      ? "bg-emerald-500/10 border border-emerald-500/30"
                      : "bg-red-500/10 border border-red-500/30"
                  }`}
                >
                  {dockerStatus.connected ? (
                    <Wifi className="w-5 h-5 text-emerald-400 flex-shrink-0" />
                  ) : (
                    <WifiOff className="w-5 h-5 text-red-400 flex-shrink-0" />
                  )}
                  <div>
                    <p
                      className={`text-sm font-medium ${
                        dockerStatus.connected
                          ? "text-emerald-400"
                          : "text-red-400"
                      }`}
                    >
                      {dockerStatus.connected
                        ? "Connected to Docker"
                        : "Docker Connection Failed"}
                    </p>
                    {dockerStatus.error && (
                      <p className="text-xs text-red-400/80 mt-0.5">
                        {dockerStatus.error}
                      </p>
                    )}
                    {dockerStatus.socket && (
                      <p className="text-xs text-vpn-muted mt-0.5 font-mono">
                        {dockerStatus.socket}
                      </p>
                    )}
                  </div>
                </div>

                {/* Docker Info Grid */}
                {dockerStatus.connected && (
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
                    <div className="bg-vpn-input rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Server className="w-3.5 h-3.5 text-vpn-muted" />
                        <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                          Version
                        </p>
                      </div>
                      <p className="text-white font-medium text-sm">
                        {dockerStatus.server_version || "—"}
                      </p>
                    </div>
                    <div className="bg-vpn-input rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Cpu className="w-3.5 h-3.5 text-vpn-muted" />
                        <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                          API
                        </p>
                      </div>
                      <p className="text-white font-medium text-sm">
                        {dockerStatus.api_version || "—"}
                      </p>
                    </div>
                    <div className="bg-vpn-input rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive className="w-3.5 h-3.5 text-vpn-muted" />
                        <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                          OS / Arch
                        </p>
                      </div>
                      <p
                        className="text-white font-medium text-sm truncate"
                        title={`${dockerStatus.os || "—"} ${dockerStatus.arch || ""}`}
                      >
                        {dockerStatus.os || "—"}{" "}
                        <span className="text-vpn-muted text-xs">
                          {dockerStatus.arch || ""}
                        </span>
                      </p>
                    </div>
                    <div className="bg-vpn-input rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <Container className="w-3.5 h-3.5 text-vpn-muted" />
                        <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                          Containers
                        </p>
                      </div>
                      <p className="text-white font-medium text-sm">
                        <span className="text-emerald-400">
                          {dockerStatus.containers_running ?? 0}
                        </span>
                        <span className="text-vpn-muted text-xs">
                          {" "}
                          / {dockerStatus.containers_total ?? 0}
                        </span>
                      </p>
                    </div>
                    <div className="bg-vpn-input rounded-lg p-3">
                      <div className="flex items-center gap-2 mb-1">
                        <HardDrive className="w-3.5 h-3.5 text-vpn-muted" />
                        <p className="text-[10px] text-vpn-muted uppercase tracking-wider">
                          Images
                        </p>
                      </div>
                      <p className="text-white font-medium text-sm">
                        {dockerStatus.images ?? 0}
                      </p>
                    </div>
                  </div>
                )}
              </div>
            ) : null}
          </div>

          {/* API Keys */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Key className="w-5 h-5 text-vpn-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-white">API Keys</h2>
                  <p className="text-xs text-vpn-muted">
                    Use API keys to access the API from external tools without
                    JWT login
                  </p>
                </div>
              </div>
              <button
                onClick={() => {
                  setShowCreateKey(!showCreateKey);
                  setCreatedKey(null);
                }}
                className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text text-sm font-medium rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-4 h-4 text-vpn-primary" />
                New Key
              </button>
            </div>

            {/* Created Key Banner (shown once after creation) */}
            {createdKey && (
              <div className="bg-emerald-500/10 border border-emerald-500/30 rounded-xl p-4 mb-4">
                <div className="flex items-center gap-2 mb-2">
                  <CheckCircle className="w-4 h-4 text-emerald-400" />
                  <p className="text-sm font-medium text-emerald-400">
                    API Key created — copy it now, it won't be shown again!
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <code className="flex-1 bg-vpn-bg px-3 py-2 rounded-lg text-vpn-primary text-sm font-mono break-all select-all">
                    {createdKey.key}
                  </code>
                  <button
                    onClick={() => copyToClipboard(createdKey.key)}
                    className={`p-2 rounded-lg transition-colors shrink-0 ${
                      keyCopied
                        ? "bg-emerald-500/20 text-emerald-400"
                        : "bg-vpn-input hover:bg-vpn-border text-vpn-text"
                    }`}
                    title="Copy to clipboard"
                  >
                    {keyCopied ? (
                      <CheckCircle className="w-4 h-4" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </button>
                </div>
                <div className="mt-3 bg-vpn-bg/50 rounded-lg p-3">
                  <p className="text-xs text-vpn-muted mb-1">Usage example:</p>
                  <code className="text-xs text-vpn-text font-mono break-all">
                    {`curl http://your-host:5000/api/containers -H "X-API-Key: ${createdKey.key}"`}
                  </code>
                </div>
              </div>
            )}

            {/* Create Key Form */}
            {showCreateKey && !createdKey && (
              <form
                onSubmit={handleCreateApiKey}
                className="bg-vpn-input rounded-xl p-4 mb-4 space-y-3"
              >
                <div>
                  <label className="block text-xs font-medium text-vpn-muted mb-1">
                    Key Name
                  </label>
                  <input
                    type="text"
                    value={newKeyName}
                    onChange={(e) => setNewKeyName(e.target.value)}
                    className={inputClass}
                    required
                    maxLength={100}
                    placeholder='e.g. "Homarr Dashboard" or "Monitoring"'
                  />
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    onClick={() => setShowCreateKey(false)}
                    className="px-4 py-2 bg-vpn-border hover:bg-vpn-muted/30 text-vpn-text text-sm rounded-lg transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={apiKeyLoading}
                    className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary disabled:opacity-50 text-vpn-text text-sm font-medium rounded-lg transition-all shadow-sm disabled:cursor-not-allowed"
                  >
                    {apiKeyLoading ? "Creating..." : "Generate Key"}
                  </button>
                </div>
              </form>
            )}

            {/* Key List */}
            {apiKeys.length === 0 ? (
              <div className="text-center py-6 text-vpn-muted text-sm">
                No API keys yet. Create one to access the API from external
                tools.
              </div>
            ) : (
              <div className="space-y-2">
                {apiKeys.map((k) => (
                  <div
                    key={k.id}
                    className="flex items-center justify-between bg-vpn-input rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-vpn-primary/20 text-vpn-primary">
                        <Key className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {k.name}
                        </p>
                        <p className="text-xs text-vpn-muted font-mono">
                          {k.key_preview}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span
                        className={`text-xs px-2 py-0.5 rounded-full ${
                          k.is_active
                            ? "bg-emerald-500/10 text-emerald-400"
                            : "bg-red-500/10 text-red-400"
                        }`}
                      >
                        {k.is_active ? "Active" : "Revoked"}
                      </span>
                      <button
                        onClick={() => handleRevokeApiKey(k.id, k.name)}
                        className="p-2 text-vpn-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Revoke key"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Monitoring Tab */}
      {settingsTab === "monitoring" && (
        <div className="space-y-6">
          {/* O11 Monitoring Instances */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="flex items-center gap-3">
                <Activity className="w-5 h-5 text-vpn-primary" />
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    O11 Monitoring
                  </h2>
                  <p className="text-xs text-vpn-muted">
                    Manage your O11 panel connections for stream monitoring
                  </p>
                </div>
              </div>
              <button
                onClick={handleAddO11}
                disabled={o11Editing === "new"}
                className="flex items-center gap-2 px-4 py-2 bg-vpn-primary text-black text-sm rounded-lg font-semibold hover:bg-vpn-primary-hover transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Add Instance
              </button>
            </div>

            {/* Add/Edit Form */}
            {o11Editing && (
              <form
                onSubmit={handleSaveO11Instance}
                className="bg-vpn-input border border-vpn-border rounded-xl p-4 mb-4 space-y-3"
              >
                <div className="flex items-center justify-between mb-1">
                  <h3 className="text-sm font-semibold text-white">
                    {o11Editing === "new"
                      ? "Add New Instance"
                      : "Edit Instance"}
                  </h3>
                </div>
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-medium text-vpn-muted mb-1">
                      Name
                    </label>
                    <input
                      type="text"
                      value={o11Form.name}
                      onChange={(e) =>
                        setO11Form({ ...o11Form, name: e.target.value })
                      }
                      placeholder="e.g. Panel US-East"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-vpn-muted mb-1">
                      O11 URL
                    </label>
                    <input
                      type="url"
                      value={o11Form.url}
                      onChange={(e) =>
                        setO11Form({ ...o11Form, url: e.target.value })
                      }
                      placeholder="http://50.7.224.34:7000"
                      className={inputClass}
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-vpn-muted mb-1">
                      Username
                    </label>
                    <input
                      type="text"
                      value={o11Form.username}
                      onChange={(e) =>
                        setO11Form({ ...o11Form, username: e.target.value })
                      }
                      placeholder="Username"
                      className={inputClass}
                      autoComplete="off"
                    />
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-vpn-muted mb-1">
                      Password
                    </label>
                    <div className="relative">
                      <input
                        type={showO11Password ? "text" : "password"}
                        value={o11Form.password}
                        onChange={(e) =>
                          setO11Form({ ...o11Form, password: e.target.value })
                        }
                        placeholder="Password"
                        className={`${inputClass} pr-10`}
                        autoComplete="new-password"
                      />
                      <button
                        type="button"
                        onClick={() => setShowO11Password(!showO11Password)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-vpn-muted hover:text-vpn-text"
                      >
                        {showO11Password ? (
                          <EyeOff className="w-4 h-4" />
                        ) : (
                          <Eye className="w-4 h-4" />
                        )}
                      </button>
                    </div>
                  </div>
                  <div>
                    <label className="block text-xs font-medium text-vpn-muted mb-1">
                      Provider ID
                    </label>
                    <input
                      type="text"
                      value={o11Form.provider_id}
                      onChange={(e) =>
                        setO11Form({ ...o11Form, provider_id: e.target.value })
                      }
                      placeholder="e.g. demagentatv"
                      className={inputClass}
                    />
                  </div>
                </div>
                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={handleCancelO11Form}
                    className="px-4 py-2 text-sm text-vpn-muted hover:text-vpn-text transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={o11FormLoading || !o11Form.url}
                    className="px-5 py-2 bg-vpn-primary text-black rounded-lg font-semibold text-sm hover:bg-vpn-primary-hover transition-colors disabled:opacity-50"
                  >
                    {o11FormLoading
                      ? "Saving..."
                      : o11Editing === "new"
                        ? "Add"
                        : "Save"}
                  </button>
                </div>
              </form>
            )}

            {/* Instance List */}
            {o11Instances.length === 0 && !o11Editing ? (
              <div className="text-center py-8 text-vpn-muted">
                <Activity className="w-8 h-8 mx-auto mb-2 opacity-40" />
                <p className="text-sm">No O11 instances configured</p>
                <p className="text-xs mt-1">
                  Click "Add Instance" to connect your first O11 panel
                </p>
              </div>
            ) : (
              <div className="space-y-2">
                {o11Instances.map((inst) => (
                  <div
                    key={inst.id}
                    className="flex items-center justify-between bg-vpn-input rounded-xl px-4 py-3"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full flex items-center justify-center bg-vpn-primary/20 text-vpn-primary shrink-0">
                        <Activity className="w-4 h-4" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex items-center gap-2">
                          <p className="text-white text-sm font-medium truncate">
                            {inst.name}
                          </p>
                          {inst.configured && (
                            <span className="flex items-center gap-1 px-1.5 py-0.5 bg-emerald-500/10 border border-emerald-500/30 rounded text-[10px] text-emerald-400 shrink-0">
                              <Wifi className="w-2.5 h-2.5" />
                              OK
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-vpn-muted truncate">
                          {inst.url}
                          {inst.provider_id && (
                            <span className="ml-2 text-vpn-primary/70">
                              [{inst.provider_id}]
                            </span>
                          )}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-1 shrink-0 ml-3">
                      <button
                        onClick={() => handleTestO11Instance(inst)}
                        disabled={o11Testing === inst.id || !inst.url}
                        className="p-2 text-vpn-muted hover:text-vpn-primary hover:bg-vpn-primary/10 rounded-lg transition-colors disabled:opacity-50"
                        title="Test connection"
                      >
                        <RefreshCw
                          className={`w-4 h-4 ${o11Testing === inst.id ? "animate-spin text-vpn-primary" : ""}`}
                        />
                      </button>
                      <button
                        onClick={() => handleEditO11(inst)}
                        disabled={o11Editing === inst.id}
                        className="p-2 text-vpn-muted hover:text-vpn-text hover:bg-vpn-card rounded-lg transition-colors disabled:opacity-50"
                        title="Edit"
                      >
                        <Pencil className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => handleDeleteO11(inst)}
                        className="p-2 text-vpn-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
      {settingsTab === "users" && (
        <div className="space-y-6">
          {/* Account Info */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">Account</h2>
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-vpn-input rounded-lg p-4">
                <p className="text-xs text-vpn-muted mb-1">Username</p>
                <p className="text-white font-medium">{user?.username}</p>
              </div>
              <div className="bg-vpn-input rounded-lg p-4">
                <p className="text-xs text-vpn-muted mb-1">Role</p>
                <p className="text-white font-medium">
                  {user?.is_admin ? "Administrator" : "User"}
                </p>
              </div>
            </div>
          </div>

          {/* User List (admin only) */}
          {user?.is_admin ? (
            <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-semibold text-white">
                  User Management
                </h2>
                <button
                  onClick={() => setShowCreateUser(!showCreateUser)}
                  className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text text-sm font-medium rounded-lg transition-all shadow-sm"
                >
                  <UserPlus className="w-4 h-4 text-vpn-primary" />
                  Add User
                </button>
              </div>

              {userError && <Alert type="error" message={userError} />}
              {userSuccess && <Alert type="success" message={userSuccess} />}

              {showCreateUser && (
                <form
                  onSubmit={handleCreateUser}
                  className="bg-vpn-input rounded-xl p-4 mb-4 space-y-3"
                >
                  <div className="grid grid-cols-2 gap-3">
                    <div>
                      <label className="block text-xs font-medium text-vpn-muted mb-1">
                        Username
                      </label>
                      <input
                        type="text"
                        value={newUser.username}
                        onChange={(e) =>
                          setNewUser({ ...newUser, username: e.target.value })
                        }
                        className={inputClass}
                        required
                        minLength={3}
                        maxLength={50}
                        placeholder="Username"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-medium text-vpn-muted mb-1">
                        Password
                      </label>
                      <input
                        type="password"
                        value={newUser.password}
                        onChange={(e) =>
                          setNewUser({ ...newUser, password: e.target.value })
                        }
                        className={inputClass}
                        required
                        minLength={6}
                        placeholder="Password"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between">
                    <label className="flex items-center gap-2 text-sm text-vpn-text cursor-pointer">
                      <input
                        type="checkbox"
                        checked={newUser.is_admin}
                        onChange={(e) =>
                          setNewUser({ ...newUser, is_admin: e.target.checked })
                        }
                        className="w-4 h-4 rounded border-vpn-border bg-vpn-input accent-vpn-primary"
                      />
                      Administrator
                    </label>
                    <div className="flex gap-2">
                      <button
                        type="button"
                        onClick={() => setShowCreateUser(false)}
                        className="px-4 py-2 bg-vpn-border hover:bg-vpn-muted/30 text-vpn-text text-sm rounded-lg transition-colors"
                      >
                        Cancel
                      </button>
                      <button
                        type="submit"
                        disabled={userLoading}
                        className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary disabled:opacity-50 text-vpn-text text-sm font-medium rounded-lg transition-all shadow-sm disabled:cursor-not-allowed"
                      >
                        {userLoading ? "Creating..." : "Create User"}
                      </button>
                    </div>
                  </div>
                </form>
              )}

              <div className="space-y-2">
                {users.map((u) => (
                  <div
                    key={u.id}
                    className="flex items-center justify-between bg-vpn-input rounded-lg px-4 py-3"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center ${
                          u.is_admin
                            ? "bg-vpn-primary/20 text-vpn-primary"
                            : "bg-vpn-border text-vpn-muted"
                        }`}
                      >
                        {u.is_admin ? (
                          <Shield className="w-4 h-4" />
                        ) : (
                          <User className="w-4 h-4" />
                        )}
                      </div>
                      <div>
                        <p className="text-white text-sm font-medium">
                          {u.username}
                          {u.id === user.id && (
                            <span className="ml-2 text-xs text-vpn-muted">
                              (you)
                            </span>
                          )}
                        </p>
                        <p className="text-xs text-vpn-muted">
                          {u.is_admin ? "Administrator" : "User"}
                        </p>
                      </div>
                    </div>
                    {u.id !== user.id && (
                      <button
                        onClick={() => handleDeleteUser(u.id, u.username)}
                        className="p-2 text-vpn-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                        title="Delete user"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                ))}
              </div>
            </div>
          ) : (
            <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 text-center">
              <Users className="w-10 h-10 text-vpn-muted mx-auto mb-3 opacity-30" />
              <p className="text-vpn-muted text-sm">
                Only administrators can manage users.
              </p>
            </div>
          )}

          {/* Change Username */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Change Username
            </h2>
            {usernameError && <Alert type="error" message={usernameError} />}
            {usernameSuccess && (
              <Alert type="success" message={usernameSuccess} />
            )}
            <form onSubmit={handleChangeUsername} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  New Username
                </label>
                <input
                  type="text"
                  value={newUsername}
                  onChange={(e) => setNewUsername(e.target.value)}
                  className={inputClass}
                  required
                  minLength={3}
                  maxLength={50}
                  placeholder="Enter new username"
                  autoComplete="username"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  Confirm Password
                </label>
                <input
                  type="password"
                  value={usernamePassword}
                  onChange={(e) => setUsernamePassword(e.target.value)}
                  className={inputClass}
                  required
                  placeholder="Enter your password to confirm"
                  autoComplete="current-password"
                />
              </div>
              <button
                type="submit"
                disabled={usernameLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary disabled:opacity-50 text-vpn-text font-medium rounded-lg transition-all shadow-sm disabled:cursor-not-allowed"
              >
                <UserCog className="w-4 h-4 text-vpn-primary" />
                {usernameLoading ? "Saving..." : "Change Username"}
              </button>
            </form>
          </div>

          {/* Change Password */}
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              Change Password
            </h2>
            {passwordError && <Alert type="error" message={passwordError} />}
            {passwordSuccess && (
              <Alert type="success" message={passwordSuccess} />
            )}
            <form onSubmit={handleChangePassword} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  Current Password
                </label>
                <input
                  type="password"
                  value={currentPassword}
                  onChange={(e) => setCurrentPassword(e.target.value)}
                  className={inputClass}
                  required
                  autoComplete="current-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  New Password
                </label>
                <input
                  type="password"
                  value={newPassword}
                  onChange={(e) => setNewPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  Confirm New Password
                </label>
                <input
                  type="password"
                  value={confirmPassword}
                  onChange={(e) => setConfirmPassword(e.target.value)}
                  className={inputClass}
                  required
                  minLength={6}
                  autoComplete="new-password"
                />
              </div>
              <button
                type="submit"
                disabled={passwordLoading}
                className="flex items-center gap-2 px-6 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary disabled:opacity-50 text-vpn-text font-medium rounded-lg transition-all shadow-sm disabled:cursor-not-allowed"
              >
                <Lock className="w-4 h-4 text-vpn-primary" />
                {passwordLoading ? "Saving..." : "Change Password"}
              </button>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
