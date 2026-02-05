"use client";

import { createContext, useCallback, useContext, useState, ReactNode } from "react";
import { Toast, ToastType, ToastContainer } from "@/components/ui/toast";

type ToastInput = {
  message: string;
  type?: ToastType;
  duration?: number;
};

interface ToastContextValue {
  toasts: Toast[];
  addToast: (toast: ToastInput) => void;
  removeToast: (id: string) => void;
}

const ToastContext = createContext<ToastContextValue | undefined>(undefined);

interface ToastProviderProps {
  children: ReactNode;
}

export function ToastProvider({ children }: ToastProviderProps) {
  const [toasts, setToasts] = useState<Toast[]>([]);

  const removeToast = useCallback((id: string) => {
    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const addToast = useCallback(
    ({ message, type = "info", duration }: ToastInput) => {
      // Validate message is present
      if (!message || message.trim() === "") {
        console.warn("[useToast] Toast called without a message");
        return;
      }

      const id = typeof crypto !== "undefined" && "randomUUID" in crypto ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`;

      setToasts((current) => [
        ...current,
        {
          id,
          message: message.trim(),
          type,
          duration,
        },
      ]);
    },
    []
  );

  return (
    <ToastContext.Provider value={{ toasts, addToast, removeToast }}>
      {children}
      <ToastContainer toasts={toasts} onClose={removeToast} />
    </ToastContext.Provider>
  );
}

export function useToast() {
  const ctx = useContext(ToastContext);

  if (!ctx) {
    // Fallback: no provider mounted. Return a no-op toast function to avoid runtime errors.
    return {
      toast: (_input: ToastInput) => {
        if (process.env.NODE_ENV !== "production") {
          console.warn(
            "[useToast] ToastProvider is not mounted. Wrap your app in <ToastProvider> to see toast notifications."
          );
        }
      },
    };
  }

  const { addToast } = ctx;

  return {
    toast: addToast,
  };
}

