import { useEffect, useMemo, useState } from 'react';
import axios from 'axios';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const getCurrentAcademicYearLabel = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, '0');
  return `${startYear}-${endYearShort}`;
};

const normalizeAcademicYear = (value) => {
  if (!value) return '';
  return String(value).trim();
};

const parseCoNumber = (coValue) => {
  if (coValue == null) return 'CO-';
  const numeric = Number(coValue);
  if (!Number.isNaN(numeric)) return `CO-${numeric}`;
  return `CO-${String(coValue)}`;
};

const formatSubjectOption = (subject) => {
  const session = subject.session || 'Session N/A';
  const division = subject.division || 'Div N/A';
  const sem = subject.sem_number != null ? `Sem ${subject.sem_number}` : 'Sem N/A';
  return `${subject.subject_code} - ${subject.subject_name || 'Unnamed Subject'} (${session}, ${division}, ${sem})`;
};

const CO_MATRIX_ROWS = Array.from({ length: 6 }, (_, i) => i + 1);
const PO_ROWS = Array.from({ length: 11 }, (_, i) => i + 1);
const PSO_ROWS = Array.from({ length: 4 }, (_, i) => i + 1);
const OUTCOME_COLUMNS = [
  ...Array.from({ length: 11 }, (_, i) => ({ type: 'PO', code: i + 1, key: `PO-${i + 1}`, label: `PO${i + 1}` })),
  ...Array.from({ length: 4 }, (_, i) => ({ type: 'PSO', code: i + 1, key: `PSO-${i + 1}`, label: `PSO${i + 1}` }))
];

const getLectureOrderNumber = (value) => {
  const text = String(value || '');
  const match = text.match(/\bLecture\s*(\d+)\b/i);
  if (!match) return Number.POSITIVE_INFINITY;

  const parsed = Number.parseInt(match[1], 10);
  return Number.isNaN(parsed) ? Number.POSITIVE_INFINITY : parsed;
};

const aiAssistSchema = z.object({
  aiLectureCount: z
    .string()
    .optional()
    .refine((value) => {
      const normalized = String(value || '').trim();
      if (!normalized) return true;
      const num = Number.parseInt(normalized, 10);
      return !Number.isNaN(num) && num >= 12 && num <= 120;
    }, 'Target lectures must be between 12 and 120')
});

export default function FacultySubjects() {
  const [subjects, setSubjects] = useState([]);
  const [selectedYear, setSelectedYear] = useState('');
  const [selectedSubjectKey, setSelectedSubjectKey] = useState('');

  const [courseOutcomes, setCourseOutcomes] = useState([]);
  const [editableCourseOutcomes, setEditableCourseOutcomes] = useState({});
  const [programOutcomes, setProgramOutcomes] = useState([]);
  const [editableProgramOutcomes, setEditableProgramOutcomes] = useState({});
  const [editableProgramOutcomeTitles, setEditableProgramOutcomeTitles] = useState({});
  const [programSpecificOutcomes, setProgramSpecificOutcomes] = useState([]);
  const [editableProgramSpecificOutcomes, setEditableProgramSpecificOutcomes] = useState({});
  const [editableProgramSpecificOutcomeTitles, setEditableProgramSpecificOutcomeTitles] = useState({});
  const [coPoStrength, setCoPoStrength] = useState([]);
  const [editableStrengthMatrix, setEditableStrengthMatrix] = useState({});
  const [editableJustificationMatrix, setEditableJustificationMatrix] = useState({});
  const [lecturePlans, setLecturePlans] = useState([]);

  const [loadingSubjects, setLoadingSubjects] = useState(true);
  const [loadingTables, setLoadingTables] = useState(false);
  const [error, setError] = useState('');
  const [subjectHint, setSubjectHint] = useState('');
  const [tablesError, setTablesError] = useState('');
  const [savingMatrix, setSavingMatrix] = useState(false);
  const [matrixSaveMessage, setMatrixSaveMessage] = useState('');
  const [savingCourseOutcomes, setSavingCourseOutcomes] = useState(false);
  const [savingProgramOutcomes, setSavingProgramOutcomes] = useState(false);
  const [savingProgramSpecificOutcomes, setSavingProgramSpecificOutcomes] = useState(false);
  const [savingLecturePlans, setSavingLecturePlans] = useState(false);
  const [savingIncludePso, setSavingIncludePso] = useState(false);
  const [syllabusFile, setSyllabusFile] = useState(null);
  const [uploadingSyllabus, setUploadingSyllabus] = useState(false);
  const [generatingAiContent, setGeneratingAiContent] = useState(false);
  const [clearingAiCache, setClearingAiCache] = useState(false);
  const [aiMessage, setAiMessage] = useState('');
  const [toast, setToast] = useState({ open: false, type: 'info', message: '' });

  const {
    register,
    handleSubmit,
    formState: { errors: aiFormErrors }
  } = useForm({
    resolver: zodResolver(aiAssistSchema),
    defaultValues: {
      aiLectureCount: ''
    }
  });

  const showToast = (type, message) => {
    setToast({ open: true, type, message });
  };

  useEffect(() => {
    if (!toast.open) return;
    const timer = setTimeout(() => {
      setToast((prev) => ({ ...prev, open: false }));
    }, 2600);
    return () => clearTimeout(timer);
  }, [toast.open, toast.message]);

  useEffect(() => {
    const fetchAssignedSubjects = async () => {
      try {
        setLoadingSubjects(true);
        setError('');
        setSubjectHint('');

        const profileRes = await axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true });
        const fromProfile = Array.isArray(profileRes.data?.assigned_subjects)
          ? profileRes.data.assigned_subjects
          : [];

        if (fromProfile.length > 0) {
          setSubjects(fromProfile);
          return;
        }

        const meRes = await axios.get(`${SERVER_URL}/user/me`, { withCredentials: true });
        const facultyId = meRes.data?.user?.id;

        if (!facultyId) {
          setSubjects([]);
          setSubjectHint('No faculty id found in session. Please re-login.');
          return;
        }

        const subjectRes = await axios.get(`${SERVER_URL}/subject/assign-subjected/${facultyId}`, {
          withCredentials: true
        });
        const fromSubjectRoute = Array.isArray(subjectRes.data) ? subjectRes.data : [];

        setSubjects(fromSubjectRoute);
        if (!fromSubjectRoute.length) {
          setSubjectHint('No subject assignments found for this faculty.');
        }
      } catch (err) {
        setError(err?.response?.data?.error || 'Failed to fetch assigned subjects.');
      } finally {
        setLoadingSubjects(false);
      }
    };

    fetchAssignedSubjects();
  }, []);

  const academicYears = useMemo(() => {
    const years = Array.from(
      new Set(subjects.map((s) => {
        const yearValue = s.academic_year || s.accadmic_year; 
        return normalizeAcademicYear(yearValue);
      }).filter(Boolean))
    );
    return years.sort((a, b) => b.localeCompare(a));
  }, [subjects]);

  useEffect(() => {
    if (!academicYears.length) {
      setSelectedYear('');
      return;
    }

    const currentYearLabel = getCurrentAcademicYearLabel();
    const defaultYear = academicYears.find((year) => year === currentYearLabel) || academicYears[0];
    setSelectedYear(defaultYear);
  }, [academicYears]);

  const filteredSubjects = useMemo(() => {
    if (!selectedYear) return [];
    return subjects.filter((s) => {
      const yearValue = s.academic_year || s.accadmic_year;
      return normalizeAcademicYear(yearValue) === selectedYear;
    });
  }, [subjects, selectedYear]);

  useEffect(() => {
    if (!filteredSubjects.length) {
      setSelectedSubjectKey('');
      return;
    }

    const existing = filteredSubjects.find((s) => String(s.subject_code) === selectedSubjectKey);
    if (!existing) {
      setSelectedSubjectKey(String(filteredSubjects[0].subject_code));
    }
  }, [filteredSubjects, selectedSubjectKey]);

  const selectedSubject = useMemo(() => {
    return filteredSubjects.find((s) => String(s.subject_code) === selectedSubjectKey) || null;
  }, [filteredSubjects, selectedSubjectKey]);

  useEffect(() => {
    const fetchTables = async () => {
      setCourseOutcomes([]);
      setProgramOutcomes([]);
      setProgramSpecificOutcomes([]);
      setCoPoStrength([]);
      setLecturePlans([]);
      setTablesError('');

      if (!selectedSubject) return;

      if (!selectedSubject.offering_id) {
        setTablesError('CO and CO-PO tables need offering_id for the selected subject. Check backend query.');
        return;
      }

      try {
        setLoadingTables(true);
        const offeringId = selectedSubject.offering_id;
        const branchCode = selectedSubject.branch_code;
        const includePso = Boolean(selectedSubject.include_pso);

        const [courseOutcomeResult, programOutcomeResult, programSpecificOutcomeResult, strengthResult, lectureResult] = await Promise.allSettled([
          axios.get(`${SERVER_URL}/attainment/course-outcomes/${offeringId}`, { withCredentials: true }),
          axios.get(`${SERVER_URL}/attainment/program-outcomes`, { withCredentials: true }),
          includePso && branchCode
            ? axios.get(`${SERVER_URL}/attainment/program-specific-outcomes/${branchCode}`, { withCredentials: true })
            : Promise.resolve({ data: { program_specific_outcomes: [] } }),
          axios.get(`${SERVER_URL}/attainment/co-po-pso/strength/${offeringId}`, { withCredentials: true }),
          axios.get(`${SERVER_URL}/lecture/plan/offering/${offeringId}`, { withCredentials: true })
        ]);

        if (courseOutcomeResult.status === 'fulfilled') {
          setCourseOutcomes(
            Array.isArray(courseOutcomeResult.value.data?.course_outcomes)
              ? courseOutcomeResult.value.data.course_outcomes
              : []
          );
        }

        if (programOutcomeResult.status === 'fulfilled') {
          setProgramOutcomes(
            Array.isArray(programOutcomeResult.value.data?.program_outcomes)
              ? programOutcomeResult.value.data.program_outcomes
              : []
          );
        }

        if (programSpecificOutcomeResult.status === 'fulfilled') {
          setProgramSpecificOutcomes(
            Array.isArray(programSpecificOutcomeResult.value.data?.program_specific_outcomes)
              ? programSpecificOutcomeResult.value.data.program_specific_outcomes
              : []
          );
        }

        if (strengthResult.status === 'fulfilled') {
          setCoPoStrength(
            Array.isArray(strengthResult.value.data?.strength_mappings)
              ? strengthResult.value.data.strength_mappings
              : []
          );
        }

        if (lectureResult.status === 'fulfilled') {
          setLecturePlans(
            Array.isArray(lectureResult.value.data?.lecture_plans)
              ? lectureResult.value.data.lecture_plans
              : []
          );
        }

        const failures = [
          courseOutcomeResult,
          programOutcomeResult,
          programSpecificOutcomeResult,
          strengthResult,
          lectureResult
        ].filter(
          (result) => result.status === 'rejected'
        );
        if (failures.length > 0) {
          const firstError = failures[0]?.reason?.response?.data?.message || 'Some table data could not be fetched.';
          setTablesError(firstError);
        }
      } catch (err) {
        setTablesError(err?.response?.data?.message || 'Failed to fetch CO/CO-PO table data.');
      } finally {
        setLoadingTables(false);
      }
    };

    fetchTables();
  }, [selectedSubject]);

  const strengthMatrix = useMemo(() => {
    const matrix = {};
    for (const row of coPoStrength) {
      const coNumber = Number.parseInt(row?.co_number, 10);
      const outcomeType = String(row?.outcome_type || '').toUpperCase();
      const outcomeCode = Number.parseInt(row?.outcome_code, 10);

      if (!coNumber || Number.isNaN(coNumber) || !outcomeType || !outcomeCode || Number.isNaN(outcomeCode)) {
        continue;
      }

      const rowKey = `CO-${coNumber}`;
      const colKey = `${outcomeType}-${outcomeCode}`;

      if (!matrix[rowKey]) {
        matrix[rowKey] = {};
      }

      matrix[rowKey][colKey] = row?.strength ?? '';
    }
    return matrix;
  }, [coPoStrength]);

  const justificationMatrix = useMemo(() => {
    const matrix = {};
    for (const row of coPoStrength) {
      const coNumber = Number.parseInt(row?.co_number, 10);
      const outcomeType = String(row?.outcome_type || '').toUpperCase();
      const outcomeCode = Number.parseInt(row?.outcome_code, 10);

      if (!coNumber || Number.isNaN(coNumber) || !outcomeType || !outcomeCode || Number.isNaN(outcomeCode)) {
        continue;
      }

      const rowKey = `CO-${coNumber}`;
      const colKey = `${outcomeType}-${outcomeCode}`;

      if (!matrix[rowKey]) {
        matrix[rowKey] = {};
      }

      matrix[rowKey][colKey] = row?.justification ?? '';
    }
    return matrix;
  }, [coPoStrength]);

  useEffect(() => {
    const initialMatrix = {};
    for (const coNumber of CO_MATRIX_ROWS) {
      const rowKey = `CO-${coNumber}`;
      initialMatrix[rowKey] = {};
      for (const col of OUTCOME_COLUMNS) {
        initialMatrix[rowKey][col.key] = strengthMatrix[rowKey]?.[col.key] ?? '';
      }
    }
    setEditableStrengthMatrix(initialMatrix);
    setMatrixSaveMessage('');
  }, [strengthMatrix]);

  useEffect(() => {
    const initialJustifications = {};
    for (const coNumber of CO_MATRIX_ROWS) {
      const rowKey = `CO-${coNumber}`;
      initialJustifications[rowKey] = {};
      for (const col of OUTCOME_COLUMNS) {
        initialJustifications[rowKey][col.key] = justificationMatrix[rowKey]?.[col.key] ?? '';
      }
    }
    setEditableJustificationMatrix(initialJustifications);
  }, [justificationMatrix]);

  useEffect(() => {
    const initialCourseOutcomeMap = {};
    for (const coNumber of CO_MATRIX_ROWS) {
      const row = courseOutcomes.find((item) => Number.parseInt(item?.co_number, 10) === coNumber);
      initialCourseOutcomeMap[`CO-${coNumber}`] = row?.co_description || '';
    }
    setEditableCourseOutcomes(initialCourseOutcomeMap);
  }, [courseOutcomes]);

  useEffect(() => {
    const initialProgramOutcomeMap = {};
    const initialProgramOutcomeTitleMap = {};
    for (const poNumber of PO_ROWS) {
      const row = programOutcomes.find((item) => Number.parseInt(item?.po_number, 10) === poNumber);
      initialProgramOutcomeMap[`PO-${poNumber}`] = row?.description || '';
      initialProgramOutcomeTitleMap[`PO-${poNumber}`] = row?.title || '';
    }
    setEditableProgramOutcomes(initialProgramOutcomeMap);
    setEditableProgramOutcomeTitles(initialProgramOutcomeTitleMap);
  }, [programOutcomes]);

  useEffect(() => {
    const initialProgramSpecificOutcomeMap = {};
    const initialProgramSpecificOutcomeTitleMap = {};
    for (const psoNumber of PSO_ROWS) {
      const row = programSpecificOutcomes.find((item) => Number.parseInt(item?.pso_number, 10) === psoNumber);
      initialProgramSpecificOutcomeMap[`PSO-${psoNumber}`] = row?.description || '';
      initialProgramSpecificOutcomeTitleMap[`PSO-${psoNumber}`] = row?.title || '';
    }
    setEditableProgramSpecificOutcomes(initialProgramSpecificOutcomeMap);
    setEditableProgramSpecificOutcomeTitles(initialProgramSpecificOutcomeTitleMap);
  }, [programSpecificOutcomes]);

  const [editableLecturePlans, setEditableLecturePlans] = useState([]);
  const [deletedLecturePlanIds, setDeletedLecturePlanIds] = useState([]);

  useEffect(() => {
    const normalized = lecturePlans.map((row, index) => ({
      id: row.id,
      description: row.description || '',
      created_at: row.created_at || null,
      tempKey: `existing-${row.id || index}`
    })).sort((a, b) => getLectureOrderNumber(a.description) - getLectureOrderNumber(b.description));

    setEditableLecturePlans(normalized);
    setDeletedLecturePlanIds([]);
  }, [lecturePlans]);

  const availableCoRowsForAi = useMemo(() => (
    CO_MATRIX_ROWS.map((coNumber) => ({
      co_number: coNumber,
      co_description: String(editableCourseOutcomes[`CO-${coNumber}`] || '').trim()
    })).filter((row) => row.co_description)
  ), [editableCourseOutcomes]);

  const availablePoRowsForAi = useMemo(() => (
    PO_ROWS.map((poNumber) => ({
      po_number: poNumber,
      title: String(editableProgramOutcomeTitles[`PO-${poNumber}`] || '').trim(),
      description: String(editableProgramOutcomes[`PO-${poNumber}`] || '').trim()
    })).filter((row) => row.title || row.description)
  ), [editableProgramOutcomes, editableProgramOutcomeTitles]);

  const availablePsoRowsForAi = useMemo(() => (
    PSO_ROWS.map((psoNumber) => ({
      pso_number: psoNumber,
      title: String(editableProgramSpecificOutcomeTitles[`PSO-${psoNumber}`] || '').trim(),
      description: String(editableProgramSpecificOutcomes[`PSO-${psoNumber}`] || '').trim()
    })).filter((row) => row.title || row.description)
  ), [editableProgramSpecificOutcomes, editableProgramSpecificOutcomeTitles]);

  const canGenerateAi = Boolean(
    selectedSubject?.offering_id &&
    availableCoRowsForAi.length > 0 &&
    availablePoRowsForAi.length > 0
  );

  const handleCourseOutcomeChange = (coNumber, value) => {
    const rowKey = `CO-${coNumber}`;
    setEditableCourseOutcomes((prev) => ({
      ...prev,
      [rowKey]: value
    }));
  };

  const handleProgramOutcomeChange = (poNumber, value) => {
    const rowKey = `PO-${poNumber}`;
    setEditableProgramOutcomes((prev) => ({
      ...prev,
      [rowKey]: value
    }));
  };

  const handleProgramOutcomeTitleChange = (poNumber, value) => {
    const rowKey = `PO-${poNumber}`;
    setEditableProgramOutcomeTitles((prev) => ({
      ...prev,
      [rowKey]: value
    }));
  };

  const handleProgramSpecificOutcomeChange = (psoNumber, value) => {
    const rowKey = `PSO-${psoNumber}`;
    setEditableProgramSpecificOutcomes((prev) => ({
      ...prev,
      [rowKey]: value
    }));
  };

  const handleProgramSpecificOutcomeTitleChange = (psoNumber, value) => {
    const rowKey = `PSO-${psoNumber}`;
    setEditableProgramSpecificOutcomeTitles((prev) => ({
      ...prev,
      [rowKey]: value
    }));
  };

  const saveCourseOutcomeTable = async () => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Cannot save course outcomes without offering id.');
      return;
    }

    const rows = CO_MATRIX_ROWS.map((coNumber) => ({
      co_number: coNumber,
      co_description: String(editableCourseOutcomes[`CO-${coNumber}`] || '').trim()
    }));

    try {
      setSavingCourseOutcomes(true);
      const response = await axios.put(
        `${SERVER_URL}/attainment/course-outcomes/${selectedSubject.offering_id}`,
        { rows },
        { withCredentials: true }
      );

      setCourseOutcomes(
        Array.isArray(response.data?.course_outcomes)
          ? response.data.course_outcomes
          : []
      );
      showToast('success', 'Course outcomes saved successfully.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save course outcomes.');
    } finally {
      setSavingCourseOutcomes(false);
    }
  };

  const saveProgramOutcomeTable = async () => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Select a subject first.');
      return;
    }

    const rows = PO_ROWS.map((poNumber) => ({
      po_number: poNumber,
      title: String(editableProgramOutcomeTitles[`PO-${poNumber}`] || '').trim(),
      description: String(editableProgramOutcomes[`PO-${poNumber}`] || '').trim()
    }));

    try {
      setSavingProgramOutcomes(true);
      const response = await axios.put(
        `${SERVER_URL}/attainment/program-outcomes`,
        { rows },
        { withCredentials: true }
      );

      setProgramOutcomes(
        Array.isArray(response.data?.program_outcomes)
          ? response.data.program_outcomes
          : []
      );
      showToast('success', 'Program outcomes saved successfully.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save program outcomes.');
    } finally {
      setSavingProgramOutcomes(false);
    }
  };

  const saveProgramSpecificOutcomeTable = async () => {
    if (!selectedSubject?.branch_code) {
      showToast('error', 'Cannot save PSO outcomes without branch code.');
      return;
    }

    const rows = PSO_ROWS.map((psoNumber) => ({
      pso_number: psoNumber,
      title: String(editableProgramSpecificOutcomeTitles[`PSO-${psoNumber}`] || '').trim(),
      description: String(editableProgramSpecificOutcomes[`PSO-${psoNumber}`] || '').trim()
    }));

    try {
      setSavingProgramSpecificOutcomes(true);
      const response = await axios.put(
        `${SERVER_URL}/attainment/program-specific-outcomes/${selectedSubject.branch_code}`,
        { rows },
        { withCredentials: true }
      );

      setProgramSpecificOutcomes(
        Array.isArray(response.data?.program_specific_outcomes)
          ? response.data.program_specific_outcomes
          : []
      );

      if (!response.data?.program_specific_outcomes?.length) {
        showToast('success', 'PSO cleared for this offering.');
      } else {
        showToast('success', 'Program specific outcomes saved successfully.');
      }
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save program specific outcomes.');
    } finally {
      setSavingProgramSpecificOutcomes(false);
    }
  };

  const handleMatrixCellChange = (rowKey, colKey, value) => {
    setEditableStrengthMatrix((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [colKey]: value
      }
    }));

    if (value === '') {
      setEditableJustificationMatrix((prev) => ({
        ...prev,
        [rowKey]: {
          ...(prev[rowKey] || {}),
          [colKey]: ''
        }
      }));
    }
  };

  const handleJustificationChange = (rowKey, colKey, value) => {
    setEditableJustificationMatrix((prev) => ({
      ...prev,
      [rowKey]: {
        ...(prev[rowKey] || {}),
        [colKey]: value
      }
    }));
  };

  const saveStrengthMatrix = async () => {
    if (!selectedSubject?.offering_id) {
      setMatrixSaveMessage('Cannot save without offering id.');
      showToast('error', 'Cannot save without offering id.');
      return;
    }

    const changes = [];
    for (const coNumber of CO_MATRIX_ROWS) {
      const rowKey = `CO-${coNumber}`;
      for (const col of OUTCOME_COLUMNS) {
        const nextValue = editableStrengthMatrix[rowKey]?.[col.key] ?? '';
        const currentValue = strengthMatrix[rowKey]?.[col.key] ?? '';
        const nextJustification = String(editableJustificationMatrix[rowKey]?.[col.key] ?? '').trim();
        const currentJustification = String(justificationMatrix[rowKey]?.[col.key] ?? '').trim();

        if (nextValue === '') {
          continue;
        }

        if (!nextJustification) {
          showToast('error', `Justification required for ${rowKey} ${col.label}.`);
          return;
        }

        if (`${nextValue}` === `${currentValue}` && nextJustification === currentJustification) {
          continue;
        }

        changes.push({
          co_number: coNumber,
          outcomeType: col.type,
          outcomeCode: col.code,
          strength: Number(nextValue),
          justification: nextJustification
        });
      }
    }

    if (!changes.length) {
      setMatrixSaveMessage('No matrix changes to save.');
      showToast('info', 'No matrix changes to save.');
      return;
    }

    try {
      setSavingMatrix(true);
      setMatrixSaveMessage('');

      await Promise.all(
        changes.map((change) => {
          const payload = {
            offering_id: selectedSubject.offering_id,
            co_number: change.co_number,
            strength: change.strength,
            justification: change.justification
          };

          if (change.outcomeType === 'PO') {
            payload.po_id = change.outcomeCode;
          } else {
            payload.pso_id = change.outcomeCode;
          }

          return axios.post(`${SERVER_URL}/attainment/co-po-pso/strength`, payload, { withCredentials: true });
        })
      );

      const strengthRes = await axios.get(
        `${SERVER_URL}/attainment/co-po-pso/strength/${selectedSubject.offering_id}`,
        { withCredentials: true }
      );
      setCoPoStrength(
        Array.isArray(strengthRes.data?.strength_mappings)
          ? strengthRes.data.strength_mappings
          : []
      );
      setMatrixSaveMessage('CO-PO matrix updated successfully.');
      showToast('success', 'Matrix saved successfully.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to save CO-PO matrix changes.';
      setMatrixSaveMessage(message);
      showToast('error', message);
    } finally {
      setSavingMatrix(false);
    }
  };

  const handleLecturePlanDescriptionChange = (tempKey, nextDescription) => {
    setEditableLecturePlans((prev) => prev.map((row) => (
      row.tempKey === tempKey
        ? { ...row, description: nextDescription }
        : row
    )));
  };

  const addLecturePlanRow = () => {
    setEditableLecturePlans((prev) => [
      ...prev,
      {
        id: null,
        description: '',
        created_at: null,
        tempKey: `new-${Date.now()}-${Math.random().toString(16).slice(2)}`
      }
    ]);
  };

  const removeLecturePlanRow = (row) => {
    setEditableLecturePlans((prev) => prev.filter((item) => item.tempKey !== row.tempKey));

    if (row.id) {
      setDeletedLecturePlanIds((prev) => (prev.includes(row.id) ? prev : [...prev, row.id]));
    }
  };

  const saveLecturePlanning = async () => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Cannot save lecture planning without offering id.');
      return;
    }

    const baselineMap = new Map(
      lecturePlans
        .filter((row) => row?.id)
        .map((row) => [Number(row.id), String(row.description || '').trim()])
    );

    const updates = editableLecturePlans
      .filter((row) => row.id)
      .map((row) => ({
        id: Number(row.id),
        description: String(row.description || '').trim()
      }))
      .filter((row) => row.description !== (baselineMap.get(row.id) || ''));

    const creates = editableLecturePlans
      .filter((row) => !row.id)
      .map((row) => String(row.description || '').trim())
      .filter(Boolean);

    if (!deletedLecturePlanIds.length && !updates.length && !creates.length) {
      showToast('info', 'No lecture planning changes to save.');
      return;
    }

    try {
      setSavingLecturePlans(true);

      await Promise.all([
        ...deletedLecturePlanIds.map((lecturePlanId) => axios.delete(
          `${SERVER_URL}/lecture/plan/${lecturePlanId}`,
          { withCredentials: true }
        )),
        ...updates.map((row) => axios.put(
          `${SERVER_URL}/lecture/plan/${row.id}`,
          { description: row.description },
          { withCredentials: true }
        )),
        ...creates.map((description) => axios.post(
          `${SERVER_URL}/lecture/plan/create`,
          {
            offering_id: selectedSubject.offering_id,
            description
          },
          { withCredentials: true }
        ))
      ]);

      const lectureRes = await axios.get(
        `${SERVER_URL}/lecture/plan/offering/${selectedSubject.offering_id}`,
        { withCredentials: true }
      );

      setLecturePlans(
        Array.isArray(lectureRes.data?.lecture_plans)
          ? lectureRes.data.lecture_plans
          : []
      );
      showToast('success', 'Lecture planning saved successfully.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to save lecture planning.');
    } finally {
      setSavingLecturePlans(false);
    }
  };

  const applyGeneratedStrengthMappings = (mappings) => {
    const nextMatrix = {};
    for (const coNumber of CO_MATRIX_ROWS) {
      const rowKey = `CO-${coNumber}`;
      nextMatrix[rowKey] = {};
      for (const col of OUTCOME_COLUMNS) {
        nextMatrix[rowKey][col.key] = '';
      }
    }

    const nextJustifications = {};
    for (const coNumber of CO_MATRIX_ROWS) {
      const rowKey = `CO-${coNumber}`;
      nextJustifications[rowKey] = {};
      for (const col of OUTCOME_COLUMNS) {
        nextJustifications[rowKey][col.key] = '';
      }
    }

    for (const item of mappings) {
      const coNumber = Number.parseInt(item?.co_number, 10);
      const outcomeType = String(item?.outcome_type || '').toUpperCase();
      const outcomeCode = Number.parseInt(item?.outcome_code, 10);
      const strength = Number.parseInt(item?.strength, 10);
      const justification = String(item?.justification || '').trim();

      if (!coNumber || coNumber < 1 || coNumber > 6) continue;
      if (!['PO', 'PSO'].includes(outcomeType)) continue;
      if (!outcomeCode || Number.isNaN(outcomeCode)) continue;
      if (Number.isNaN(strength) || strength < 0 || strength > 3) continue;

      const rowKey = `CO-${coNumber}`;
      const colKey = `${outcomeType}-${outcomeCode}`;
      if (nextMatrix[rowKey] && Object.prototype.hasOwnProperty.call(nextMatrix[rowKey], colKey)) {
        nextMatrix[rowKey][colKey] = String(strength);
      }
      if (nextJustifications[rowKey] && Object.prototype.hasOwnProperty.call(nextJustifications[rowKey], colKey)) {
        nextJustifications[rowKey][colKey] = justification;
      }
    }

    setEditableStrengthMatrix(nextMatrix);
    setEditableJustificationMatrix(nextJustifications);
  };

  const applyGeneratedLecturePlan = (lecturePlan) => {
    const sortedLecturePlan = [...lecturePlan].sort((a, b) => {
      const aNo = Number.parseInt(a?.lecture_no, 10);
      const bNo = Number.parseInt(b?.lecture_no, 10);
      return (Number.isNaN(aNo) ? Number.POSITIVE_INFINITY : aNo) - (Number.isNaN(bNo) ? Number.POSITIVE_INFINITY : bNo);
    });

    const rows = sortedLecturePlan.map((item, index) => {
      const unit = String(item?.unit || '').trim();
      const lectureNo = Number.parseInt(item?.lecture_no, 10);
      const topic = String(item?.topic || '').trim();
      const coNumber = Number.parseInt(item?.co_number, 10);

      const parts = [
        unit || `Unit ${Math.floor(index / 5) + 1}`,
        Number.isNaN(lectureNo) ? `Lecture ${index + 1}` : `Lecture ${lectureNo}`,
        Number.isNaN(coNumber) ? '' : `CO-${coNumber}`,
        topic
      ].filter(Boolean);

      return {
        id: null,
        description: parts.join(' | '),
        created_at: null,
        tempKey: `ai-${Date.now()}-${index}`
      };
    });

    setEditableLecturePlans(rows);
    setDeletedLecturePlanIds([]);
  };

  const handleIncludePsoToggle = async (nextValue) => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Select a subject with offering id first.');
      return;
    }

    try {
      setSavingIncludePso(true);
      await axios.put(
        `${SERVER_URL}/subject/offered/${selectedSubject.offering_id}`,
        { include_pso: Boolean(nextValue) },
        { withCredentials: true }
      );

      setSubjects((prev) => prev.map((row) => (
        String(row.offering_id) === String(selectedSubject.offering_id)
          ? { ...row, include_pso: Boolean(nextValue) }
          : row
      )));

      showToast('success', nextValue ? 'PSO enabled for this offering.' : 'PSO disabled for this offering.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to update PSO toggle.');
    } finally {
      setSavingIncludePso(false);
    }
  };

  const uploadSelectedSubjectSyllabus = async () => {
    if (!selectedSubject?.subject_code) {
      showToast('error', 'Please select a subject first.');
      return;
    }

    if (!syllabusFile) {
      showToast('error', 'Please choose a syllabus PDF.');
      return;
    }

    try {
      setUploadingSyllabus(true);
      const formData = new FormData();
      formData.append('file', syllabusFile);
      if (selectedSubject?.offering_id) {
        formData.append('offering_id', String(selectedSubject.offering_id));
      }

      const response = await axios.post(
        `${SERVER_URL}/subject/${encodeURIComponent(selectedSubject.subject_code)}/syllabus`,
        formData,
        {
          withCredentials: true,
          headers: { 'Content-Type': 'multipart/form-data' }
        }
      );

      const uploadedFileName = response.data?.subject?.syllabus_file_name || syllabusFile.name;
      setSubjects((prev) => prev.map((row) => (
        String(row.subject_code) === String(selectedSubject.subject_code)
          ? { ...row, syllabus_file_name: uploadedFileName }
          : row
      )));
      const savedCourseOutcomes = Array.isArray(response.data?.course_outcomes)
        ? response.data.course_outcomes
        : [];
      const extractedCourseOutcomes = Array.isArray(response.data?.extracted_course_outcomes)
        ? response.data.extracted_course_outcomes
        : [];
      const nextCourseOutcomes = savedCourseOutcomes.length > 0 ? savedCourseOutcomes : extractedCourseOutcomes;
      if (nextCourseOutcomes.length > 0) {
        setCourseOutcomes(nextCourseOutcomes);
        setEditableCourseOutcomes(
          CO_MATRIX_ROWS.reduce((acc, coNumber) => {
            const row = nextCourseOutcomes.find((item) => Number.parseInt(item?.co_number, 10) === coNumber);
            acc[`CO-${coNumber}`] = row?.co_description || '';
            return acc;
          }, {})
        );
      }
      setSyllabusFile(null);
      showToast('success', response.data?.message || 'Syllabus uploaded successfully.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to upload syllabus.');
    } finally {
      setUploadingSyllabus(false);
    }
  };

  const generateAiSuggestions = async (formValues) => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Please select a subject with offering id first.');
      return;
    }

    if (!availableCoRowsForAi.length || !availablePoRowsForAi.length) {
      showToast('error', 'Please fill and save CO and PO tables before using AI generation.');
      return;
    }

    try {
      setGeneratingAiContent(true);
      setAiMessage('');

      const formData = new FormData();
      formData.append('subject_name', selectedSubject.subject_name || selectedSubject.subject_code || 'Subject');
      formData.append('offering_id', String(selectedSubject.offering_id));
      if (formValues.aiLectureCount && String(formValues.aiLectureCount).trim() !== '') {
        formData.append('total_lectures', String(formValues.aiLectureCount).trim());
      }
      const includePso = Boolean(selectedSubject?.include_pso);
      formData.append('co_rows', JSON.stringify(availableCoRowsForAi));
      formData.append('po_rows', JSON.stringify(availablePoRowsForAi));
      formData.append('pso_rows', JSON.stringify(includePso ? availablePsoRowsForAi : []));
      formData.append('include_pso', includePso ? 'true' : 'false');

      const response = await axios.post(
        `${SERVER_URL}/nba/generate`,
        formData,
        {
          withCredentials: true,
          headers: {
            'Content-Type': 'multipart/form-data'
          }
        }
      );

      const generated = response.data?.generated || {};
      const mappings = Array.isArray(generated?.co_po_pso_strength_mappings)
        ? generated.co_po_pso_strength_mappings
        : [];
      const lecturePlan = Array.isArray(generated?.lecture_plan)
        ? generated.lecture_plan
        : [];

      if (!mappings.length && !lecturePlan.length) {
        showToast('error', 'AI generation returned empty data.');
        return;
      }

      if (mappings.length) {
        applyGeneratedStrengthMappings(mappings);
      }

      if (lecturePlan.length) {
        applyGeneratedLecturePlan(lecturePlan);
      }

      setAiMessage('AI suggestions applied locally. Use Save Matrix and Save Lecture Planning to persist.');
      showToast('success', 'AI suggestions loaded. Nothing saved yet.');
    } catch (err) {
      showToast('error', err?.response?.data?.message || 'Failed to generate AI suggestions.');
    } finally {
      setGeneratingAiContent(false);
    }
  };

  const clearOfferingAiCache = async () => {
    if (!selectedSubject?.offering_id) {
      showToast('error', 'Please select a subject with offering id first.');
      return;
    }

    const confirmed = window.confirm('This will delete only nba_generation_cache rows for this offering. Continue?');
    if (!confirmed) {
      return;
    }

    try {
      setClearingAiCache(true);
      const response = await axios.delete(
        `${SERVER_URL}/nba/cache/${selectedSubject.offering_id}`,
        { withCredentials: true }
      );

      const deletedCount = Number(response.data?.deleted_count || 0);
      setAiMessage(`AI cache cleared for this offering (rows deleted: ${deletedCount}).`);
      showToast('success', response.data?.message || 'AI cache cleared successfully.');
    } catch (err) {
      const message = err?.response?.data?.message || 'Failed to clear AI cache.';
      showToast('error', message);
    } finally {
      setClearingAiCache(false);
    }
  };

  // Reusable styled classes for dropdowns and cards
  const inputStyles = "select w-full bg-white text-gray-900 border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm";
  const cardStyles = "rounded-lg border border-slate-200 bg-white p-6 shadow-sm";
  const tableHeaderStyles = "bg-slate-50 text-slate-700 border-b border-slate-200";
  const toastClass = toast.type === 'success'
    ? 'bg-emerald-600 text-white'
    : toast.type === 'error'
      ? 'bg-red-600 text-white'
      : 'bg-slate-700 text-white';

  return (
    // Added min-h-screen, slate background, and pb-48 to force dropdowns to open downwards
    <div className="w-full space-y-6">
      
      {/* Header Section */}
      <div className="mb-2">
        <h2 className="text-3xl font-bold text-slate-800 mb-1">Faculty Subjects</h2>
        <p className="text-slate-500 border-b border-slate-200 pb-4">
          Select academic year and subject to view CO tables, CO-PO mapping, and lecture planning context.
        </p>
      </div>

      {toast.open && (
        <div className="fixed top-5 right-5 z-50">
          <div className={`${toastClass} px-4 py-2 rounded-lg shadow-lg text-sm font-medium`}>
            {toast.message}
          </div>
        </div>
      )}

      {/* Alerts */}
      {error && <div className="alert bg-red-100 text-red-800 border-red-200 shadow-sm">{error}</div>}
      {!error && !loadingSubjects && !subjects.length && subjectHint && (
        <div className="alert bg-yellow-100 text-yellow-800 border-yellow-200 shadow-sm">{subjectHint}</div>
      )}

      {/* Filters Card */}
      <div className={`${cardStyles} shadow-md`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-slate-700">Academic Year</span>
            </label>
            <select
              className={inputStyles}
              value={selectedYear}
              onChange={(e) => setSelectedYear(e.target.value)}
              disabled={loadingSubjects || !academicYears.length}
            >
              {!academicYears.length && <option value="">No academic years found</option>}
              {academicYears.map((year) => (
                <option key={year} value={year}>{year}</option>
              ))}
            </select>
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-slate-700">Assigned Subject</span>
            </label>
            <select
              className={inputStyles}
              value={selectedSubjectKey}
              onChange={(e) => setSelectedSubjectKey(e.target.value)}
              disabled={loadingSubjects || !filteredSubjects.length}
            >
              {!filteredSubjects.length && <option value="">No subjects for selected year</option>}
              {filteredSubjects.map((subject) => (
                <option key={`${subject.subject_code}-${subject.session}-${subject.division}`} value={String(subject.subject_code)}>
                  {formatSubjectOption(subject)}
                </option>
              ))}
            </select>
          </div>
        </div>
      </div>

      {loadingSubjects && <div className="text-sm text-slate-500 text-center font-medium">Loading assigned subjects...</div>}

      {/* Subject Details Summary */}
      {selectedSubject && (
        <div className={cardStyles}>
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-2">Selected Subject Details</h3>
          <div className="mt-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6">
            <p><span className="font-semibold text-slate-800">Name:</span> {selectedSubject.subject_name}</p>
            <p><span className="font-semibold text-slate-800">Code:</span> {selectedSubject.subject_code}</p>
            <p><span className="font-semibold text-slate-800">Academic Year:</span> {selectedSubject.academic_year || selectedSubject.accadmic_year || 'N/A'}</p>
            <p><span className="font-semibold text-slate-800">Session:</span> {selectedSubject.session || 'N/A'}</p>
            <p><span className="font-semibold text-slate-800">Division:</span> {selectedSubject.division || 'N/A'}</p>
            <p><span className="font-semibold text-slate-800">Semester:</span> {selectedSubject.sem_number ?? 'N/A'}</p>
          </div>
          <div className="mt-4 rounded-lg border border-blue-200 bg-blue-50 px-4 py-3">
            <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-blue-900">Syllabus Upload</p>
                <p className="text-xs text-blue-700">
                  {selectedSubject.syllabus_file_name
                    ? `Current file: ${selectedSubject.syllabus_file_name}`
                    : 'Upload the subject syllabus PDF for AI Assist.'}
                </p>
                <label className="mt-3 inline-flex w-full cursor-pointer items-center justify-center rounded-lg border border-blue-300 bg-white px-4 py-2.5 text-sm font-semibold text-slate-700 transition hover:bg-blue-50 md:w-auto">
                  {syllabusFile ? syllabusFile.name : 'Choose Syllabus PDF'}
                  <input
                    type="file"
                    className="hidden"
                    accept="application/pdf,.pdf"
                    onChange={(e) => setSyllabusFile(e.target.files?.[0] || null)}
                  />
                </label>
              </div>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={uploadSelectedSubjectSyllabus}
                disabled={uploadingSyllabus || !selectedSubject?.subject_code}
              >
                {uploadingSyllabus ? 'Uploading...' : 'Upload Syllabus'}
              </button>
            </div>
          </div>
          <div className="mt-4 flex items-center justify-between rounded-lg border border-slate-200 bg-slate-50 px-4 py-3">
            <div>
              <p className="text-sm font-semibold text-slate-700">Include PSO for this offering</p>
              <p className="text-xs text-slate-500">If disabled, PSO rows are not used for AI or reports.</p>
            </div>
            <label className="flex items-center gap-3 text-sm">
              <input
                type="checkbox"
                className="toggle toggle-primary"
                checked={Boolean(selectedSubject.include_pso)}
                onChange={(e) => handleIncludePsoToggle(e.target.checked)}
                disabled={savingIncludePso}
              />
              <span className="text-slate-600">{selectedSubject.include_pso ? 'Enabled' : 'Disabled'}</span>
            </label>
          </div>
        </div>
      )}

      {tablesError && <div className="alert bg-yellow-100 text-yellow-800 border-yellow-200 shadow-sm">{tablesError}</div>}
      {loadingTables && <div className="text-sm text-slate-500 text-center font-medium">Loading CO, PO/PSO and CO-PO tables...</div>}

      {/* CO Attainment Table */}
      <div className={cardStyles}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">Course Outcomes</h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveCourseOutcomeTable}
            disabled={savingCourseOutcomes || !selectedSubject?.offering_id}
          >
            {savingCourseOutcomes ? 'Saving...' : 'Save CO Table'}
          </button>
        </div>
        {courseOutcomes.length === 0 && (
          <p className="text-sm text-slate-500 italic mb-3">No existing course outcomes found. You can create CO1 to CO6 and save.</p>
        )}
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table table-sm w-full">
            <thead className={tableHeaderStyles}>
              <tr>
                <th className="py-3 px-4">CO</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody>
              {CO_MATRIX_ROWS.map((coNumber) => (
                <tr key={`CO-${coNumber}`} className="hover:bg-slate-50 border-b border-slate-100">
                  <td className="py-2 px-4 font-medium text-slate-700">CO-{coNumber}</td>
                  <td className="py-2 px-4 text-slate-600">
                    <input
                      type="text"
                      className="input input-sm w-full bg-white text-slate-700 border border-slate-300"
                      value={editableCourseOutcomes[`CO-${coNumber}`] ?? ''}
                      onChange={(e) => handleCourseOutcomeChange(coNumber, e.target.value)}
                      placeholder={`Enter CO-${coNumber} description`}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardStyles}>
        <div className="flex flex-col gap-2 mb-4">
          <h3 className="font-bold text-lg text-slate-800">Program Outcomes (PO1 to PO11)</h3>
          <p className="text-sm text-slate-500">Read-only. Managed by admin as global outcomes.</p>
        </div>
        <div className="overflow-x-auto rounded-lg border border-slate-200">
          <table className="table table-sm w-full">
            <thead className={tableHeaderStyles}>
              <tr>
                <th className="py-3 px-4">PO</th>
                <th className="py-3 px-4">Title</th>
                <th className="py-3 px-4">Description</th>
              </tr>
            </thead>
            <tbody>
              {PO_ROWS.map((poNumber) => {
                const row = programOutcomes.find((item) => Number(item?.po_number) === poNumber);
                return (
                  <tr key={`PO-${poNumber}`} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="py-2 px-4 font-medium text-slate-700">PO-{poNumber}</td>
                    <td className="py-2 px-4 text-slate-600">{row?.title || '-'}</td>
                    <td className="py-2 px-4 text-slate-600">{row?.description || '-'}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {Boolean(selectedSubject?.include_pso) && (
        <div className={cardStyles}>
          <div className="flex flex-col gap-2 mb-4">
            <h3 className="font-bold text-lg text-slate-800">Program Specific Outcomes (PSO1 to PSO4)</h3>
            <p className="text-sm text-slate-500">Read-only. Managed by admin for the selected branch.</p>
          </div>
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table table-sm w-full">
              <thead className={tableHeaderStyles}>
                <tr>
                  <th className="py-3 px-4">PSO</th>
                  <th className="py-3 px-4">Title</th>
                  <th className="py-3 px-4">Description</th>
                </tr>
              </thead>
              <tbody>
                {PSO_ROWS.map((psoNumber) => {
                  const row = programSpecificOutcomes.find((item) => Number(item?.pso_number) === psoNumber);
                  return (
                    <tr key={`PSO-${psoNumber}`} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="py-2 px-4 font-medium text-slate-700">PSO-{psoNumber}</td>
                      <td className="py-2 px-4 text-slate-600">{row?.title || '-'}</td>
                      <td className="py-2 px-4 text-slate-600">{row?.description || '-'}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>
      )}


      {selectedSubject && (
        <div className={cardStyles}>
          <div className="flex flex-col gap-3 md:flex-row md:items-end md:justify-between mb-4">
            <div>
              <h3 className="font-bold text-lg text-slate-800">AI Assist: Mapping and Lecture Plan</h3>
              <p className="text-sm text-slate-500">Uses the syllabus uploaded from Create Subject. Generated output is preview only until you click save buttons.</p>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                className="btn btn-outline btn-error btn-sm"
                onClick={clearOfferingAiCache}
                disabled={clearingAiCache || !selectedSubject?.offering_id}
              >
                {clearingAiCache ? 'Clearing...' : 'Clear AI Cache'}
              </button>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={handleSubmit(generateAiSuggestions)}
                disabled={generatingAiContent || !canGenerateAi}
              >
                {generatingAiContent ? 'Generating...' : 'Generate AI Suggestions'}
              </button>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-semibold text-slate-700">Target Lectures (optional)</span>
              </label>
              <input
                type="number"
                min="12"
                max="120"
                className="input input-sm input-bordered border border-slate-300 w-full bg-white text-black"
                placeholder="Example: 42"
                {...register('aiLectureCount')}
              />
              {aiFormErrors.aiLectureCount && (
                <p className="mt-1 text-xs text-error">{aiFormErrors.aiLectureCount.message}</p>
              )}
            </div>

            <div className="form-control">
              <label className="label py-1">
                <span className="label-text font-semibold text-slate-700">Context Check</span>
              </label>
              <div className="input input-sm input-bordered w-full flex items-center bg-slate-50 text-slate-700">
                COs: {availableCoRowsForAi.length} | POs: {availablePoRowsForAi.length} | PSOs: {availablePsoRowsForAi.length}
              </div>
            </div>
          </div>

          {!canGenerateAi && (
            <p className="text-sm text-amber-700 mt-3">Fill CO and PO descriptions first, then use AI generate.</p>
          )}
          {aiMessage && <p className="text-sm text-slate-600 mt-2">{aiMessage}</p>}
        </div>
      )}

      {/* CO-PO Mapping Table */}
      <div className={cardStyles}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">CO-PO Mapping with PO Strength</h3>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={saveStrengthMatrix}
            disabled={savingMatrix || !selectedSubject?.offering_id}
          >
            {savingMatrix ? 'Saving...' : 'Save Matrix'}
          </button>
        </div>
        {matrixSaveMessage && (
          <div className="mb-3 text-sm text-slate-600">{matrixSaveMessage}</div>
        )}
        {coPoStrength.length === 0 && (
          <p className="text-sm text-slate-500 italic mb-3">No existing mappings found. You can add values and save.</p>
        )}
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="table table-sm w-max min-w-full">
            <thead className={tableHeaderStyles}>
              <tr>
                <th className="py-3 px-3 sticky left-0 bg-slate-50 z-10 whitespace-nowrap">CO</th>
                {OUTCOME_COLUMNS.map((col) => (
                  <th key={col.key} className="py-3 px-2 text-center min-w-14 whitespace-nowrap">{col.label}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {CO_MATRIX_ROWS.map((coNumber) => {
                const rowKey = `CO-${coNumber}`;
                return (
                  <tr key={rowKey} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="py-2 px-3 font-medium text-slate-700 sticky left-0 bg-white z-10 whitespace-nowrap">{rowKey}</td>
                    {OUTCOME_COLUMNS.map((col) => (
                      <td key={`${rowKey}-${col.key}`} className="py-2 px-2 text-center text-slate-600">
                        <select
                          className="select select-xs w-12 text-center bg-white text-slate-700 border border-slate-300"
                          value={editableStrengthMatrix[rowKey]?.[col.key] ?? ''}
                          onChange={(e) => handleMatrixCellChange(rowKey, col.key, e.target.value)}
                        >
                          <option value=""></option>
                          <option value="0">0</option>
                          <option value="1">1</option>
                          <option value="2">2</option>
                          <option value="3">3</option>
                        </select>
                      </td>
                    ))}
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      <div className={cardStyles}>
        <div className="flex flex-col gap-2 mb-4">
          <h3 className="font-bold text-lg text-slate-800">CO-PO/PSO Justifications</h3>
          <p className="text-sm text-slate-500">
            Fill justification for each strength value. Missing strengths are shown as Not addressed.
          </p>
        </div>
        <div className="max-w-full overflow-x-auto rounded-lg border border-slate-200">
          <table className="table table-sm w-full">
            <thead className={tableHeaderStyles}>
              <tr>
                <th className="py-3 px-3 whitespace-nowrap">CO</th>
                <th className="py-3 px-3 whitespace-nowrap">PO/PSO</th>
                <th className="py-3 px-3 whitespace-nowrap">Strength</th>
                <th className="py-3 px-3">Justification</th>
              </tr>
            </thead>
            <tbody>
              {CO_MATRIX_ROWS.flatMap((coNumber) => {
                const rowKey = `CO-${coNumber}`;
                return OUTCOME_COLUMNS.map((col) => {
                  const strengthValue = editableStrengthMatrix[rowKey]?.[col.key] ?? '';
                  const justificationValue = editableJustificationMatrix[rowKey]?.[col.key] ?? '';
                  return (
                    <tr key={`just-${rowKey}-${col.key}`} className="hover:bg-slate-50 border-b border-slate-100">
                      <td className="py-2 px-3 font-medium text-slate-700 whitespace-nowrap">{rowKey}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">{col.label}</td>
                      <td className="py-2 px-3 text-slate-600 whitespace-nowrap">
                        {strengthValue === '' ? 'Not addressed' : strengthValue}
                      </td>
                      <td className="py-2 px-3 text-slate-600">
                        <textarea
                          className="textarea textarea-bordered textarea-xs w-full bg-white text-slate-700"
                          value={justificationValue}
                          onChange={(e) => handleJustificationChange(rowKey, col.key, e.target.value)}
                          placeholder={
                            strengthValue === ''
                              ? 'Not addressed yet.'
                              : 'Add justification for this strength.'
                          }
                          disabled={strengthValue === ''}
                          rows={2}
                        />
                      </td>
                    </tr>
                  );
                });
              })}
            </tbody>
          </table>
        </div>
      </div>

      {/* Lecture Planning Table */}
      <div className={cardStyles}>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between mb-4">
          <h3 className="font-bold text-lg text-slate-800">Lecture Planning</h3>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-outline btn-sm"
              onClick={addLecturePlanRow}
              disabled={!selectedSubject?.offering_id}
            >
              Add Row
            </button>
            <button
              type="button"
              className="btn btn-primary btn-sm"
              onClick={saveLecturePlanning}
              disabled={savingLecturePlans || !selectedSubject?.offering_id}
            >
              {savingLecturePlans ? 'Saving...' : 'Save Lecture Planning'}
            </button>
          </div>
        </div>

        {editableLecturePlans.length === 0 ? (
          <p className="text-sm text-slate-500 italic">No lecture plan entries available.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-slate-200">
            <table className="table table-sm w-full">
              <thead className={tableHeaderStyles}>
                <tr>
                  <th className="py-3 px-4 w-16">#</th>
                  <th className="py-3 px-4">Description</th>
                  <th className="py-3 px-4 w-32">Date</th>
                  <th className="py-3 px-4 w-28">Action</th>
                </tr>
              </thead>
              <tbody>
                {editableLecturePlans.map((row, idx) => (
                  <tr key={row.tempKey} className="hover:bg-slate-50 border-b border-slate-100">
                    <td className="py-2 px-4 font-medium text-slate-700">{idx + 1}</td>
                    <td className="py-2 px-4 text-slate-600">
                      <textarea
                        className="textarea textarea-bordered textarea-sm w-full h-12 min-h-12 bg-white text-slate-700"
                        value={row.description || ''}
                        onChange={(e) => handleLecturePlanDescriptionChange(row.tempKey, e.target.value)}
                        placeholder="Enter lecture plan description"
                      />
                    </td>
                    <td className="py-2 px-4 text-slate-600 whitespace-nowrap">{row.created_at ? new Date(row.created_at).toLocaleDateString('en-IN') : 'New'}</td>
                    <td className="py-2 px-4">
                      <button
                        type="button"
                        className="btn btn-ghost btn-xs text-red-600"
                        onClick={() => removeLecturePlanRow(row)}
                      >
                        Remove
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

    </div>
  );
}
