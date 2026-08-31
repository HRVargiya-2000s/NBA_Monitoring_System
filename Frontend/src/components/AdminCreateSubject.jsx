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

const subjectCreateSchema = z.object({
  subject_code: z.string().trim().min(1, 'Subject code is required.'),
  name: z.string().trim().min(1, 'Subject name is required.'),
  session: z.enum(['ODD', 'EVEN']).default('ODD'),
  syllabus_url: z
    .string()
    .trim()
    .optional()
    .refine((val) => !val || z.string().url().safeParse(val).success, 'Enter a valid URL.'),
  teaching_branch_codes: z.array(z.string()).default([])
});

const defaultValues = {
  subject_code: '',
  name: '',
  session: 'ODD',
  syllabus_url: '',
  teaching_branch_codes: []
};

export default function AdminCreateSubject() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [createdSubject, setCreatedSubject] = useState(null);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(subjectCreateSchema),
    defaultValues
  });

  const watchedSubjectCode = watch('subject_code');

  const uploadSyllabus = async () => {
    setError('');
    setSuccess('');

    const subjectCode = String(watchedSubjectCode || '').trim();
    if (!subjectCode) {
      setError('Enter subject code before uploading syllabus.');
      return;
    }

    if (!syllabusFile) {
      setError('Please choose a syllabus PDF.');
      return;
    }

    try {
      setUploadingSyllabus(true);
      const formData = new FormData();
      formData.append('file', syllabusFile);

      const res = await axios.post(
        `${SERVER_URL}/subject/${encodeURIComponent(subjectCode)}/syllabus`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      setCreatedSubject(res.data?.subject || null);
      setSuccess(res.data?.message || 'Syllabus uploaded successfully.');
      setSyllabusFile(null);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to upload syllabus. Save the subject first, then upload PDF.');
    } finally {
      setUploadingSyllabus(false);
    }
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      const payload = {
        subject_code: data.subject_code.trim(),
        name: data.name.trim(),
        session: data.session,
        syllabus_url: data.syllabus_url?.trim() || null,
        teaching_branch_codes: []
      };

      let res;
      try {
        res = await axios.post(`${SERVER_URL}/subject/create`, payload, {
          withCredentials: true
        });
      } catch (err) {
        if (err.response?.status !== 409) {
          throw err;
        }

        res = await axios.put(`${SERVER_URL}/subject/${encodeURIComponent(payload.subject_code)}`, payload, {
          withCredentials: true
        });
      }

      setCreatedSubject(res.data?.subject || null);
      setSuccess(res.data?.message || 'Subject saved successfully.');
      reset(defaultValues);
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to save subject.');
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard label="CREATE SUBJECT FORM">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
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
              Subject Information
            </p>
            <div className="space-y-4">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Subject Code" required>
                  <input className={inputCls} placeholder="e.g. 3150703" {...register('subject_code')} />
                  {errors.subject_code ? <p className="mt-1 text-xs text-error">{errors.subject_code.message}</p> : null}
                </FormField>

                <FormField label="Subject Name" required>
                  <input className={inputCls} placeholder="e.g. Analysis and Design of Algorithms" {...register('name')} />
                  {errors.name ? <p className="mt-1 text-xs text-error">{errors.name.message}</p> : null}
                </FormField>
              </div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <FormField label="Session" required>
                  <select className={inputCls} {...register('session')}>
                    <option value="ODD">ODD</option>
                    <option value="EVEN">EVEN</option>
                  </select>
                  {errors.session ? <p className="mt-1 text-xs text-error">{errors.session.message}</p> : null}
                </FormField>

                <FormField label="Syllabus URL">
                  <input className={inputCls} placeholder="https://..." {...register('syllabus_url')} />
                  {errors.syllabus_url ? <p className="mt-1 text-xs text-error">{errors.syllabus_url.message}</p> : null}
                </FormField>
              </div>

              <div className="rounded-lg border border-blue-200 bg-blue-50 p-4">
                <p className="text-xs font-bold text-blue-800 uppercase tracking-wide mb-3">Syllabus Upload</p>
                <div className="grid grid-cols-1 md:grid-cols-[1fr_auto] gap-4 items-end">
                  <FormField label="Syllabus PDF">
                    <label className="px-4 py-2.5 rounded-lg border border-blue-300 bg-white text-slate-700 hover:bg-blue-50 text-sm font-semibold transition cursor-pointer text-center">
                      {syllabusFile ? syllabusFile.name : 'Choose PDF'}
                      <input
                        type="file"
                        className="hidden"
                        accept="application/pdf,.pdf"
                        onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                      />
                    </label>
                  </FormField>

                  <button
                    type="button"
                    onClick={uploadSyllabus}
                    disabled={uploadingSyllabus || isSubmitting}
                    className="px-6 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-bold transition disabled:opacity-60"
                  >
                    {uploadingSyllabus ? 'Uploading...' : 'Upload Syllabus PDF'}
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="flex gap-3 pt-2 border-t border-slate-100 mt-6">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-6 py-2 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {isSubmitting ? 'Creating...' : 'Create Subject'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
              reset(defaultValues);
              setError('');
              setSuccess('');
              setCreatedSubject(null);
              setSyllabusFile(null);
            }}
              className="px-6 py-2 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition disabled:opacity-60 disabled:cursor-not-allowed"
            >
              Reset
            </button>
          </div>
        </form>
      </SectionCard>

      {createdSubject ? (
        <SectionCard label="Created Subject Snapshot">
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Subject Code</p>
              <p className="text-slate-700 font-medium">{createdSubject.subject_code || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Name</p>
              <p className="text-slate-700 font-medium">{createdSubject.name || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm md:col-span-2">
              <p className="text-xs text-slate-500 uppercase font-semibold">Syllabus URL</p>
              <p className="text-slate-700 font-medium break-all">{createdSubject.syllabus_url || '-'}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Syllabus File</p>
              <p className="text-slate-700 font-medium">{createdSubject.syllabus_file_name || '-'}</p>
            </div>
              <div className="rounded-lg border border-slate-200 p-3 text-sm">
                <p className="text-xs text-slate-500 uppercase font-semibold">Session</p>
                <p className="text-slate-700 font-medium">{createdSubject.session || '-'}</p>
              </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
