import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { ArrowLeft, Loader2, Plus, Trash2, Boxes, Shield } from "lucide-react";
import api from "../services/api";
import CustomDropdown from "../components/CustomDropdown";

export default function CreateO11Container() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [networks, setNetworks] = useState([]);
  const [vpnContainers, setVpnContainers] = useState([]);

  const [form, setForm] = useState({
    name: "",
    image: "",
    network_mode: "bridge",
    vpn_container: "",
    restart_policy: "unless-stopped",
    command: "",
  });

  const [envVars, setEnvVars] = useState([]);
  const [ports, setPorts] = useState([]);
  const [volumes, setVolumes] = useState([]);

  useEffect(() => {
    api
      .get("/containers/networks")
      .then((res) => setNetworks(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
    api
      .get("/containers")
      .then((res) => setVpnContainers(Array.isArray(res.data) ? res.data : []))
      .catch(() => {});
  }, []);

  // --- Env Vars ---
  const addEnvVar = () => setEnvVars([...envVars, { key: "", value: "" }]);
  const removeEnvVar = (i) => setEnvVars(envVars.filter((_, idx) => idx !== i));
  const updateEnvVar = (i, field, value) => {
    const updated = [...envVars];
    updated[i] = { ...updated[i], [field]: value };
    setEnvVars(updated);
  };

  // --- Ports ---
  const addPort = () =>
    setPorts([...ports, { host: "", container: "", protocol: "tcp" }]);
  const removePort = (i) => setPorts(ports.filter((_, idx) => idx !== i));
  const updatePort = (i, field, value) => {
    const updated = [...ports];
    updated[i] = { ...updated[i], [field]: value };
    setPorts(updated);
  };

  // --- Volumes ---
  const addVolume = () =>
    setVolumes([...volumes, { source: "", target: "", mode: "rw" }]);
  const removeVolume = (i) => setVolumes(volumes.filter((_, idx) => idx !== i));
  const updateVolume = (i, field, value) => {
    const updated = [...volumes];
    updated[i] = { ...updated[i], [field]: value };
    setVolumes(updated);
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    // Determine network_mode
    let networkMode = form.network_mode;
    if (form.network_mode === "vpn" && form.vpn_container) {
      networkMode = `container:${form.vpn_container}`;
    }

    // Build environment dict
    const environment = {};
    for (const ev of envVars) {
      if (ev.key.trim()) {
        environment[ev.key.trim()] = ev.value;
      }
    }

    // Filter valid ports
    const validPorts = ports.filter(
      (p) =>
        p.host &&
        p.container &&
        parseInt(p.host) > 0 &&
        parseInt(p.container) > 0,
    );

    // Filter valid volumes
    const validVolumes = volumes.filter(
      (v) => v.source.trim() && v.target.trim(),
    );

    try {
      await api.post("/containers/dependents/create", {
        name: form.name.trim(),
        image: form.image.trim(),
        network_mode: networkMode,
        environment:
          Object.keys(environment).length > 0 ? environment : undefined,
        ports: validPorts.length > 0 ? validPorts : undefined,
        volumes: validVolumes.length > 0 ? validVolumes : undefined,
        restart_policy: form.restart_policy,
        command: form.command.trim() || undefined,
      });
      navigate("/o11");
    } catch (err) {
      setError(err.response?.data?.detail || "Failed to create container");
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full px-4 py-2.5 bg-vpn-input border border-vpn-border rounded-lg text-white placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent";
  const labelClass = "block text-sm font-medium text-vpn-muted mb-1.5";

  const isVpnMode = form.network_mode === "vpn";

  return (
    <div>
      <button
        onClick={() => navigate("/o11")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to O11
      </button>

      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
        <Boxes className="w-7 h-7 text-vpn-primary" />
        Create O11 Container
      </h1>
      <p className="text-vpn-muted mb-6">
        Deploy a new Docker container, optionally routed through a VPN.
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
                placeholder="e.g. o11-qbittorrent"
                required
              />
              <p className="text-xs text-vpn-muted mt-1">
                Must be unique. Lowercase letters, numbers, hyphens,
                underscores.
              </p>
            </div>
            <div>
              <label className={labelClass}>Docker Image</label>
              <input
                type="text"
                value={form.image}
                onChange={(e) => setForm({ ...form, image: e.target.value })}
                className={inputClass}
                placeholder="e.g. linuxserver/qbittorrent:latest"
                required
              />
              <p className="text-xs text-vpn-muted mt-1">
                Image will be pulled automatically if not available locally.
              </p>
            </div>
            <div>
              <label className={labelClass}>Restart Policy</label>
              <CustomDropdown
                value={form.restart_policy}
                onChange={(val) => setForm({ ...form, restart_policy: val })}
                options={[
                  { value: "unless-stopped", label: "Unless Stopped" },
                  { value: "always", label: "Always" },
                  { value: "on-failure", label: "On Failure" },
                  { value: "no", label: "Never" },
                ]}
              />
            </div>
            <div>
              <label className={labelClass}>Command (optional)</label>
              <input
                type="text"
                value={form.command}
                onChange={(e) => setForm({ ...form, command: e.target.value })}
                className={inputClass}
                placeholder="e.g. --webui-port=8080"
              />
              <p className="text-xs text-vpn-muted mt-1">
                Override the default container command. Leave empty to use image
                default.
              </p>
            </div>
          </div>
        </div>

        {/* Card: Network */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-4">Network</h2>
          <div className="space-y-4">
            <div>
              <label className={labelClass}>Network Mode</label>
              <div className="grid grid-cols-3 gap-3">
                {[
                  {
                    value: "bridge",
                    label: "Bridge",
                    desc: "Default Docker network",
                  },
                  {
                    value: "vpn",
                    label: "VPN Route",
                    desc: "Through Gluetun VPN",
                  },
                  {
                    value: "custom",
                    label: "Custom",
                    desc: "Existing Docker network",
                  },
                ].map((opt) => (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() =>
                      setForm({
                        ...form,
                        network_mode: opt.value,
                        vpn_container: "",
                      })
                    }
                    className={`py-3 px-3 rounded-lg border font-medium transition-colors text-left ${
                      form.network_mode === opt.value
                        ? "bg-vpn-primary/20 border-vpn-primary text-vpn-primary"
                        : "bg-vpn-input border-vpn-border text-vpn-muted hover:border-vpn-muted"
                    }`}
                  >
                    <span className="block text-sm">{opt.label}</span>
                    <span className="block text-[10px] mt-0.5 opacity-70">
                      {opt.desc}
                    </span>
                  </button>
                ))}
              </div>
            </div>

            {isVpnMode && (
              <div>
                <label className={labelClass}>
                  <span className="flex items-center gap-1.5">
                    <Shield className="w-3.5 h-3.5 text-blue-400" />
                    VPN Container
                  </span>
                </label>
                <CustomDropdown
                  value={form.vpn_container}
                  onChange={(val) => setForm({ ...form, vpn_container: val })}
                  placeholder="Select a Gluetun VPN container..."
                  required
                  options={vpnContainers.map((c) => ({
                    value: c.docker_name || `gluetun-${c.name}`,
                    label: `${c.docker_name || `gluetun-${c.name}`} (${c.vpn_provider})`,
                  }))}
                />
                <p className="text-xs text-vpn-muted mt-1">
                  All traffic from this container will be routed through the
                  selected VPN. Port mappings are handled by the VPN container.
                </p>
              </div>
            )}

            {form.network_mode === "custom" && (
              <div>
                <label className={labelClass}>Docker Network</label>
                <CustomDropdown
                  value={form.vpn_container}
                  onChange={(val) => setForm({ ...form, vpn_container: val })}
                  placeholder="Select network..."
                  required
                  options={networks
                    .filter((n) => !["host", "none"].includes(n.name))
                    .map((n) => ({
                      value: n.name,
                      label: `${n.name} (${n.driver})`,
                    }))}
                />
              </div>
            )}
          </div>
        </div>

        {/* Card: Environment Variables */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-semibold text-white">
              Environment Variables
            </h2>
            <button
              type="button"
              onClick={addEnvVar}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-vpn-primary" />
              Add Variable
            </button>
          </div>

          {envVars.length === 0 ? (
            <p className="text-xs text-vpn-muted">
              No environment variables configured. Click "Add Variable" to add
              key-value pairs.
            </p>
          ) : (
            <div className="space-y-2">
              {envVars.map((ev, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={ev.key}
                    onChange={(e) => updateEnvVar(i, "key", e.target.value)}
                    placeholder="KEY"
                    className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                  />
                  <span className="text-vpn-muted">=</span>
                  <input
                    type="text"
                    value={ev.value}
                    onChange={(e) => updateEnvVar(i, "value", e.target.value)}
                    placeholder="value"
                    className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeEnvVar(i)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card: Port Mappings */}
        {!isVpnMode && (
          <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
            <div className="flex items-center justify-between mb-4">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Port Mappings
                </h2>
                <p className="text-xs text-vpn-muted mt-0.5">
                  Map host ports to container ports.
                </p>
              </div>
              <button
                type="button"
                onClick={addPort}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add Port
              </button>
            </div>

            {ports.length === 0 ? (
              <p className="text-xs text-vpn-muted">
                No port mappings configured.
              </p>
            ) : (
              <div className="space-y-2">
                {ports.map((p, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <div className="flex-1">
                      <input
                        type="number"
                        value={p.host}
                        onChange={(e) => updatePort(i, "host", e.target.value)}
                        placeholder="Host port"
                        min="1"
                        max="65535"
                        className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                      />
                    </div>
                    <span className="text-vpn-muted text-lg">:</span>
                    <div className="flex-1">
                      <input
                        type="number"
                        value={p.container}
                        onChange={(e) =>
                          updatePort(i, "container", e.target.value)
                        }
                        placeholder="Container port"
                        min="1"
                        max="65535"
                        className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                      />
                    </div>
                    <CustomDropdown
                      value={p.protocol}
                      onChange={(val) => updatePort(i, "protocol", val)}
                      className="w-24"
                      options={[
                        { value: "tcp", label: "TCP" },
                        { value: "udp", label: "UDP" },
                      ]}
                    />
                    <button
                      type="button"
                      onClick={() => removePort(i)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}

            {isVpnMode && (
              <div className="mt-3 bg-blue-500/10 border border-blue-500/20 rounded-lg p-3">
                <p className="text-xs text-blue-400">
                  Port mappings are disabled in VPN mode. Ports must be mapped
                  on the VPN (Gluetun) container instead.
                </p>
              </div>
            )}
          </div>
        )}

        {isVpnMode && (
          <div className="bg-blue-500/5 border border-blue-500/20 rounded-2xl p-6">
            <div className="flex items-center gap-2 mb-2">
              <Shield className="w-5 h-5 text-blue-400" />
              <h2 className="text-lg font-semibold text-blue-400">
                VPN Routing Info
              </h2>
            </div>
            <p className="text-sm text-vpn-muted">
              This container will use{" "}
              <code className="text-vpn-primary">
                network_mode: container:{form.vpn_container || "..."}
              </code>{" "}
              to route all traffic through the selected VPN container. Port
              mappings must be configured on the VPN container, not here.
            </p>
          </div>
        )}

        {/* Card: Volume Mounts */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">
                Volume Mounts
              </h2>
              <p className="text-xs text-vpn-muted mt-0.5">
                Bind mount host directories into the container.
              </p>
            </div>
            <button
              type="button"
              onClick={addVolume}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-vpn-primary" />
              Add Volume
            </button>
          </div>

          {volumes.length === 0 ? (
            <p className="text-xs text-vpn-muted">No volumes configured.</p>
          ) : (
            <div className="space-y-2">
              {volumes.map((v, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="flex-1">
                    <input
                      type="text"
                      value={v.source}
                      onChange={(e) =>
                        updateVolume(i, "source", e.target.value)
                      }
                      placeholder="Host path (e.g. /data/downloads)"
                      className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                  </div>
                  <span className="text-vpn-muted text-lg">:</span>
                  <div className="flex-1">
                    <input
                      type="text"
                      value={v.target}
                      onChange={(e) =>
                        updateVolume(i, "target", e.target.value)
                      }
                      placeholder="Container path (e.g. /downloads)"
                      className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                  </div>
                  <CustomDropdown
                    value={v.mode}
                    onChange={(val) => updateVolume(i, "mode", val)}
                    className="w-24"
                    options={[
                      { value: "rw", label: "RW" },
                      { value: "ro", label: "RO" },
                    ]}
                  />
                  <button
                    type="button"
                    onClick={() => removeVolume(i)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Submit */}
        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={() => navigate("/o11")}
            className="px-6 py-2.5 border border-vpn-border text-vpn-text rounded-lg hover:bg-vpn-input transition-colors"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={loading}
            className="flex items-center gap-2 px-6 py-2.5 bg-vpn-primary text-black font-semibold rounded-lg hover:bg-vpn-primary/90 transition-colors disabled:opacity-50"
          >
            {loading && <Loader2 className="w-4 h-4 animate-spin" />}
            {loading ? "Creating..." : "Create Container"}
          </button>
        </div>
      </form>
    </div>
  );
}
