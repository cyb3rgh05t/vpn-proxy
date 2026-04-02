import { useState, useEffect, useRef } from "react";
import { useNavigate } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  ChevronDown,
  ChevronRight,
  Upload,
  File,
  X,
  PlusCircle,
} from "lucide-react";
import api from "../services/api";
import CustomDropdown from "../components/CustomDropdown";

const WHITELISTED_KEYS = new Set([
  "PGID",
  "PUID",
  "TZ",
  "VERSION_INFORMATION",
  "LOG_LEVEL",
  "VPN_SERVICE_PROVIDER",
  "VPN_TYPE",
  "SERVER_COUNTRIES",
  "SERVER_REGIONS",
  "SERVER_CITIES",
  "WIREGUARD_PRIVATE_KEY",
  "WIREGUARD_ADDRESSES",
  "OPENVPN_USER",
  "OPENVPN_PASSWORD",
  "OPENVPN_USER_SECRETFILE",
  "OPENVPN_PASSWORD_SECRETFILE",
  "OPENVPN_AUTH",
  "OPENVPN_PROCESS_USER",
  "VPN_PORT_FORWARDING_USERNAME",
  "VPN_PORT_FORWARDING_PASSWORD",
  "OPENVPN_KEY_PASSPHRASE",
  "OPENVPN_KEY_PASSPHRASE_SECRETFILE",
  "DOT_EXCLUDE_IPS",
  "FIREWALL_OUTBOUND_SUBNETS",
  "PUBLICIP_ENABLED",
  "PUBLICIP_API",
  "PUBLICIP_API_TOKEN",
  "HTTPPROXY",
  "HTTPPROXY_LOG",
  "HTTPPROXY_LISTENING_ADDRESS",
  "HTTPPROXY_STEALTH",
  "HTTPPROXY_USER",
  "HTTPPROXY_PASSWORD",
  "HTTPPROXY_USER_SECRETFILE",
  "HTTPPROXY_PASSWORD_SECRETFILE",
  "SHADOWSOCKS",
  "SHADOWSOCKS_ADDRESS",
  "SHADOWSOCKS_PASSWORD",
  "SHADOWSOCKS_PASSWORD_SECRETFILE",
  "HTTP_CONTROL_SERVER_LOG",
  "HTTP_CONTROL_SERVER_ADDRESS",
  "HTTP_CONTROL_SERVER_AUTH_CONFIG_FILEPATH",
  "HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE",
  "UPDATER_PROTONVPN_EMAIL",
  "UPDATER_PROTONVPN_PASSWORD",
  "UPDATER_PERIOD",
  "UPDATER_MIN_RATIO",
  "UPDATER_VPN_SERVICE_PROVIDERS",
]);

const AUTO_SET_KEYS = new Set([
  "VPN_SERVICE_PROVIDER",
  "VPN_TYPE",
  "HTTP_CONTROL_SERVER_AUTH_DEFAULT_ROLE",
]);

export default function CreateContainer() {
  const navigate = useNavigate();
  const [providers, setProviders] = useState([]);
  const [providerDetails, setProviderDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");

  const [form, setForm] = useState({
    name: "",
    vpn_provider: "",
    vpn_type: "openvpn",
    port_http_proxy: 8888,
    port_shadowsocks: 8388,
    network_name: "",
  });
  const [httpProxyEnabled, setHttpProxyEnabled] = useState(true);
  const [shadowsocksEnabled, setShadowsocksEnabled] = useState(false);
  const [configFields, setConfigFields] = useState({});
  const [extraPorts, setExtraPorts] = useState([]);
  const [envVarCategories, setEnvVarCategories] = useState({});
  const [advancedFields, setAdvancedFields] = useState({});
  const [gluetunFields, setGluetunFields] = useState({ TZ: "Europe/Berlin" });
  const [openCategories, setOpenCategories] = useState({});
  const [openGluetunCategories, setOpenGluetunCategories] = useState({});
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef(null);

  useEffect(() => {
    api
      .get("/containers/providers")
      .then((res) => setProviders(Array.isArray(res.data) ? res.data : []))
      .catch(() => setError("Failed to load providers"));
    api
      .get("/containers/env-variables")
      .then((res) => setEnvVarCategories(res.data || {}))
      .catch(() => {});
    api
      .get("/containers/networks")
      .then((res) => setNetworks(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  useEffect(() => {
    if (!form.vpn_provider) {
      setProviderDetails(null);
      return;
    }
    api
      .get(`/containers/providers/${form.vpn_provider}`)
      .then((res) => {
        setProviderDetails(res.data);
        if (!res.data.vpn_types.includes(form.vpn_type)) {
          setForm((f) => ({ ...f, vpn_type: res.data.vpn_types[0] }));
        }
        setConfigFields({});
      })
      .catch(() => setProviderDetails(null));
  }, [form.vpn_provider]);

  const getFields = () => {
    if (!providerDetails) return [];
    const typeFields = providerDetails.fields?.[form.vpn_type] || [];
    const commonFields = providerDetails.common_fields || [];
    return [...typeFields, ...commonFields];
  };

  const addExtraPort = () => {
    setExtraPorts([
      ...extraPorts,
      { host: "", container: "", protocol: "tcp" },
    ]);
  };

  const removeExtraPort = (index) => {
    setExtraPorts(extraPorts.filter((_, i) => i !== index));
  };

  const updateExtraPort = (index, field, value) => {
    const updated = [...extraPorts];
    updated[index] = { ...updated[index], [field]: value };
    setExtraPorts(updated);
  };

  // Get provider-specific field keys to exclude from advanced settings
  const getProviderFieldKeys = () => {
    if (!providerDetails) return new Set();
    const typeFields = providerDetails.fields?.[form.vpn_type] || [];
    const commonFields = providerDetails.common_fields || [];
    return new Set([...typeFields, ...commonFields].map((f) => f.key));
  };

  const toggleCategory = (cat) => {
    setOpenCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const toggleGluetunCategory = (cat) => {
    setOpenGluetunCategories((prev) => ({ ...prev, [cat]: !prev[cat] }));
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !form.name.trim()) return;
    setUploading(true);
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const res = await api.post(
          `/containers/upload-config-by-name/${encodeURIComponent(form.name.trim())}`,
          formData,
          { headers: { "Content-Type": "multipart/form-data" } },
        );
        setUploadedFiles((prev) => [
          ...prev,
          { name: res.data.filename, path: res.data.path },
        ]);
      }
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  };

  const removeUploadedFile = (fileName) => {
    setUploadedFiles((prev) => prev.filter((f) => f.name !== fileName));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    const validExtraPorts = extraPorts.filter(
      (p) =>
        p.host &&
        p.container &&
        parseInt(p.host) > 0 &&
        parseInt(p.container) > 0,
    );

    // Merge provider config fields with gluetun config and advanced env var fields
    const filledGluetun = {};
    for (const [key, value] of Object.entries(gluetunFields)) {
      if (value && value.trim()) {
        filledGluetun[key] = value.trim();
      }
    }
    const filledAdvanced = {};
    for (const [key, value] of Object.entries(advancedFields)) {
      if (value && value.trim()) {
        filledAdvanced[key] = value.trim();
      }
    }
    const mergedConfig = {
      ...configFields,
      ...filledGluetun,
      ...filledAdvanced,
      HTTPPROXY: httpProxyEnabled ? "on" : "off",
      SHADOWSOCKS: shadowsocksEnabled ? "on" : "off",
    };

    try {
      await api.post("/containers", {
        name: form.name,
        vpn_provider: form.vpn_provider,
        vpn_type: form.vpn_type,
        config: mergedConfig,
        port_http_proxy: form.port_http_proxy,
        port_shadowsocks: form.port_shadowsocks,
        extra_ports: validExtraPorts,
        network_name: form.network_name || undefined,
      });
      navigate("/");
    } catch (err) {
      setError(
        err.response?.data?.detail ||
          (Array.isArray(err.response?.data?.detail)
            ? err.response.data.detail[0]?.msg
            : "Failed to create container"),
      );
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-vpn-input border border-vpn-border rounded-lg text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent";
  const labelClass = "block text-sm font-medium text-vpn-muted mb-1.5";

  return (
    <div>
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
        <PlusCircle className="w-7 h-7 text-vpn-primary" />
        Create VPN Container
      </h1>
      <p className="text-vpn-muted mb-6">
        Configure and deploy a new Gluetun VPN container.
      </p>

      {error && (
        <div className="p-3 mb-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
          {error}
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-6">
        {/* Card: General */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">General</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Container Name</label>
              <input
                type="text"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                className={inputClass}
                placeholder="e.g. my-vpn"
                required
              />
              <p className="text-xs text-vpn-muted mt-1">
                Lowercase letters, numbers, hyphens, underscores only
              </p>
            </div>
            <div>
              <label className={labelClass}>Docker Network</label>
              <CustomDropdown
                value={form.network_name}
                onChange={(val) => setForm({ ...form, network_name: val })}
                placeholder="Default (bridge)"
                options={[
                  { value: "", label: "Default (bridge)" },
                  ...networks.map((n) => ({
                    value: n.name,
                    label: `${n.name} (${n.driver})`,
                  })),
                ]}
              />
              <p className="text-xs text-vpn-muted mt-1">
                Select an existing Docker network for this container
              </p>
            </div>
          </div>
        </div>

        {/* Card: VPN Provider */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            VPN Provider
          </h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Provider</label>
              <CustomDropdown
                value={form.vpn_provider}
                onChange={(val) => {
                  setForm({ ...form, vpn_provider: val });
                }}
                placeholder="Select a provider..."
                required
                options={providers.map((p) => ({
                  value: p.key,
                  label: p.name,
                }))}
              />
            </div>

            {providerDetails && (
              <div>
                <label className={labelClass}>VPN Type</label>
                <div className="flex gap-3">
                  {providerDetails.vpn_types.map((type) => (
                    <button
                      key={type}
                      type="button"
                      onClick={() => {
                        setForm({ ...form, vpn_type: type });
                        setConfigFields({});
                      }}
                      className={`flex-1 py-2.5 rounded-lg border font-medium transition-colors ${
                        form.vpn_type === type
                          ? "bg-vpn-primary/20 border-vpn-primary text-vpn-primary"
                          : "bg-vpn-input border-vpn-border text-vpn-muted hover:border-vpn-muted"
                      }`}
                    >
                      {type === "openvpn" ? "OpenVPN" : "WireGuard"}
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Card: VPN Configuration */}
        {getFields().length > 0 && (
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-4">
              VPN Configuration
            </h2>
            <div className="space-y-4">
              {getFields().map((field) => (
                <div key={field.key}>
                  <label className={labelClass}>
                    {field.label}
                    {field.required && (
                      <span className="text-red-400 ml-1">*</span>
                    )}
                  </label>
                  <input
                    type={field.type === "password" ? "password" : "text"}
                    value={configFields[field.key] || ""}
                    onChange={(e) =>
                      setConfigFields({
                        ...configFields,
                        [field.key]: e.target.value,
                      })
                    }
                    className={inputClass}
                    placeholder={field.placeholder || ""}
                    required={field.required}
                    autoComplete="off"
                  />
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Card: VPN Config Files */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">
            VPN Config Files
          </h2>
          <p className="text-xs text-vpn-muted mb-4">
            Upload OpenVPN (.ovpn) or WireGuard (.conf) config files. Files are
            stored in{" "}
            <span className="font-mono text-vpn-primary/70">/gluetun/</span>{" "}
            inside the container.
          </p>

          {!form.name.trim() ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                Enter a container name above before uploading config files.
              </p>
            </div>
          ) : (
            <>
              <input
                ref={fileInputRef}
                type="file"
                accept=".ovpn,.conf,.key,.crt,.pem,.txt,.cfg"
                onChange={handleFileUpload}
                className="hidden"
                multiple
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-3 border-2 border-dashed border-vpn-border hover:border-vpn-primary rounded-xl text-sm text-vpn-muted hover:text-vpn-primary transition-all disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? "Uploading..." : "Click to upload config files"}
              </button>

              {uploadedFiles.length > 0 && (
                <div className="mt-3 space-y-2">
                  {uploadedFiles.map((f) => (
                    <div
                      key={f.name}
                      className="flex items-center justify-between bg-vpn-input rounded-lg px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <File className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                        <span className="text-sm text-white truncate">
                          {f.name}
                        </span>
                        <span className="text-xs text-vpn-muted font-mono flex-shrink-0">
                          {f.path}
                        </span>
                      </div>
                      <button
                        type="button"
                        onClick={() => removeUploadedFile(f.name)}
                        className="p-1 text-vpn-muted hover:text-red-400 transition-colors flex-shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </>
          )}
        </div>

        {/* Card: Access Ports */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">
            Access Ports
          </h2>
          <div className="grid grid-cols-2 gap-4 mb-4">
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-vpn-muted">
                  HTTP Proxy
                </label>
                <button
                  type="button"
                  onClick={() => setHttpProxyEnabled(!httpProxyEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    httpProxyEnabled
                      ? "bg-vpn-primary"
                      : "bg-vpn-input border border-vpn-border"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      httpProxyEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <input
                type="number"
                value={form.port_http_proxy}
                onChange={(e) =>
                  setForm({
                    ...form,
                    port_http_proxy: parseInt(e.target.value) || 0,
                  })
                }
                className={`${inputClass} ${!httpProxyEnabled ? "opacity-40" : ""}`}
                min="1024"
                max="65535"
                disabled={!httpProxyEnabled}
              />
            </div>
            <div>
              <div className="flex items-center justify-between mb-1.5">
                <label className="text-sm font-medium text-vpn-muted">
                  Shadowsocks
                </label>
                <button
                  type="button"
                  onClick={() => setShadowsocksEnabled(!shadowsocksEnabled)}
                  className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${
                    shadowsocksEnabled
                      ? "bg-vpn-primary"
                      : "bg-vpn-input border border-vpn-border"
                  }`}
                >
                  <span
                    className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                      shadowsocksEnabled ? "translate-x-4" : "translate-x-0.5"
                    }`}
                  />
                </button>
              </div>
              <input
                type="number"
                value={form.port_shadowsocks}
                onChange={(e) =>
                  setForm({
                    ...form,
                    port_shadowsocks: parseInt(e.target.value) || 0,
                  })
                }
                className={`${inputClass} ${!shadowsocksEnabled ? "opacity-40" : ""}`}
                min="1024"
                max="65535"
                disabled={!shadowsocksEnabled}
              />
            </div>
          </div>

          {/* Extra Ports */}
          <div className="border-t border-vpn-border pt-4">
            <div className="flex items-center justify-between mb-3">
              <label className="text-sm font-medium text-vpn-muted">
                Additional Ports
              </label>
              <button
                type="button"
                onClick={addExtraPort}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add Port
              </button>
            </div>

            {extraPorts.length === 0 && (
              <p className="text-xs text-vpn-muted">
                No additional ports configured. Click "Add Port" to map extra
                ports through the VPN container.
              </p>
            )}

            <div className="space-y-2">
              {extraPorts.map((port, index) => (
                <div key={index} className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="number"
                      value={port.host}
                      onChange={(e) =>
                        updateExtraPort(index, "host", e.target.value)
                      }
                      className={inputClass}
                      placeholder="Host port"
                      min="1"
                      max="65535"
                    />
                  </div>
                  <span className="text-vpn-muted text-lg">:</span>
                  <div className="flex-1">
                    <input
                      type="number"
                      value={port.container}
                      onChange={(e) =>
                        updateExtraPort(index, "container", e.target.value)
                      }
                      className={inputClass}
                      placeholder="Container port"
                      min="1"
                      max="65535"
                    />
                  </div>
                  <CustomDropdown
                    value={port.protocol}
                    onChange={(val) => updateExtraPort(index, "protocol", val)}
                    className="w-24"
                    options={[
                      { value: "tcp", label: "TCP" },
                      { value: "udp", label: "UDP" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => removeExtraPort(index)}
                    className="p-2.5 text-vpn-muted hover:text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Card: Gluetun Configuration */}
        {Object.keys(envVarCategories).length > 0 && (
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <h2 className="text-lg font-semibold text-white mb-1">
              Gluetun Configuration
            </h2>
            <p className="text-xs text-vpn-muted mb-4">
              Common Gluetun environment variables. Provider-specific fields
              above take priority.
            </p>
            <div className="space-y-3">
              {Object.entries(envVarCategories).map(([category, vars]) => {
                const providerKeys = getProviderFieldKeys();
                const filteredVars = vars.filter(
                  (v) =>
                    WHITELISTED_KEYS.has(v.key) &&
                    !AUTO_SET_KEYS.has(v.key) &&
                    !providerKeys.has(v.key),
                );
                if (filteredVars.length === 0) return null;

                return (
                  <div
                    key={category}
                    className="border border-vpn-border rounded-lg overflow-hidden"
                  >
                    <button
                      type="button"
                      onClick={() => toggleGluetunCategory(category)}
                      className="flex items-center justify-between w-full px-4 py-2.5 bg-vpn-input hover:bg-vpn-border transition-colors"
                    >
                      <span className="text-sm font-medium text-vpn-text">
                        {category}
                      </span>
                      <div className="flex items-center gap-2">
                        {filteredVars.some((v) => gluetunFields[v.key]) && (
                          <span className="text-xs text-vpn-primary">
                            {
                              filteredVars.filter((v) => gluetunFields[v.key])
                                .length
                            }{" "}
                            set
                          </span>
                        )}
                        {openGluetunCategories[category] ? (
                          <ChevronDown className="w-4 h-4 text-vpn-muted" />
                        ) : (
                          <ChevronRight className="w-4 h-4 text-vpn-muted" />
                        )}
                      </div>
                    </button>

                    {openGluetunCategories[category] && (
                      <div className="px-4 py-3 space-y-3">
                        {filteredVars.map((envVar) => (
                          <div key={envVar.key}>
                            <label className={labelClass}>
                              {envVar.label}
                              <span className="text-xs text-vpn-muted ml-2 font-normal">
                                {envVar.key}
                              </span>
                            </label>
                            <input
                              type={
                                envVar.type === "password" ? "password" : "text"
                              }
                              value={gluetunFields[envVar.key] || ""}
                              onChange={(e) =>
                                setGluetunFields({
                                  ...gluetunFields,
                                  [envVar.key]: e.target.value,
                                })
                              }
                              className={inputClass}
                              placeholder={
                                envVar.default
                                  ? `Default: ${envVar.default}`
                                  : envVar.placeholder || ""
                              }
                              autoComplete="off"
                            />
                            {envVar.default && (
                              <p className="text-xs text-vpn-muted mt-1">
                                Default:{" "}
                                <span className="text-vpn-primary/70">
                                  {envVar.default}
                                </span>
                              </p>
                            )}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>
        )}

        {/* Card: Advanced Settings (Gluetun Env Variables) */}
        {Object.keys(envVarCategories).length > 0 && (
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <button
              type="button"
              onClick={() => setShowAdvanced(!showAdvanced)}
              className="flex items-center justify-between w-full"
            >
              <h2 className="text-lg font-semibold text-white">
                Advanced Settings
              </h2>
              {showAdvanced ? (
                <ChevronDown className="w-5 h-5 text-vpn-muted" />
              ) : (
                <ChevronRight className="w-5 h-5 text-vpn-muted" />
              )}
            </button>
            <p className="text-xs text-vpn-muted mt-1">
              Optional Gluetun environment variables not covered above.
            </p>

            {showAdvanced && (
              <div className="mt-4 space-y-3">
                {Object.entries(envVarCategories).map(([category, vars]) => {
                  const providerKeys = getProviderFieldKeys();
                  const filteredVars = vars.filter(
                    (v) =>
                      !WHITELISTED_KEYS.has(v.key) && !providerKeys.has(v.key),
                  );
                  if (filteredVars.length === 0) return null;

                  return (
                    <div
                      key={category}
                      className="border border-vpn-border rounded-lg overflow-hidden"
                    >
                      <button
                        type="button"
                        onClick={() => toggleCategory(category)}
                        className="flex items-center justify-between w-full px-4 py-2.5 bg-vpn-input hover:bg-vpn-border transition-colors"
                      >
                        <span className="text-sm font-medium text-vpn-text">
                          {category}
                        </span>
                        <div className="flex items-center gap-2">
                          {filteredVars.some((v) => advancedFields[v.key]) && (
                            <span className="text-xs text-vpn-primary">
                              {
                                filteredVars.filter(
                                  (v) => advancedFields[v.key],
                                ).length
                              }{" "}
                              set
                            </span>
                          )}
                          {openCategories[category] ? (
                            <ChevronDown className="w-4 h-4 text-vpn-muted" />
                          ) : (
                            <ChevronRight className="w-4 h-4 text-vpn-muted" />
                          )}
                        </div>
                      </button>

                      {openCategories[category] && (
                        <div className="px-4 py-3 space-y-3">
                          {filteredVars.map((envVar) => (
                            <div key={envVar.key}>
                              <label className={labelClass}>
                                {envVar.label}
                                <span className="text-xs text-vpn-muted ml-2 font-normal">
                                  {envVar.key}
                                </span>
                              </label>
                              <input
                                type={
                                  envVar.type === "password"
                                    ? "password"
                                    : "text"
                                }
                                value={advancedFields[envVar.key] || ""}
                                onChange={(e) =>
                                  setAdvancedFields({
                                    ...advancedFields,
                                    [envVar.key]: e.target.value,
                                  })
                                }
                                className={inputClass}
                                placeholder={
                                  envVar.default
                                    ? `Default: ${envVar.default}`
                                    : envVar.placeholder || ""
                                }
                                autoComplete="off"
                              />
                              {envVar.default && (
                                <p className="text-xs text-vpn-muted mt-1">
                                  Default:{" "}
                                  <span className="text-vpn-primary/70">
                                    {envVar.default}
                                  </span>
                                </p>
                              )}
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Submit */}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={loading}
            className="px-6 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary disabled:opacity-50 disabled:cursor-not-allowed text-vpn-text font-medium rounded-lg transition-all shadow-sm flex items-center gap-2"
          >
            {loading ? (
              <Loader2 className="w-4 h-4 text-vpn-primary animate-spin" />
            ) : (
              <Plus className="w-4 h-4 text-vpn-primary" />
            )}
            {loading ? "Creating Container..." : "Create Container"}
          </button>
        </div>
      </form>
    </div>
  );
}
