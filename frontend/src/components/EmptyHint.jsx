import { Inbox } from "lucide-react";

/**
 * Visual placeholder for empty list-style sections
 * (Extra Hosts, Devices, Capabilities, Custom Labels, etc.).
 * Replaces tiny gray "No X configured." text with a clearly visible
 * dashed-border block.
 */
export default function EmptyHint({ icon: Icon = Inbox, label, hint }) {
  return (
    <div className="flex items-center gap-3 px-4 py-3 border border-dashed border-vpn-border/70 rounded-lg bg-vpn-input/30 text-vpn-muted">
      <Icon className="w-5 h-5 text-vpn-muted/70 flex-shrink-0" />
      <div className="text-sm">
        <div className="font-medium text-vpn-muted">{label}</div>
        {hint && (
          <div className="text-xs text-vpn-muted/70 mt-0.5">{hint}</div>
        )}
      </div>
    </div>
  );
}
