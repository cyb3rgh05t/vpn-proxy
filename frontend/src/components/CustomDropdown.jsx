import { useState, useRef, useEffect } from "react";
import { ChevronDown, Check } from "lucide-react";

export default function CustomDropdown({
  value,
  onChange,
  options = [],
  placeholder = "Select...",
  className = "",
  required = false,
  disabled = false,
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);

  const selected = options.find((o) => o.value === value);

  useEffect(() => {
    const handleClick = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  useEffect(() => {
    if (!open) return;
    const handleKey = (e) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleKey);
    return () => document.removeEventListener("keydown", handleKey);
  }, [open]);

  return (
    <div ref={ref} className={`relative ${className}`}>
      {/* Hidden native select for form validation */}
      {required && (
        <select
          className="sr-only"
          tabIndex={-1}
          value={value}
          required
          onChange={() => {}}
          aria-hidden="true"
        >
          <option value="">{placeholder}</option>
          {options.map((o) => (
            <option key={o.value} value={o.value}>
              {o.label}
            </option>
          ))}
        </select>
      )}

      <button
        type="button"
        onClick={() => !disabled && setOpen((prev) => !prev)}
        disabled={disabled}
        className={`w-full flex items-center justify-between gap-2 px-4 py-2.5 bg-vpn-input border rounded-lg text-sm transition-all focus:outline-none focus:ring-2 focus:ring-vpn-primary focus:border-transparent ${
          open
            ? "border-vpn-primary"
            : "border-vpn-border hover:border-vpn-primary"
        } ${disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer"}`}
      >
        <span className={selected ? "text-white" : "text-vpn-muted"}>
          {selected ? selected.label : placeholder}
        </span>
        <ChevronDown
          className={`w-4 h-4 text-vpn-muted transition-transform ${open ? "rotate-180" : ""}`}
        />
      </button>

      {open && (
        <div className="absolute z-50 mt-1 w-full bg-vpn-card border border-vpn-border rounded-lg shadow-xl shadow-black/40 overflow-hidden animate-in fade-in slide-in-from-top-1 duration-150">
          <div className="max-h-60 overflow-y-auto custom-scrollbar">
            {options.map((option) => {
              const isSelected = option.value === value;
              return (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => {
                    onChange(option.value);
                    setOpen(false);
                  }}
                  className={`w-full flex items-center gap-2 px-4 py-2.5 text-sm text-left transition-colors ${
                    isSelected
                      ? "bg-vpn-primary/10 text-vpn-primary"
                      : "text-vpn-text hover:bg-vpn-primary hover:text-black"
                  }`}
                >
                  <span className="flex-1 truncate">{option.label}</span>
                  {isSelected && (
                    <Check className="w-4 h-4 shrink-0 text-vpn-primary" />
                  )}
                </button>
              );
            })}
            {options.length === 0 && (
              <div className="px-4 py-3 text-sm text-vpn-muted text-center">
                No options available
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
