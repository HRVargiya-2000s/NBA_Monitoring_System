
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition';

const FormField = ({ label, required = false, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-slate-700">
      {label} {required ? <span className="text-red-500">*</span> : null}
    </label>
    {children}
  </div>
);

const SectionCard = ({ label, children }) => (
  <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const resetPasswordSchema = z.object({
  identifier: z.string().trim().min(1, 'Identifier is required.'),
  role: z.enum(['student', 'ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN'])
});

const defaultValues = {
  identifier: '',
  role: 'ASSISTANT'
};

export default function AdminResetPassword() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastReset, setLastReset] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues
  });

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      const res = await axios.put(
        `${SERVER_URL}/admin/reset-password`,
        {
          identifier: data.identifier.trim(),
          role: data.role
        },
        { withCredentials: true }
      );

      console.log('Reset response:', res.data);

      setSuccess(res.data?.message + `Default password: ${res.data?.defaultPassword}` || 'Password reset successful.');
      setLastReset({
        identifier: data.identifier.trim(),
        role: data.role,
        defaultPassword: res.data?.defaultPassword || ''
      });
      reset(defaultValues);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to reset password.');
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard label="Reset User Password">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
              {error}
            </div>
          ) : null}

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
              {success}
            </div>
          ) : null}

          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
              Reset Details
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Identifier (Email / Enrollment)" required>
                <input
                  className={inputCls}
                  placeholder="Enter email or enrollment number"
                  {...register('identifier')}
                />
                {errors.identifier ? <p className="mt-1 text-xs text-error">{errors.identifier.message}</p> : null}
              </FormField>

              <FormField label="Role" required>
                <select className={inputCls} {...register('role')}>
                  <option value="student">student</option>
                  <option value="ASSISTANT">ASSISTANT</option>
                  <option value="HOD">HOD</option>
                  <option value="ASSOCIATE">ASSOCIATE</option>
                  <option value="ADMIN">ADMIN</option>
                </select>
                {errors.role ? <p className="mt-1 text-xs text-error">{errors.role.message}</p> : null}
              </FormField>
            </div>
          </div>

          <div className="flex gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {isSubmitting ? 'Resetting...' : 'Reset Password'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                reset(defaultValues);
                setError('');
                setSuccess('');
                setLastReset(null);
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
            >
              Reset Form
            </button>
          </div>
        </form>
      </SectionCard>

      {lastReset ? (
        <SectionCard label="Last Reset Action">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Identifier</p>
              <p className="text-slate-700 font-medium break-all">{lastReset.identifier}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Role</p>
              <p className="text-slate-700 font-medium">{lastReset.role}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="text-xs text-emerald-700 uppercase font-semibold">Default Password</p>
              <p className="text-emerald-900 font-semibold break-all">{lastReset.defaultPassword || 'N/A'}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}