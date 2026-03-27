import { createContext, useContext, useState, useCallback } from "react";
import { CheckCircle, AlertCircle, Info, X, AlertTriangle } from "lucide-react";

const ToastContext = createContext();

let toastId = 0;

const icons = {
  success: CheckCircle,
  error: AlertCircle,
  warning: AlertTriangle,
  info: Info,
};

const colors = {
  success: "border-emerald-500/30 bg-emerald-500/10 text-emerald-400",
  error: "border-red-500/30 bg-red-500/10 text-red-400",
  warning: "border-amber-500/30 bg-amber-500/10 text-amber-400",
  info: "border-vpn-primary/30 bg-vpn-primary/10 text-vpn-primary",
};

function Toast({ toast, onDismiss }) {
  const Icon = icons[toast.type] || icons.info;

  return (
    <div
      className={`flex items-start gap-3 px-4 py-3 rounded-lg border backdrop-blur-sm shadow-lg transition-all duration-300 ${colors[toast.type] || colors.info} ${
        toast.removing ? "animate-toast-out" : "animate-toast-in"
      }`}
    >
      <Icon className="w-5 h-5 flex-shrink-0 mt-0.5" />
      <p className="text-sm flex-1">{toast.message}</p>
      <button
        onClick={() => onDismiss(toast.id)}
        className="flex-shrink-0 opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const dismiss = useCallback((id) => {
    setToasts((prev) =>
      prev.map((t) => (t.id === id ? { ...t, removing: true } : t)),
    );
    setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 300);
  }, []);

  const addToast = useCallback(
    (message, type = "info", duration = 4000) => {
      const id = ++toastId;
      setToasts((prev) => [...prev, { id, message, type, removing: false }]);
      if (duration > 0) {
        setTimeout(() => dismiss(id), duration);
      }
      return id;
    },
    [dismiss],
  );

  const toast = useCallback(
    {
      success: (msg, dur) => addToast(msg, "success", dur),
      error: (msg, dur) => addToast(msg, "error", dur ?? 6000),
      warning: (msg, dur) => addToast(msg, "warning", dur),
      info: (msg, dur) => addToast(msg, "info", dur),
    },
    [addToast],
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}
      <div className="fixed bottom-4 right-4 z-50 flex flex-col gap-2 max-w-sm w-full pointer-events-none">
        {toasts.map((t) => (
          <div key={t.id} className="pointer-events-auto">
            <Toast toast={t} onDismiss={dismiss} />
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);
  if (!ctx) throw new Error("useToast must be used within ToastProvider");
  return ctx;
}
