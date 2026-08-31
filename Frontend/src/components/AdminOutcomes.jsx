import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import * as XLSX from 'xlsx';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const RowBadge = ({ label, tone }) => {
  const toneClass = tone === 'blue' ? 'badge-primary' : 'badge-success';
  return <div className={`badge ${toneClass} text-white`}>{label}</div>;
};

const hasContent = (row) => Boolean(row?.title || row?.description);

const normalizeText = (text) => (typeof text === 'string' ? text.trim() : '');

const STANDARD_PO_DESCRIPTIONS = {
  1: 'Apply knowledge of mathematics, natural science, computing, engineering fundamentals and an engineering specialization as specified in WK1 to WK4 respectively to develop to the solution of complex engineering problems.',
  2: 'Identify, formulate, review research literature and analyze complex engineering problems reaching substantiated conclusions with consideration for sustainable development.',
  3: 'Design creative solutions for complex engineering problems and design/develop systems/components/processes to meet identified needs with consideration for public health and safety, whole-life cost, net zero carbon, culture, society and environment as required.',
  4: 'Conduct investigations of complex engineering problems using research-based knowledge including design of experiments, modelling, analysis and interpretation of data to provide valid conclusions.',
  5: 'Create, select and apply appropriate techniques, resources and modern engineering and IT tools, including prediction and modelling, to complex engineering problems, with an understanding of their limitations.',
  6: 'Apply reasoning informed by contextual knowledge to assess societal, health, safety, legal and cultural issues and the consequent responsibilities relevant to professional engineering practice.',
  7: 'Understand and evaluate the sustainability and impact of professional engineering work in the solution of complex engineering problems in societal and environmental contexts.',
  8: 'Apply ethical principles and commit to professional ethics, human values, diversity and inclusion, and norms of engineering practice.',
  9: 'Function effectively as an individual, and as a member or leader in diverse and inclusive teams and in multidisciplinary, face-to-face, remote and distributed settings.',
  10: 'Communicate effectively and inclusively on complex engineering activities with the engineering community and with society at large, including writing effective reports and design documentation, making effective presentations, and giving and receiving clear instructions.',
  11: 'Demonstrate knowledge and understanding of engineering management principles and economic decision-making and apply these to one’s own work, as a member and leader in a team, and to manage projects in multidisciplinary environments.'
};

const resolvePoDescription = (poNumber, title, description) => {
  const cleanTitle = normalizeText(title).toLowerCase();
  const cleanDescription = normalizeText(description);
  if (cleanDescription && cleanDescription.toLowerCase() !== cleanTitle) {
    return cleanDescription;
  }

  return STANDARD_PO_DESCRIPTIONS[Number(poNumber)] || cleanDescription;
};

const toggleEditingRow = (setter, rowNumber) => {
  setter((prev) => (prev.includes(rowNumber) ? prev.filter((n) => n !== rowNumber) : [...prev, rowNumber]));
};

const updateDraftRow = (setter, rowNumber, key, value) => {
  setter((prev) => ({ ...prev, [rowNumber]: { ...prev[rowNumber], [key]: value } }));
};

const PO_ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
const PSO_ROWS = Array.from({ length: 4 }, (_, i) => i + 1);

const createDraftMap = (numbers, rows = [], keyName) => {
  const draft = Object.fromEntries(numbers.map((number) => [number, { title: '', description: '' }]));
  if (Array.isArray(rows) && keyName) {
    for (const r of rows) {
      const idx = Number(r[keyName]);
      if (Number.isFinite(idx)) {
        const title = r.title || '';
        const description = keyName === 'po_number' ? resolvePoDescription(idx, title, r.description) : r.description || '';
        draft[idx] = { title, description };
      }
    }
  }
  return draft;
};

export default function AdminOutcomes() {
  const [programOutcomes, setProgramOutcomes] = useState([]);
  const [programSpecificOutcomes, setProgramSpecificOutcomes] = useState([]);
  const [poDraft, setPoDraft] = useState({});
  const [psoDraft, setPsoDraft] = useState({});
  const [editingPoRows, setEditingPoRows] = useState([]);
  const [editingPsoRows, setEditingPsoRows] = useState([]);
  const [poDirtyRows, setPoDirtyRows] = useState([]);
  const [psoDirtyRows, setPsoDirtyRows] = useState([]);
  const [branches, setBranches] = useState([]);
  const [selectedBranch, setSelectedBranch] = useState('');
  const [savingPo, setSavingPo] = useState(false);
  const [savingPso, setSavingPso] = useState(false);
  const [importingPo, setImportingPo] = useState(false);
  const [importingPso, setImportingPso] = useState(false);
  const [importFile, setImportFile] = useState(null);
  const [importPsoFile, setImportPsoFile] = useState(null);
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState({ type: '', text: '' });

  const showMessage = (type, text) => setMessage({ type, text });

  const markPoDirty = (poNumber) => {
    setPoDirtyRows((prev) => (prev.includes(poNumber) ? prev : [...prev, poNumber]));
  };

  const markPsoDirty = (psoNumber) => {
    setPsoDirtyRows((prev) => (prev.includes(psoNumber) ? prev : [...prev, psoNumber]));
  };

  const syncPoDraft = (rows) => {
    const draft = createDraftMap(PO_ROWS, rows, 'po_number');
    setPoDraft(draft);
    setPoDirtyRows([]);
  };

  const syncPsoDraft = (rows) => {
    const draft = createDraftMap(PSO_ROWS, rows, 'pso_number');
    setPsoDraft(draft);
    setPsoDirtyRows([]);
  };

  const restorePoRow = (poNumber) => {
    const row = programOutcomes.find((item) => Number(item?.po_number) === poNumber);
    setPoDraft((prev) => ({
      ...prev,
      [poNumber]: {
        title: row?.title || '',
        description: row?.description || ''
      }
    }));
    setPoDirtyRows((prev) => prev.filter((item) => item !== poNumber));
  };

  const removePoRow = (poNumber) => {
    const remaining = programOutcomes.filter((item) => Number(item.po_number) !== poNumber);
    setProgramOutcomes(remaining);
    setPoDraft((prev) => ({ ...prev, [poNumber]: { title: '', description: '' } }));
    setEditingPoRows((prev) => prev.filter((item) => item !== poNumber));
(async () => {
      try {
        setSavingPo(true);
        const merged = remaining.map((r) => ({ po_number: Number(r.po_number), title: String(r.title || ''), description: String(r.description || '') }));
        const res = await axios.put(`${SERVER_URL}/attainment/program-outcomes`, { rows: merged }, { withCredentials: true });
        const updatedRows = Array.isArray(res.data?.program_outcomes) ? res.data.program_outcomes : [];
        setProgramOutcomes(updatedRows);
        syncPoDraft(updatedRows);
        showMessage('success', `PO${poNumber} removed.`);
      } catch (err) {
        showMessage('error', err?.response?.data?.message || 'Failed to remove PO.');
      } finally {
        setSavingPo(false);
      }
    })();
  };

  const restorePsoRow = (psoNumber) => {
    const row = programSpecificOutcomes.find((item) => Number(item?.pso_number) === psoNumber);
    setPsoDraft((prev) => ({
      ...prev,
      [psoNumber]: {
        title: row?.title || '',
        description: row?.description || ''
      }
    }));
    setPsoDirtyRows((prev) => prev.filter((item) => item !== psoNumber));
  };

  const handleAddPo = () => {
    // Find next available PO number up to 11
    const existing = programOutcomes.map((p) => Number(p.po_number));
    let next = 1;
    while (existing.includes(next) && next <= 11) next += 1;
    if (next > 11) {
      showMessage('error', 'Maximum PO count reached. Remove an existing PO to add a new one.');
      return;
    }

    // Initialize draft for the new PO and open edit
    setPoDraft((prev) => ({ ...prev, [next]: { title: '', description: '' } }));
    setEditingPoRows((prev) => (prev.includes(next) ? prev : [...prev, next]));
    markPoDirty(next);
    showMessage('success', `PO${next} is ready for entry.`);
  };

  const handleAddPso = () => {
    const nextEmpty = PSO_ROWS.find((psoNumber) => !hasContent(psoDraft[psoNumber]));
    if (!nextEmpty) {
      showMessage('error', 'All standard PSO slots are already in use. Use Edit to update an existing row.');
      return;
    }

    setEditingPsoRows((prev) => (prev.includes(nextEmpty) ? prev : [...prev, nextEmpty]));
    markPsoDirty(nextEmpty);
    showMessage('success', `PSO${nextEmpty} is ready for entry.`);
  };

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: '', text: '' }), 3000);
    return () => clearTimeout(timer);
  }, [message.text]);

  useEffect(() => {
    const loadBranches = async () => {
      try {
        setLoading(true);
        const res = await axios.get(`${SERVER_URL}/admin/departments`, { withCredentials: true });
        const deptRows = Array.isArray(res.data?.departments) ? res.data.departments : [];
        setBranches(deptRows);
        if (deptRows.length) {
          setSelectedBranch(deptRows[0].branch_code);
        }
      } catch (err) {
        showMessage('error', err?.response?.data?.message || 'Failed to load departments.');
      } finally {
        setLoading(false);
      }
    };

    loadBranches();
  }, []);

  useEffect(() => {
    const loadOutcomes = async () => {
      if (!selectedBranch) return;

      try {
        setLoading(true);
        const [poRes, psoRes] = await Promise.all([
          axios.get(`${SERVER_URL}/attainment/program-outcomes`, { withCredentials: true }),
          axios.get(`${SERVER_URL}/attainment/program-specific-outcomes/${selectedBranch}`, { withCredentials: true })
        ]);

        const poRows = Array.isArray(poRes.data?.program_outcomes) ? poRes.data.program_outcomes : [];
        const psoRows = Array.isArray(psoRes.data?.program_specific_outcomes) ? psoRes.data.program_specific_outcomes : [];

        setProgramOutcomes(poRows);
        setProgramSpecificOutcomes(psoRows);
        syncPoDraft(poRows);
        syncPsoDraft(psoRows);
      } catch (err) {
        showMessage('error', err?.response?.data?.message || 'Failed to load PO/PSO outcomes.');
      } finally {
        setLoading(false);
      }
    };

    loadOutcomes();
  }, [selectedBranch]);

  const branchLabel = useMemo(() => {
    const match = branches.find((b) => b.branch_code === selectedBranch);
    return match ? (match.display_name || `${match.branch_code} - ${match.name}`) : '';
  }, [branches, selectedBranch]);

  const saveProgramOutcomes = async (sourceLabel = '') => {
    // Build rows from current programOutcomes and any draft edits/new PO entries
    const merged = new Map();

    // Start with existing program outcomes
    for (const po of programOutcomes) {
      const poNumber = Number(po.po_number);
      const title = String(po.title || '');
      merged.set(poNumber, { po_number: poNumber, title, description: resolvePoDescription(poNumber, title, po.description) });
    }

    // Apply drafts (edits or newly added rows)
    for (const [poNumberStr, draft] of Object.entries(poDraft || {})) {
      const pn = Number(poNumberStr);
      if (!pn || (!draft.title && !draft.description && !merged.has(pn))) continue;
      // Only include drafts that have content or already exist
      if (draft.title || draft.description || merged.has(pn)) {
        const title = normalizeText(draft.title);
        merged.set(pn, { po_number: pn, title, description: resolvePoDescription(pn, title, draft.description) });
      }
    }

    const rows = Array.from(merged.values()).sort((a, b) => a.po_number - b.po_number);

    try {
      setSavingPo(true);
      const res = await axios.put(`${SERVER_URL}/attainment/program-outcomes`, { rows }, { withCredentials: true });
      const updatedRows = Array.isArray(res.data?.program_outcomes) ? res.data.program_outcomes : [];
      setProgramOutcomes(updatedRows);
      syncPoDraft(updatedRows);
      setEditingPoRows([]);
      showMessage('success', sourceLabel ? `${sourceLabel} applied successfully.` : 'Global PO outcomes saved successfully.');
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to save PO outcomes.');
    } finally {
      setSavingPo(false);
    }
  };

  const saveProgramOutcomeRow = async (poNumber) => {
    const draft = poDraft?.[poNumber] || {};
    const existingRow = programOutcomes.find((item) => Number(item?.po_number) === poNumber);
    const title = normalizeText(draft.title ?? existingRow?.title);
    const description = resolvePoDescription(poNumber, title, draft.description ?? existingRow?.description);

    if (!title && !description) {
      showMessage('error', `Enter a title or description for PO${poNumber} before applying.`);
      return;
    }

    const merged = new Map();
    for (const po of programOutcomes) {
      const currentNumber = Number(po.po_number);
      if (Number.isFinite(currentNumber)) {
        merged.set(currentNumber, {
          po_number: currentNumber,
          title: String(po.title || ''),
          description: resolvePoDescription(currentNumber, po.title, po.description)
        });
      }
    }

    merged.set(poNumber, { po_number: poNumber, title, description });
    const rows = Array.from(merged.values()).sort((a, b) => a.po_number - b.po_number);

    try {
      setSavingPo(true);
      const res = await axios.put(`${SERVER_URL}/attainment/program-outcomes`, { rows }, { withCredentials: true });
      const updatedRows = Array.isArray(res.data?.program_outcomes) ? res.data.program_outcomes : [];
      setProgramOutcomes(updatedRows);
      syncPoDraft(updatedRows);
      setEditingPoRows((prev) => prev.filter((item) => item !== poNumber));
      showMessage('success', `PO${poNumber} applied successfully.`);
    } catch (err) {
      showMessage('error', err?.response?.data?.message || `Failed to save PO${poNumber}.`);
    } finally {
      setSavingPo(false);
    }
  };

  const saveProgramSpecificOutcomes = async (sourceLabel = '') => {
    if (!selectedBranch) {
      showMessage('error', 'Select a branch first.');
      return;
    }

    const rows = PSO_ROWS.map((psoNumber) => ({
      pso_number: psoNumber,
      title: normalizeText(psoDraft?.[psoNumber]?.title),
      description: normalizeText(psoDraft?.[psoNumber]?.description)
    }));

    try {
      setSavingPso(true);
      const res = await axios.put(
        `${SERVER_URL}/attainment/program-specific-outcomes/${selectedBranch}`,
        { rows },
        { withCredentials: true }
      );
      const updatedRows = Array.isArray(res.data?.program_specific_outcomes) ? res.data.program_specific_outcomes : [];
      setProgramSpecificOutcomes(updatedRows);
      syncPsoDraft(updatedRows);
      showMessage('success', sourceLabel ? `${sourceLabel} applied successfully.` : 'Branch PSO outcomes saved successfully.');
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to save PSO outcomes.');
    } finally {
      setSavingPso(false);
    }
  };

  const downloadPoTemplate = () => {
    const headers = [
      'PO Number',
      'Title',
      'Description',
      'Competency Number',
      'Competency Text',
      'Indicator Number',
      'Indicator Text'
    ];

    const sampleRows = [
      ['1', 'Engineering knowledge', 'Apply knowledge of mathematics, science, engineering fundamentals and an engineering specialization to the solution of complex engineering problems.', '1.1', 'Ability to apply fundamentals', '1.1.1', 'Identify and apply core engineering principles.'],
      ['1', '', '', '1.2', 'Ability to extend knowledge', '1.2.1', 'Use engineering theory in practical work.'],
      ['2', 'Problem analysis', 'Identify, formulate, review research literature, and analyze complex engineering problems reaching substantiated conclusions.', '2.1', 'Problem decomposition', '2.1.1', 'Break a complex problem into smaller elements.']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PO Import');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'po-import-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const downloadPsoTemplate = () => {
    const headers = [
      'PSO Number',
      'Title',
      'Description'
    ];

    const sampleRows = [
      ['1', 'Core Domain Expertise', 'Graduates will demonstrate competence in core discipline fundamentals, applying theoretical principles to analyze and solve real-world engineering problems.'],
      ['2', 'System Design & Development', 'Graduates will design, implement, and evaluate software, hardware, or integrated systems to meet specified industrial and societal needs.'],
      ['3', 'Professional Practice & Innovation', 'Graduates will adapt to emerging technologies, follow ethical engineering standards, and engage in lifelong learning and innovation.']
    ];

    const worksheet = XLSX.utils.aoa_to_sheet([headers, ...sampleRows]);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, 'PSO Import');
    const data = XLSX.write(workbook, { bookType: 'xlsx', type: 'array' });
    const blob = new Blob([data], {
      type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
    });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = 'pso-import-template.xlsx';
    link.click();
    URL.revokeObjectURL(url);
  };

  const handleImportFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImportFile(file);
  };

  const handleImportPsoFileChange = (event) => {
    const file = event.target.files?.[0] || null;
    setImportPsoFile(file);
  };

  const uploadPsoDocument = async () => {
    if (!importPsoFile) {
      showMessage('error', 'Choose a PSO import file first.');
      return;
    }
    if (!selectedBranch) {
      showMessage('error', 'Select a branch first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', importPsoFile);

    try {
      setImportingPso(true);
      const res = await axios.post(`${SERVER_URL}/attainment/program-specific-outcomes/import/${selectedBranch}`, formData, {
        withCredentials: true
      });

      const importedRows = Array.isArray(res.data?.program_specific_outcomes) ? res.data.program_specific_outcomes : [];
      setProgramSpecificOutcomes(importedRows);
      syncPsoDraft(importedRows);
      setImportPsoFile(null);
      showMessage('success', res.data?.message || 'PSO document imported successfully.');
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to import PSO document.');
    } finally {
      setImportingPso(false);
    }
  };

  const uploadPoDocument = async () => {
    if (!importFile) {
      showMessage('error', 'Choose a PO import file first.');
      return;
    }

    const formData = new FormData();
    formData.append('file', importFile);

    try {
      setImportingPo(true);
      const res = await axios.post(`${SERVER_URL}/attainment/program-outcomes/import`, formData, {
        withCredentials: true
      });

      const importedRows = Array.isArray(res.data?.program_outcomes) ? res.data.program_outcomes : [];
      setProgramOutcomes(importedRows);
      syncPoDraft(importedRows);
      setImportFile(null);
      showMessage('success', res.data?.message || 'PO document imported successfully.');
    } catch (err) {
      showMessage('error', err?.response?.data?.message || 'Failed to import PO document.');
    } finally {
      setImportingPo(false);
    }
  };

  return (
    <div className="space-y-6">
      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <h1 className="text-2xl font-bold text-slate-900">PO / PSO Master Outcomes</h1>
        <p className="mt-2 text-sm text-slate-600">
          Maintain global Program Outcomes (PO) and branch-specific Program Specific Outcomes (PSO).
        </p>
      </div>

      {message.text && (
        <div className={`alert ${message.type === 'error' ? 'alert-error' : 'alert-success'} shadow-sm`}>
          <span>{message.text}</span>
        </div>
      )}

      <div className="rounded-2xl border border-slate-200 bg-linear-to-br from-slate-50 to-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Import PO / PSO Document</h2>
            <p className="text-xs text-slate-500">
              Upload an Excel, CSV, or text-based PDF containing PO or PSO details.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button type="button" className="btn btn-sm btn-outline" onClick={downloadPoTemplate}>
              Download PO Template
            </button>
            <button type="button" className="btn btn-sm btn-outline text-blue-600 border-blue-300 hover:bg-blue-50" onClick={downloadPsoTemplate}>
              Download PSO Template
            </button>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-1 gap-4 lg:grid-cols-[1.3fr_0.7fr]">
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-700">Choose PO import file</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white hover:file:bg-slate-700"
              onChange={handleImportFileChange}
            />
            <p className="mt-2 text-xs text-slate-500">
              Expected columns: PO Number, Title, Description, Competency Number, Competency Text, Indicator Number, Indicator Text.
            </p>
          </div>
          <div className="rounded-xl border border-dashed border-slate-300 bg-white p-4">
            <label className="block text-sm font-semibold text-slate-700">Choose PSO import file</label>
            <input
              type="file"
              accept=".xlsx,.xls,.csv,.pdf"
              className="mt-2 block w-full text-sm text-slate-600 file:mr-4 file:rounded-lg file:border-0 file:bg-slate-900 file:px-4 file:py-2 file:text-white hover:file:bg-slate-700"
              onChange={handleImportPsoFileChange}
            />
            <p className="mt-2 text-xs text-slate-500">
              Expected columns: PSO Number, Title, Description (optional).
            </p>
          </div>

        </div>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="space-y-2">
            <p className="text-sm text-slate-600">
              PO file: {importFile ? `${importFile.name}` : 'No file selected'}
            </p>
            <p className="text-sm text-slate-600">
              PSO file: {importPsoFile ? `${importPsoFile.name}` : 'No file selected'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-primary"
              onClick={uploadPoDocument}
              disabled={importingPo}
            >
              {importingPo ? 'Importing PO...' : 'Import PO'}
            </button>
            <button
              type="button"
              className="btn btn-primary"
              onClick={uploadPsoDocument}
              disabled={importingPso || !selectedBranch}
            >
              {importingPso ? 'Importing PSO...' : 'Import PSO'}
            </button>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Global PO Outcomes</h2>
            <p className="text-xs text-slate-500">
              Import the PO document first, then use Add New, Edit, or Remove on the imported rows.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleAddPo}
              disabled={savingPo}
            >
              Add New PO
            </button>
            <button
              type="button"
              className="btn btn-sm bg-blue-600 text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => saveProgramOutcomes('PO changes')}
              disabled={savingPo || !poDirtyRows.length}
            >
              {savingPo ? 'Saving...' : 'Apply All PO'}
            </button>
          </div>
        </div>

        <div className="mt-4 space-y-3">
          {(() => {
            // Build the list of PO numbers to display: existing program outcomes and any active drafts
            const displaySet = new Set();
            for (const po of programOutcomes || []) {
              const n = Number(po.po_number);
              if (Number.isFinite(n)) displaySet.add(n);
            }
            for (const key of Object.keys(poDraft || {})) {
              const n = Number(key);
              const draft = poDraft[key];
              if (editingPoRows.includes(n) || hasContent(draft)) displaySet.add(n);
            }

            const displayList = Array.from(displaySet).sort((a, b) => a - b);

            if (!displayList.length) {
              return (
                <div className="rounded-xl border border-slate-200 p-6 bg-slate-50 text-sm text-slate-600">
                  No Program Outcomes found. Import a PO document or click "Add New PO" to create the first PO.
                </div>
              );
            }

            return displayList.map((poNumber) => {
              const isEditing = editingPoRows.includes(poNumber);
              const existingRow = programOutcomes.find((p) => Number(p.po_number) === poNumber) || null;
              const draftRow = poDraft?.[poNumber] || { title: existingRow?.title || '', description: existingRow?.description || '' };
              const titleText = draftRow.title || existingRow?.title || '';
              const descriptionText = resolvePoDescription(poNumber, titleText, draftRow.description || existingRow?.description);
              const isFilled = hasContent(draftRow) || Boolean(existingRow);

              return (
                <div key={poNumber} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                  <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                    <div className="flex items-center gap-3">
                      <RowBadge label={`PO${poNumber}`} tone="blue" />
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{isFilled ? (titleText || `PO${poNumber}`) : 'Empty'}</p>
                      </div>
                    </div>

                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        className="btn btn-xs btn-outline"
                        onClick={() => {
                          if (isEditing) {
                            restorePoRow(poNumber);
                          }
                          toggleEditingRow(setEditingPoRows, poNumber);
                        }}
                      >
                        {isEditing ? 'Cancel Edit' : 'Edit'}
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-outline btn-error"
                        onClick={() => removePoRow(poNumber)}
                        disabled={savingPo}
                      >
                        Remove
                      </button>
                      <button
                        type="button"
                        className="btn btn-xs btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                        onClick={() => saveProgramOutcomeRow(poNumber)}
                        disabled={savingPo || !poDirtyRows.includes(poNumber)}
                      >
                        Apply
                      </button>
                    </div>
                  </div>

                  {isEditing ? (
                    <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                      <label className="block text-sm">
                        <span className="mb-1 block font-medium text-gray-700">Title</span>
                        <input
                          className="input input-sm w-full bg-white text-slate-700 border border-slate-300"
                          placeholder={`PO${poNumber} title`}
                          value={draftRow.title}
                          onChange={(e) => {
                            updateDraftRow(setPoDraft, poNumber, 'title', e.target.value);
                            markPoDirty(poNumber);
                          }}
                        />
                      </label>

                      <label className="block text-sm md:col-span-2">
                        <span className="mb-1 block font-medium text-gray-700">Description</span>
                        <textarea
                          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
                          rows={3}
                          placeholder={`PO${poNumber} description`}
                          value={descriptionText}
                          onChange={(e) => {
                            updateDraftRow(setPoDraft, poNumber, 'description', e.target.value);
                            markPoDirty(poNumber);
                          }}
                        />
                      </label>
                    </div>
                  ) : (
                    <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                      {isFilled ? (
                        <p className="leading-6">{descriptionText || 'No description available.'}</p>
                      ) : (
                        <p>Import a PO document, or use Add New to activate this slot.</p>
                      )}
                    </div>
                  )}
                </div>
              );
            });
          })()}
        </div>
      </div>

      <div className="rounded-2xl border border-slate-200 bg-white p-6 shadow-sm">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-bold text-slate-900">Branch PSO Outcomes</h2>
            <p className="text-xs text-slate-500">
              All 4 branch-specific PSO rows are maintained here. Use Add New to activate a blank slot, or Edit to modify an existing row.
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              className="btn btn-sm btn-outline"
              onClick={handleAddPso}
              disabled={savingPso}
            >
              Add New PSO
            </button>
            <button
              type="button"
              className="btn btn-sm bg-emerald-600 text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              onClick={() => saveProgramSpecificOutcomes('PSO changes')}
              disabled={savingPso || !psoDirtyRows.length}
            >
              {savingPso ? 'Saving...' : 'Apply All PSO'}
            </button>
          </div>
        </div>

        <div className="mt-4">
          <label className="text-sm font-semibold text-slate-700">Select Branch</label>
          <select
            className="mt-2 w-full max-w-sm rounded-lg border border-slate-300 px-3 py-2 text-sm"
            value={selectedBranch}
            onChange={(e) => setSelectedBranch(e.target.value)}
          >
            {branches.map((branch) => (
              <option key={branch.branch_code} value={branch.branch_code}>
                {branch.display_name || `${branch.branch_code} - ${branch.name}`}
              </option>
            ))}
          </select>
          {branchLabel && (
            <p className="mt-2 text-xs text-slate-500">Editing PSO for {branchLabel}</p>
          )}
        </div>

        <div className="mt-4 space-y-3">
          {(() => {
            const displaySet = new Set();
            for (const pso of programSpecificOutcomes || []) {
              const n = Number(pso.pso_number);
              if (Number.isFinite(n)) displaySet.add(n);
            }
            for (const key of Object.keys(psoDraft || {})) {
              const n = Number(key);
              const draft = psoDraft[key];
              if (editingPsoRows.includes(n) || hasContent(draft)) displaySet.add(n);
            }

            const displayList = Array.from(displaySet).sort((a, b) => a - b);

            if (!displayList.length) {
              return (
                <div className="rounded-xl border border-slate-200 p-6 bg-slate-50 text-sm text-slate-600">
                  No PSO outcomes found for this branch. Import a PSO document or click "Add New PSO" to create the first one.
                </div>
              );
            }

            return displayList.map((psoNumber) => {
              const isEditing = editingPsoRows.includes(psoNumber);
              const existingRow = programSpecificOutcomes.find((p) => Number(p.pso_number) === psoNumber) || null;
              const draftRow = psoDraft?.[psoNumber] || { title: existingRow?.title || '', description: existingRow?.description || '' };
              const titleText = draftRow.title || existingRow?.title || '';
              const descriptionText = draftRow.description || existingRow?.description || '';
              const isFilled = hasContent(draftRow) || Boolean(existingRow);

              return (
              <div key={psoNumber} className="rounded-xl border border-slate-200 p-4 bg-slate-50">
                <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
                  <div className="flex items-center gap-3">
                    <RowBadge label={`PSO${psoNumber}`} tone="emerald" />
                    <div>
                      <p className="text-sm font-semibold text-slate-800">{isFilled ? (titleText || `PSO${psoNumber}`) : 'Empty'}</p>
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      className="btn btn-xs btn-outline"
                      onClick={() => {
                        if (isEditing) {
                          restorePsoRow(psoNumber);
                        }
                        toggleEditingRow(setEditingPsoRows, psoNumber);
                      }}
                    >
                      {isEditing ? 'Cancel Edit' : 'Edit'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-outline btn-error"
                      onClick={() => {
                        const remaining = programSpecificOutcomes.filter((item) => Number(item.pso_number) !== psoNumber);
                        setProgramSpecificOutcomes(remaining);
                        setPsoDraft((prev) => ({ ...prev, [psoNumber]: { title: '', description: '' } }));
                        setEditingPsoRows((prev) => prev.filter((item) => item !== psoNumber));
                        
                        (async () => {
                          try {
                            setSavingPso(true);
                            const rows = remaining.map((r) => ({ pso_number: Number(r.pso_number), title: String(r.title || ''), description: String(r.description || '') }));
                            const res = await axios.put(`${SERVER_URL}/attainment/program-specific-outcomes/${selectedBranch}`, { rows }, { withCredentials: true });
                            const updatedRows = Array.isArray(res.data?.program_specific_outcomes) ? res.data.program_specific_outcomes : [];
                            setProgramSpecificOutcomes(updatedRows);
                            syncPsoDraft(updatedRows);
                            showMessage('success', `PSO${psoNumber} removed.`);
                          } catch (err) {
                            showMessage('error', err?.response?.data?.message || 'Failed to remove PSO.');
                          } finally {
                            setSavingPso(false);
                          }
                        })();
                      }}
                      disabled={savingPso}
                    >
                      Remove
                    </button>
                    <button
                      type="button"
                      className="btn btn-xs btn-primary disabled:cursor-not-allowed disabled:opacity-50"
                      onClick={() => saveProgramSpecificOutcomes(`PSO${psoNumber}`)}
                      disabled={savingPso || !psoDirtyRows.includes(psoNumber)}
                    >
                      Apply
                    </button>
                  </div>
                </div>

                {isEditing ? (
                  <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-3">
                    <label className="block text-sm">
                      <span className="mb-1 block font-medium text-gray-700">Title</span>
                      <input
                        className="input input-sm w-full bg-white text-slate-700 border border-slate-300"
                        placeholder={`PSO${psoNumber} title`}
                        value={draftRow.title}
                        onChange={(e) => {
                          updateDraftRow(setPsoDraft, psoNumber, 'title', e.target.value);
                          markPsoDirty(psoNumber);
                        }}
                      />
                    </label>

                    <label className="block text-sm md:col-span-2">
                      <span className="mb-1 block font-medium text-gray-700">Description</span>
                      <textarea
                        className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm bg-white text-slate-700"
                        rows={3}
                        placeholder={`PSO${psoNumber} description`}
                        value={descriptionText}
                        onChange={(e) => {
                          updateDraftRow(setPsoDraft, psoNumber, 'description', e.target.value);
                          markPsoDirty(psoNumber);
                        }}
                      />
                    </label>
                  </div>
                ) : (
                  <div className="mt-4 rounded-xl border border-dashed border-slate-300 bg-white p-4 text-sm text-slate-600">
                    {isFilled ? (
                      <p className="leading-6">{descriptionText || 'No description available.'}</p>
                    ) : (
                      <p>Import a PSO document, or use Add New to activate this slot.</p>
                    )}
                  </div>
                )}
              </div>
              );
            });
          })()}
        </div>
      </div>

      {loading && (
        <div className="flex items-center justify-center">
          <span className="loading loading-spinner loading-lg"></span>
        </div>
      )}
    </div>
  );
}
