// Stub for sonner — MyHub uses it for toasts. The harness logs to console.
type ToastFn = (message: string, opts?: unknown) => void;
const log =
  (level: 'log' | 'error' | 'warn'): ToastFn =>
  (message) => console[level](`[toast] ${message}`);
const toastFn = log('log') as ToastFn & {
  success: ToastFn;
  error: ToastFn;
  info: ToastFn;
  message: ToastFn;
  warning: ToastFn;
};
toastFn.success = log('log');
toastFn.error = log('error');
toastFn.info = log('log');
toastFn.message = log('log');
toastFn.warning = log('warn');
export const toast = toastFn;
export const Toaster = () => null;
