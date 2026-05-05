import { Network as NetworkIcon, Globe, Shield } from "lucide-react";

/**
 * Default Traefik config — matches the user's existing label scheme:
 *   traefik.enable=true
 *   traefik.docker.network=proxy
 *   traefik.http.routers.<svc>-rtr.entrypoints=https
 *   traefik.http.routers.<svc>-rtr.rule=Host(`<sub>.${DOMAIN}`)
 *   traefik.http.routers.<svc>-rtr.tls=true
 *   traefik.http.routers.<svc>-rtr.tls.certresolver=dns-cloudflare
 *   traefik.http.routers.<svc>-rtr.middlewares=chain-authelia@file
 *   traefik.http.routers.<svc>-rtr.service=<svc>-svc
 *   traefik.http.services.<svc>-svc.loadbalancer.server.port=<port>
 */
export const DEFAULT_TRAEFIK = {
  enabled: false,
  service: "", // defaults to container name
  subdomain: "", // defaults to container name
  domainVar: "${DOMAIN}",
  port: "",
  network: "proxy",
  entrypoint: "https",
  tls: true,
  certResolver: "dns-cloudflare",
  middlewares: "chain-authelia@file",
};

/**
 * Generate the Docker labels object from a Traefik config.
 * Returns an empty object when disabled or invalid.
 */
export function traefikLabelsFrom(cfg, fallbackName) {
  if (!cfg || !cfg.enabled) return {};
  const svc = (cfg.service || fallbackName || "").trim();
  const sub = (cfg.subdomain || svc).trim();
  if (!svc || !sub) return {};

  const labels = {
    "traefik.enable": "true",
  };
  if (cfg.network && cfg.network.trim()) {
    labels["traefik.docker.network"] = cfg.network.trim();
  }
  const router = `traefik.http.routers.${svc}-rtr`;
  if (cfg.entrypoint && cfg.entrypoint.trim()) {
    labels[`${router}.entrypoints`] = cfg.entrypoint.trim();
  }
  labels[`${router}.rule`] = `Host(\`${sub}.${cfg.domainVar || "${DOMAIN}"}\`)`;
  if (cfg.tls) {
    labels[`${router}.tls`] = "true";
    if (cfg.certResolver && cfg.certResolver.trim()) {
      labels[`${router}.tls.certresolver`] = cfg.certResolver.trim();
    }
  }
  if (cfg.middlewares && cfg.middlewares.trim()) {
    labels[`${router}.middlewares`] = cfg.middlewares.trim();
  }
  labels[`${router}.service`] = `${svc}-svc`;
  if (cfg.port && String(cfg.port).trim()) {
    labels[`traefik.http.services.${svc}-svc.loadbalancer.server.port`] =
      String(cfg.port).trim();
  }
  return labels;
}

export default function TraefikSection({
  value,
  onChange,
  containerName,
  inputClass,
  labelClass,
}) {
  const cfg = value || DEFAULT_TRAEFIK;
  const set = (patch) => onChange({ ...cfg, ...patch });
  const fallbackSvc = (cfg.service || containerName || "").trim();
  const fallbackSub = (cfg.subdomain || fallbackSvc).trim();

  const previewLabels = traefikLabelsFrom(cfg, containerName);
  const previewEntries = Object.entries(previewLabels);

  const baseInput =
    inputClass ||
    "w-full px-3 py-2 bg-vpn-input border border-vpn-border rounded-lg text-white text-sm placeholder-vpn-muted focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent";
  const baseLabel =
    labelClass || "block text-xs font-medium text-vpn-muted mb-1";

  return (
    <div className="bg-vpn-card border border-vpn-border rounded-2xl p-6 mb-6">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-3">
          <NetworkIcon className="w-5 h-5 text-vpn-primary" />
          <div>
            <h2 className="text-lg font-semibold text-white">
              Traefik Reverse Proxy
            </h2>
            <p className="text-xs text-vpn-muted mt-0.5">
              Auto-generate Traefik labels for HTTPS routing through your proxy
              network.
            </p>
          </div>
        </div>
        <button
          type="button"
          onClick={() => set({ enabled: !cfg.enabled })}
          aria-pressed={!!cfg.enabled}
          className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
            cfg.enabled ? "bg-vpn-primary" : "bg-vpn-border"
          }`}
        >
          <span
            className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
              cfg.enabled ? "translate-x-6" : "translate-x-1"
            }`}
          />
        </button>
      </div>

      {!cfg.enabled ? (
        <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-vpn-border/70 rounded-lg bg-vpn-input/30 text-vpn-muted">
          <Globe className="w-5 h-5 text-vpn-muted/70" />
          <div className="text-sm">
            Traefik integration is <span className="font-semibold">off</span>.
            Enable to expose this container via your reverse proxy.
          </div>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className={baseLabel}>Service name</label>
              <input
                type="text"
                value={cfg.service}
                onChange={(e) => set({ service: e.target.value })}
                placeholder={containerName || "tempest"}
                className={baseInput}
              />
              <p className="text-[11px] text-vpn-muted/70 mt-1">
                Used in <code>{`<svc>-rtr`}</code> / <code>{`<svc>-svc`}</code>.
                Defaults to container name.
              </p>
            </div>

            <div>
              <label className={baseLabel}>Subdomain</label>
              <div className="flex items-center gap-2">
                <input
                  type="text"
                  value={cfg.subdomain}
                  onChange={(e) => set({ subdomain: e.target.value })}
                  placeholder={fallbackSvc || "tempest"}
                  className={`${baseInput} flex-1`}
                />
                <span className="text-vpn-muted text-sm">.</span>
                <input
                  type="text"
                  value={cfg.domainVar}
                  onChange={(e) => set({ domainVar: e.target.value })}
                  placeholder="${DOMAIN}"
                  className={`${baseInput} w-40 font-mono text-xs`}
                />
              </div>
              <p className="text-[11px] text-vpn-muted/70 mt-1">
                Final host: <code>{fallbackSub || "<svc>"}.</code>
                <code>{cfg.domainVar || "${DOMAIN}"}</code>
              </p>
            </div>

            <div>
              <label className={baseLabel}>Container port</label>
              <input
                type="text"
                value={cfg.port}
                onChange={(e) => set({ port: e.target.value })}
                placeholder="8095"
                className={baseInput}
              />
              <p className="text-[11px] text-vpn-muted/70 mt-1">
                The internal port Traefik should forward to.
              </p>
            </div>

            <div>
              <label className={baseLabel}>Docker network</label>
              <input
                type="text"
                value={cfg.network}
                onChange={(e) => set({ network: e.target.value })}
                placeholder="proxy"
                className={baseInput}
              />
            </div>

            <div>
              <label className={baseLabel}>Entrypoint</label>
              <input
                type="text"
                value={cfg.entrypoint}
                onChange={(e) => set({ entrypoint: e.target.value })}
                placeholder="https"
                className={baseInput}
              />
            </div>

            <div>
              <label className={baseLabel}>Cert resolver</label>
              <input
                type="text"
                value={cfg.certResolver}
                onChange={(e) => set({ certResolver: e.target.value })}
                placeholder="dns-cloudflare"
                className={baseInput}
                disabled={!cfg.tls}
              />
            </div>

            <div className="md:col-span-2">
              <label className={baseLabel}>Middlewares</label>
              <input
                type="text"
                value={cfg.middlewares}
                onChange={(e) => set({ middlewares: e.target.value })}
                placeholder="chain-authelia@file"
                className={baseInput}
              />
              <p className="text-[11px] text-vpn-muted/70 mt-1">
                Comma-separated middleware chain. Leave empty to skip.
              </p>
            </div>

            <div className="md:col-span-2 flex items-center justify-between bg-vpn-input/40 border border-vpn-border rounded-lg px-4 py-3">
              <div className="flex items-center gap-2">
                <Shield className="w-4 h-4 text-vpn-primary" />
                <span className="text-sm text-white font-medium">
                  Enable TLS
                </span>
              </div>
              <button
                type="button"
                onClick={() => set({ tls: !cfg.tls })}
                aria-pressed={!!cfg.tls}
                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${
                  cfg.tls ? "bg-vpn-primary" : "bg-vpn-border"
                }`}
              >
                <span
                  className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                    cfg.tls ? "translate-x-6" : "translate-x-1"
                  }`}
                />
              </button>
            </div>
          </div>

          {/* Preview */}
          <div className="mt-5 border-t border-vpn-border pt-4">
            <div className="text-xs font-semibold text-vpn-muted mb-2">
              Generated labels ({previewEntries.length})
            </div>
            <div className="bg-vpn-input/40 border border-vpn-border rounded-lg p-3 max-h-64 overflow-y-auto font-mono text-[11px] leading-relaxed">
              {previewEntries.length === 0 ? (
                <span className="text-vpn-muted">
                  Fill in service name and host to preview labels.
                </span>
              ) : (
                previewEntries.map(([k, v]) => (
                  <div key={k} className="text-vpn-text break-all">
                    <span className="text-vpn-primary">{k}</span>
                    <span className="text-vpn-muted">=</span>
                    <span>{v}</span>
                  </div>
                ))
              )}
            </div>
            <p className="text-[11px] text-vpn-muted/70 mt-2">
              These labels will be merged into the container at create time.
            </p>
          </div>
        </>
      )}
    </div>
  );
}
