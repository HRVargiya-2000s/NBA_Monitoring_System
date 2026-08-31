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

export const FacultyBulkImportExample = () => (
  <section className="space-y-3">
    <div>
      <p className="text-xs font-bold text-slate-600 uppercase tracking-wide">Expected CSV Format</p>
      <p className="mt-1 text-xs text-slate-500">
        Required columns: Name, Type. Other columns optional. DefaultPassword falls back to server DEFAULT_PASSWORD when empty.
      </p>
    </div>

    <div className="overflow-x-auto rounded-lg border border-slate-200 bg-white">
      <table className="w-full">
        <thead>
          <tr className="border-b border-slate-200">{['Name', 'Type', 'BranchCode', 'MobileNo', 'Email', 'CollegeEmail', 'JoiningDate', 'DefaultPassword'].map((h) => (
            <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
          ))}</tr>
        </thead>
        <tbody>
          <tr className="border-b border-slate-100">
            <td className="py-3 px-3 text-sm text-slate-700">Hiren Vargiya</td>
            <td className="py-3 px-3 text-sm text-slate-700">ADMIN</td>
            <td className="py-3 px-3 text-sm text-slate-700">IT</td>
            <td className="py-3 px-3 text-sm text-slate-700">7905618432</td>
            <td className="py-3 px-3 text-sm text-slate-700">admin@mail.com</td>
            <td className="py-3 px-3 text-sm text-slate-700">admin.it@ldce.ac.in</td>
            <td className="py-3 px-3 text-sm text-slate-700">2026-04-20</td>
            <td className="py-3 px-3 text-sm text-slate-700">MyPass@123</td>
          </tr>
        </tbody>
      </table>
    </div>
  </section>
);

const ACCEPTED_TYPES = [
  'text/csv'
];

const bulkSchema = z.object({
  branch_code: z.string().trim().optional(),
  file: z
    .any()
    .refine((fileList) => fileList && fileList.length > 0, 'CSV file is required.')
    .refine(
      (fileList) => {
        if (!fileList || !fileList.length) return false;
        const file = fileList[0];
        return ACCEPTED_TYPES.includes(file.type) || /\.csv$/i.test(file.name);
      },
      'Please upload .csv file.'
    )
});

const defaultValues = { branch_code: '', file: undefined };

export default function AdminBulkImportFaculty() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [selectedFileName, setSelectedFileName] = useState('');

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({ resolver: zodResolver(bulkSchema), defaultValues });

  const fileWatch = watch('file')?.[0];
  if (fileWatch && fileWatch.name && fileWatch.name !== selectedFileName) setSelectedFileName(fileWatch.name);

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');
    try {
      const formData = new FormData();
      if (data.branch_code) formData.append('branch_code', data.branch_code.trim());
      formData.append('file', data.file[0]);

      const res = await axios.post(`${SERVER_URL}/admin/bulk-import-faculty`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(res.data?.message || 'Bulk import completed successfully.');
      reset(defaultValues);
      setSelectedFileName('');
    } catch (err) {
      setError(err.response?.data?.message || 'Bulk import failed.');
    }
  };

  const downloadTemplate = () => {
    const headers = ['Name', 'Type', 'BranchCode', 'MobileNo', 'Email', 'CollegeEmail', 'JoiningDate', 'DefaultPassword'];
    const sample = [
      ['Hiren Vargiya', 'ADMIN', '16', '7905618432', 'admin@mail.com', 'admin.it@ldce.ac.in', '2026-04-20', 'MyPass@123']
    ];
    const csv = [headers, ...sample]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_import_faculty_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <SectionCard label="Bulk Import Faculty from CSV">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error ? <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div> : null}
          {success ? <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div> : null}

          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">Upload Details</p>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <FormField label="Branch Code (optional)">{/* optional filter */}
                <input className={inputCls} placeholder="e.g. IT" {...register('branch_code')} />
                {errors.branch_code ? <p className="mt-1 text-xs text-error">{errors.branch_code.message}</p> : null}
              </FormField>

              <FormField label="CSV File" required>
                <input type="file" className="file-input file-input-bordered w-full" accept=".csv" {...register('file')} />
                {errors.file ? <p className="mt-1 text-xs text-error">{errors.file.message}</p> : null}
                {selectedFileName ? <p className="mt-1 text-xs text-slate-500">Selected: {selectedFileName}</p> : null}
              </FormField>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button type="submit" disabled={isSubmitting} className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60">
              {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {isSubmitting ? 'Uploading...' : 'Upload & Import'}
            </button>

            <button type="button" disabled={isSubmitting} onClick={() => { reset(defaultValues); setError(''); setSuccess(''); setSelectedFileName(''); }} className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition">Reset Form</button>

            <button type="button" onClick={downloadTemplate} className="px-5 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold transition">Download Sample Template</button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}
