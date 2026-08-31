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

const resolveFileName = (headerValue, fallback) => {
  if (!headerValue) return fallback;
  const fileNameMatch = /filename\*?=(?:UTF-8''|\")?([^;\"\n]+)/i.exec(headerValue);
  if (!fileNameMatch) return fallback;
  const name = decodeURIComponent(fileNameMatch[1]).replace(/\"/g, '').trim();
  return name || fallback;
};

const extractErrorMessage = async (error, fallback) => {
  const responseData = error?.response?.data;
  if (responseData instanceof Blob) {
    try {
      const text = await responseData.text();
      const parsed = JSON.parse(text);
      return parsed?.message || fallback;
    } catch {
      return fallback;
    }
  }

  return error?.response?.data?.message || fallback;
};

export default function AdminBatchReport() {
  const [branches, setBranches] = useState([]);
  const [branchCode, setBranchCode] = useState('');
  const [batchId, setBatchId] = useState('');
  const [batches, setBatches] = useState([]);
  const [loadingBranches, setLoadingBranches] = useState(false);
  const [loadingBatches, setLoadingBatches] = useState(false);
  const [downloading, setDownloading] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  useEffect(() => {
    let ignore = false;

    const fetchDepartments = async () => {
      setLoadingBranches(true);
      try {
        const res = await axios.get(`${SERVER_URL}/admin/departments`, { withCredentials: true });
        if (!ignore) {
          setBranches(res.data?.departments || []);
        }
      } catch {
        if (!ignore) {
          setBranches([]);
        }
      } finally {
        if (!ignore) {
          setLoadingBranches(false);
        }
      }
    };

    fetchDepartments();
    return () => {
      ignore = true;
    };
  }, []);

  const branchOptions = useMemo(
    () => branches.map((row) => ({
      code: String(row.branch_code || '').trim(),
      name: row.display_name || row.name || ''
    })),
    [branches]
  );

  useEffect(() => {
    let ignore = false;

    const fetchBatches = async () => {
      const cleanBranch = branchCode.trim();
      setBatches([]);
      setBatchId('');

      if (!cleanBranch) {
        return;
      }

      setLoadingBatches(true);
      try {
        const res = await axios.get(`${SERVER_URL}/admin/batches`, {
          params: { branch_code: cleanBranch },
          withCredentials: true
        });
        if (!ignore) {
          setBatches(res.data?.batches || []);
        }
      } catch {
        if (!ignore) {
          setBatches([]);
        }
      } finally {
        if (!ignore) {
          setLoadingBatches(false);
        }
      }
    };

    fetchBatches();
    return () => {
      ignore = true;
    };
  }, [branchCode]);

  const batchOptions = useMemo(
    () =>
      batches.map((row) => ({
        batch_id: String(row.batch_id),
        enrolled_year: row.enrolled_year,
        passing_year: row.passing_year,
        batch_no: row.batch_no,
        course_name: row.course_name || ''
      })),
    [batches]
  );

  const handleDownload = async () => {
    setError('');
    setSuccess('');

    const cleanBranch = branchCode.trim();
    const cleanBatch = batchId.trim();

    if (!cleanBranch) {
      setError('Branch code is required.');
      return;
    }

    if (!cleanBatch) {
      setError('Batch id is required.');
      return;
    }

    try {
      setDownloading(true);
      const response = await axios.get(`${SERVER_URL}/attainment/batch-report/download`, {
        params: {
          batch_id: cleanBatch,
          branch_code: cleanBranch
        },
        responseType: 'blob',
        withCredentials: true
      });

      const contentDisposition = response.headers['content-disposition'] || '';
      const filename = resolveFileName(
        contentDisposition,
        `batch_attainment_${cleanBranch || 'branch'}_${cleanBatch || 'batch'}.xlsx`
      );

      const blobUrl = URL.createObjectURL(new Blob([response.data]));
      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(blobUrl);

      setSuccess('Batch report downloaded successfully.');
    } catch (err) {
      const message = await extractErrorMessage(err, 'Failed to download batch report.');
      setError(message);
    } finally {
      setDownloading(false);
    }
  };

  return (
    <div className="space-y-5">
      <div>
        <h1 className="text-xl md:text-2xl font-bold text-slate-900">Batch Attainment Report</h1>
        <p className="text-sm text-slate-600">
          Download the consolidated PO/PSO average sheet and CO average sheet for a selected batch and department.
        </p>
      </div>

      <SectionCard label="Report Filters">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div>
            <label className="text-xs font-semibold text-slate-700">Branch Code <span className="text-red-500">*</span></label>
            {branchOptions.length ? (
              <select
                className={inputCls}
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
                disabled={loadingBranches}
              >
                <option value="">Select branch</option>
                {branchOptions.map((branch) => (
                  <option key={branch.code} value={branch.code}>
                    {branch.code} {branch.name ? `- ${branch.name}` : ''}
                  </option>
                ))}
              </select>
            ) : (
              <input
                className={inputCls}
                placeholder="e.g. CE"
                value={branchCode}
                onChange={(e) => setBranchCode(e.target.value)}
              />
            )}
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700">Batch ID <span className="text-red-500">*</span></label>
            <select
              className={inputCls}
              value={batchId}
              onChange={(e) => setBatchId(e.target.value)}
              disabled={loadingBatches || !branchCode}
            >
              <option value="">{loadingBatches ? 'Loading batches...' : 'Select batch'}</option>
              {batchOptions.map((batch) => (
                <option key={batch.batch_id} value={batch.batch_id}>
                  {batch.batch_no || batch.enrolled_year || batch.batch_id}
                  {batch.course_name ? ` - ${batch.course_name}` : ''}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-end">
            <button
              type="button"
              onClick={handleDownload}
              disabled={downloading}
              className="w-full px-4 py-2.5 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition disabled:opacity-60"
            >
              {downloading ? 'Downloading...' : 'Download Report'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mt-4 bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{error}</div>
        ) : null}

        {success ? (
          <div className="mt-4 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{success}</div>
        ) : null}
      </SectionCard>

      <SectionCard label="What You Get">
        <ul className="list-disc pl-5 text-sm text-slate-700 space-y-1">
          <li>PO-PSO Average sheet grouped by semester with all offered subjects.</li>
          <li>CO Average sheet grouped by semester with overall CO averages.</li>
          <li>Faculty names included for quick validation before sharing.</li>
        </ul>
      </SectionCard>
    </div>
  );
}
