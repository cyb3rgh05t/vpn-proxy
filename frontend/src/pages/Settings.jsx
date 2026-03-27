import { useState, useEffect } from "react";
import { useAuth } from "../context/AuthContext";
import {
  AlertCircle,
  CheckCircle,
  UserPlus,
  Trash2,
  Shield,
  User,
} from "lucide-react";
import api from "../services/api";

export default function Settings() {
  const { user, refreshUser } = useAuth();

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

  useEffect(() => {
    if (user?.is_admin) {
      fetchUsers();
    }
  }, [user]);

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
      setNewUsername("");
      setUsernamePassword("");
      await refreshUser();
      fetchUsers();
    } catch (err) {
      setUsernameError(
        err.response?.data?.detail || "Failed to change username",
      );
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
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
    } catch (err) {
      setPasswordError(
        err.response?.data?.detail || "Failed to change password",
      );
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
      setNewUser({ username: "", password: "", is_admin: true });
      setShowCreateUser(false);
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.detail || "Failed to create user");
    } finally {
      setUserLoading(false);
    }
  };

  const handleDeleteUser = async (userId, username) => {
    if (!window.confirm(`Delete user "${username}"?`)) return;
    try {
      await api.delete(`/auth/users/${userId}`);
      fetchUsers();
    } catch (err) {
      setUserError(err.response?.data?.detail || "Failed to delete user");
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
        <h1 className="text-2xl font-bold text-white mb-2">Settings</h1>
        <p className="text-vpn-muted">Manage your account settings</p>
      </div>

      {/* User Management (admin only) */}
      {user?.is_admin && (
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              User Management
            </h2>
            <button
              onClick={() => setShowCreateUser(!showCreateUser)}
              className="flex items-center gap-2 px-4 py-2 bg-vpn-primary hover:bg-vpn-primary-hover text-black text-sm font-medium rounded-lg transition-colors"
            >
              <UserPlus className="w-4 h-4" />
              Add User
            </button>
          </div>

          {userError && <Alert type="error" message={userError} />}
          {userSuccess && <Alert type="success" message={userSuccess} />}

          {/* Create User Form */}
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
                    className="px-4 py-2 bg-vpn-primary hover:bg-vpn-primary-hover disabled:opacity-50 text-black text-sm font-medium rounded-lg transition-colors"
                  >
                    {userLoading ? "Creating..." : "Create User"}
                  </button>
                </div>
              </div>
            </form>
          )}

          {/* User List */}
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
      )}

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

      {/* Change Username */}
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Change Username
        </h2>
        {usernameError && <Alert type="error" message={usernameError} />}
        {usernameSuccess && <Alert type="success" message={usernameSuccess} />}
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
            className="px-6 py-2.5 bg-vpn-primary hover:bg-vpn-primary-hover disabled:opacity-50 text-black font-medium rounded-lg transition-colors"
          >
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
        {passwordSuccess && <Alert type="success" message={passwordSuccess} />}
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
            className="px-6 py-2.5 bg-vpn-primary hover:bg-vpn-primary-hover disabled:opacity-50 text-black font-medium rounded-lg transition-colors"
          >
            {passwordLoading ? "Saving..." : "Change Password"}
          </button>
        </form>
      </div>
    </div>
  );
}
