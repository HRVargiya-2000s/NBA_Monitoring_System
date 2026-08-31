import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import * as XLSX from "xlsx";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";
const EXAM_TYPES = ["mid_sem", "internal", "external", "viva"];
const MAX_MARKS_BY_EXAM = {
    mid_sem: 30,
    internal: 20,
    external: 70,
    viva: 30
};

const getCurrentAcademicYearLabel = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth() + 1;
    const startYear = month >= 6 ? year : year - 1;
    const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
    return `${startYear}-${endYearShort}`;
};

const normalizeAcademicYear = (value) => String(value || "").trim();

const normalizeSession = (value) => String(value || "").trim().toLowerCase();

const getOfferingAcademicYear = (subject) => normalizeAcademicYear(subject?.accadmic_year || subject?.academic_year);

const getOfferingSession = (subject) => normalizeSession(subject?.session);

const buildDefaultCoRows = () =>
    Array.from({ length: 6 }, (_, i) => ({
        co_number: i + 1,
        total_marks: "",
        target_value: ""
    }));

const formatSubjectLabel = (subject) => {
    const code = subject.subject_code || "-";
    const name = subject.subject_name || "Unnamed";
    const sem = subject.sem_number != null ? `Sem ${subject.sem_number}` : "Sem ?";
    const division = subject.division || "Div ?";
    const session = subject.session || "Session ?";
    const year = subject.accadmic_year || subject.academic_year || "Year ?";
    return `${code} - ${name} (${sem}, ${division}, ${session}, ${year})`;
};

const isGradedExamType = (examType) => examType === "external" || examType === "viva";

const buildGridHeader = (examType) => {
    if (isGradedExamType(examType)) {
        return ["Sr", "Enrollment No", "Grade"];
    }

    const base = ["Sr", "Enrollment No", "CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "Total Marks"];
    return base;
};

const isBlankCell = (value) => String(value ?? "").trim() === "";

const emptyStudentRow = (enrollment_no, sr, examType) => ({
    sr,
    enrollment_no,
    total_marks: "",
    co1: "",
    co2: "",
    co3: "",
    co4: "",
    co5: "",
    co6: "",
    grade: isGradedExamType(examType) ? "" : undefined,
    invalid: false
});

const normalizeHeaderCell = (value) => String(value ?? "").trim().toUpperCase().replace(/\s+/g, "");

const detectUploadedHeaderIndex = (rows) =>
    rows.findIndex((row) => {
        const normalized = row.map((cell) => normalizeHeaderCell(cell));
        return normalized.some((cell) => cell.includes("ENROLLMENT")) || normalized.some((cell) => /^CO[1-6]$/.test(cell));
    });

const parseUploadedRows = (rows, examType) => {
    const gradedExam = isGradedExamType(examType);
    const headerIndex = detectUploadedHeaderIndex(rows);
    const headerRow = headerIndex >= 0 ? rows[headerIndex] : rows[0] || [];
    const dataRows = rows.slice(headerIndex >= 0 ? headerIndex + 1 : 1);

    const colMap = {
        enrollment: 1,
        co1: 2,
        co2: 3,
        co3: 4,
        co4: 5,
        co5: 6,
        co6: 7,
        total: 8,
        grade: gradedExam ? 2 : null
    };

    const hasCoHeaders = headerRow.some((cell) => /^CO[1-6]$/.test(normalizeHeaderCell(cell)));

    headerRow.forEach((cell, index) => {
        const normalized = normalizeHeaderCell(cell);
        if (normalized.includes("ENROLLMENT")) colMap.enrollment = index;
        if (normalized.includes("TOTAL")) colMap.total = index;
        if (normalized === "CO1") colMap.co1 = index;
        if (normalized === "CO2") colMap.co2 = index;
        if (normalized === "CO3") colMap.co3 = index;
        if (normalized === "CO4") colMap.co4 = index;
        if (normalized === "CO5") colMap.co5 = index;
        if (normalized === "CO6") colMap.co6 = index;
        if (normalized.includes("GRADE")) colMap.grade = index;
    });

    const parsedRows = [];
    dataRows.forEach((row) => {
        const enrollment = String(row[colMap.enrollment] ?? "").trim();
        if (!enrollment) return;

        parsedRows.push({
            enrollment_no: enrollment,
            total_marks: gradedExam ? "" : row[colMap.total] ?? "",
            co1: gradedExam || !hasCoHeaders ? "" : row[colMap.co1] ?? "",
            co2: gradedExam || !hasCoHeaders ? "" : row[colMap.co2] ?? "",
            co3: gradedExam || !hasCoHeaders ? "" : row[colMap.co3] ?? "",
            co4: gradedExam || !hasCoHeaders ? "" : row[colMap.co4] ?? "",
            co5: gradedExam || !hasCoHeaders ? "" : row[colMap.co5] ?? "",
            co6: gradedExam || !hasCoHeaders ? "" : row[colMap.co6] ?? "",
            grade: colMap.grade !== null ? row[colMap.grade] ?? "" : ""
        });
    });

    return parsedRows;
};

const assessmentFormSchema = z.object({
    offering_id: z.string(),
    exam_type: z.enum(["mid_sem", "internal", "external", "viva"]),
    academic_year: z.string(),
    session: z.string(),
    exam_date: z.string(),
    total_students: z.string(),
    max_marks: z.union([z.string(), z.number()]),
    globalThreshold: z.string()
});

export default function Assessment() {
    const [subjects, setSubjects] = useState([]);
    const [subjectsLoading, setSubjectsLoading] = useState(true);
    const [subjectsError, setSubjectsError] = useState("");

    const { watch, setValue } = useForm({
        resolver: zodResolver(assessmentFormSchema),
        defaultValues: {
            offering_id: "",
            exam_type: "mid_sem",
            academic_year: "",
            session: "odd",
            exam_date: "",
            total_students: "",
            max_marks: "30",
            globalThreshold: ""
        }
    });

    const form = watch();

    const [paperState, setPaperState] = useState({
        checked: false,
        exists: false,
        paper: null
    });

    const [coRows, setCoRows] = useState(buildDefaultCoRows());
    const [file, setFile] = useState(null);
    const [gridHeader, setGridHeader] = useState(buildGridHeader("mid_sem"));
    const [validPreviewRows, setValidPreviewRows] = useState([]);
    const [invalidPreviewRows, setInvalidPreviewRows] = useState([]);

    const [busyCheck, setBusyCheck] = useState(false);
    const [busyCreate, setBusyCreate] = useState(false);
    const [busySaveConfig, setBusySaveConfig] = useState(false);
    const [busyUpload, setBusyUpload] = useState(false);
    const [busyParseFile, setBusyParseFile] = useState(false);

    const [message, setMessage] = useState({ type: "", text: "" });

    const getCoWeightValues = () => {
        const weights = coRows.map((row) => {
            const value = Number(row.total_marks);
            return Number.isNaN(value) || value < 0 ? 0 : value;
        });
        const hasWeight = weights.some((value) => value > 0);
        return hasWeight ? weights : Array(6).fill(1);
    };

    const sumCoMarks = (row) => {
        const values = [row.co1, row.co2, row.co3, row.co4, row.co5, row.co6].map((value) => {
            const numeric = Number(value);
            return Number.isNaN(numeric) ? 0 : numeric;
        });
        return values.reduce((acc, value) => acc + value, 0);
    };

    const distributeTotalToCos = (totalValue) => {
        const total = Number(totalValue);
        if (Number.isNaN(total) || total < 0) {
            return {
                co1: "",
                co2: "",
                co3: "",
                co4: "",
                co5: "",
                co6: ""
            };
        }

        const weights = getCoWeightValues();
        const weightSum = weights.reduce((acc, value) => acc + value, 0) || 1;
        const raw = weights.map((weight) => Math.floor((total * weight) / weightSum));
        const allocated = raw.reduce((acc, value) => acc + value, 0);
        const lastWeightedIndex = weights.map((weight, index) => (weight > 0 ? index : -1)).filter((index) => index >= 0).pop();
        const remainderIndex = lastWeightedIndex !== undefined ? lastWeightedIndex : raw.length - 1;
        raw[remainderIndex] = raw[remainderIndex] + (total - allocated);

        return {
            co1: raw[0],
            co2: raw[1],
            co3: raw[2],
            co4: raw[3],
            co5: raw[4],
            co6: raw[5]
        };
    };

    const inputStyles =
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const selectStyles =
        "w-full rounded-md border border-slate-300 bg-white px-3 py-2 text-sm text-slate-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500";
    const cardStyles = "rounded-lg border border-slate-200 bg-white p-6 shadow-sm";
    const tableHeaderStyles = "bg-slate-50 text-slate-700 border-b border-slate-200";
    const primaryButtonStyles =
        "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300";
    const secondaryButtonStyles =
        "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

    useEffect(() => {
        if (!message.text) return;

        const timer = setTimeout(() => {
            setMessage({ type: "", text: "" });
        }, 3500);

        return () => clearTimeout(timer);
    }, [message.text]);

    const loadOfferingStudents = async (offeringId, examType) => {
        const res = await axios.get(`${SERVER_URL}/marks/offering/${offeringId}/students`, { withCredentials: true });
        const enrollments = Array.isArray(res.data?.enrollments) ? res.data.enrollments : [];
        const sorted = [...enrollments].sort((a, b) => String(b).localeCompare(String(a)));

        const rows = sorted.map((enrollment, index) => emptyStudentRow(String(enrollment), index + 1, examType));

        setGridHeader(buildGridHeader(examType));
        setValidPreviewRows(rows);
        setInvalidPreviewRows([]);
        setValue("total_students", String(rows.length));

        if (!rows.length) {
            setMessage({ type: "info", text: "No students are currently mapped to this offering. Grid is empty until mapping is added." });
        }

        return rows;
    };

    const handleValidCellChange = (rowIndex, field, value) => {
        setValidPreviewRows((prev) => {
            const next = [...prev];
            const updatedRow = { ...next[rowIndex], [field]: value };

            if (!isGradedExamType(form.exam_type)) {
                if (field === "total_marks") {
                    const distributed = distributeTotalToCos(value);
                    updatedRow.co1 = distributed.co1;
                    updatedRow.co2 = distributed.co2;
                    updatedRow.co3 = distributed.co3;
                    updatedRow.co4 = distributed.co4;
                    updatedRow.co5 = distributed.co5;
                    updatedRow.co6 = distributed.co6;
                } else if (["co1", "co2", "co3", "co4", "co5", "co6"].includes(field)) {
                    updatedRow.total_marks = sumCoMarks(updatedRow);
                }
            }

            next[rowIndex] = updatedRow;
            return next;
        });
    };

    const handleFileSelection = async (selectedFile) => {
        setFile(selectedFile || null);
        setInvalidPreviewRows([]);

        if (!selectedFile) {
            return;
        }

        let previewRows = validPreviewRows;
        if (!previewRows.length && form.offering_id) {
            try {
                previewRows = await loadOfferingStudents(form.offering_id, form.exam_type);
            } catch {
                previewRows = [];
            }
        }

        if (!previewRows.length) {
            setMessage({ type: "error", text: "No students are mapped to this offering yet. Assign students to this offering first, then upload marks." });
            return;
        }

        try {
            setBusyParseFile(true);
            const arrayBuffer = await selectedFile.arrayBuffer();
            const workbook = XLSX.read(arrayBuffer, { type: "array" });
            const sheet = workbook.Sheets[workbook.SheetNames[0]];
            const rows = XLSX.utils.sheet_to_json(sheet, { header: 1, defval: "", blankrows: true });

            if (!rows.length) {
                setMessage({ type: "error", text: "Selected file is empty." });
                return;
            }

            const parsed = parseUploadedRows(rows, form.exam_type);
            const validSet = new Set(previewRows.map((row) => String(row.enrollment_no)));
            const uploadedMap = new Map(parsed.map((row) => [String(row.enrollment_no), row]));

            const mergedRows = previewRows.map((row, index) => {
                const uploaded = uploadedMap.get(String(row.enrollment_no));
                if (!uploaded) {
                    return { ...row, sr: index + 1 };
                }

                if (!isGradedExamType(form.exam_type)) {
                    const uploadedCos = [uploaded.co1, uploaded.co2, uploaded.co3, uploaded.co4, uploaded.co5, uploaded.co6];
                    const hasAnyCo = uploadedCos.some((value) => !isBlankCell(value));
                    if (!hasAnyCo && !isBlankCell(uploaded.total_marks)) {
                        const distributed = distributeTotalToCos(uploaded.total_marks);
                        return {
                            ...row,
                            sr: index + 1,
                            total_marks: Number(uploaded.total_marks),
                            co1: distributed.co1,
                            co2: distributed.co2,
                            co3: distributed.co3,
                            co4: distributed.co4,
                            co5: distributed.co5,
                            co6: distributed.co6
                        };
                    }

                    const nextRow = {
                        ...row,
                        sr: index + 1,
                        co1: uploaded.co1,
                        co2: uploaded.co2,
                        co3: uploaded.co3,
                        co4: uploaded.co4,
                        co5: uploaded.co5,
                        co6: uploaded.co6
                    };
                    return { ...nextRow, total_marks: sumCoMarks(nextRow) };
                }

                return {
                    ...row,
                    sr: index + 1,
                    co1: isGradedExamType(form.exam_type) ? row.co1 : uploaded.co1,
                    co2: isGradedExamType(form.exam_type) ? row.co2 : uploaded.co2,
                    co3: isGradedExamType(form.exam_type) ? row.co3 : uploaded.co3,
                    co4: isGradedExamType(form.exam_type) ? row.co4 : uploaded.co4,
                    co5: isGradedExamType(form.exam_type) ? row.co5 : uploaded.co5,
                    co6: isGradedExamType(form.exam_type) ? row.co6 : uploaded.co6,
                    grade: isGradedExamType(form.exam_type) ? uploaded.grade : undefined
                };
            });

            const invalidRows = parsed
                .filter((row) => !validSet.has(String(row.enrollment_no)))
                .map((row) => ({ ...row, sr: "!", invalid: true }))
                .sort((a, b) => String(b.enrollment_no).localeCompare(String(a.enrollment_no)));

            setValidPreviewRows(mergedRows);
            setInvalidPreviewRows(invalidRows);

            if (invalidRows.length > 0) {
                setMessage({
                    type: "error",
                    text: `Found ${invalidRows.length} invalid enrollment(s). They are highlighted in red at top, and upload is disabled.`
                });
            } else {
                setMessage({ type: "success", text: "Excel values merged into offering student preview." });
            }
        } catch (err) {
            setMessage({ type: "error", text: "Could not parse Excel file. Please choose a valid .xlsx/.xls file." });
        } finally {
            setBusyParseFile(false);
        }
    };

    useEffect(() => {
        const loadAssignedSubjects = async () => {
            try {
                setSubjectsLoading(true);
                setSubjectsError("");

                const profileRes = await axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true });
                const assigned = Array.isArray(profileRes.data?.assigned_subjects)
                    ? profileRes.data.assigned_subjects
                    : [];

                setSubjects(assigned);

                if (!assigned.length) {
                    setSubjectsError("No assigned offerings found for your account.");
                    return;
                }

                const currentYear = getCurrentAcademicYearLabel();
                const defaultSubject =
                    assigned.find((s) => normalizeAcademicYear(s.accadmic_year || s.academic_year) === currentYear) || assigned[0];

                setValue("offering_id", String(defaultSubject.offering_id || ""));
                setValue("academic_year", normalizeAcademicYear(defaultSubject.accadmic_year || defaultSubject.academic_year) || currentYear);
                setValue("session", normalizeSession(defaultSubject.session) || "odd");
            } catch (err) {
                setSubjectsError(err?.response?.data?.error || "Failed to load assigned offerings.");
            } finally {
                setSubjectsLoading(false);
            }
        };

        loadAssignedSubjects();
    }, [setValue]);

    useEffect(() => {
        setValue("max_marks", String(MAX_MARKS_BY_EXAM[form.exam_type]));

        setGridHeader(buildGridHeader(form.exam_type));
        setValidPreviewRows((prev) =>
            prev.map((row, index) => ({
                ...row,
                sr: index + 1,
                grade: isGradedExamType(form.exam_type) ? row.grade ?? "" : undefined
            }))
        );
        setInvalidPreviewRows((prev) =>
            prev.map((row) => ({
                ...row,
                grade: isGradedExamType(form.exam_type) ? row.grade ?? "" : undefined
            }))
        );
    }, [form.exam_type]);

    const selectedSubject = useMemo(
        () => subjects.find((s) => String(s.offering_id) === String(form.offering_id)) || null,
        [subjects, form.offering_id]
    );

    const selectedAcademicYear = getOfferingAcademicYear(selectedSubject);
    const selectedSession = getOfferingSession(selectedSubject);

    const resetBelowStep1 = () => {
        setPaperState({ checked: false, exists: false, paper: null });
        setCoRows(buildDefaultCoRows());
        setFile(null);
        setValidPreviewRows([]);
        setInvalidPreviewRows([]);
        setGridHeader(buildGridHeader(form.exam_type));
    };

    const applyCoConfig = (coConfig) => {
        if (!Array.isArray(coConfig) || !coConfig.length) {
            setCoRows(buildDefaultCoRows());
            return;
        }

        const nextRows = buildDefaultCoRows();
        for (const row of coConfig) {
            const co = Number.parseInt(row?.co_number, 10);
            if (!co || co < 1 || co > 6) continue;
            nextRows[co - 1] = {
                co_number: co,
                total_marks: row?.total_marks ?? "",
                target_value: row?.target_value ?? ""
            };
        }

        setCoRows(nextRows);
    };

    const handleCheckPaper = async () => {
        if (!form.offering_id || !form.exam_type || !selectedAcademicYear || !selectedSession) {
            setMessage({ type: "error", text: "Please select a valid offering and exam type." });
            return;
        }

        try {
            setBusyCheck(true);
            setMessage({ type: "", text: "" });
            resetBelowStep1();

            const res = await axios.get(`${SERVER_URL}/exam/paper/by-offering`, {
                withCredentials: true,
                params: {
                    offering_id: form.offering_id,
                    exam_type: form.exam_type,
                    academic_year: selectedAcademicYear,
                    session: selectedSession
                }
            });

            if (res.data?.exists) {
                setPaperState({ checked: true, exists: true, paper: res.data.paper });
                applyCoConfig(res.data.co_config);
                await loadOfferingStudents(form.offering_id, form.exam_type);
                setMessage({ type: "success", text: "Paper found. Step 2 is ready." });
            } else {
                setPaperState({ checked: true, exists: false, paper: null });
                applyCoConfig([]);
                await loadOfferingStudents(form.offering_id, form.exam_type);
                setMessage({ type: "info", text: "Paper not found. Fill details and create paper." });
            }
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to check paper." });
        } finally {
            setBusyCheck(false);
        }
    };

    const handleCreatePaper = async () => {
        if (!paperState.checked || paperState.exists) return;
        if (!form.exam_date || form.total_students === "") {
            setMessage({ type: "error", text: "Please provide exam date and total students." });
            return;
        }

        try {
            setBusyCreate(true);
            setMessage({ type: "", text: "" });

            const res = await axios.post(
                `${SERVER_URL}/exam/paper/ensure`,
                {
                    offering_id: Number(form.offering_id),
                    exam_type: form.exam_type,
                    academic_year: selectedAcademicYear,
                    session: selectedSession,
                    exam_date: form.exam_date,
                    total_students: Number(form.total_students),
                    max_marks: Number(form.max_marks)
                },
                { withCredentials: true }
            );

            setPaperState({ checked: true, exists: true, paper: res.data.paper });
            applyCoConfig(res.data.co_config);
            await loadOfferingStudents(form.offering_id, form.exam_type);
            setMessage({ type: "success", text: "Paper created. Step 2 is ready." });
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to create paper." });
        } finally {
            setBusyCreate(false);
        }
    };

    const handleCoChange = (index, field, value) => {
        setCoRows((prev) => {
            const next = [...prev];
            next[index] = { ...next[index], [field]: value };
            return next;
        });
    };

    const applyGlobalThreshold = () => {
        const value = Number(form.globalThreshold);
        if (Number.isNaN(value) || value < 0 || value > 100) {
            setMessage({ type: "error", text: "Threshold must be between 0 and 100." });
            return;
        }

        setCoRows((prev) => prev.map((row) => ({ ...row, target_value: value })));
        setMessage({ type: "success", text: "Threshold applied to all COs." });
    };

    const handleSaveCoConfig = async () => {
        if (!paperState.paper?.paper_id) return;

        const rows = coRows.map((row) => ({
            co_number: Number(row.co_number),
            total_marks: Number(row.total_marks),
            target_value: Number(row.target_value)
        }));

        const invalid = rows.find(
            (row) => Number.isNaN(row.total_marks) || row.total_marks < 0 || Number.isNaN(row.target_value) || row.target_value < 0 || row.target_value > 100
        );

        if (invalid) {
            setMessage({ type: "error", text: "Fill valid CO rows: total marks >= 0, target % between 0 and 100." });
            return;
        }

        try {
            setBusySaveConfig(true);
            setMessage({ type: "", text: "" });

            const res = await axios.put(
                `${SERVER_URL}/exam/paper/${paperState.paper.paper_id}/co-config`,
                { rows },
                { withCredentials: true }
            );

            applyCoConfig(res.data?.co_config || []);
            setMessage({ type: "success", text: "CO config saved. You can upload Excel now." });
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to save CO config." });
        } finally {
            setBusySaveConfig(false);
        }
    };

    const getUploadEndpoint = (examType) => {
        if (examType === "external") return "external";
        if (examType === "viva") return "viva";
        return "internal-midsem";
    };

    const handleUpload = async () => {
        if (!paperState.paper?.paper_id) {
            setMessage({ type: "error", text: "Paper is required before upload." });
            return;
        }

        if (invalidPreviewRows.length > 0) {
            setMessage({ type: "error", text: "Remove invalid enrollments first. Upload is blocked." });
            return;
        }

        if (!validPreviewRows.length) {
            setMessage({ type: "error", text: "No offering students available for upload." });
            return;
        }

        let normalizedRows = validPreviewRows;

        if (!isGradedExamType(form.exam_type)) {
            normalizedRows = validPreviewRows.map((row) => {
                const coValues = [row.co1, row.co2, row.co3, row.co4, row.co5, row.co6];
                const hasAnyCo = coValues.some((value) => !isBlankCell(value));
                if (hasAnyCo) {
                    const nextRow = {
                        ...row,
                        co1: isBlankCell(row.co1) ? 0 : row.co1,
                        co2: isBlankCell(row.co2) ? 0 : row.co2,
                        co3: isBlankCell(row.co3) ? 0 : row.co3,
                        co4: isBlankCell(row.co4) ? 0 : row.co4,
                        co5: isBlankCell(row.co5) ? 0 : row.co5,
                        co6: isBlankCell(row.co6) ? 0 : row.co6
                    };
                    return { ...nextRow, total_marks: sumCoMarks(nextRow) };
                }

                if (!isBlankCell(row.total_marks)) {
                    const distributed = distributeTotalToCos(row.total_marks);
                    return {
                        ...row,
                        total_marks: Number(row.total_marks),
                        co1: distributed.co1,
                        co2: distributed.co2,
                        co3: distributed.co3,
                        co4: distributed.co4,
                        co5: distributed.co5,
                        co6: distributed.co6
                    };
                }

                return row;
            });
        }

        const rows = [
            [...gridHeader],
            ...normalizedRows.map((row) => {
                if (isGradedExamType(form.exam_type)) {
                    return [row.sr, row.enrollment_no, row.grade ?? ""];
                }

                return [row.sr, row.enrollment_no, row.co1, row.co2, row.co3, row.co4, row.co5, row.co6, row.total_marks];
            })
        ];

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Marks");
        const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const uploadFile = new File([workbookBuffer], `edited_marks_${form.exam_type}.xlsx`, {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });

        const body = new FormData();
        body.append("paper_id", String(paperState.paper.paper_id));
        body.append("file", uploadFile);

        try {
            setBusyUpload(true);
            setMessage({ type: "", text: "" });

            const endpoint = getUploadEndpoint(form.exam_type);
            await axios.post(`${SERVER_URL}/marks/upload/${endpoint}`, body, {
                withCredentials: true,
                headers: { "Content-Type": "multipart/form-data" }
            });

            setMessage({ type: "success", text: "Marks uploaded successfully. Previous marks were replaced for this paper." });
        } catch (err) {
            setMessage({ type: "error", text: err?.response?.data?.message || "Failed to upload marks." });
        } finally {
            setBusyUpload(false);
        }
    };

    const handleDownloadDemoTemplate = () => {
        const isGradedExam = form.exam_type === "external" || form.exam_type === "viva";
        const rows = isGradedExam
            ? [
                ["Sr", "Enrollment No", "Grade"],
                [1, "230280116157", "AA"],
                [2, "220110002", "AB"]
            ]
            : [
                ["Sr", "Enrollment No", "CO1", "CO2", "CO3", "CO4", "CO5", "CO6", "Total Marks"],
                [1, "230280116157", 8, 10, 8, 0, 0, 0, 26],
                [2, "220110002", 9, 8, 7, 0, 0, 0, 24],
                [3, "220110003", "", "", "", "", "", "", 18]
            ];

        const worksheet = XLSX.utils.aoa_to_sheet(rows);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "Template");
        const workbookBuffer = XLSX.write(workbook, { bookType: "xlsx", type: "array" });
        const blob = new Blob([workbookBuffer], {
            type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
        });
        const url = URL.createObjectURL(blob);
        const link = document.createElement("a");
        link.href = url;
        link.download = `marks_template_${form.exam_type}.xlsx`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        URL.revokeObjectURL(url);
    };

    return (
        <div className="w-full space-y-6 text-slate-800">
            <div className="mb-2">
                <h2 className="text-3xl font-bold text-slate-800 mb-1">Assessment Workflow</h2>
                <p className="text-slate-500 border-b border-slate-200 pb-4">
                    Step 1: Check/Create paper, Step 2: CO config, Step 3: Excel marks upload.
                </p>
            </div>

            <div className={cardStyles}>

                <div className="mt-6 grid gap-6 lg:grid-cols-3">
                    <div className="lg:col-span-2 rounded-lg border border-slate-200 p-4">
                        <h2 className="text-lg font-semibold">Step 1: Paper Check / Create</h2>

                        {subjectsLoading ? <p className="mt-3 text-sm text-slate-500">Loading assigned offerings...</p> : null}
                        {subjectsError ? <p className="mt-3 text-sm text-red-600">{subjectsError}</p> : null}

                        <div className="mt-4 grid gap-3 md:grid-cols-2">
                            <div>
                                <label className="mb-1 block text-sm font-medium">Offering</label>
                                <select
                                    className={selectStyles}
                                    value={form.offering_id}
                                    onChange={(e) => {
                                        const picked = subjects.find((s) => String(s.offering_id) === String(e.target.value));
                                        setValue("offering_id", e.target.value);
                                        setValue("academic_year", getOfferingAcademicYear(picked));
                                        setValue("session", getOfferingSession(picked) || "odd");
                                        resetBelowStep1();
                                    }}
                                    disabled={subjectsLoading}
                                >
                                    <option value="">Select offering</option>
                                    {subjects.map((subject) => (
                                        <option key={`${subject.offering_id}-${subject.subject_code}-${subject.division}`} value={subject.offering_id}>
                                            {formatSubjectLabel(subject)}
                                        </option>
                                    ))}
                                </select>
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-medium">Exam Type</label>
                                <select
                                    className={selectStyles}
                                    value={form.exam_type}
                                    onChange={(e) => {
                                        setValue("exam_type", e.target.value);
                                        resetBelowStep1();
                                    }}
                                >
                                    {EXAM_TYPES.map((type) => (
                                        <option key={type} value={type}>
                                            {type}
                                        </option>
                                    ))}
                                </select>
                            </div>
                        </div>

                        <div className="mt-4 flex flex-wrap gap-2">
                            <button className={primaryButtonStyles} type="button" onClick={handleCheckPaper} disabled={busyCheck || !form.offering_id}>
                                {busyCheck ? "Checking..." : "Check Paper"}
                            </button>
                        </div>

                        {paperState.checked && !paperState.exists ? (
                            <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 p-4">
                                <p className="text-sm text-amber-800">Paper does not exist yet. Enter details to create.</p>
                                <div className="mt-3 grid gap-3 md:grid-cols-3">
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Exam Date</label>
                                        <input
                                            type="date"
                                            className={inputStyles}
                                            value={form.exam_date}
                                            onChange={(e) => setValue("exam_date", e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Total Students</label>
                                        <input
                                            type="number"
                                            min="0"
                                            className={inputStyles}
                                            value={form.total_students}
                                            onChange={(e) => setValue("total_students", e.target.value)}
                                        />
                                    </div>
                                    <div>
                                        <label className="mb-1 block text-sm font-medium">Max Marks</label>
                                        <input
                                            type="number"
                                            min="1"
                                            className={inputStyles}
                                            value={form.max_marks}
                                            onChange={(e) => setValue("max_marks", e.target.value)}
                                        />
                                    </div>
                                </div>
                                <button className={`${secondaryButtonStyles} mt-3`} type="button" onClick={handleCreatePaper} disabled={busyCreate}>
                                    {busyCreate ? "Creating..." : "Create Paper"}
                                </button>
                            </div>
                        ) : null}

                        {paperState.paper ? (
                            <div className="mt-4 rounded-lg border border-emerald-200 bg-emerald-50 p-3 text-sm text-emerald-800">
                                Paper ID: {paperState.paper.paper_id} | Offering: {paperState.paper.offering_id} | Max Marks: {paperState.paper.max_marks}
                            </div>
                        ) : null}
                    </div>

                    <div className="rounded-lg border border-slate-200 p-4">
                        <h3 className="font-semibold">Selected Offering</h3>
                        {selectedSubject ? (
                            <div className="mt-2 text-sm text-slate-700">
                                <p>{selectedSubject.subject_name}</p>
                                <p className="text-slate-500">{selectedSubject.subject_code}</p>
                                <p className="text-slate-500">Division: {selectedSubject.division || "-"}</p>
                                <p className="text-slate-500">Year/Session: {selectedSubject.accadmic_year || selectedSubject.academic_year} / {selectedSubject.session}</p>
                            </div>
                        ) : (
                            <p className="mt-2 text-sm text-slate-500">No offering selected.</p>
                        )}
                    </div>
                </div>

                <div className="mt-6 rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold">Step 2: CO Configuration</h2>
                    <p className="mt-1 text-sm text-slate-500">If config is missing, fields are intentionally empty as requested.</p>

                    <div className="mt-4 flex flex-col gap-3 md:flex-row md:items-end">
                        <div>
                            <label className="mb-1 block text-sm font-medium">Single Threshold % (Apply to All COs)</label>
                            <input
                                type="number"
                                min="0"
                                max="100"
                                className={`${inputStyles} w-56`}
                                value={form.globalThreshold}
                                onChange={(e) => setValue("globalThreshold", e.target.value)}
                                disabled={!paperState.paper}
                                placeholder="e.g. 40"
                            />
                        </div>
                        <button
                            type="button"
                            className={primaryButtonStyles}
                            onClick={applyGlobalThreshold}
                            disabled={!paperState.paper}
                        >
                            Apply to All COs
                        </button>
                    </div>

                    <div className="mt-3 overflow-x-auto">
                        <table className="table border border-slate-200 bg-white text-slate-800">
                            <thead className={tableHeaderStyles}>
                                <tr>
                                    <th className="border-b border-slate-200">CO</th>
                                    <th className="border-b border-slate-200">Total Marks</th>
                                    <th className="border-b border-slate-200">Threshold %</th>
                                </tr>
                            </thead>
                            <tbody>
                                {coRows.map((row, index) => (
                                    <tr key={row.co_number} className="border-b border-slate-100 bg-white text-slate-800">
                                        <td>CO-{row.co_number}</td>
                                        <td>
                                            <input
                                                type="number"
                                                min="0"
                                                className={`${inputStyles} w-28 py-1.5 text-xs`}
                                                value={row.total_marks}
                                                onChange={(e) => handleCoChange(index, "total_marks", e.target.value)}
                                                disabled={!paperState.paper}
                                            />
                                        </td>
                                        <td>
                                            <span className="font-medium text-slate-700">{row.target_value === "" ? "-" : `${row.target_value}%`}</span>
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>

                    <button
                        type="button"
                        className={`${primaryButtonStyles} mt-3`}
                        onClick={handleSaveCoConfig}
                        disabled={!paperState.paper || busySaveConfig}
                    >
                        {busySaveConfig ? "Saving..." : "Save CO Config"}
                    </button>
                </div>

                <div className="mt-6 rounded-lg border border-slate-200 p-4">
                    <h2 className="text-lg font-semibold">Step 3: Upload Student Excel</h2>
                    <p className="mt-1 text-sm text-slate-500">Uploading again replaces previous marks for this paper.</p>

                    <div className="mt-3 flex flex-col gap-3 md:flex-row md:items-center">
                        <input
                            type="file"
                            className={`${inputStyles} md:max-w-xs`}
                            accept=".xlsx,.xls,.csv"
                            onChange={(e) => handleFileSelection(e.target.files?.[0] || null)}
                            disabled={!paperState.paper}
                        />

                        <button
                            type="button"
                            className={secondaryButtonStyles}
                            onClick={handleDownloadDemoTemplate}
                        >
                            Download Demo Template
                        </button>

                        <button
                            type="button"
                            className={primaryButtonStyles}
                            onClick={handleUpload}
                            disabled={!paperState.paper || busyUpload || busyParseFile || invalidPreviewRows.length > 0 || !validPreviewRows.length}
                        >
                            {busyUpload ? "Uploading..." : "Upload Marks"}
                        </button>
                    </div>

                    {busyParseFile ? <p className="mt-3 text-sm text-slate-500">Reading excel...</p> : null}

                    {invalidPreviewRows.length > 0 ? (
                        <div className="mt-3 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                            Invalid enrollments found for this offering. Remove/fix these in Excel: {invalidPreviewRows.map((row) => row.enrollment_no).join(", ")}
                        </div>
                    ) : null}

                    {paperState.paper ? (
                        <div className="mt-4 rounded-lg border border-slate-200 bg-white p-3">
                            <p className="mb-2 text-sm font-medium text-slate-700">Editable Excel Preview</p>
                            <div className="max-h-80 overflow-auto border border-slate-200">
                                <table className="table border-collapse bg-white text-slate-800">
                                    <thead className={tableHeaderStyles}>
                                        <tr>
                                            {gridHeader.map((label) => (
                                                <th key={label} className="border border-slate-200">{label}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {invalidPreviewRows.map((row, rowIndex) => {
                                            const finalValues = isGradedExamType(form.exam_type)
                                                ? [row.sr, row.enrollment_no, row.grade ?? ""]
                                                : [row.sr, row.enrollment_no, row.co1, row.co2, row.co3, row.co4, row.co5, row.co6, row.total_marks];

                                            return (
                                                <tr key={`invalid-${rowIndex}`} className="bg-red-100">
                                                    {finalValues.map((cell, colIndex) => (
                                                        <td key={`invalid-cell-${rowIndex}-${colIndex}`} className="border border-red-300 p-1">
                                                            <input
                                                                type="text"
                                                                className="w-full rounded border border-red-300 bg-red-50 px-2 py-1 text-xs text-red-700"
                                                                value={cell}
                                                                readOnly
                                                            />
                                                        </td>
                                                    ))}
                                                </tr>
                                            );
                                        })}

                                        {validPreviewRows.map((row, rowIndex) => {
                                            const gradedExam = isGradedExamType(form.exam_type);
                                            const finalValues = gradedExam
                                                ? [row.sr, row.enrollment_no, row.grade ?? ""]
                                                : [row.sr, row.enrollment_no, row.co1, row.co2, row.co3, row.co4, row.co5, row.co6, row.total_marks];

                                            return (
                                                <tr key={`valid-${row.enrollment_no}`} className="bg-white">
                                                    {finalValues.map((cell, colIndex) => {
                                                        const isReadOnly = colIndex === 0 || colIndex === 1;
                                                        const field =
                                                            gradedExam
                                                                ? "grade"
                                                                : colIndex === 2
                                                                ? "co1"
                                                                : colIndex === 3
                                                                ? "co2"
                                                                : colIndex === 4
                                                                ? "co3"
                                                                : colIndex === 5
                                                                ? "co4"
                                                                : colIndex === 6
                                                                ? "co5"
                                                                : colIndex === 7
                                                                ? "co6"
                                                                : "total_marks";

                                                        return (
                                                            <td key={`valid-cell-${row.enrollment_no}-${colIndex}`} className="border border-slate-200 p-1">
                                                            <input
                                                                type="text"
                                                                className={`w-full rounded border px-2 py-1 text-xs text-slate-800 ${isReadOnly ? "border-slate-200 bg-slate-100" : "border-slate-300 bg-white"}`}
                                                                value={cell}
                                                                onChange={(e) => {
                                                                    if (isReadOnly) return;
                                                                    handleValidCellChange(rowIndex, field, e.target.value);
                                                                }}
                                                                readOnly={isReadOnly}
                                                            />
                                                    </td>
                                                        );
                                                    })}
                                                </tr>
                                            );
                                        })}

                                        {validPreviewRows.length === 0 && invalidPreviewRows.length === 0 ? (
                                            <tr>
                                                <td className="border border-slate-200 p-3 text-sm text-slate-500" colSpan={gridHeader.length}>
                                                    No students found for this offering.
                                                </td>
                                            </tr>
                                        ) : null}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    ) : null}
                </div>
            </div>

            {message.text ? (
                <div className="pointer-events-none fixed bottom-6 right-6 z-1000 max-w-sm">
                    <div
                        className={`pointer-events-auto rounded-lg border px-4 py-3 text-sm shadow-lg ${
                            message.type === "error"
                                ? "border-red-200 bg-red-50 text-red-700"
                                : message.type === "success"
                                ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                                : "border-blue-200 bg-blue-50 text-blue-700"
                        }`}
                    >
                        {message.text}
                    </div>
                </div>
            ) : null}
        </div>
    );
}
