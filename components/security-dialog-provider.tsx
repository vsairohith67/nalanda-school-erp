"use client";

import { createContext, useCallback, useContext, useRef, useState } from "react";

type DialogOptions = {
  title: string;
  message: string;
  confirmLabel?: string;
  cancelLabel?: string;
  input?: {
    label: string;
    defaultValue?: string;
    required?: boolean;
    maxLength?: number;
  };
};

type PendingDialog = DialogOptions & {
  resolve: (value: string | null) => void;
};

const SecurityDialogContext = createContext<((options: DialogOptions) => Promise<string | null>) | null>(null);

export function SecurityDialogProvider({ children }: { children: React.ReactNode }) {
  const [pending, setPending] = useState<PendingDialog | null>(null);
  const [inputValue, setInputValue] = useState("");
  const triggerRef = useRef<HTMLElement | null>(null);

  const requestDialog = useCallback((options: DialogOptions) => {
    return new Promise<string | null>((resolve) => {
      triggerRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
      setInputValue(options.input?.defaultValue ?? "");
      setPending({ ...options, resolve });
    });
  }, []);

  const finish = (value: string | null) => {
    const resolver = pending?.resolve;
    setPending(null);
    resolver?.(value);
    queueMicrotask(() => triggerRef.current?.focus());
  };

  return (
    <SecurityDialogContext.Provider value={requestDialog}>
      {children}
      {pending ? (
        <div className="modal-backdrop" onMouseDown={(event) => {
          if (event.target === event.currentTarget) finish(null);
        }}>
          <section
            aria-labelledby="security-dialog-title"
            aria-describedby="security-dialog-description"
            aria-modal="true"
            className="card confirmation-dialog"
            role="dialog"
          >
            <h3 id="security-dialog-title">{pending.title}</h3>
            <p id="security-dialog-description">{pending.message}</p>
            {pending.input ? (
              <label>
                {pending.input.label}
                <input
                  autoFocus
                  maxLength={pending.input.maxLength ?? 500}
                  required={pending.input.required}
                  value={inputValue}
                  onChange={(event) => setInputValue(event.target.value)}
                />
              </label>
            ) : null}
            <div className="page-actions">
              <button type="button" className="secondary" onClick={() => finish(null)}>
                {pending.cancelLabel ?? "Cancel"}
              </button>
              <button
                type="button"
                className="danger"
                autoFocus={!pending.input}
                disabled={Boolean(pending.input?.required && !inputValue.trim())}
                onClick={() => finish(pending.input ? inputValue.trim() : "confirmed")}
              >
                {pending.confirmLabel ?? "Confirm"}
              </button>
            </div>
          </section>
        </div>
      ) : null}
    </SecurityDialogContext.Provider>
  );
}

export function useSecurityDialog() {
  const requestDialog = useContext(SecurityDialogContext);
  if (!requestDialog) throw new Error("SecurityDialogProvider is not mounted");
  return requestDialog;
}
