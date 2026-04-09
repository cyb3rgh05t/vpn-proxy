import { RefreshCw, Check, X } from "lucide-react";

const ACTION_LABELS = {
  start: "Starting",
  stop: "Stopping",
  restart: "Restarting",
  redeploy: "Redeploying",
  delete: "Deleting",
  discover: "Discovering",
  refresh: "Refreshing",
};

/**
 * ActionProgressDialog — shows a modal overlay while an action is in progress.
 *
 * Props:
 *  - action     : string | null  — current action key (e.g. "start"). null = hidden.
 *  - target     : string         — container / item name shown in the dialog
 *  - total      : number | null  — for bulk: total items
 *  - done       : number | null  — for bulk: completed items
 *  - success    : number | null  — for bulk: succeeded count
 *  - failed     : number | null  — for bulk: failed count
 *  - finished   : bool           — true when action completed (shows result briefly)
 *  - error      : string | null  — error message if action failed
 */
export default function ActionProgressDialog({
  action,
  target,
  total = null,
  done = null,
  success = null,
  failed = null,
  finished = false,
  error = null,
}) {
  if (!action) return null;

  const label = ACTION_LABELS[action] || action;
  const isBulk = total != null && total > 0;
  const pct = isBulk && total > 0 ? Math.round((done / total) * 100) : 0;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="bg-vpn-card border border-vpn-border rounded-2xl p-8 w-full max-w-md mx-4 shadow-2xl">
        <div className="flex flex-col items-center text-center">
          {/* Icon */}
          <div className="mb-4">
            {finished && !error ? (
              <div className="w-10 h-10 rounded-full bg-emerald-500/20 flex items-center justify-center">
                <Check className="w-6 h-6 text-emerald-400" />
              </div>
            ) : finished && error ? (
              <div className="w-10 h-10 rounded-full bg-red-500/20 flex items-center justify-center">
                <X className="w-6 h-6 text-red-400" />
              </div>
            ) : (
              <RefreshCw className="w-10 h-10 text-vpn-primary animate-spin" />
            )}
          </div>

          {/* Title */}
          <h3 className="text-lg font-semibold text-white mb-1">
            {finished && !error
              ? `${target ? target + " " : ""}${label.replace(/ing$/, "ed")} Successfully`
              : finished && error
                ? `Failed to ${action} ${target || ""}`
                : `${label} ${target || ""}...`}
          </h3>

          {/* Subtitle */}
          {!finished && !isBulk && (
            <p className="text-sm text-vpn-muted mb-2">
              Please wait while the action completes
            </p>
          )}

          {/* Error message */}
          {error && <p className="text-sm text-red-400 mb-2">{error}</p>}

          {/* Bulk progress */}
          {isBulk && (
            <>
              <p className="text-sm text-vpn-muted mb-4">
                {done} of {total} completed
              </p>
              <div className="w-full bg-vpn-input rounded-full h-3 mb-4 overflow-hidden">
                <div
                  className="h-full bg-vpn-primary rounded-full transition-all duration-300"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="flex items-center gap-4 text-sm">
                {success > 0 && (
                  <span className="text-emerald-400">{success} succeeded</span>
                )}
                {failed > 0 && (
                  <span className="text-red-400">{failed} failed</span>
                )}
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  );
}
