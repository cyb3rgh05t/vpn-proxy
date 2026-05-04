import { useState, useEffect, useRef } from "react";
import { useToast } from "../context/ToastContext";
import { useConfirm } from "../context/ConfirmContext";
import {
  Download,
  Upload,
  Save,
  Trash2,
  RefreshCw,
  HardDrive,
  FileJson,
  Clock,
  CheckCircle,
  AlertCircle,
} from "lucide-react";
import api from "../services/api";

function formatBytes(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function formatDate(iso) {
  return new Date(iso).toLocaleString();
}

export default function Backup() {
  const toast = useToast();
  const confirm = useConfirm();
  const fileInputRef = useRef(null);

  const [backups, setBackups] = useState([]);
  const [loadingList, setLoadingList] = useState(false);
  const [savingLabel, setSavingLabel] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [importing, setImporting] = useState(false);
  const [deletingFile, setDeletingFile] = useState(null);
  const [downloadingFile, setDownloadingFile] = useState(null);

  const loadBackups = async () => {
    setLoadingList(true);
    try {
      const res = await api.get("/backup/list");
      setBackups(res.data);
    } catch {
      toast.error("Backup-Liste konnte nicht geladen werden");
    } finally {
      setLoadingList(false);
    }
  };

  useEffect(() => {
    loadBackups();
  }, []);

  // ---- Export (browser download) ----
  const handleExport = async () => {
    setExporting(true);
    try {
      const res = await api.get("/backup/export", { responseType: "blob" });
      const disposition = res.headers["content-disposition"] || "";
      const match = disposition.match(/filename="([^"]+)"/);
      const filename = match ? match[1] : "vpnproxy_backup.json";
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
      toast.success("Backup heruntergeladen");
    } catch {
      toast.error("Export fehlgeschlagen");
    } finally {
      setExporting(false);
    }
  };

  // ---- Import (file upload) ----
  const handleImportClick = () => fileInputRef.current?.click();

  const handleFileChange = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    e.target.value = "";

    const ok = await confirm({
      title: "Backup wiederherstellen?",
      message:
        "Alle bestehenden Einstellungen und Container-Konfigurationen werden überschrieben. Laufende Container sind nicht betroffen.",
      confirmLabel: "Wiederherstellen",
      variant: "danger",
    });
    if (!ok) return;

    setImporting(true);
    try {
      const formData = new FormData();
      formData.append("file", file);
      const res = await api.post("/backup/import", formData, {
        headers: { "Content-Type": "multipart/form-data" },
      });
      const { restored } = res.data;
      toast.success(
        `Backup wiederhergestellt: ${restored.settings} Einstellungen, ${restored.vpn_containers} VPN-Container (${restored.cert_files} Zertifikatsdateien), ${restored.o11_containers} OTT-Container, ${restored.users} Benutzer, ${restored.api_keys} API-Keys`,
      );
    } catch (err) {
      toast.error(err.response?.data?.detail || "Import fehlgeschlagen");
    } finally {
      setImporting(false);
    }
  };

  // ---- Save to server ----
  const handleSaveToServer = async () => {
    setSaving(true);
    try {
      const res = await api.post("/backup/save", { label: savingLabel });
      toast.success(`Backup gespeichert: ${res.data.filename}`);
      setSavingLabel("");
      await loadBackups();
    } catch {
      toast.error("Speichern fehlgeschlagen");
    } finally {
      setSaving(false);
    }
  };

  // ---- Download server backup ----
  const handleDownloadServer = async (filename) => {
    setDownloadingFile(filename);
    try {
      const res = await api.get(
        `/backup/download/${encodeURIComponent(filename)}`,
        {
          responseType: "blob",
        },
      );
      const url = URL.createObjectURL(
        new Blob([res.data], { type: "application/json" }),
      );
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.click();
      URL.revokeObjectURL(url);
    } catch {
      toast.error("Download fehlgeschlagen");
    } finally {
      setDownloadingFile(null);
    }
  };

  // ---- Delete server backup ----
  const handleDelete = async (filename) => {
    const ok = await confirm({
      title: "Backup löschen?",
      message: `"${filename}" wird dauerhaft gelöscht.`,
      confirmLabel: "Löschen",
      variant: "danger",
    });
    if (!ok) return;

    setDeletingFile(filename);
    try {
      await api.delete(`/backup/${encodeURIComponent(filename)}`);
      toast.success("Backup gelöscht");
      setBackups((prev) => prev.filter((b) => b.filename !== filename));
    } catch {
      toast.error("Löschen fehlgeschlagen");
    } finally {
      setDeletingFile(null);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-white">Backup & Restore</h1>
        <p className="text-sm text-vpn-muted mt-1">
          Einstellungen, VPN-Proxy- und OTT-Container-Konfigurationen sichern
          und wiederherstellen.
        </p>
      </div>

      {/* Quick actions */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        {/* Export */}
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-vpn-primary/15 flex items-center justify-center">
              <Download className="w-5 h-5 text-vpn-primary" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Export</h2>
              <p className="text-xs text-vpn-muted">
                Als JSON-Datei herunterladen
              </p>
            </div>
          </div>
          <button
            onClick={handleExport}
            disabled={exporting}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm disabled:opacity-50 disabled:cursor-not-allowed text-sm"
          >
            {exporting ? (
              <RefreshCw className="w-4 h-4 text-vpn-primary animate-spin" />
            ) : (
              <Download className="w-4 h-4 text-vpn-primary" />
            )}
            {exporting ? "Exportiere..." : "Backup herunterladen"}
          </button>
        </div>

        {/* Import */}
        <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 space-y-3">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-500/15 flex items-center justify-center">
              <Upload className="w-5 h-5 text-amber-400" />
            </div>
            <div>
              <h2 className="text-base font-semibold text-white">Import</h2>
              <p className="text-xs text-vpn-muted">
                Backup-Datei hochladen &amp; wiederherstellen
              </p>
            </div>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept=".json"
            className="hidden"
            onChange={handleFileChange}
          />
          <button
            onClick={handleImportClick}
            disabled={importing}
            className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-amber-500/20 text-amber-300 font-semibold text-sm border border-amber-500/30 hover:bg-amber-500/30 disabled:opacity-50 transition-colors"
          >
            {importing ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Upload className="w-4 h-4" />
            )}
            {importing ? "Wiederherstelle..." : "Backup hochladen"}
          </button>
        </div>
      </div>

      {/* Save to server */}
      <div className="bg-vpn-card border border-vpn-border rounded-xl p-5 space-y-4">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-lg bg-blue-500/15 flex items-center justify-center">
            <HardDrive className="w-5 h-5 text-blue-400" />
          </div>
          <div>
            <h2 className="text-base font-semibold text-white">
              Auf Server speichern
            </h2>
            <p className="text-xs text-vpn-muted">
              Aktuellen Stand als Backup im Server-Dateisystem ablegen (max. 20
              Backups)
            </p>
          </div>
        </div>
        <div className="flex gap-3">
          <input
            type="text"
            value={savingLabel}
            onChange={(e) => setSavingLabel(e.target.value)}
            placeholder="Optionaler Name (z.B. vor-update)"
            maxLength={50}
            className="flex-1 bg-vpn-input border border-vpn-border rounded-lg px-3 py-2 text-sm text-white placeholder-vpn-muted focus:outline-none focus:border-vpn-primary"
          />
          <button
            onClick={handleSaveToServer}
            disabled={saving}
            className="flex items-center gap-2 px-4 py-2 rounded-lg bg-blue-600/20 text-blue-300 font-semibold text-sm border border-blue-500/30 hover:bg-blue-600/30 disabled:opacity-50 transition-colors whitespace-nowrap"
          >
            {saving ? (
              <RefreshCw className="w-4 h-4 animate-spin" />
            ) : (
              <Save className="w-4 h-4" />
            )}
            {saving ? "Speichere..." : "Speichern"}
          </button>
        </div>
      </div>

      {/* Server backup list */}
      <div className="bg-vpn-card border border-vpn-border rounded-xl overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-vpn-border">
          <div className="flex items-center gap-2">
            <FileJson className="w-4 h-4 text-vpn-primary" />
            <h2 className="text-base font-semibold text-white">
              Gespeicherte Backups
            </h2>
            <span className="text-xs bg-vpn-primary/15 text-vpn-primary px-2 py-0.5 rounded-full">
              {backups.length}
            </span>
          </div>
          <button
            onClick={loadBackups}
            disabled={loadingList}
            className="p-1.5 rounded-lg text-vpn-muted hover:text-vpn-primary transition-colors"
            title="Aktualisieren"
          >
            <RefreshCw
              className={`w-4 h-4 ${loadingList ? "animate-spin" : ""}`}
            />
          </button>
        </div>

        {loadingList ? (
          <div className="flex items-center justify-center py-12">
            <RefreshCw className="w-6 h-6 text-vpn-primary animate-spin" />
          </div>
        ) : backups.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 text-vpn-muted gap-2">
            <HardDrive className="w-8 h-8 opacity-40" />
            <p className="text-sm">Keine Backups vorhanden</p>
          </div>
        ) : (
          <ul className="divide-y divide-vpn-border">
            {backups.map((b) => (
              <li
                key={b.filename}
                className="flex items-center gap-4 px-5 py-3 hover:bg-vpn-bg/40 transition-colors"
              >
                <FileJson className="w-4 h-4 text-vpn-muted shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">
                    {b.filename}
                  </p>
                  <div className="flex items-center gap-3 mt-0.5 text-xs text-vpn-muted">
                    <span className="flex items-center gap-1">
                      <Clock className="w-3 h-3" />
                      {formatDate(b.modified_at)}
                    </span>
                    <span>{formatBytes(b.size)}</span>
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <button
                    onClick={() => handleDownloadServer(b.filename)}
                    disabled={downloadingFile === b.filename}
                    className="p-1.5 rounded-lg text-vpn-muted hover:text-vpn-primary transition-colors"
                    title="Herunterladen"
                  >
                    {downloadingFile === b.filename ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Download className="w-4 h-4" />
                    )}
                  </button>
                  <button
                    onClick={() => handleDelete(b.filename)}
                    disabled={deletingFile === b.filename}
                    className="p-1.5 rounded-lg text-vpn-muted hover:text-red-400 transition-colors"
                    title="Löschen"
                  >
                    {deletingFile === b.filename ? (
                      <RefreshCw className="w-4 h-4 animate-spin" />
                    ) : (
                      <Trash2 className="w-4 h-4" />
                    )}
                  </button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* Info box */}
      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex gap-3">
        <AlertCircle className="w-4 h-4 text-blue-400 mt-0.5 shrink-0" />
        <div className="text-xs text-blue-300 space-y-1">
          <p>
            <strong>Was wird gesichert:</strong> Alle App-Einstellungen
            (O11-Instanzen, Telegram, Docker-Images, Portainer-URL), VPN-Proxy-
            und OTT-Container-Konfigurationen, VPN-Zertifikatsdateien (.ovpn,
            .conf, .key, .crt …), Benutzerkonten (Passwort-Hashes) und API-Keys.
          </p>
          <p>
            <strong>Was wird nicht gesichert:</strong> Laufende
            Container-Zustände, aktive JWT-Sessions und Gluetun-interne
            Laufzeitdaten.
          </p>
        </div>
      </div>
    </div>
  );
}
