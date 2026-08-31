import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';
import axios from 'axios';
import AdminBulkImportFaculty, { FacultyBulkImportExample } from './AdminBulkImportFaculty';

const SERVER_URL = import.meta.env.SERVER_URL || 'http://localhost:3000';

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

const facultyCreateSchema = z.object({
  name: z.string().trim().min(1, 'Full name is required.'),
  type: z.enum(['ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN']),
  branch_code: z.string().trim().optional(),
  email: z.string().trim().min(1, 'Personal email is required.').email('Enter a valid personal email.'),
  college_email: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.email().safeParse(val).success, 'Enter a valid college email.'),
  password: z.string().min(6, 'Password must be at least 6 characters.')
});

const defaultValues = {
  name: '',
  type: 'ASSISTANT',
  branch_code: '',
  email: '',
  college_email: '',
  password: ''
};

export default function AdminCreateFaculty() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdFaculty, setCreatedFaculty] = useState(null);

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(facultyCreateSchema),
    defaultValues
  });

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      const payload = {
        name: data.name.trim(),
        type: data.type,
        branch_code: data.branch_code?.trim() || null,
        email: data.email.trim(),
        college_email: data.college_email?.trim() || null,
        password: data.password
      };

      const res = await axios.post(`${SERVER_URL}/admin/create-faculty`, payload, {
        withCredentials: true
      });

      setCreatedFaculty(res.data?.faculty || null);
      setSuccess(res.data?.message || 'Faculty created successfully.');
      reset(defaultValues);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to create faculty.');
    }
  };

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-5 items-start">
        <SectionCard label="Create Faculty Form">
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
                Basic Information
              </p>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Full Name" required>
                  <input className={inputCls} placeholder="Faculty full name" {...register('name')} />
                  {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
                </FormField>

                <FormField label="Faculty Type" required>
                  <select className={inputCls} {...register('type')}>
                    <option value="ASSISTANT">ASSISTANT</option>
                    <option value="HOD">HOD</option>
                    <option value="ASSOCIATE">ASSOCIATE</option>
                    <option value="ADMIN">ADMIN</option>
                  </select>
                  {errors.type ? <p className="mt-1 text-xs text-error">{errors.type.message}</p> : null}
                </FormField>

                <FormField label="Branch Code">
                  <input className={inputCls} placeholder="e.g. CE, IT" {...register('branch_code')} />
                  {errors.branch_code ? <p className="mt-1 text-xs text-error">{errors.branch_code.message}</p> : null}
                </FormField>

                <FormField label="Personal Email" required>
                  <input className={inputCls} type="email" placeholder="example@mail.com" {...register('email')} />
                  {errors.email ? <p className="mt-1 text-xs text-error">{errors.email.message}</p> : null}
                </FormField>

                <FormField label="College Email">
                  <input className={inputCls} type="email" placeholder="faculty@ldce.ac.in" {...register('college_email')} />
                  {errors.college_email ? <p className="mt-1 text-xs text-error">{errors.college_email.message}</p> : null}
                </FormField>

                <FormField label="Password" required>
                  <input className={inputCls} type="password" placeholder="Minimum 6 characters" {...register('password')} />
                  {errors.password ? <p className="mt-1 text-xs text-error">{errors.password.message}</p> : null}
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
                {isSubmitting ? 'Creating...' : 'Create Faculty'}
              </button>

              <button
                type="button"
                disabled={isSubmitting}
                onClick={() => {
                  reset(defaultValues);
                  setError('');
                  setSuccess('');
                  setCreatedFaculty(null);
                }}
                className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
              >
                Reset
              </button>
            </div>
          </form>
        </SectionCard>

        <AdminBulkImportFaculty />
      </div>

      <FacultyBulkImportExample />

      {createdFaculty ? (
        <SectionCard label="Created Faculty Snapshot">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">ID</p>
              <p className="text-slate-700 font-medium">{createdFaculty.id || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Name</p>
              <p className="text-slate-700 font-medium">{createdFaculty.name || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Type</p>
              <p className="text-slate-700 font-medium">{createdFaculty.type || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Email</p>
              <p className="text-slate-700 font-medium break-all">{createdFaculty.email || '-'}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}