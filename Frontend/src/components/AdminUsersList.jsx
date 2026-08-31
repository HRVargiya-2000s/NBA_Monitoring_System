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

const listUsersSchema = z.object({
  role: z.enum(['student', 'ASSISTANT', 'HOD', 'ASSOCIATE', 'ADMIN']),
  name: z.string().trim().optional(),
  branch_code: z.string().trim().optional(),
  division: z.string().trim().optional(),
  enrolled_year: z.string().trim().optional()
});

const defaultValues = {
  role: 'student',
  name: '',
  branch_code: '',
  division: '',
  enrolled_year: ''
};

export default function AdminUsersList() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [users, setUsers] = useState([]);
  const [searchedRole, setSearchedRole] = useState('student');

  const {
    register,
    watch,
    handleSubmit,
    reset,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(listUsersSchema),
    defaultValues
  });

  const selectedRole = watch('role');
  const isStudentRole = selectedRole === 'student';

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      const params = { role: data.role };
      if (data.name?.trim()) params.name = data.name.trim();
      if (data.branch_code?.trim()) params.branch_code = data.branch_code.trim();
      if (data.role === 'student') {
        if (data.division?.trim()) params.division = data.division.trim();
        if (data.enrolled_year?.trim()) params.enrolled_year = data.enrolled_year.trim();
      }

      const res = await axios.get(`${SERVER_URL}/admin/list`, {
        params,
        withCredentials: true
      });

      const list = res.data?.users || [];
      setUsers(list);
      setSearchedRole(data.role);
      setSuccess(`Fetched ${list.length} user${list.length === 1 ? '' : 's'}.`);
    } catch (err) {
      setUsers([]);
      setError(err.response?.data?.message || 'Failed to fetch users list.');
    }
  };

  const renderStudentTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {['Enrollment', 'Name', 'Email', 'Division', 'Batch No', 'Branch', 'Branch Code'].map((h) => (
              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={`${u.enrollment_no || u.id}-${i}`} className="border-b border-slate-100 last:border-0">
              <td className="py-3 px-3 text-sm text-slate-700 font-mono">{u.enrollment_no || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-700">{u.name || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600 break-all">{u.email || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.current_division || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.batch_no || u.enrolled_year || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.branch_name || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.branch_code || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  const renderFacultyTable = () => (
    <div className="overflow-x-auto">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">
            {['ID', 'Name', 'Email', 'Role', 'Branch Code'].map((h) => (
              <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {users.map((u, i) => (
            <tr key={`${u.id || u.email}-${i}`} className="border-b border-slate-100 last:border-0">
              <td className="py-3 px-3 text-sm text-slate-700 font-mono">{u.id || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-700">{u.name || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600 break-all">{u.email || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.role || '-'}</td>
              <td className="py-3 px-3 text-sm text-slate-600">{u.branch_code || '-'}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );

  return (
    <div className="space-y-5">
      <SectionCard label="User List Filters">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          ) : null}

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div>
          ) : null}

          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
              Query Parameters
            </p>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
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

              <FormField label="Name">
                <input className={inputCls} placeholder="e.g. Het" {...register('name')} />
                {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
              </FormField>

              <FormField label="Branch Code">
                <input className={inputCls} placeholder="e.g. CE, IT" {...register('branch_code')} />
                {errors.branch_code ? <p className="mt-1 text-xs text-error">{errors.branch_code.message}</p> : null}
              </FormField>

              <FormField label="Division">
                <input
                  className={inputCls}
                  placeholder={isStudentRole ? 'e.g. A' : 'Only for student role'}
                  disabled={!isStudentRole}
                  {...register('division')}
                />
                {errors.division ? <p className="mt-1 text-xs text-error">{errors.division.message}</p> : null}
              </FormField>

              <FormField label="Enrolled Year">
                <input
                  className={inputCls}
                  placeholder={isStudentRole ? 'e.g. 2024' : 'Only for student role'}
                  disabled={!isStudentRole}
                  {...register('enrolled_year')}
                />
                {errors.enrolled_year ? <p className="mt-1 text-xs text-error">{errors.enrolled_year.message}</p> : null}
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
              {isSubmitting ? 'Fetching...' : 'Get Users'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                reset(defaultValues);
                setError('');
                setSuccess('');
                setUsers([]);
                setSearchedRole('student');
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
            >
              Reset Filters
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard label="Users Result">
        {!users.length ? (
          <div className="text-sm text-slate-600">No users loaded yet. Apply filters and click Get Users.</div>
        ) : searchedRole === 'student' ? (
          renderStudentTable()
        ) : (
          renderFacultyTable()
        )}
      </SectionCard>
    </div>
  );
}
