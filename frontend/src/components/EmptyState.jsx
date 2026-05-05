/**
 * Generic empty state used when a page has no content yet.
 *
 * Props:
 *   icon: lucide icon component
 *   title: main headline
 *   description: secondary text
 *   actions: optional array of { label, icon, onClick, primary }
 */
export default function EmptyState({
  icon: Icon,
  title,
  description,
  actions = [],
  className = "",
}) {
  return (
    <div
      className={`bg-vpn-card border border-vpn-border rounded-2xl p-12 text-center ${className}`}
    >
      {Icon && (
        <Icon className="w-14 h-14 text-vpn-muted mx-auto mb-4 opacity-40" />
      )}
      {title && (
        <h3 className="text-lg font-semibold text-white mb-2">{title}</h3>
      )}
      {description && (
        <p className="text-vpn-muted text-sm mb-6 max-w-md mx-auto">
          {description}
        </p>
      )}
      {actions.length > 0 && (
        <div className="flex flex-wrap items-center justify-center gap-2">
          {actions.map(({ label, icon: ActionIcon, onClick, primary }) => (
            <button
              key={label}
              onClick={onClick}
              className={`inline-flex items-center gap-2 px-5 py-2.5 rounded-lg transition-all shadow-sm text-sm ${
                primary
                  ? "bg-vpn-primary text-black font-semibold hover:opacity-90"
                  : "bg-vpn-card border border-vpn-border hover:border-vpn-primary text-vpn-text"
              }`}
            >
              {ActionIcon && (
                <ActionIcon
                  className={`w-4 h-4 ${primary ? "" : "text-vpn-primary"}`}
                />
              )}
              {label}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
