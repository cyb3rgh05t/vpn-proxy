import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import {
  Grid3X3,
  ArrowRight,
  Shield,
  Boxes,
  Plus,
  Pencil,
  Trash2,
  X,
  Save,
  Loader2,
} from "lucide-react";
import api from "../services/api";
import CustomDropdown from "../components/CustomDropdown";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";

const RESTART_POLICIES = [
  { value: "no", label: "no" },
  { value: "always", label: "always" },
  { value: "on-failure", label: "on-failure" },
  { value: "unless-stopped", label: "unless-stopped" },
];

const PROTOCOL_OPTIONS = [
  { value: "tcp", label: "tcp" },
  { value: "udp", label: "udp" },
];

const VOLUME_MODES = [
  { value: "rw", label: "rw" },
  { value: "ro", label: "ro" },
];

const emptyTemplate = () => ({
  id: "",
  title: "",
  subtitle: "",
  image: "",
  suggested_name: "",
  restart_policy: "unless-stopped",
  env_vars: [],
  ports: [],
  volumes: [],
  devices: [],
  labels: [],
  is_builtin: false,
});

function ListEditor({ items, fields, onChange, addLabel }) {
  const addRow = () => {
    const row = {};
    fields.forEach((f) => (row[f.key] = f.default ?? ""));
    onChange([...items, row]);
  };
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));
  const updateRow = (idx, key, value) => {
    const next = [...items];
    next[idx] = { ...next[idx], [key]: value };
    onChange(next);
  };

  return (
    <div className="space-y-2">
      {items.map((row, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          {fields.map((f) =>
            f.type === "select" ? (
              <div key={f.key} style={{ width: f.width || 100 }}>
                <CustomDropdown
                  value={row[f.key] ?? f.default ?? ""}
                  onChange={(v) => updateRow(idx, f.key, v)}
                  options={f.options}
                />
              </div>
            ) : (
              <input
                key={f.key}
                type="text"
                value={row[f.key] ?? ""}
                onChange={(e) => updateRow(idx, f.key, e.target.value)}
                placeholder={f.placeholder || f.key}
                className="flex-1 px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text text-sm focus:outline-none focus:border-vpn-primary"
                style={f.width ? { flex: "none", width: f.width } : undefined}
              />
            ),
          )}
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
            title="Remove"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-vpn-primary hover:bg-vpn-primary/10 rounded-lg"
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}

function StringListEditor({ items, onChange, addLabel, placeholder }) {
  const addRow = () => onChange([...items, ""]);
  const removeRow = (idx) => onChange(items.filter((_, i) => i !== idx));
  const updateRow = (idx, value) => {
    const next = [...items];
    next[idx] = value;
    onChange(next);
  };
  return (
    <div className="space-y-2">
      {items.map((value, idx) => (
        <div key={idx} className="flex gap-2 items-center">
          <input
            type="text"
            value={value ?? ""}
            onChange={(e) => updateRow(idx, e.target.value)}
            placeholder={placeholder}
            className="flex-1 px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text text-sm focus:outline-none focus:border-vpn-primary"
          />
          <button
            type="button"
            onClick={() => removeRow(idx)}
            className="p-2 text-red-400 hover:bg-red-500/10 rounded-lg"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      ))}
      <button
        type="button"
        onClick={addRow}
        className="flex items-center gap-2 px-3 py-1.5 text-sm text-vpn-primary hover:bg-vpn-primary/10 rounded-lg"
      >
        <Plus className="w-4 h-4" />
        {addLabel}
      </button>
    </div>
  );
}

function TemplateModal({ initial, isNew, onClose, onSaved }) {
  const toast = useToast();
  const [tpl, setTpl] = useState(() => ({ ...emptyTemplate(), ...initial }));
  const [saving, setSaving] = useState(false);

  const set = (key, value) => setTpl((prev) => ({ ...prev, [key]: value }));

  const save = async (e) => {
    e?.preventDefault?.();
    if (!tpl.title.trim() || !tpl.image.trim()) {
      toast.error("Title and Image are required");
      return;
    }
    if (isNew) {
      const id = (tpl.id || "").trim().toLowerCase();
      if (!id || !/^[a-z0-9][a-z0-9_-]*$/.test(id)) {
        toast.error(
          "ID must be lowercase letters, digits, '-' or '_' (start with a letter/digit)",
        );
        return;
      }
    }
    setSaving(true);
    try {
      const payload = {
        title: tpl.title.trim(),
        subtitle: tpl.subtitle?.trim() || "",
        image: tpl.image.trim(),
        suggested_name: tpl.suggested_name?.trim() || "",
        restart_policy: tpl.restart_policy || "unless-stopped",
        env_vars: tpl.env_vars || [],
        ports: tpl.ports || [],
        volumes: tpl.volumes || [],
        devices: (tpl.devices || []).filter((s) => s && s.trim()),
        labels: tpl.labels || [],
      };
      let res;
      if (isNew) {
        res = await api.post("/app-templates", {
          id: tpl.id.trim().toLowerCase(),
          ...payload,
        });
      } else {
        res = await api.put(
          `/app-templates/${encodeURIComponent(tpl.id)}`,
          payload,
        );
      }
      toast.success(`Template "${res.data.title}" saved`);
      onSaved?.(res.data);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to save template");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm p-4">
      <form
        onSubmit={save}
        className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-3xl max-h-[90vh] overflow-y-auto"
      >
        <div className="flex items-center justify-between p-5 border-b border-vpn-border sticky top-0 bg-vpn-card z-10">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <Boxes className="w-5 h-5 text-vpn-primary" />
            {isNew ? "Create Template" : `Edit Template: ${tpl.title}`}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-vpn-muted hover:text-white rounded-lg"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-5">
          {/* Basic */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {isNew && (
              <div>
                <label className="block text-xs text-vpn-muted mb-1">
                  ID *
                </label>
                <input
                  type="text"
                  value={tpl.id}
                  onChange={(e) => set("id", e.target.value)}
                  placeholder="my-template"
                  className="w-full px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text focus:outline-none focus:border-vpn-primary"
                />
              </div>
            )}
            <div>
              <label className="block text-xs text-vpn-muted mb-1">
                Title *
              </label>
              <input
                type="text"
                value={tpl.title}
                onChange={(e) => set("title", e.target.value)}
                className="w-full px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text focus:outline-none focus:border-vpn-primary"
              />
            </div>
            <div className={isNew ? "md:col-span-2" : "md:col-span-1"}>
              <label className="block text-xs text-vpn-muted mb-1">
                Subtitle
              </label>
              <input
                type="text"
                value={tpl.subtitle}
                onChange={(e) => set("subtitle", e.target.value)}
                className="w-full px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text focus:outline-none focus:border-vpn-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-vpn-muted mb-1">
                Image *
              </label>
              <input
                type="text"
                value={tpl.image}
                onChange={(e) => set("image", e.target.value)}
                placeholder="linuxserver/qbittorrent:latest"
                className="w-full px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text focus:outline-none focus:border-vpn-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-vpn-muted mb-1">
                Suggested Name
              </label>
              <input
                type="text"
                value={tpl.suggested_name}
                onChange={(e) => set("suggested_name", e.target.value)}
                className="w-full px-3 py-2 bg-vpn-bg border border-vpn-border rounded-lg text-vpn-text focus:outline-none focus:border-vpn-primary"
              />
            </div>
            <div>
              <label className="block text-xs text-vpn-muted mb-1">
                Restart Policy
              </label>
              <CustomDropdown
                value={tpl.restart_policy}
                onChange={(v) => set("restart_policy", v)}
                options={RESTART_POLICIES}
              />
            </div>
          </div>

          {/* Env Vars */}
          <div>
            <label className="block text-sm text-white mb-2">
              Environment Variables
            </label>
            <ListEditor
              items={tpl.env_vars || []}
              fields={[
                { key: "key", placeholder: "KEY" },
                { key: "value", placeholder: "value" },
              ]}
              onChange={(v) => set("env_vars", v)}
              addLabel="Add Env Var"
            />
          </div>

          {/* Ports */}
          <div>
            <label className="block text-sm text-white mb-2">Ports</label>
            <ListEditor
              items={tpl.ports || []}
              fields={[
                {
                  key: "host",
                  placeholder: "host port",
                  width: 130,
                },
                {
                  key: "container",
                  placeholder: "container port",
                  width: 130,
                },
                {
                  key: "protocol",
                  type: "select",
                  options: PROTOCOL_OPTIONS,
                  default: "tcp",
                  width: 100,
                },
              ]}
              onChange={(v) => set("ports", v)}
              addLabel="Add Port"
            />
          </div>

          {/* Volumes */}
          <div>
            <label className="block text-sm text-white mb-2">Volumes</label>
            <ListEditor
              items={tpl.volumes || []}
              fields={[
                {
                  key: "source",
                  placeholder: "host path (leave empty for default)",
                },
                { key: "target", placeholder: "/container/path" },
                {
                  key: "mode",
                  type: "select",
                  options: VOLUME_MODES,
                  default: "rw",
                  width: 80,
                },
              ]}
              onChange={(v) => set("volumes", v)}
              addLabel="Add Volume"
            />
          </div>

          {/* Devices */}
          <div>
            <label className="block text-sm text-white mb-2">Devices</label>
            <StringListEditor
              items={tpl.devices || []}
              onChange={(v) => set("devices", v)}
              placeholder="/dev/dri:/dev/dri"
              addLabel="Add Device"
            />
          </div>

          {/* Labels */}
          <div>
            <label className="block text-sm text-white mb-2">Labels</label>
            <ListEditor
              items={tpl.labels || []}
              fields={[
                { key: "key", placeholder: "label.key" },
                { key: "value", placeholder: "label value" },
              ]}
              onChange={(v) => set("labels", v)}
              addLabel="Add Label"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 p-5 border-t border-vpn-border sticky bottom-0 bg-vpn-card">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50"
          >
            {saving ? (
              <Loader2 className="w-4 h-4 animate-spin text-vpn-primary" />
            ) : (
              <Save className="w-4 h-4 text-vpn-primary" />
            )}
            Save
          </button>
        </div>
      </form>
    </div>
  );
}

export default function AppCatalog() {
  const navigate = useNavigate();
  const toast = useToast();
  const confirm = useConfirm();
  const [templates, setTemplates] = useState([]);
  const [loading, setLoading] = useState(true);
  const [modal, setModal] = useState(null); // { initial, isNew }

  const load = async () => {
    setLoading(true);
    try {
      const res = await api.get("/app-templates");
      setTemplates(Array.isArray(res.data) ? res.data : []);
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to load templates");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleDelete = async (tpl) => {
    const ok = await confirm({
      title: "Delete Template",
      message: `Delete template "${tpl.title}"? This cannot be undone.`,
      confirmText: "Delete",
      variant: "danger",
    });
    if (!ok) return;
    try {
      await api.delete(`/app-templates/${encodeURIComponent(tpl.id)}`);
      toast.success(`Template "${tpl.title}" deleted`);
      load();
    } catch (err) {
      toast.error(err.response?.data?.detail || "Failed to delete template");
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-bold text-white flex items-center gap-3">
            <Grid3X3 className="w-7 h-7 text-vpn-primary" />
            App Catalog
          </h1>
          <p className="text-vpn-muted mt-1">
            Install any Docker app from a prepared template and route it through
            VPN or a proxy, just like O11.
          </p>
        </div>
        <button
          onClick={() => setModal({ initial: emptyTemplate(), isNew: true })}
          className="flex items-center gap-2 px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
        >
          <Plus className="w-4 h-4 text-vpn-primary" />
          Add Template
        </button>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-300 mt-0.5" />
        <p className="text-sm text-blue-200">
          Recommendation: pick the "VPN Route" mode in the installer so the
          container runs through your Gluetun tunnel.
        </p>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-vpn-muted">
          <Loader2 className="w-5 h-5 animate-spin mr-2" />
          Loading templates...
        </div>
      ) : templates.length === 0 ? (
        <div className="bg-vpn-card border border-vpn-border rounded-2xl p-10 text-center text-vpn-muted">
          No templates yet. Click "Add Template" to create your first one.
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {templates.map((tpl) => (
            <article
              key={tpl.id}
              className="bg-vpn-card border border-vpn-border rounded-xl p-5 flex flex-col"
            >
              <div className="flex items-start justify-between gap-3 mb-3">
                <div>
                  <h2 className="text-lg font-semibold text-white">
                    {tpl.title}
                  </h2>
                  <p className="text-xs text-vpn-muted">{tpl.subtitle}</p>
                </div>
                <span className="text-[10px] px-2 py-1 rounded-full bg-vpn-primary/15 text-vpn-primary border border-vpn-primary/30 uppercase tracking-wider">
                  {tpl.is_builtin ? "Built-in" : "Custom"}
                </span>
              </div>

              <div className="space-y-2 text-xs text-vpn-muted mb-4">
                <p className="truncate">
                  <span className="text-vpn-text">Image:</span> {tpl.image}
                </p>
                <p>
                  <span className="text-vpn-text">Ports:</span>{" "}
                  {(tpl.ports || []).length}
                </p>
                <p>
                  <span className="text-vpn-text">Volumes:</span>{" "}
                  {(tpl.volumes || []).length}
                </p>
              </div>

              <div className="mt-auto flex gap-2">
                <button
                  onClick={() =>
                    navigate(`/create-o11?template=${tpl.id}&type=app`)
                  }
                  className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm text-sm"
                >
                  Install
                  <ArrowRight className="w-4 h-4 text-vpn-primary" />
                </button>
                <button
                  onClick={() => setModal({ initial: tpl, isNew: false })}
                  className="px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
                  title="Edit template"
                >
                  <Pencil className="w-4 h-4 text-vpn-primary" />
                </button>
                <button
                  onClick={() => handleDelete(tpl)}
                  className="px-3 py-2 bg-vpn-card border border-vpn-border hover:border-red-500 text-vpn-text rounded-lg transition-all shadow-sm"
                  title="Delete template"
                >
                  <Trash2 className="w-4 h-4 text-red-400" />
                </button>
              </div>
            </article>
          ))}
        </div>
      )}

      {modal && (
        <TemplateModal
          initial={modal.initial}
          isNew={modal.isNew}
          onClose={() => setModal(null)}
          onSaved={() => {
            setModal(null);
            load();
          }}
        />
      )}
    </div>
  );
}
