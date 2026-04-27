export type ToastKind = "success" | "error" | "info";

export type ToastPayload = {
  message: string;
  kind?: ToastKind;
};

const TOAST_EVENT = "itiw:toast";

export function showToast(payload: ToastPayload) {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<ToastPayload>(TOAST_EVENT, { detail: payload }));
}

export function getToastEventName() {
  return TOAST_EVENT;
}

