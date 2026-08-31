
import { useEffect, useMemo, useState } from 'react';
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

const ACCEPTED_TYPES = [
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-excel',
  'text/csv'
];

const bulkImportSchema = z.object({
  branch_name: z.string().trim().optional(),
  branch_code: z.string().trim().optional(),
  course_name: z.string().trim().min(1, 'Course is required.'),
  course_id: z.string().trim().min(1, 'Please select a valid course from suggestions.'),
  enrolled_year: z.string().trim().min(1, 'Enrolled year is required.'),
  file: z
    .any()
    .refine((fileList) => fileList && fileList.length > 0, 'Excel file is required.')
    .refine(
      (fileList) => {
        if (!fileList || !fileList.length) return false;
        const file = fileList[0];
        return ACCEPTED_TYPES.includes(file.type) || /\.(xlsx|xls|csv)$/i.test(file.name);
      },
      'Please upload .xlsx, .xls or .csv file.'
    )
});

const defaultValues = {
  branch_name: '',
  branch_code: '',
  course_name: '',
  course_id: '',
  enrolled_year: '',
  file: undefined
};

export default function AdminBulkImport() {
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [lastImport, setLastImport] = useState(null);
  const [courses, setCourses] = useState([]);
  const [coursesLoading, setCoursesLoading] = useState(false);
  const [branches, setBranches] = useState([]);
  const [branchesLoading, setBranchesLoading] = useState(false);

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    clearErrors,
    watch,
    formState: { errors, isSubmitting }
  } = useForm({
    resolver: zodResolver(bulkImportSchema),
    defaultValues
  });

  const selectedFile = watch('file')?.[0];
  const courseName = watch('course_name') || '';
  const branchName = watch('branch_name') || '';
  const enrolledYear = watch('enrolled_year') || '';
  const selectedCourse = courses.find((course) => String(course.id) === watch('course_id'));
  const requiresBranch = selectedCourse?.name?.trim().toUpperCase() === 'BE';
  const batchNoPreview = useMemo(() => {
    const startYear = Number.parseInt(enrolledYear, 10);
    const durationYears = Number.parseInt(selectedCourse?.duration_years, 10);
    if (!Number.isFinite(startYear) || !Number.isFinite(durationYears)) return '';
    return `${startYear}-${startYear + durationYears}`;
  }, [enrolledYear, selectedCourse]);

  const filteredCourses = useMemo(() => {
    const q = courseName.trim().toLowerCase();
    if (!q) return courses;
    return courses.filter((course) => course.name.toLowerCase().includes(q));
  }, [courses, courseName]);

  const filteredBranches = useMemo(() => {
    const q = branchName.trim().toLowerCase();
    if (!q) return branches;
    return branches.filter((branch) => {
      const label = branch.display_name || branch.name + " - " + branch.branch_code;
      return label.toLowerCase().includes(q) || branch.branch_code.toLowerCase().includes(q) || branch.name.toLowerCase().includes(q);
    });
  }, [branches, branchName]);

  useEffect(() => {
    const fetchCourses = async () => {
      setCoursesLoading(true);
      try {
        const res = await axios.get(`${SERVER_URL}/admin/courses`, { withCredentials: true });
        setCourses(res.data?.courses || []);
      } catch {
        // Keep page usable even if courses list fails to load.
        setCourses([]);
      } finally {
        setCoursesLoading(false);
      }
    };

    fetchCourses();

    const fetchBranches = async () => {
      setBranchesLoading(true);
      try {
        const res = await axios.get(`${SERVER_URL}/admin/departments`, { withCredentials: true });
        setBranches(res.data?.departments || []);
      } catch {
        setBranches([]);
      } finally {
        setBranchesLoading(false);
      }
    };

    fetchBranches();
  }, []);

  const handleBranchInput = (value) => {
    setValue("branch_name", value, { shouldValidate: true });

    const matched = branches.find((branch) => {
      const label = branch.display_name || branch.name + " - " + branch.branch_code;
      return label.toLowerCase() === value.trim().toLowerCase();
    });

    if (matched) {
      setValue("branch_code", matched.branch_code, { shouldValidate: true });
      clearErrors("branch_code");
    } else {
      setValue("branch_code", "", { shouldValidate: true });
    }
  };

  const handleCourseInput = (value) => {
    setValue('course_name', value, { shouldValidate: true });

    const matched = courses.find((course) => course.name.toLowerCase() === value.trim().toLowerCase());
    if (matched) {
      setValue('course_id', String(matched.id), { shouldValidate: true });
      clearErrors('course_id');
      if (matched.name.trim().toUpperCase() !== 'BE') {
        setValue('branch_name', '', { shouldValidate: true });
        setValue('branch_code', '', { shouldValidate: true });
        clearErrors('branch_code');
      }
    } else {
      setValue('course_id', '', { shouldValidate: true });
      setValue('branch_name', '', { shouldValidate: true });
      setValue('branch_code', '', { shouldValidate: true });
    }
  };

  const onSubmit = async (data) => {
    setError('');
    setSuccess('');

    try {
      if (requiresBranch && !data.branch_code?.trim()) {
        setError('Please select a valid branch for BE.');
        return;
      }

      const formData = new FormData();
      formData.append('branch_code', requiresBranch ? data.branch_code.trim() : '');
      formData.append('course_id', data.course_id.trim());
      formData.append('enrolled_year', data.enrolled_year.trim());
      formData.append('file', data.file[0]);

      const res = await axios.post(`${SERVER_URL}/admin/bulk-import`, formData, {
        withCredentials: true,
        headers: {
          'Content-Type': 'multipart/form-data'
        }
      });

      setSuccess(res.data?.message || 'Bulk import completed successfully.');
      setLastImport({
        branch_code: data.branch_code.trim(),
        branch_name: requiresBranch ? data.branch_name.trim() : 'No branch',
        course_name: data.course_name.trim(),
        course_id: data.course_id.trim(),
        enrolled_year: data.enrolled_year.trim(),
        batch_no: res.data?.batch_no || batchNoPreview || '-',
        resolved_batch_id: res.data?.batch_id || '-',
        batch_created: Boolean(res.data?.batch_created),
        fileName: data.file[0]?.name || '-',
        message: res.data?.message || ''
      });
      reset(defaultValues);
    } catch (err) {
      const serverMessage = err.response?.data?.message || 'Bulk import failed.';
      const serverError = err.response?.data?.error;
      const displayMessage = serverError ? `${serverMessage} (${serverError})` : serverMessage;
      const duplicates = err.response?.data?.duplicates;
      const duplicateDetails = err.response?.data?.duplicate_details;
      if (Array.isArray(duplicates) && duplicates.length) {
        if (Array.isArray(duplicateDetails) && duplicateDetails.length) {
          const detailText = duplicateDetails
            .map((d) => `${d.enrollment_no} (rows ${d.first_row}, ${d.duplicate_row})`)
            .join('; ');
          setError(`${displayMessage} Duplicate enrollment(s): ${duplicates.join(', ')}. Details: ${detailText}`);
        } else {
          setError(`${displayMessage} Duplicate enrollment(s): ${duplicates.join(', ')}`);
        }
      } else {
        setError(displayMessage);
      }
    }
  };

  const downloadTemplate = () => {
    const headers = ['EnrollmentNo', 'Name', 'Division', 'DefaultPassword'];
    const sampleRows = [
      ['230280116157', 'Het Virani', 'A', 'MyPass@123'],
      ['ENR010', 'Mansi Shah', 'A', ''],
      ['ENR009', 'Rohan Solanki', '', '']
    ];

    const csv = [headers, ...sampleRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'bulk_import_template.csv';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  return (
    <div className="space-y-5">
      <SectionCard label="Bulk Import Students">
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5">
          {error ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
          ) : null}

          {success ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div>
          ) : null}

          <div>
            <p className="text-xs font-bold text-slate-600 uppercase tracking-wide border-b border-slate-200 pb-2 mb-4">
              Upload Details
            </p>

            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
              <FormField label="Course" required>
                <input
                  className={inputCls}
                  placeholder={coursesLoading ? 'Loading courses...' : 'Type to search courses'}
                  list="courses-list"
                  value={courseName}
                  onChange={(e) => handleCourseInput(e.target.value)}
                  disabled={coursesLoading}
                />
                <datalist id="courses-list">
                  {filteredCourses.map((course) => (
                    <option key={course.id} value={course.name}>
                      {course.name}
                    </option>
                  ))}
                </datalist>
                <input type="hidden" {...register('course_id')} />
                {errors.course_name ? <p className="mt-1 text-xs text-error">{errors.course_name.message}</p> : null}
                {errors.course_id ? <p className="mt-1 text-xs text-error">{errors.course_id.message}</p> : null}
              </FormField>

              {requiresBranch ? (
                <FormField label="Branch" required>
                  <input
                    className={inputCls}
                    placeholder={branchesLoading ? "Loading branches..." : "Type to search branches"}
                    list="branches-list"
                    value={branchName}
                    onChange={(e) => handleBranchInput(e.target.value)}
                    disabled={branchesLoading}
                  />
                  <datalist id="branches-list">
                    {filteredBranches.map((branch) => {
                      const label = branch.display_name || branch.name + " - " + branch.branch_code;
                      return (
                        <option key={branch.branch_code} value={label}>
                          {label}
                        </option>
                      );
                    })}
                  </datalist>
                  <input type="hidden" {...register("branch_code")} />
                  {errors.branch_name ? <p className="mt-1 text-xs text-error">{errors.branch_name.message}</p> : null}
                  {errors.branch_code ? <p className="mt-1 text-xs text-error">{errors.branch_code.message}</p> : null}
                </FormField>
              ) : (
                <input type="hidden" {...register("branch_code")} />
              )}

              <FormField label="Enrolled Year" required>
                <input className={inputCls} placeholder="e.g. 2024" {...register('enrolled_year')} />
                {errors.enrolled_year ? <p className="mt-1 text-xs text-error">{errors.enrolled_year.message}</p> : null}
                {batchNoPreview ? (
                  <p className="mt-1 text-xs text-slate-500">Batch No: {batchNoPreview}</p>
                ) : null}
              </FormField>

              <FormField label="Excel File" required>
                <input
                  type="file"
                  className="file-input file-input-bordered w-full"
                  accept=".xlsx,.xls,.csv"
                  {...register('file')}
                />
                {errors.file ? <p className="mt-1 text-xs text-error">{errors.file.message}</p> : null}
                {selectedFile ? (
                  <p className="mt-1 text-xs text-slate-500">Selected: {selectedFile.name}</p>
                ) : null}
              </FormField>
            </div>
          </div>

          <div className="flex flex-wrap gap-3 pt-1">
            <button
              type="submit"
              disabled={isSubmitting}
              className="flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {isSubmitting ? <span className="loading loading-spinner loading-xs" /> : null}
              {isSubmitting ? 'Uploading...' : 'Upload & Import'}
            </button>

            <button
              type="button"
              disabled={isSubmitting}
              onClick={() => {
                reset(defaultValues);
                setError('');
                setSuccess('');
                setLastImport(null);
              }}
              className="px-5 py-2.5 rounded-lg border border-slate-200 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
            >
              Reset Form
            </button>

            <button
              type="button"
              onClick={downloadTemplate}
              className="px-5 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold transition"
            >
              Download Sample Template
            </button>
          </div>
        </form>
      </SectionCard>

      <SectionCard label="Expected Excel Format">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-slate-200">
                {['EnrollmentNo', 'Name', 'Division', 'DefaultPassword'].map((h) => (
                  <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              <tr className="border-b border-slate-100">
                <td className="py-3 px-3 text-sm text-slate-700 font-mono">230280116157</td>
                <td className="py-3 px-3 text-sm text-slate-700">Het Virani</td>
                <td className="py-3 px-3 text-sm text-slate-700">A</td>
                <td className="py-3 px-3 text-sm text-slate-700">MyPass@123</td>
              </tr>
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-slate-500">
          Required columns: EnrollmentNo, Name. Division defaults to A, DefaultPassword defaults to LDCE@123 when empty.
        </p>
      </SectionCard>

      {lastImport ? (
        <SectionCard label="Last Import Action">
          <div className="grid grid-cols-1 md:grid-cols-5 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Branch</p>
              <p className="text-slate-700 font-medium">{lastImport.branch_name || lastImport.branch_code}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Course</p>
              <p className="text-slate-700 font-medium">{lastImport.course_name}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Course ID</p>
              <p className="text-slate-700 font-medium">{lastImport.course_id}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Batch No</p>
              <p className="text-slate-700 font-medium">{lastImport.batch_no}</p>
              <p className="mt-1 text-xs text-slate-500">Enrolled: {lastImport.enrolled_year}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Resolved Batch ID</p>
              <p className="text-slate-700 font-medium">{lastImport.resolved_batch_id}</p>
              <p className="mt-1 text-xs text-slate-500">
                {lastImport.batch_created ? 'New batch created' : 'Existing batch used'}
              </p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">File</p>
              <p className="text-slate-700 font-medium break-all">{lastImport.fileName}</p>
            </div>
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm">
              <p className="text-xs text-emerald-700 uppercase font-semibold">Result</p>
              <p className="text-emerald-900 font-semibold">{lastImport.message || 'Import complete'}</p>
            </div>
          </div>
        </SectionCard>
      ) : null}
    </div>
  );
}
