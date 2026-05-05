import { useState, useEffect, useRef } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import {
  ArrowLeft,
  Loader2,
  Plus,
  Trash2,
  Boxes,
  Shield,
  Upload,
  File,
  X,
  FolderOpen,
} from "lucide-react";
import api from "../services/api";
import CustomDropdown from "../components/CustomDropdown";
import ActionProgressDialog from "../components/ActionProgressDialog";
import EmptyHint from "../components/EmptyHint";
import TraefikSection, {
  DEFAULT_TRAEFIK,
  traefikLabelsFrom,
} from "../components/TraefikSection";
import { useToast } from "../context/ToastContext";

// Normalize a template fetched from the backend (snake_case) to the
// camelCase shape used internally by this form.
const normalizeTpl = (tpl) => {
  if (!tpl) return null;
  return {
    id: tpl.id,
    title: tpl.title,
    subtitle: tpl.subtitle,
    image: tpl.image,
    suggestedName: tpl.suggested_name ?? tpl.suggestedName ?? "",
    restartPolicy: tpl.restart_policy ?? tpl.restartPolicy ?? "unless-stopped",
    envVars: tpl.env_vars ?? tpl.envVars ?? [],
    ports: tpl.ports ?? [],
    volumes: tpl.volumes ?? [],
    devices: tpl.devices ?? [],
    labels: tpl.labels ?? [],
  };
};

export default function CreateO11Container() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const toast = useToast();
  const [loading, setLoading] = useState(false);
  const [networks, setNetworks] = useState([]);
  const [vpnContainers, setVpnContainers] = useState([]);
  const [predefinedImages, setPredefinedImages] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [selectedTemplateId, setSelectedTemplateId] = useState("");
  // Container kind toggle: "app" -> shows up on Apps page, "o11" -> shows up on OTT Panel page.
  // Defaults from URL (?type=app) but user can switch explicitly.
  const [containerKind, setContainerKind] = useState(
    searchParams.get("type") === "app" ? "app" : "o11",
  );
  const isAppType = containerKind === "app";

  const [form, setForm] = useState({
    name: "",
    image: "",
    network_mode: "network",
    vpn_container: "",
    restart_policy: "unless-stopped",
    command: "",
  });

  const [envVars, setEnvVars] = useState([
    { key: "PGID", value: "1000" },
    { key: "PUID", value: "1000" },
    { key: "TZ", value: "Europe/Berlin" },
    { key: "O11_PORT", value: "6123" },
    { key: "O11_EPG_PORT", value: "6125" },
  ]);
  const [ports, setPorts] = useState([]);
  const [volumes, setVolumes] = useState([]);
  const [devices, setDevices] = useState([]);
  const [hostname, setHostname] = useState("");
  const [customLabels, setCustomLabels] = useState([]);
  const [capAdd, setCapAdd] = useState([]);
  const [securityOpt, setSecurityOpt] = useState([]);
  const [traefikConfig, setTraefikConfig] = useState(DEFAULT_TRAEFIK);
  const [namedVolumes, setNamedVolumes] = useState([]);
  const [showVolumeModal, setShowVolumeModal] = useState(false);
  const [newVolumeForm, setNewVolumeForm] = useState({
    name: "",
    driver: "local",
    driver_opts: [{ key: "", value: "" }],
  });
  const [volumeBusy, setVolumeBusy] = useState(false);
  const [uploadedFiles, setUploadedFiles] = useState([]);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(null);
  const [uploadTargetPath, setUploadTargetPath] = useState("");
  const [hostBasePath, setHostBasePath] = useState("");
  const fileInputRef = useRef(null);

  const applyTemplate = (templateId, onlyIfEmptyName = false) => {
    const raw = templates.find((t) => t.id === templateId);
    const tpl = normalizeTpl(raw);
    if (!tpl) return;

    setSelectedTemplateId(tpl.id);
    setForm((prev) => ({
      ...prev,
      name:
        onlyIfEmptyName && prev.name.trim()
          ? prev.name
          : tpl.suggestedName || prev.name,
      image: tpl.image || prev.image,
      restart_policy: tpl.restartPolicy || prev.restart_policy,
    }));
    setEnvVars(Array.isArray(tpl.envVars) ? tpl.envVars : []);
    setPorts(Array.isArray(tpl.ports) ? tpl.ports : []);
    setVolumes(Array.isArray(tpl.volumes) ? tpl.volumes : []);
    setDevices(Array.isArray(tpl.devices) ? tpl.devices : []);
    if (Array.isArray(tpl.labels) && tpl.labels.length > 0) {
      setCustomLabels(tpl.labels);
    }
  };

  useEffect(() => {
    // Parallelize independent requests — was 5× sequential = 2-3s, now ~500ms
    Promise.all([
      api.get("/containers/networks").catch(() => ({ data: [] })),
      api.get("/containers/volumes").catch(() => ({ data: [] })),
      api.get("/containers").catch(() => ({ data: [] })),
      api.get("/settings/container-images").catch(() => ({ data: {} })),
      api.get("/app-templates").catch(() => ({ data: [] })),
    ]).then(([netRes, volRes, vpnRes, imgRes, tplRes]) => {
      setNetworks(Array.isArray(netRes.data) ? netRes.data : []);
      setNamedVolumes(Array.isArray(volRes.data) ? volRes.data : []);
      setVpnContainers(Array.isArray(vpnRes.data) ? vpnRes.data : []);
      const imgs = Array.isArray(imgRes.data?.o11_images)
        ? imgRes.data.o11_images
        : [];
      setPredefinedImages(imgs);
      setTemplates(Array.isArray(tplRes.data) ? tplRes.data : []);
    });
  }, []);

  useEffect(() => {
    const templateFromUrl = searchParams.get("template");
    if (templateFromUrl && templates.length > 0) {
      applyTemplate(templateFromUrl, true);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, templates]);

  // Fetch host base path when name changes
  useEffect(() => {
    const name = form.name.trim();
    if (!name) {
      setHostBasePath("");
      return;
    }
    const timer = setTimeout(() => {
      api
        .get(
          `/containers/dependents/data-path/${encodeURIComponent(name)}?kind=${isAppType ? "apps" : "o11"}`,
        )
        .then((res) => setHostBasePath(res.data.base_path))
        .catch(() => {});
    }, 300);
    return () => clearTimeout(timer);
  }, [form.name, isAppType]);

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
    setVolumes([
      ...volumes,
      { source: hostBasePath || "", target: "/opt/o11", mode: "rw" },
    ]);
  const removeVolume = (i) => setVolumes(volumes.filter((_, idx) => idx !== i));
  const updateVolume = (i, field, value) => {
    const updated = [...volumes];
    updated[i] = { ...updated[i], [field]: value };
    setVolumes(updated);
  };

  // --- Devices ---
  const addDevice = () => setDevices([...devices, ""]);
  const removeDevice = (i) => setDevices(devices.filter((_, idx) => idx !== i));
  const updateDevice = (i, value) => {
    const updated = [...devices];
    updated[i] = value;
    setDevices(updated);
  };

  // --- Custom Labels ---
  const addCustomLabel = () =>
    setCustomLabels([...customLabels, { key: "", value: "" }]);
  const removeCustomLabel = (i) =>
    setCustomLabels(customLabels.filter((_, idx) => idx !== i));
  const updateCustomLabel = (i, field, value) => {
    const updated = [...customLabels];
    updated[i] = { ...updated[i], [field]: value };
    setCustomLabels(updated);
  };

  // --- Cap Add ---
  const addCapAdd = () => setCapAdd([...capAdd, ""]);
  const removeCapAdd = (i) => setCapAdd(capAdd.filter((_, idx) => idx !== i));
  const updateCapAdd = (i, value) => {
    const updated = [...capAdd];
    updated[i] = value;
    setCapAdd(updated);
  };

  // --- Security Opt ---
  const addSecurityOpt = () => setSecurityOpt([...securityOpt, ""]);
  const removeSecurityOpt = (i) =>
    setSecurityOpt(securityOpt.filter((_, idx) => idx !== i));
  const updateSecurityOpt = (i, value) => {
    const updated = [...securityOpt];
    updated[i] = value;
    setSecurityOpt(updated);
  };

  // --- Named Volumes (Docker volume create) ---
  const refreshNamedVolumes = async () => {
    try {
      const res = await api.get("/containers/volumes");
      setNamedVolumes(Array.isArray(res.data) ? res.data : []);
    } catch {
      // ignore
    }
  };

  const updateNewVolumeOpt = (i, field, value) => {
    const updated = [...newVolumeForm.driver_opts];
    updated[i] = { ...updated[i], [field]: value };
    setNewVolumeForm({ ...newVolumeForm, driver_opts: updated });
  };

  const addNewVolumeOpt = () =>
    setNewVolumeForm({
      ...newVolumeForm,
      driver_opts: [...newVolumeForm.driver_opts, { key: "", value: "" }],
    });

  const removeNewVolumeOpt = (i) =>
    setNewVolumeForm({
      ...newVolumeForm,
      driver_opts: newVolumeForm.driver_opts.filter((_, idx) => idx !== i),
    });

  const submitNewVolume = async () => {
    const name = newVolumeForm.name.trim();
    if (!name) return;
    setVolumeBusy(true);
    try {
      const opts = newVolumeForm.driver_opts.reduce((acc, o) => {
        const k = o.key.trim();
        if (k) acc[k] = o.value.trim();
        return acc;
      }, {});
      await api.post("/containers/volumes", {
        name,
        driver: newVolumeForm.driver.trim() || "local",
        driver_opts: Object.keys(opts).length > 0 ? opts : undefined,
      });
      await refreshNamedVolumes();
      setNewVolumeForm({
        name: "",
        driver: "local",
        driver_opts: [{ key: "", value: "" }],
      });
      setShowVolumeModal(false);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create volume");
    } finally {
      setVolumeBusy(false);
    }
  };

  const deleteNamedVolume = async (name) => {
    if (!window.confirm(`Delete Docker volume '${name}'?`)) return;
    try {
      await api.delete(`/containers/volumes/${encodeURIComponent(name)}`);
      await refreshNamedVolumes();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete volume");
    }
  };

  // --- File Upload ---
  const fetchHostBasePath = async () => {
    if (!form.name.trim() || hostBasePath) return;
    try {
      const res = await api.get(
        `/containers/dependents/data-path/${encodeURIComponent(form.name.trim())}?kind=${isAppType ? "apps" : "o11"}`,
      );
      setHostBasePath(res.data.base_path);
    } catch {
      // fallback
    }
  };

  const handleFileUpload = async (e) => {
    const files = Array.from(e.target.files || []);
    if (!files.length || !form.name.trim()) return;
    setUploading(true);
    setUploadProgress({
      action: "upload",
      target: "",
      percent: 0,
      finished: false,
      error: null,
    });
    await fetchHostBasePath();
    try {
      for (const file of files) {
        const formData = new FormData();
        formData.append("file", file);
        const targetClean = uploadTargetPath.trim().replace(/^\/+|\/+$/g, "");
        const params = new URLSearchParams();
        params.set("kind", isAppType ? "apps" : "o11");
        if (targetClean) params.set("target_path", targetClean);
        const url = `/containers/dependents/upload-files/${encodeURIComponent(form.name.trim())}?${params.toString()}`;
        setUploadProgress((prev) => ({
          ...prev,
          target: file.name,
          percent: 0,
        }));
        const res = await api.post(url, formData, {
          headers: { "Content-Type": "multipart/form-data" },
          onUploadProgress: (progressEvent) => {
            const pct = progressEvent.total
              ? Math.round((progressEvent.loaded / progressEvent.total) * 100)
              : 0;
            setUploadProgress((prev) => ({ ...prev, percent: pct }));
          },
        });
        setUploadedFiles((prev) => [
          ...prev,
          {
            name: res.data.filename,
            size: res.data.size,
            target_path: res.data.target_path || "",
            stored_path: res.data.stored_path,
          },
        ]);
      }
      setUploadProgress((prev) => ({ ...prev, percent: 100, finished: true }));
    } catch (err) {
      setUploadProgress((prev) => ({
        ...prev,
        finished: true,
        error: err.response?.data?.detail || "Failed to upload file",
      }));
      toast.error(err.response?.data?.detail || "Failed to upload file");
    } finally {
      setUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setTimeout(() => setUploadProgress(null), 1500);
    }
  };

  const removeUploadedFile = async (storedPath) => {
    try {
      await api.delete(
        `/containers/dependents/files/${encodeURIComponent(form.name.trim())}/${storedPath}?kind=${isAppType ? "apps" : "o11"}`,
      );
    } catch {
      // ignore delete errors for pre-creation files
    }
    setUploadedFiles((prev) =>
      prev.filter((f) => f.stored_path !== storedPath),
    );
  };

  const formatFileSize = (bytes) => {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  };

  // Auto-generate volume mounts from uploaded files
  const addVolumesFromUploads = () => {
    if (!uploadedFiles.length || !hostBasePath) return;
    // Group files by target_path to create one volume mount per unique target directory
    const targetPaths = [
      ...new Set(uploadedFiles.map((f) => f.target_path || "")),
    ];
    const newVolumes = [];
    for (const tp of targetPaths) {
      const hostPath = tp ? `${hostBasePath}/${tp}` : hostBasePath;
      // Don't add duplicate
      const exists = volumes.some((v) => v.source === hostPath);
      if (!exists) {
        newVolumes.push({
          source: hostPath,
          target: tp ? `/opt/o11/${tp}` : "/opt/o11",
          mode: "rw",
        });
      }
    }
    if (newVolumes.length) {
      setVolumes((prev) => [...prev, ...newVolumes]);
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);

    // Determine network_mode
    let networkMode = form.network_mode;
    if (form.network_mode === "vpn" && form.vpn_container) {
      networkMode = `container:${form.vpn_container}`;
    } else if (form.network_mode === "network" && form.vpn_container) {
      networkMode = form.vpn_container;
    } else if (form.network_mode === "network") {
      networkMode = "bridge";
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

    // Validate that container target paths are absolute. Docker requires this and
    // otherwise returns a cryptic 500. Catch it client-side with a clear message.
    const badVolume = validVolumes.find(
      (v) => !v.target.trim().startsWith("/"),
    );
    if (badVolume) {
      toast.error(
        `Volume target must be an absolute path (start with '/'): '${badVolume.target}'`,
      );
      setLoading(false);
      return;
    }

    // Filter valid devices
    const validDevices = devices.filter((d) => d.trim());
    const validCapAdd = capAdd.map((c) => c.trim()).filter(Boolean);
    const validSecurityOpt = securityOpt.map((s) => s.trim()).filter(Boolean);
    const traefikLabels = traefikLabelsFrom(traefikConfig, form.name.trim());
    const validCustomLabels = customLabels.reduce((acc, l) => {
      const k = l.key.trim();
      const v = l.value.trim();
      if (k) acc[k] = v;
      return acc;
    }, {});

    try {
      let imageName = form.image.trim();
      if (imageName.toLowerCase().startsWith("docker pull ")) {
        imageName = imageName.slice("docker pull ".length).trim();
      }
      await api.post("/containers/dependents/create", {
        name: form.name.trim(),
        image: imageName,
        network_mode: networkMode,
        environment:
          Object.keys(environment).length > 0 ? environment : undefined,
        ports: validPorts.length > 0 ? validPorts : undefined,
        volumes: validVolumes.length > 0 ? validVolumes : undefined,
        devices: validDevices.length > 0 ? validDevices : undefined,
        restart_policy: form.restart_policy,
        command: form.command.trim() || undefined,
        hostname: hostname.trim() || undefined,
        custom_labels:
          Object.keys({ ...traefikLabels, ...validCustomLabels }).length > 0
            ? { ...traefikLabels, ...validCustomLabels }
            : undefined,
        cap_add: validCapAdd.length > 0 ? validCapAdd : undefined,
        security_opt:
          validSecurityOpt.length > 0 ? validSecurityOpt : undefined,
        labels: isAppType ? { "managed-by": "vpn-proxy-app" } : undefined,
      });
      toast.success(`Container '${form.name.trim()}' created`);
      navigate(isAppType ? "/apps" : "/o11");
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to create container");
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
        onClick={() => navigate(isAppType ? "/apps" : "/o11")}
        className="flex items-center gap-2 text-vpn-muted hover:text-white mb-6 transition-colors"
      >
        <ArrowLeft className="w-4 h-4" />
        Back
      </button>

      <h1 className="text-2xl font-bold text-white mb-2 flex items-center gap-3">
        <Boxes className="w-7 h-7 text-vpn-primary" />
        Create {isAppType ? "App" : "OTT Panel"} Container
      </h1>
      <p className="text-vpn-muted mb-6">
        Deploy a new Docker container, optionally routed through a VPN.
      </p>

      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">
          Container Type
        </h2>
        <p className="text-sm text-vpn-muted mb-3">
          Choose where this container will be listed after creation.
        </p>
        <div className="grid grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => setContainerKind("o11")}
            className={`px-4 py-3 rounded-lg border text-left transition-colors ${
              !isAppType
                ? "border-vpn-primary bg-vpn-primary/10 text-white"
                : "border-vpn-border text-vpn-muted hover:border-vpn-primary/50"
            }`}
          >
            <div className="font-semibold">OTT Panel</div>
            <div className="text-xs opacity-75">
              Listed on the OTT Panel page
            </div>
          </button>
          <button
            type="button"
            onClick={() => setContainerKind("app")}
            className={`px-4 py-3 rounded-lg border text-left transition-colors ${
              isAppType
                ? "border-vpn-primary bg-vpn-primary/10 text-white"
                : "border-vpn-border text-vpn-muted hover:border-vpn-primary/50"
            }`}
          >
            <div className="font-semibold">App</div>
            <div className="text-xs opacity-75">Listed on the Apps page</div>
          </button>
        </div>
      </div>

      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
        <h2 className="text-lg font-semibold text-white mb-4">Template</h2>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3 items-end">
          <div className="md:col-span-2">
            <label className={labelClass}>Template Preset</label>
            <CustomDropdown
              value={selectedTemplateId}
              onChange={(val) => setSelectedTemplateId(val)}
              options={templates.map((tpl) => ({
                value: tpl.id,
                label: `${tpl.title} (${tpl.image})`,
              }))}
              placeholder="Choose a preset template..."
            />
          </div>
          <button
            type="button"
            onClick={() => applyTemplate(selectedTemplateId)}
            disabled={!selectedTemplateId}
            className="h-[42px] px-4 rounded-lg border border-vpn-border text-vpn-text hover:border-vpn-primary disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            Apply Template
          </button>
        </div>
        <p className="text-xs text-vpn-muted mt-2">
          Pre-fills image, environment, ports and volumes. You can still adjust
          everything individually afterwards.
        </p>
      </div>

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
              {predefinedImages.length > 0 ? (
                <CustomDropdown
                  value={form.image}
                  onChange={(val) => setForm({ ...form, image: val })}
                  options={predefinedImages.map((img) => ({
                    value: img,
                    label: img,
                  }))}
                  placeholder="Select a predefined image..."
                />
              ) : (
                <input
                  type="text"
                  value={form.image}
                  onChange={(e) => setForm({ ...form, image: e.target.value })}
                  className={inputClass}
                  placeholder="e.g. linuxserver/qbittorrent:latest"
                  required
                />
              )}
              <p className="text-xs text-vpn-muted mt-1">
                {predefinedImages.length > 0
                  ? "Select from predefined images configured in Settings."
                  : "No predefined images configured. Add them in Settings → Container Images."}
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
              <div className="grid grid-cols-2 gap-3">
                {[
                  {
                    value: "network",
                    label: "Docker Network",
                    desc: "Select a Docker network",
                  },
                  {
                    value: "vpn",
                    label: "VPN Route",
                    desc: "Through Gluetun VPN",
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

            {form.network_mode === "network" && (
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
                Bind mount host directories or named Docker volumes into the
                container.
              </p>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setShowVolumeModal(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Named Volumes
              </button>
              <button
                type="button"
                onClick={addVolume}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add Volume
              </button>
            </div>
          </div>

          {namedVolumes.length > 0 && (
            <div className="mb-3 text-xs text-vpn-muted">
              Tip: To use a named volume, set source to its name (e.g.{" "}
              <code className="text-vpn-primary/80">unionfs</code>) — no leading
              slash.
            </div>
          )}

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

        {/* Card: Devices */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h2 className="text-lg font-semibold text-white">Devices</h2>
              <p className="text-xs text-vpn-muted mt-0.5">
                Pass host devices into the container (e.g.{" "}
                <code className="text-vpn-primary/80">/dev/dri:/dev/dri</code>{" "}
                for GPU transcoding).
              </p>
            </div>
            <button
              type="button"
              onClick={addDevice}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
            >
              <Plus className="w-3.5 h-3.5 text-vpn-primary" />
              Add Device
            </button>
          </div>

          {devices.length === 0 ? (
            <EmptyHint
              label="No devices configured"
              hint="Pass GPU/USB/serial devices into the container, e.g. /dev/dri:/dev/dri."
            />
          ) : (
            <div className="space-y-2">
              {devices.map((d, i) => (
                <div key={i} className="flex items-center gap-2">
                  <input
                    type="text"
                    value={d}
                    onChange={(e) => updateDevice(i, e.target.value)}
                    placeholder="/dev/host:/dev/container (e.g. /dev/dri:/dev/dri)"
                    className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                  />
                  <button
                    type="button"
                    onClick={() => removeDevice(i)}
                    className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Card: Traefik Reverse Proxy */}
        <TraefikSection
          value={traefikConfig}
          onChange={setTraefikConfig}
          containerName={form.name}
        />

        {/* Card: Advanced Options (Hostname, Cap Add, Security Opt, Custom Labels) */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 space-y-5">
          <h2 className="text-lg font-semibold text-white">Advanced Options</h2>

          {/* Hostname */}
          <div>
            <label className="block text-sm font-medium text-vpn-muted mb-1">
              Hostname
            </label>
            <p className="text-xs text-vpn-muted mb-2">
              Override container hostname (ignored when network_mode is{" "}
              <code>container:</code>).
            </p>
            <input
              type="text"
              value={hostname}
              onChange={(e) => setHostname(e.target.value)}
              placeholder="e.g. plex"
              className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
            />
          </div>

          {/* Cap Add */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-vpn-muted">
                  Capabilities (cap_add)
                </label>
                <p className="text-xs text-vpn-muted mt-0.5">
                  Linux capabilities — e.g. <code>SYS_ADMIN</code>,{" "}
                  <code>NET_ADMIN</code>
                </p>
              </div>
              <button
                type="button"
                onClick={addCapAdd}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add
              </button>
            </div>
            {capAdd.length === 0 ? (
              <EmptyHint
                label="No capabilities"
                hint="Add Linux capabilities like SYS_ADMIN or NET_ADMIN if needed."
              />
            ) : (
              <div className="space-y-2">
                {capAdd.map((c, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={c}
                      onChange={(e) => updateCapAdd(i, e.target.value)}
                      placeholder="SYS_ADMIN"
                      className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeCapAdd(i)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Security Opt */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-vpn-muted">
                  Security Options (security_opt)
                </label>
                <p className="text-xs text-vpn-muted mt-0.5">
                  e.g. <code>seccomp=unconfined</code>,{" "}
                  <code>no-new-privileges:true</code>
                </p>
              </div>
              <button
                type="button"
                onClick={addSecurityOpt}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add
              </button>
            </div>
            {securityOpt.length === 0 ? (
              <EmptyHint
                label="No security options"
                hint="e.g. seccomp=unconfined or no-new-privileges:true."
              />
            ) : (
              <div className="space-y-2">
                {securityOpt.map((s, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={s}
                      onChange={(e) => updateSecurityOpt(i, e.target.value)}
                      placeholder="seccomp=unconfined"
                      className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeSecurityOpt(i)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Custom Labels */}
          <div>
            <div className="flex items-center justify-between mb-2">
              <div>
                <label className="block text-sm font-medium text-vpn-muted">
                  Custom Labels
                </label>
                <p className="text-xs text-vpn-muted mt-0.5">
                  Additional Docker labels (Traefik, dockupdater, etc.)
                </p>
              </div>
              <button
                type="button"
                onClick={addCustomLabel}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
              >
                <Plus className="w-3.5 h-3.5 text-vpn-primary" />
                Add
              </button>
            </div>
            {customLabels.length === 0 ? (
              <EmptyHint
                label="No custom labels"
                hint="Use the Traefik section above for routing, or add manual labels here."
              />
            ) : (
              <div className="space-y-2">
                {customLabels.map((entry, i) => (
                  <div key={i} className="flex items-center gap-2">
                    <input
                      type="text"
                      value={entry.key}
                      onChange={(e) =>
                        updateCustomLabel(i, "key", e.target.value)
                      }
                      placeholder="traefik.enable"
                      className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                    <span className="text-vpn-muted">=</span>
                    <input
                      type="text"
                      value={entry.value}
                      onChange={(e) =>
                        updateCustomLabel(i, "value", e.target.value)
                      }
                      placeholder="true"
                      className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                    />
                    <button
                      type="button"
                      onClick={() => removeCustomLabel(i)}
                      className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Card: File Upload */}
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6">
          <h2 className="text-lg font-semibold text-white mb-1">File Upload</h2>{" "}
          <p className="text-xs text-vpn-muted mb-4">
            Upload configuration or script files into the container. Set the{" "}
            <span className="text-vpn-primary">Container Target Path</span> to
            control where files end up inside the container, then click{" "}
            <span className="text-vpn-primary">"Generate Volume Mounts"</span>{" "}
            to auto-create the bind mounts.
          </p>
          {!form.name.trim() ? (
            <div className="bg-amber-500/10 border border-amber-500/30 rounded-lg p-3">
              <p className="text-xs text-amber-400">
                Enter a container name above before uploading files.
              </p>
            </div>
          ) : (
            <>
              {/* Target path input */}
              <div className="mb-3">
                <label className="block text-sm font-medium text-vpn-muted mb-1.5">
                  Container Target Path
                </label>
                <div className="flex items-center gap-2">
                  <FolderOpen className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                  <input
                    type="text"
                    value={uploadTargetPath}
                    onChange={(e) => setUploadTargetPath(e.target.value)}
                    placeholder="e.g. /scripts or /config (leave empty for root)"
                    className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                  />
                </div>
                <p className="text-xs text-vpn-muted mt-1">
                  Where inside the container should these files be placed? e.g.{" "}
                  <code className="text-vpn-primary/70">/scripts</code>,{" "}
                  <code className="text-vpn-primary/70">/config</code>, or empty
                  for container root.
                </p>
              </div>

              {/* Upload button */}
              <input
                ref={fileInputRef}
                type="file"
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
                {uploading
                  ? "Uploading..."
                  : `Click to upload files${uploadTargetPath.trim() ? ` → ${uploadTargetPath.trim()}` : ""}`}
              </button>

              {/* Uploaded file list */}
              {uploadedFiles.length > 0 && (
                <>
                  <div className="mt-3 space-y-2">
                    {uploadedFiles.map((f) => (
                      <div
                        key={f.stored_path}
                        className="flex items-center justify-between bg-vpn-input rounded-lg px-3 py-2"
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <File className="w-4 h-4 text-vpn-primary flex-shrink-0" />
                          <span className="text-sm text-white truncate">
                            {f.name}
                          </span>
                          {f.target_path && (
                            <span className="text-xs text-vpn-primary/70 font-mono flex-shrink-0">
                              → /{f.target_path}/
                            </span>
                          )}
                          <span className="text-xs text-vpn-muted font-mono flex-shrink-0">
                            {formatFileSize(f.size)}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => removeUploadedFile(f.stored_path)}
                          className="p-1 text-vpn-muted hover:text-red-400 transition-colors flex-shrink-0"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ))}
                  </div>

                  {/* Auto-generate volumes button */}
                  <button
                    type="button"
                    onClick={addVolumesFromUploads}
                    className="mt-3 flex items-center gap-1.5 px-3 py-1.5 text-sm bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
                  >
                    <FolderOpen className="w-3.5 h-3.5 text-vpn-primary" />
                    Generate Volume Mounts
                  </button>
                </>
              )}
            </>
          )}
        </div>

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
      <ActionProgressDialog
        action={uploadProgress?.action}
        target={uploadProgress?.target}
        percent={uploadProgress?.percent}
        finished={uploadProgress?.finished}
        error={uploadProgress?.error}
      />

      {/* Named Volumes Modal */}
      {showVolumeModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4"
          onClick={() => setShowVolumeModal(false)}
        >
          <div
            className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-6 border-b border-vpn-border flex items-center justify-between">
              <div>
                <h2 className="text-lg font-semibold text-white">
                  Named Docker Volumes
                </h2>
                <p className="text-xs text-vpn-muted mt-0.5">
                  Manage volumes with custom drivers (e.g.{" "}
                  <code className="text-vpn-primary/80">local-persist</code>)
                </p>
              </div>
              <button
                type="button"
                onClick={() => setShowVolumeModal(false)}
                className="p-2 text-vpn-muted hover:text-white rounded-lg transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Existing volumes */}
            <div className="p-6 border-b border-vpn-border">
              <h3 className="text-sm font-semibold text-white mb-3">
                Existing Volumes ({namedVolumes.length})
              </h3>
              {namedVolumes.length === 0 ? (
                <EmptyHint
                  label="No named volumes"
                  hint="Create one with the button above, or use a host path mount."
                />
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {namedVolumes.map((v) => (
                    <div
                      key={v.name}
                      className="flex items-center justify-between gap-2 p-3 bg-vpn-input border border-vpn-border rounded-lg"
                    >
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2">
                          <span className="text-white text-sm font-mono truncate">
                            {v.name}
                          </span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-vpn-primary/10 text-vpn-primary border border-vpn-primary/20">
                            {v.driver}
                          </span>
                        </div>
                        {v.mountpoint && (
                          <p className="text-xs text-vpn-muted truncate mt-0.5">
                            {v.mountpoint}
                          </p>
                        )}
                      </div>
                      <button
                        type="button"
                        onClick={() => deleteNamedVolume(v.name)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Create volume form */}
            <div className="p-6 space-y-4">
              <h3 className="text-sm font-semibold text-white">
                Create New Volume
              </h3>

              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1">
                  Name
                </label>
                <input
                  type="text"
                  value={newVolumeForm.name}
                  onChange={(e) =>
                    setNewVolumeForm({ ...newVolumeForm, name: e.target.value })
                  }
                  placeholder="e.g. unionfs"
                  className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-vpn-muted mb-1">
                  Driver
                </label>
                <input
                  type="text"
                  value={newVolumeForm.driver}
                  onChange={(e) =>
                    setNewVolumeForm({
                      ...newVolumeForm,
                      driver: e.target.value,
                    })
                  }
                  placeholder="local | local-persist | nfs"
                  className="w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                />
                <p className="text-xs text-vpn-muted mt-1">
                  Note: Custom drivers like <code>local-persist</code> must be
                  installed on the Docker host as a plugin.
                </p>
              </div>

              <div>
                <div className="flex items-center justify-between mb-2">
                  <label className="block text-sm font-medium text-vpn-muted">
                    Driver Options
                  </label>
                  <button
                    type="button"
                    onClick={addNewVolumeOpt}
                    className="flex items-center gap-1.5 px-2 py-1 text-xs bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all"
                  >
                    <Plus className="w-3 h-3 text-vpn-primary" />
                    Add Option
                  </button>
                </div>
                <p className="text-xs text-vpn-muted mb-2">
                  For local-persist:{" "}
                  <code className="text-vpn-primary/80">mountpoint</code> ={" "}
                  <code className="text-vpn-primary/80">/mnt</code>
                </p>
                <div className="space-y-2">
                  {newVolumeForm.driver_opts.map((o, i) => (
                    <div key={i} className="flex items-center gap-2">
                      <input
                        type="text"
                        value={o.key}
                        onChange={(e) =>
                          updateNewVolumeOpt(i, "key", e.target.value)
                        }
                        placeholder="key (e.g. mountpoint)"
                        className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                      />
                      <span className="text-vpn-muted">=</span>
                      <input
                        type="text"
                        value={o.value}
                        onChange={(e) =>
                          updateNewVolumeOpt(i, "value", e.target.value)
                        }
                        placeholder="value (e.g. /mnt)"
                        className="flex-1 px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm font-mono placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent"
                      />
                      <button
                        type="button"
                        onClick={() => removeNewVolumeOpt(i)}
                        className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="p-6 border-t border-vpn-border flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setShowVolumeModal(false)}
                className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all text-sm"
              >
                Close
              </button>
              <button
                type="button"
                onClick={submitNewVolume}
                disabled={volumeBusy || !newVolumeForm.name.trim()}
                className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2"
              >
                {volumeBusy ? (
                  <Loader2 className="w-4 h-4 text-vpn-primary animate-spin" />
                ) : (
                  <Plus className="w-4 h-4 text-vpn-primary" />
                )}
                Create Volume
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
