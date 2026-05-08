"use client";

import { useEffect, useRef, useState } from "react";
import { getToastEventName, ToastPayload } from "@/lib/toast";

type ToastState = {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
};

export function ToastHost() {
  const [toast, setToast] = useState<ToastState | null>(null);
  const timerRef = useRef<number | null>(null);
  const currentId = useRef(0);

  useEffect(() => {
    const eventName = getToastEventName();
    const onToast = (event: Event) => {
      const customEvent = event as CustomEvent<ToastPayload>;
      const payload = customEvent.detail;
      if (!payload?.message) return;

      currentId.current += 1;
      setToast({
        id: currentId.current,
        message: payload.message,
        kind: payload.kind || "success",
      });

      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }

      timerRef.current = window.setTimeout(() => {
        setToast((prev) => (prev && prev.id === currentId.current ? null : prev));
      }, 3000);
    };

    window.addEventListener(eventName, onToast as EventListener);
    return () => {
      window.removeEventListener(eventName, onToast as EventListener);
      if (timerRef.current) {
        window.clearTimeout(timerRef.current);
      }
    };
  }, []);

  if (!toast) return null;

  const palette =
    toast.kind === "error"
      ? "bg-[#ff6b81] text-[#14070b]"
      : toast.kind === "info"
      ? "bg-[#7de6d4] text-[#05261f]"
      : "bg-[#e94560] text-[#06231d]";

  return (
    <div className="pointer-events-none fixed bottom-6 left-1/2 z-[80] -translate-x-1/2 px-4">
      <div
        className={`${palette} min-w-[260px] max-w-[90vw] rounded-[100px] px-5 py-3 text-sm font-semibold shadow-[0_16px_40px_rgba(0,0,0,0.35)] animate-[toast-in_220ms_ease]`}
      >
        {toast.message}
      </div>
    </div>
  );
}


