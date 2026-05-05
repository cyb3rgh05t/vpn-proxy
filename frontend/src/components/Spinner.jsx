import { RefreshCw } from "lucide-react";

/**
 * Global spinner used across the UI. Matches the style of the
 * ActionProgressDialog (RefreshCw icon spinning in vpn-primary).
 *
 * size: "xs" | "sm" | "md" | "lg" | "xl"
 */
const SIZES = {
  xs: "w-3 h-3",
  sm: "w-4 h-4",
  md: "w-6 h-6",
  lg: "w-10 h-10",
  xl: "w-12 h-12",
};

export default function Spinner({
  size = "md",
  className = "",
  fullPage = false,
  label,
}) {
  const sizeClass = SIZES[size] || SIZES.md;
  const node = (
    <RefreshCw
      className={`${sizeClass} text-vpn-primary animate-spin ${className}`}
    />
  );

  if (fullPage) {
    return (
      <div className="flex flex-col items-center justify-center py-12 gap-3">
        {node}
        {label && <p className="text-sm text-vpn-muted">{label}</p>}
      </div>
    );
  }
  return node;
}
