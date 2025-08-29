import { toast as sonnerToast } from "sonner";
import { CheckCircle, XCircle, AlertTriangle, Info } from "lucide-react";

// Custom toast với styles và icons
export const toast = {
  success: (message: string, options?: any) => {
    return sonnerToast(message, {
      icon: <CheckCircle className="w-4 h-4" />,
      className: "toast-success",
      style: {
        background: "#33d29d",
        color: "white",
        border: "1px solid #33d29d",
      },
      ...options,
    });
  },

  error: (message: string, options?: any) => {
    return sonnerToast(message, {
      icon: <XCircle className="w-4 h-4" />,
      className: "toast-error",
      style: {
        background: "#e97a7a",
        color: "white",
        border: "1px solid #e97a7a",
      },
      ...options,
    });
  },

  warning: (message: string, options?: any) => {
    return sonnerToast(message, {
      icon: <AlertTriangle className="w-4 h-4" />,
      className: "toast-warning",
      style: {
        background: "#f5b442",
        color: "white",
        border: "1px solid #f5b442",
      },
      ...options,
    });
  },

  info: (message: string, options?: any) => {
    return sonnerToast(message, {
      icon: <Info className="w-4 h-4" />,
      className: "toast-info",
      style: {
        background: "#4285f5",
        color: "white",
        border: "1px solid #4285f5",
      },
      ...options,
    });
  },

  // Giữ lại default toast
  default: sonnerToast,

  // Expose các methods khác của sonner
  dismiss: sonnerToast.dismiss,
  loading: sonnerToast.loading,
  promise: sonnerToast.promise,
};
