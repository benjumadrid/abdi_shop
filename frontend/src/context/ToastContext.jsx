import { useState, useCallback, useMemo } from 'react';
import PropTypes from 'prop-types';
import { ToastContext } from './toast-context';

export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);

  const removeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const showToast = useCallback(
    ({ type = 'success', title = '', message = '', duration = 4500 }) => {
      const id = Date.now().toString() + Math.random().toString(36).substring(2, 6);
      const newToast = { id, type, title, message, duration };

      setToasts((prev) => [...prev, newToast]);

      if (duration > 0) {
        setTimeout(() => {
          removeToast(id);
        }, duration);
      }

      return id;
    },
    [removeToast]
  );

  const toast = useMemo(
    () => ({
      show: showToast,
      success: (message, title = 'Success') =>
        showToast({ type: 'success', title, message }),
      error: (message, title = 'Error') =>
        showToast({ type: 'error', title, message }),
      warning: (message, title = 'Warning') =>
        showToast({ type: 'warning', title, message }),
      info: (message, title = 'Notice') =>
        showToast({ type: 'info', title, message }),
      remove: removeToast
    }),
    [showToast, removeToast]
  );

  return (
    <ToastContext.Provider value={toast}>
      {children}

      {/* Floating Toast Notification Container */}
      <div
        aria-live="assertive"
        className="fixed top-4 right-4 sm:top-5 sm:right-5 z-[9999] flex flex-col gap-2.5 max-w-sm sm:max-w-md w-full pointer-events-none px-3 sm:px-0"
      >
        {toasts.map((t) => {
          const isSuccess = t.type === 'success';
          const isError = t.type === 'error';
          const isWarning = t.type === 'warning';

          const borderColors = isSuccess
            ? 'border-emerald-500/40'
            : isError
            ? 'border-rose-500/40'
            : isWarning
            ? 'border-amber-500/40'
            : 'border-sky-500/40';

          const bgCard = isSuccess
            ? 'bg-gradient-to-r from-emerald-950/95 via-ink-950/95 to-ink-950/95'
            : isError
            ? 'bg-gradient-to-r from-rose-950/95 via-ink-950/95 to-ink-950/95'
            : isWarning
            ? 'bg-gradient-to-r from-amber-950/95 via-ink-950/95 to-ink-950/95'
            : 'bg-gradient-to-r from-sky-950/95 via-ink-950/95 to-ink-950/95';

          return (
            <div
              key={t.id}
              role="status"
              className={`pointer-events-auto rounded-2xl p-4 text-white shadow-2xl border ${borderColors} ${bgCard} backdrop-blur-md transition-all duration-300 ease-out transform animate-in fade-in slide-in-from-top-4 flex items-start justify-between gap-3.5`}
            >
              <div className="flex items-start gap-3 min-w-0">
                {/* Icon */}
                <div
                  className={`w-7 h-7 rounded-xl flex items-center justify-center shrink-0 mt-0.5 ${
                    isSuccess
                      ? 'bg-emerald-500/20 text-emerald-400 ring-1 ring-emerald-500/40'
                      : isError
                      ? 'bg-rose-500/20 text-rose-400 ring-1 ring-rose-500/40'
                      : isWarning
                      ? 'bg-amber-500/20 text-amber-400 ring-1 ring-amber-500/40'
                      : 'bg-sky-500/20 text-sky-400 ring-1 ring-sky-500/40'
                  }`}
                >
                  {isSuccess && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
                    </svg>
                  )}
                  {isError && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
                    </svg>
                  )}
                  {isWarning && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                    </svg>
                  )}
                  {!isSuccess && !isError && !isWarning && (
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  )}
                </div>

                {/* Content */}
                <div className="min-w-0 flex-1">
                  {t.title && (
                    <h4 className="text-xs font-bold tracking-tight text-white flex items-center gap-1.5">
                      <span>{t.title}</span>
                    </h4>
                  )}
                  <p className="text-xs text-white/90 leading-relaxed font-medium mt-0.5 break-words">
                    {t.message}
                  </p>
                </div>
              </div>

              {/* Close Button */}
              <button
                type="button"
                onClick={() => removeToast(t.id)}
                className="text-white/50 hover:text-white hover:bg-white/10 p-1 rounded-lg transition-colors cursor-pointer shrink-0"
                aria-label="Close notification"
              >
                <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
          );
        })}
      </div>
    </ToastContext.Provider>
  );
}

ToastProvider.propTypes = {
  children: PropTypes.node.isRequired
};

export default ToastProvider;
