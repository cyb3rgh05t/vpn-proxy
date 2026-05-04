import { useNavigate } from "react-router-dom";
import { Grid3X3, ArrowRight, Shield, Boxes } from "lucide-react";
import { APP_TEMPLATES } from "../data/appTemplates";

export default function AppCatalog() {
  const navigate = useNavigate();

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-white flex items-center gap-3">
          <Grid3X3 className="w-7 h-7 text-vpn-primary" />
          App Catalog
        </h1>
        <p className="text-vpn-muted mt-1">
          Installiere beliebige Docker-Apps mit vorbereiteten Templates und
          verbinde sie wie O11 mit VPN oder Proxy.
        </p>
      </div>

      <div className="bg-blue-500/10 border border-blue-500/20 rounded-xl p-4 flex items-start gap-3">
        <Shield className="w-5 h-5 text-blue-300 mt-0.5" />
        <p className="text-sm text-blue-200">
          Empfehlung: Wähle im Installer den Modus "VPN Route", damit der
          Container über deinen Gluetun-Tunnel läuft.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
        {APP_TEMPLATES.map((tpl) => (
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
                Template
              </span>
            </div>

            <div className="space-y-2 text-xs text-vpn-muted mb-4">
              <p className="truncate">
                <span className="text-vpn-text">Image:</span> {tpl.image}
              </p>
              <p>
                <span className="text-vpn-text">Ports:</span> {tpl.ports.length}
              </p>
              <p>
                <span className="text-vpn-text">Volumes:</span>{" "}
                {tpl.volumes.length}
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
                onClick={() => navigate("/create-o11")}
                className="px-3 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text rounded-lg transition-all shadow-sm"
                title="Open generic installer"
              >
                <Boxes className="w-4 h-4 text-vpn-primary" />
              </button>
            </div>
          </article>
        ))}
      </div>
    </div>
  );
}
