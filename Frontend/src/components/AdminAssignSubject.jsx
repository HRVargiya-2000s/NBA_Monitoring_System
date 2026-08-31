import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || 'http://localhost:3000';

const inputCls =
  'w-full px-3 py-2 rounded-lg border border-slate-300 text-sm text-slate-700 ' +
  'focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent bg-white transition';

const SectionCard = ({ label, children }) => (
  <div className="border border-slate-200 bg-white rounded-lg overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-100 bg-slate-50">
      <span className="text-xs font-bold text-slate-700 uppercase tracking-wide">{label}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

export default function AdminAssignSubject() {
  const [accadmicYear, setAccadmicYear] = useState('');
  const [session, setSession] = useState('ODD');
  const [branchCode, setBranchCode] = useState('');
  const [departments, setDepartments] = useState([]);
  const [file, setFile] = useState(null);
  const [offeredSubjects, setOfferedSubjects] = useState([]);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [uploadSummary, setUploadSummary] = useState(null);

  const uniqueSubjectCodes = useMemo(() => {
    const codes = new Set(
      offeredSubjects
        .map((row) => String(row?.subject_code || '').trim())
        .filter(Boolean)
    );
    return Array.from(codes);
  }, [offeredSubjects]);

  useEffect(() => {
    const fetchDepartments = async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/subject/departments`, { withCredentials: true });
        setDepartments(Array.isArray(res.data?.departments) ? res.data.departments : []);
      } catch (err) {
        setDepartments([]);
      }
    };

    fetchDepartments();
  }, []);

  const fetchOfferings = async () => {
    setError('');
    setSuccess('');

    if (!accadmicYear.trim() || !session.trim()) {
      setError('Academic year and session are required to fetch offered subjects.');
      return;
    }

    try {
      setLoadingOfferings(true);
      const res = await axios.get(
        `${SERVER_URL}/subject/offered?accadmic_year=${encodeURIComponent(accadmicYear.trim())}&session=${encodeURIComponent(session.trim().toUpperCase())}`,
        { withCredentials: true }
      );
      const items = Array.isArray(res.data?.items) ? res.data.items : [];
      setOfferedSubjects(items);
      if (!items.length) {
        setError('No offered subjects found for selected academic year/session.');
      }
    } catch (err) {
      setOfferedSubjects([]);
      setError(err?.response?.data?.message || 'Failed to load offered subjects.');
    } finally {
      setLoadingOfferings(false);
    }
  };

  const downloadTemplate = () => {
    if (!uniqueSubjectCodes.length) {
      setError('Load offered subjects first to generate a template.');
      return;
    }

    const subjectColumnCount = Math.max(2, Math.min(6, uniqueSubjectCodes.length));
    const headers = ['EnrollmentNo.', 'Branch', ...Array.from({ length: subjectColumnCount }, (_, i) => `subject ${i + 1}`)];

    const fillSubjectCells = (startIndex) => {
      const cells = [];
      for (let i = 0; i < subjectColumnCount; i++) {
        cells.push(uniqueSubjectCodes[(startIndex + i) % uniqueSubjectCodes.length] || '');
      }
      return cells;
    };

    const sampleRows = [
      ['230280116001', branchCode || '16', ...fillSubjectCells(0)],
      ['230280116003', branchCode || '16', ...fillSubjectCells(0)],
      ['230280116006', branchCode || '16', ...fillSubjectCells(0)]
    ];

    const csv = [headers, ...sampleRows]
      .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
      .join('\n');

    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `student_offering_template_${accadmicYear.trim() || 'year'}_${session.trim() || 'session'}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  const uploadSheet = async () => {
    setError('');
    setSuccess('');
    setUploadSummary(null);

    if (!file) {
      setError('Please select an Excel/CSV file.');
      return;
    }

    if (!accadmicYear.trim() || !session.trim()) {
      setError('Academic year and session are required.');
      return;
    }

    try {
      setUploading(true);
      const formData = new FormData();
      formData.append('file', file);
      formData.append('accadmic_year', accadmicYear.trim());
      formData.append('session', session.trim().toUpperCase());
      if (branchCode.trim()) {
        formData.append('branch_code', branchCode.trim());
      }

      const res = await axios.post(`${SERVER_URL}/subject/student-offerings/upload`, formData, {
        withCredentials: true,
        headers: { 'Content-Type': 'multipart/form-data' }
      });

      setSuccess(res.data?.message || 'Student offering subjects uploaded successfully.');
      setUploadSummary({
        total_students: res.data?.total_students,
        total_mappings_saved: res.data?.total_mappings_saved,
        created_missing_students: res.data?.created_missing_students,
        missing_students: res.data?.missing_students || [],
        missing_offerings: res.data?.missing_offerings || []
      });
    } catch (err) {
      const data = err?.response?.data || {};
      setError(data?.message || 'Upload failed.');
      if (Array.isArray(data.missing_students) || Array.isArray(data.missing_offerings)) {
        setUploadSummary({
          total_students: data?.total_students,
          total_mappings_saved: data?.total_mappings_saved,
          created_missing_students: data?.created_missing_students,
          missing_students: data.missing_students || [],
          missing_offerings: data.missing_offerings || []
        });
      }
    } finally {
      setUploading(false);
    }
  };

  return (
    <div className="space-y-5">
      <SectionCard label="Assign Offering Subjects To Students">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Academic Year <span className="text-red-500">*</span></label>
            <input
              className={inputCls}
              placeholder="e.g. 2025-26"
              value={accadmicYear}
              onChange={(e) => setAccadmicYear(e.target.value)}
            />
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Session <span className="text-red-500">*</span></label>
            <select className={inputCls} value={session} onChange={(e) => setSession(e.target.value)}>
              <option value="ODD">ODD</option>
              <option value="EVEN">EVEN</option>
            </select>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Branch</label>
            <select className={inputCls} value={branchCode} onChange={(e) => setBranchCode(e.target.value)}>
              <option value="">Use sheet/DB branch</option>
              {departments.map((dept) => (
                <option key={dept.branch_code} value={dept.branch_code}>
                  {dept.branch_code} - {dept.name}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={fetchOfferings}
              disabled={loadingOfferings}
              className="w-full px-4 py-2.5 rounded-lg border border-blue-200 text-blue-700 hover:bg-blue-50 text-sm font-semibold transition"
            >
              {loadingOfferings ? 'Loading...' : 'Load Offered Subjects'}
            </button>
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-3">
          <button
            type="button"
            onClick={downloadTemplate}
            className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition"
          >
            Download Template
          </button>

          <label className="px-5 py-2.5 rounded-lg border border-slate-300 text-slate-700 hover:bg-slate-50 text-sm font-semibold transition cursor-pointer">
            Choose File
            <input
              type="file"
              className="hidden"
              accept=".xlsx,.xls,.csv"
              onChange={(e) => setFile(e.target.files?.[0] || null)}
            />
          </label>

          <button
            type="button"
            onClick={uploadSheet}
            disabled={uploading}
            className="px-5 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60"
          >
            {uploading ? 'Uploading...' : 'Upload & Assign'}
          </button>
        </div>

        <div className="mt-3 text-sm text-slate-600">
          {file ? `Selected file: ${file.name}` : 'No file selected.'}
        </div>

        {error ? (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        ) : null}

        {success ? (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div>
        ) : null}
      </SectionCard>

      <SectionCard label="Template Rules">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>Use first column as EnrollmentNo.</li>
          <li>Use Branch column or select a Branch before upload. Row Branch overrides selected Branch.</li>
          <li>Use generic headers like subject 1, subject 2, subject 3.</li>
          <li>Put actual subject codes in row cells (example: CS101, CS102).</li>
          <li>You can keep empty cells if a student has fewer subjects.</li>
          <li>Session can be ODD or EVEN (uppercase supported).</li>
        </ul>
      </SectionCard>

      <SectionCard label="Loaded Offered Subject Codes">
        {uniqueSubjectCodes.length ? (
          <div className="flex flex-wrap gap-2">
            {uniqueSubjectCodes.map((code) => (
              <span key={code} className="px-2.5 py-1 rounded-md bg-slate-100 text-slate-700 text-xs font-semibold">
                {code}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-slate-500">No offered subject codes loaded yet.</p>
        )}
      </SectionCard>

      {uploadSummary ? (
        <SectionCard label="Last Upload Summary">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Total Students</p>
              <p className="text-slate-700 font-medium">{uploadSummary.total_students ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Mappings Saved</p>
              <p className="text-slate-700 font-medium">{uploadSummary.total_mappings_saved ?? 0}</p>
            </div>
            <div className="rounded-lg border border-slate-200 p-3 text-sm">
              <p className="text-xs text-slate-500 uppercase font-semibold">Students Created</p>
              <p className="text-slate-700 font-medium">{uploadSummary.created_missing_students ?? 0}</p>
            </div>
          </div>

          {(uploadSummary.missing_students?.length || uploadSummary.missing_offerings?.length) ? (
            <div className="mt-4 text-sm text-amber-800 bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 space-y-3">
              <p className="font-semibold">Some rows could not be mapped.</p>
              {uploadSummary.missing_students?.length ? (
                <div>
                  <p className="text-xs uppercase font-bold text-amber-700">Missing Students</p>
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    {uploadSummary.missing_students.slice(0, 8).map((row, index) => (
                      <li key={`${row.enrollment_no}-${index}`}>
                        {row.enrollment_no} - {row.reason || 'Student not found'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
              {uploadSummary.missing_offerings?.length ? (
                <div>
                  <p className="text-xs uppercase font-bold text-amber-700">Missing Offerings</p>
                  <ul className="mt-1 list-disc pl-5 space-y-1">
                    {uploadSummary.missing_offerings.slice(0, 8).map((row, index) => (
                      <li key={`${row.enrollment_no}-${row.subject_code}-${index}`}>
                        {row.enrollment_no} - {row.subject_code} for branch {row.student_branch_code || 'unknown'}
                      </li>
                    ))}
                  </ul>
                </div>
              ) : null}
            </div>
          ) : null}
        </SectionCard>
      ) : null}
    </div>
  );
}
