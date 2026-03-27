import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import api from "../services/api";

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
    port_control: 8000,
  });
  const [configFields, setConfigFields] = useState({});

  useEffect(() => {
    api
      .get("/containers/providers")
      .then((res) => setProviders(res.data))
      .catch(() => setError("Failed to load providers"));
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

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      await api.post("/containers", {
        name: form.name,
        vpn_provider: form.vpn_provider,
        vpn_type: form.vpn_type,
        config: configFields,
        port_http_proxy: form.port_http_proxy,
        port_shadowsocks: form.port_shadowsocks,
        port_control: form.port_control,
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
    "w-full px-4 py-2.5 bg-slate-800 border border-slate-700 rounded-lg text-white placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent";
  const labelClass = "block text-sm font-medium text-slate-400 mb-1.5";

  return (
    <div className="max-w-2xl mx-auto">
      <button
        onClick={() => navigate("/")}
        className="flex items-center gap-2 text-slate-400 hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Dashboard
      </button>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-8">
        <h1 className="text-2xl font-bold text-white mb-2">
          Create VPN Container
        </h1>
        <p className="text-slate-500 mb-8">
          Configure and deploy a new Gluetun VPN container.
        </p>

        {error && (
          <div className="p-3 mb-6 bg-red-500/10 border border-red-500/30 rounded-lg text-red-400 text-sm">
            {error}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Container Name */}
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
            <p className="text-xs text-slate-600 mt-1">
              Lowercase letters, numbers, hyphens, underscores only
            </p>
          </div>

          {/* VPN Provider */}
          <div>
            <label className={labelClass}>VPN Provider</label>
            <select
              value={form.vpn_provider}
              onChange={(e) =>
                setForm({ ...form, vpn_provider: e.target.value })
              }
              className={inputClass}
              required
            >
              <option value="">Select a provider...</option>
              {providers.map((p) => (
                <option key={p.key} value={p.key}>
                  {p.name}
                </option>
              ))}
            </select>
          </div>

          {/* VPN Type */}
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
                        ? "bg-blue-600/20 border-blue-500 text-blue-400"
                        : "bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-600"
                    }`}
                  >
                    {type === "openvpn" ? "OpenVPN" : "WireGuard"}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Provider-specific fields */}
          {getFields().length > 0 && (
            <div className="space-y-4 p-5 bg-slate-800/50 border border-slate-700 rounded-xl">
              <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
                VPN Configuration
              </h3>
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
          )}

          {/* Port Configuration */}
          <div className="space-y-4 p-5 bg-slate-800/50 border border-slate-700 rounded-xl">
            <h3 className="text-sm font-semibold text-slate-300 uppercase tracking-wider">
              Port Mapping
            </h3>
            <div className="grid grid-cols-3 gap-4">
              <div>
                <label className={labelClass}>HTTP Proxy</label>
                <input
                  type="number"
                  value={form.port_http_proxy}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      port_http_proxy: parseInt(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                  min="1024"
                  max="65535"
                />
              </div>
              <div>
                <label className={labelClass}>Shadowsocks</label>
                <input
                  type="number"
                  value={form.port_shadowsocks}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      port_shadowsocks: parseInt(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                  min="1024"
                  max="65535"
                />
              </div>
              <div>
                <label className={labelClass}>Control</label>
                <input
                  type="number"
                  value={form.port_control}
                  onChange={(e) =>
                    setForm({
                      ...form,
                      port_control: parseInt(e.target.value) || 0,
                    })
                  }
                  className={inputClass}
                  min="1024"
                  max="65535"
                />
              </div>
            </div>
          </div>

          {/* Submit */}
          <button
            type="submit"
            disabled={loading}
            className="w-full py-3 bg-blue-600 hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed text-white font-medium rounded-lg transition-colors flex items-center justify-center gap-2"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating Container..." : "Create Container"}
          </button>
        </form>
      </div>
    </div>
  );
}
