import { useState } from 'react';
import PropTypes from 'prop-types';
import { useAdminAuth } from '../../hooks/useAdminAuth';
import { useToast } from '../../hooks/useToast';

export default function AdminSecurityModal({ isOpen, onClose }) {
  const { admin, updateCredentials } = useAdminAuth();
  const toast = useToast();

  const [name, setName] = useState(admin?.name || '');
  const [email, setEmail] = useState(admin?.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');

  // Password visibility toggles
  const [showCurrent, setShowCurrent] = useState(false);
  const [showNew, setShowNew] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);
  const [successMessage, setSuccessMessage] = useState(null);

  if (!isOpen) return null;

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError(null);
    setSuccessMessage(null);

    // Validation
    if (!currentPassword.trim()) {
      setError('Current password is required to verify your identity.');
      return;
    }

    if (newPassword && newPassword.length < 6) {
      setError('New password must be at least 6 characters long.');
      return;
    }

    if (newPassword && newPassword !== confirmPassword) {
      setError('New password and confirmation do not match.');
      return;
    }

    const isEmailChanged = email.trim().toLowerCase() !== (admin?.email || '').toLowerCase();
    const isNameChanged = name.trim() !== (admin?.name || '');
    const isPasswordChanged = Boolean(newPassword.trim());

    if (!isEmailChanged && !isNameChanged && !isPasswordChanged) {
      setError('No changes detected. Update your email, name, or enter a new password.');
      return;
    }

    try {
      setSubmitting(true);
      await updateCredentials({
        currentPassword,
        newEmail: isEmailChanged ? email.trim() : undefined,
        newPassword: isPasswordChanged ? newPassword : undefined,
        name: isNameChanged ? name.trim() : undefined
      });

      const successMsg = 'Credentials updated successfully! Only you hold your new password.';
      setSuccessMessage(successMsg);
      toast.success(successMsg, 'Security Updated');
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');

      // Auto close after 2.5 seconds on success
      setTimeout(() => {
        setSuccessMessage(null);
        onClose();
      }, 2500);
    } catch (err) {
      const errMsg = err?.message || 'Failed to update credentials. Please check your current password.';
      setError(errMsg);
      toast.error(errMsg, 'Update Failed');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 sm:p-6 bg-ink-950/60 backdrop-blur-xs animate-in fade-in duration-150">
      <div
        className="relative w-full max-w-xl bg-white rounded-3xl shadow-2xl border-2 border-surface-200/90 overflow-hidden flex flex-col max-h-[92vh] animate-scale-in"
        onClick={(e) => e.stopPropagation()}
      >
        {/* ── HEADER ── */}
        <div className="px-6 sm:px-7 py-5 border-b-2 border-surface-100 flex items-center justify-between bg-surface-50/80">
          <div className="flex items-center gap-3.5">
            <div className="w-11 h-11 rounded-2xl bg-brand-50 text-brand-700 border-2 border-brand-200/70 flex items-center justify-center shadow-xs shrink-0">
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
              </svg>
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-ink-950 tracking-tight">Account & Security</h3>
              <p className="text-xs sm:text-sm text-ink-500 mt-0.5">Change your login email and private password</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="w-9 h-9 flex items-center justify-center text-ink-400 hover:text-ink-800 hover:bg-surface-200/80 rounded-xl transition-all cursor-pointer"
            aria-label="Close modal"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* ── BODY ── */}
        <div className="p-6 sm:p-7 overflow-y-auto space-y-5">
          {/* Privacy & Security Guarantee Banner */}
          <div className="p-4 rounded-2xl bg-emerald-50/90 border-2 border-emerald-200/90 flex items-start gap-3.5 shadow-2xs">
            <div className="w-7 h-7 rounded-xl bg-emerald-100 text-emerald-800 flex items-center justify-center shrink-0 text-sm font-bold mt-0.5 border border-emerald-200">
              🛡️
            </div>
            <div className="text-xs sm:text-sm text-emerald-950 leading-relaxed">
              <strong className="font-bold block mb-0.5 text-emerald-900">100% Private & Encrypted</strong>
              Your new password is encrypted with cryptographic <code className="px-1.5 py-0.5 rounded-md bg-emerald-100 font-mono text-xs font-semibold text-emerald-900">bcrypt</code> hashing. Neither developers nor anyone else can view or read your password. Only you have access.
            </div>
          </div>

          {/* Success Banner */}
          {successMessage && (
            <div className="p-4 rounded-2xl bg-brand-50 border-2 border-brand-200 text-xs sm:text-sm text-brand-900 font-semibold flex items-center gap-2.5 shadow-2xs">
              <svg className="w-5 h-5 text-brand-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2.5" d="M5 13l4 4L19 7" />
              </svg>
              <span>{successMessage}</span>
            </div>
          )}

          {/* Error Banner */}
          {error && (
            <div className="p-4 rounded-2xl bg-rose-50 border-2 border-rose-200 text-xs sm:text-sm text-rose-800 font-semibold flex items-center gap-2.5 shadow-2xs">
              <svg className="w-5 h-5 text-rose-600 shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M12 8v4m0 4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
              </svg>
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4 sm:space-y-5">
            {/* Display Name */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                Display Name / ስም
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="e.g. Abdi"
                className="w-full px-4 py-2.5 sm:py-3 text-sm font-medium rounded-xl border-2 border-surface-300 bg-white text-ink-950 placeholder:text-ink-400 hover:border-surface-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition-all shadow-2xs"
              />
            </div>

            {/* Email Address */}
            <div>
              <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                Admin Login Email / ኢሜይል
              </label>
              <input
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="abdi@gmail.com"
                className="w-full px-4 py-2.5 sm:py-3 text-sm font-medium rounded-xl border-2 border-surface-300 bg-white text-ink-950 placeholder:text-ink-400 hover:border-surface-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition-all shadow-2xs"
              />
              <p className="text-xs text-ink-500 mt-1.5">
                You will use this email address to log in to the admin panel.
              </p>
            </div>

            <div className="pt-3 border-t-2 border-surface-100">
              {/* Current Password (Required) */}
              <div>
                <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                  Current Password / አሁን ያለው የይለፍ ቃል <span className="text-rose-500">*</span>
                </label>
                <div className="relative">
                  <input
                    type={showCurrent ? 'text' : 'password'}
                    required
                    value={currentPassword}
                    onChange={(e) => setCurrentPassword(e.target.value)}
                    placeholder="Enter current password to authorize"
                    className="w-full pl-4 pr-12 py-2.5 sm:py-3 text-sm font-medium rounded-xl border-2 border-surface-300 bg-white text-ink-950 placeholder:text-ink-400 hover:border-surface-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowCurrent(!showCurrent)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer"
                    aria-label={showCurrent ? 'Hide password' : 'Show password'}
                  >
                    {showCurrent ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                <p className="text-xs text-ink-500 mt-1.5">
                  Required to verify that it is really you making this change.
                </p>
              </div>
            </div>

            {/* New Password & Confirm Password */}
            <div className="pt-3 border-t-2 border-surface-100 space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-xs sm:text-sm font-bold text-ink-950">Change Password (Optional)</span>
                <span className="text-xs text-ink-400 bg-surface-100 px-2 py-0.5 rounded-md font-medium">Leave blank if keeping current password</span>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                  New Password / አዲስ የይለፍ ቃል
                </label>
                <div className="relative">
                  <input
                    type={showNew ? 'text' : 'password'}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="Enter secret new password (min. 6 characters)"
                    className="w-full pl-4 pr-12 py-2.5 sm:py-3 text-sm font-medium rounded-xl border-2 border-surface-300 bg-white text-ink-950 placeholder:text-ink-400 hover:border-surface-400 focus:outline-none focus:border-brand-600 focus:ring-4 focus:ring-brand-500/15 transition-all shadow-2xs"
                  />
                  <button
                    type="button"
                    onClick={() => setShowNew(!showNew)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer"
                    aria-label={showNew ? 'Hide password' : 'Show password'}
                  >
                    {showNew ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs sm:text-sm font-bold text-ink-900 mb-1.5">
                  Confirm New Password / አዲሱን የይለፍ ቃል ያረጋግጡ
                </label>
                <div className="relative">
                  <input
                    type={showConfirm ? 'text' : 'password'}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-type new password"
                    className={`w-full pl-4 pr-12 py-2.5 sm:py-3 text-sm font-medium rounded-xl border-2 bg-white text-ink-950 placeholder:text-ink-400 focus:outline-none focus:ring-4 transition-all shadow-2xs ${
                      confirmPassword && newPassword === confirmPassword
                        ? 'border-emerald-500 focus:ring-emerald-500/20 focus:border-emerald-600'
                        : confirmPassword && newPassword !== confirmPassword
                        ? 'border-rose-500 focus:ring-rose-500/20 focus:border-rose-600'
                        : 'border-surface-300 hover:border-surface-400 focus:border-brand-600 focus:ring-brand-500/15'
                    }`}
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 w-8 h-8 flex items-center justify-center text-ink-400 hover:text-ink-700 hover:bg-surface-100 rounded-lg transition-colors cursor-pointer"
                    aria-label={showConfirm ? 'Hide password' : 'Show password'}
                  >
                    {showConfirm ? (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l18 18" />
                      </svg>
                    ) : (
                      <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                      </svg>
                    )}
                  </button>
                </div>
                {confirmPassword && newPassword === confirmPassword && (
                  <p className="text-xs text-emerald-600 mt-1.5 flex items-center gap-1 font-bold">
                    ✓ Passwords match
                  </p>
                )}
                {confirmPassword && newPassword !== confirmPassword && (
                  <p className="text-xs text-rose-500 mt-1.5 font-bold">
                    ✕ Passwords do not match
                  </p>
                )}
              </div>
            </div>

            {/* Modal Actions */}
            <div className="pt-4 sm:pt-5 border-t-2 border-surface-100 flex items-center justify-end gap-3">
              <button
                type="button"
                onClick={onClose}
                disabled={submitting}
                className="px-5 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-ink-700 hover:text-ink-950 bg-white hover:bg-surface-100 rounded-xl border-2 border-surface-200 hover:border-surface-300 transition-all cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={submitting}
                className="px-6 py-2.5 sm:py-3 text-xs sm:text-sm font-bold text-white bg-brand-600 hover:bg-brand-700 active:bg-brand-800 rounded-xl shadow-md hover:shadow-lg transition-all cursor-pointer flex items-center gap-2 disabled:opacity-50"
              >
                {submitting && (
                  <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v8H4z" />
                  </svg>
                )}
                <span>{submitting ? 'Saving...' : 'Save Changes'}</span>
              </button>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
}

AdminSecurityModal.propTypes = {
  isOpen: PropTypes.bool.isRequired,
  onClose: PropTypes.func.isRequired
};
