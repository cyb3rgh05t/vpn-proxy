export default function StatusBadge({ status }) {
  const styles = {
    running: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    healthy: "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
    unhealthy: "bg-red-500/15 text-red-400 border-red-500/30",
    starting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    exited: "bg-red-500/15 text-red-400 border-red-500/30",
    created: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    restarting: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    paused: "bg-amber-500/15 text-amber-400 border-amber-500/30",
    removing: "bg-red-500/15 text-red-400 border-red-500/30",
    dead: "bg-red-500/15 text-red-400 border-red-500/30",
    unknown: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    removed: "bg-slate-500/15 text-slate-400 border-slate-500/30",
    error: "bg-red-500/15 text-red-400 border-red-500/30",
  };

  const dotColor =
    status === "running" || status === "healthy"
      ? "bg-emerald-400 animate-pulse"
      : status === "exited" ||
          status === "dead" ||
          status === "error" ||
          status === "unhealthy"
        ? "bg-red-400"
        : status === "restarting" ||
            status === "paused" ||
            status === "starting"
          ? "bg-amber-400 animate-pulse"
          : "bg-slate-400";

  const label = status
    ? status.charAt(0).toUpperCase() + status.slice(1)
    : "Unknown";

  return (
    <span
      className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full border ${
        styles[status] || styles.unknown
      }`}
    >
      <span className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
      {label}
    </span>
  );
}
