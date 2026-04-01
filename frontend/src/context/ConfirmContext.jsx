import {
  createContext,
  useContext,
  useState,
  useCallback,
  useRef,
} from "react";
import { AlertTriangle, Trash2, Rocket, X } from "lucide-react";

const ConfirmContext = createContext();

const variantConfig = {
  danger: {
    icon: Trash2,
    iconColor: "text-red-400",
    iconBg: "bg-red-500/10",
    buttonClass: "bg-red-600 hover:bg-red-700 text-white",
  },
  warning: {
    icon: AlertTriangle,
    iconColor: "text-amber-400",
    iconBg: "bg-amber-500/10",
    buttonClass: "bg-amber-600 hover:bg-amber-700 text-white",
  },
  info: {
    icon: Rocket,
    iconColor: "text-blue-400",
    iconBg: "bg-blue-500/10",
    buttonClass: "bg-blue-600 hover:bg-blue-700 text-white",
  },
};

function ConfirmDialog({ dialog, onConfirm, onCancel }) {
  if (!dialog) return null;

  const variant = variantConfig[dialog.variant || "danger"];
  const Icon = dialog.icon || variant.icon;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm z-[60] flex items-center justify-center p-4">
      <div className="bg-vpn-card border border-vpn-border rounded-2xl w-full max-w-md shadow-2xl animate-toast-in">
        <div className="p-6">
          <div className="flex items-start gap-4">
            <div className={`p-3 rounded-xl ${variant.iconBg} flex-shrink-0`}>
              <Icon className={`w-6 h-6 ${variant.iconColor}`} />
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="text-lg font-semibold text-white mb-1">
                {dialog.title || "Confirm"}
              </h3>
              <p className="text-sm text-vpn-muted leading-relaxed">
                {dialog.message}
              </p>
            </div>
            <button
              onClick={onCancel}
              className="p-1.5 rounded-lg text-vpn-muted hover:text-white hover:bg-vpn-input transition-colors flex-shrink-0"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
        <div className="flex items-center justify-end gap-3 px-6 pb-6">
          <button
            onClick={onCancel}
            className="px-4 py-2 bg-vpn-card border border-vpn-border hover:border-vpn-muted text-vpn-text rounded-lg text-sm transition-all"
          >
            {dialog.cancelText || "Cancel"}
          </button>
          <button
            onClick={onConfirm}
            className={`px-4 py-2 rounded-lg text-sm font-medium transition-all ${variant.buttonClass}`}
          >
            {dialog.confirmText || "Confirm"}
          </button>
        </div>
      </div>
    </div>
  );
}

export function ConfirmProvider({ children }) {
  const [dialog, setDialog] = useState(null);
  const resolveRef = useRef(null);

  const confirm = useCallback(
    ({
      title,
      message,
      confirmText = "Confirm",
      cancelText = "Cancel",
      variant = "danger",
      icon,
    } = {}) => {
      return new Promise((resolve) => {
        resolveRef.current = resolve;
        setDialog({ title, message, confirmText, cancelText, variant, icon });
      });
    },
    [],
  );

  const handleConfirm = useCallback(() => {
    resolveRef.current?.(true);
    setDialog(null);
  }, []);

  const handleCancel = useCallback(() => {
    resolveRef.current?.(false);
    setDialog(null);
  }, []);

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <ConfirmDialog
        dialog={dialog}
        onConfirm={handleConfirm}
        onCancel={handleCancel}
      />
    </ConfirmContext.Provider>
  );
}

export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error("useConfirm must be used within ConfirmProvider");
  return ctx;
}
