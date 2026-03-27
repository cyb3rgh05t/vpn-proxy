import { useNavigate } from "react-router-dom";
import { Play, Square, RotateCcw, Trash2, Eye } from "lucide-react";
import StatusBadge from "./StatusBadge";
import api from "../services/api";

export default function ContainerCard({ container, onRefresh }) {
  const navigate = useNavigate();

  const handleAction = async (e, action) => {
    e.stopPropagation();
    try {
      await api.post(`/containers/${container.id}/${action}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || `Failed to ${action} container`);
    }
  };

  const handleDelete = async (e) => {
    e.stopPropagation();
    if (
      !confirm(`Delete container "${container.name}"? This cannot be undone.`)
    )
      return;
    try {
      await api.delete(`/containers/${container.id}`);
      onRefresh();
    } catch (err) {
      alert(err.response?.data?.detail || "Failed to delete container");
    }
  };

  const isRunning = container.status === "running";
  const isStopped = ["exited", "created", "removed", "dead"].includes(
    container.status,
  );

  return (
    <div
      onClick={() => navigate(`/containers/${container.id}`)}
      className="bg-vpn-card border border-vpn-border rounded-xl p-5 hover:border-vpn-muted transition-all cursor-pointer group"
    >
      <div className="flex items-start justify-between mb-4">
        <div>
          <h3 className="text-lg font-semibold text-white group-hover:text-vpn-primary transition-colors">
            {container.name}
          </h3>
          <p className="text-sm text-vpn-muted mt-0.5">
            {container.vpn_provider}
          </p>
        </div>
        <StatusBadge status={container.status} />
      </div>

      <div className="grid grid-cols-2 gap-2 mb-4 text-sm">
        <div className="text-vpn-muted">
          Type: <span className="text-vpn-text">{container.vpn_type}</span>
        </div>
        <div className="text-vpn-muted">
          HTTP:{" "}
          <span className="text-vpn-text">:{container.port_http_proxy}</span>
        </div>
        <div className="text-vpn-muted">
          SOCKS:{" "}
          <span className="text-vpn-text">:{container.port_shadowsocks}</span>
        </div>
        <div className="text-vpn-muted">
          Control:{" "}
          <span className="text-vpn-text">:{container.port_control}</span>
        </div>
      </div>

      <div className="flex items-center gap-2 pt-3 border-t border-vpn-border">
        <button
          onClick={(e) => {
            e.stopPropagation();
            navigate(`/containers/${container.id}`);
          }}
          className="p-2 rounded-lg text-vpn-muted hover:bg-vpn-input hover:text-white transition-colors"
          title="View Details"
        >
          <Eye className="w-4 h-4" />
        </button>
        {isStopped && (
          <button
            onClick={(e) => handleAction(e, "start")}
            className="p-2 rounded-lg text-emerald-400 hover:bg-emerald-500/10 transition-colors"
            title="Start"
          >
            <Play className="w-4 h-4" />
          </button>
        )}
        {isRunning && (
          <button
            onClick={(e) => handleAction(e, "stop")}
            className="p-2 rounded-lg text-amber-400 hover:bg-amber-500/10 transition-colors"
            title="Stop"
          >
            <Square className="w-4 h-4" />
          </button>
        )}
        <button
          onClick={(e) => handleAction(e, "restart")}
            className="p-2 rounded-lg text-vpn-primary hover:bg-vpn-primary/10 transition-colors"
          title="Restart"
        >
          <RotateCcw className="w-4 h-4" />
        </button>
        <button
          onClick={handleDelete}
          className="p-2 rounded-lg text-red-400 hover:bg-red-500/10 transition-colors ml-auto"
          title="Delete"
        >
          <Trash2 className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}
