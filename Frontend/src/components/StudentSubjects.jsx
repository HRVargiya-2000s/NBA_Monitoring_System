import { useEffect, useMemo, useState } from "react";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const EXAM_ORDER = ["internal", "mid_sem", "external", "viva"];

const EXTERNAL_MARK_TO_GRADE = {
  65: "AA",
  56: "AB",
  49: "BB",
  42: "BC",
  35: "CC",
  29: "CD",
  28: "DD",
  22: "FF"
};

const VIVA_MARK_TO_GRADE = {
  28: "AA",
  24: "AB",
  21: "BB",
  18: "BC",
  15: "CC",
  13: "CD",
  12: "DD",
  10: "FF"
};

const examLabel = (examType) => {
  const map = {
    internal: "Internal",
    mid_sem: "Mid Sem",
    external: "External",
    viva: "Viva"
  };
  return map[examType] || String(examType || "").replace(/_/g, " ");
};

const normalizeExamType = (examType) => {
  const normalized = String(examType || "")
    .trim()
    .toLowerCase()
    .replace(/[-\s]+/g, "_");

  if (!normalized) return "";
  if (normalized === "midsem") return "mid_sem";
  if (normalized === "mid_sems") return "mid_sem";
  if (normalized === "internal_exam") return "internal";
  if (normalized === "external_exam") return "external";
  if (normalized === "viva_voce" || normalized === "viva_vice" || normalized === "vivi") return "viva";

  return normalized;
};

const getGradeFromMarks = (examType, marks) => {
  const markNumber = Number(marks);
  if (Number.isNaN(markNumber)) return "-";
  if (examType === "external") return EXTERNAL_MARK_TO_GRADE[markNumber] || "-";
  if (examType === "viva") return VIVA_MARK_TO_GRADE[markNumber] || "-";
  return "-";
};

const GradePill = ({ grade }) => {
  if (!grade || grade === "-") {
    return <span className="rounded-full border border-slate-300 bg-white px-2.5 py-0.5 text-[11px] font-semibold text-slate-600">Pending</span>;
  }

  const tone = grade === "FF"
    ? "border border-red-200 bg-red-50 text-red-700"
    : grade === "DD" || grade === "CD"
      ? "border border-amber-200 bg-amber-50 text-amber-700"
      : "border border-emerald-200 bg-emerald-50 text-emerald-700";
  return <span className={`rounded-full px-2.5 py-0.5 text-[11px] font-bold ${tone}`}>Grade {grade}</span>;
};

const SectionCard = ({ label, children }) => (
  <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b border-slate-200 bg-slate-50">
      <span className="text-xs font-bold text-slate-600 uppercase tracking-wide">{label}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const normalizeMarksByExam = (marksData) => {
  const normalized = {};
  const list = Array.isArray(marksData) ? marksData : [];

  list.forEach((paper) => {
    const type = normalizeExamType(paper?.exam_type);
    if (!type) return;

    if (!EXAM_ORDER.includes(type)) return;

    normalized[type] = {
      obtained: paper?.obtained_marks,
      total: paper?.total_marks,
      co: Array.isArray(paper?.co_marks) ? paper.co_marks : []
    };
  });

  return normalized;
};

export default function StudentSubjects() {
  const [subjects, setSubjects] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const fetchSubjects = async () => {
      try {
        setLoading(true);
        setError("");

        const userRes = await axios.get(`${SERVER_URL}/user/me`, { withCredentials: true });
        const userData = userRes.data?.user || userRes.data || {};
        const enrollmentNo = userData.enrollment_no || userData.id;

        if (!enrollmentNo) {
          throw new Error("Student enrollment number not found.");
        }

        const subjectsRes = await axios.get(`${SERVER_URL}/subject/student/${enrollmentNo}/subjects`, {
          withCredentials: true
        });

        const rawSubjects = Array.isArray(subjectsRes.data?.subjects) ? subjectsRes.data.subjects : [];

        const subjectsWithMarks = await Promise.all(
          rawSubjects.map(async (subject) => {
            const offeringId = subject?.offering_id;
            if (!offeringId) {
              return { ...subject, marksByExam: {} };
            }

            try {
              const marksRes = await axios.get(`${SERVER_URL}/marks/student/${enrollmentNo}/offering/${offeringId}`, {
                withCredentials: true
              });
              return { ...subject, marksByExam: normalizeMarksByExam(marksRes.data) };
            } catch {
              return { ...subject, marksByExam: {} };
            }
          })
        );

        setSubjects(subjectsWithMarks);
      } catch (err) {
        setError(err?.response?.data?.message || err?.message || "Unable to load subjects.");
      } finally {
        setLoading(false);
      }
    };

    fetchSubjects();
  }, []);

  const groupedSubjects = useMemo(() => {
    const grouped = subjects.reduce((acc, subject) => {
      const year = subject?.accadmic_year || "Unknown Year";
      const session = subject?.session ? String(subject.session).toUpperCase() : "Unknown Session";
      const key = `${year} | ${session}`;
      if (!acc[key]) {
        acc[key] = {
          year,
          session,
          items: []
        };
      }
      acc[key].items.push(subject);
      return acc;
    }, {});

    return Object.values(grouped)
      .sort((a, b) => {
        const aStart = Number.parseInt(String(a.year).split("-")[0], 10) || 0;
        const bStart = Number.parseInt(String(b.year).split("-")[0], 10) || 0;
        if (aStart !== bStart) return bStart - aStart;
        if (a.session === b.session) return 0;
        return a.session === "EVEN" ? 1 : -1;
      })
      .map((group) => ({
        ...group,
        items: group.items.sort((a, b) => {
          const semA = Number(a?.sem_number || 0);
          const semB = Number(b?.sem_number || 0);
          if (semA !== semB) return semA - semB;
          return String(a?.subject_code || "").localeCompare(String(b?.subject_code || ""));
        })
      }));
  }, [subjects]);

  if (loading) {
    return <div className="p-10 text-center"><span className="loading loading-dots loading-lg text-blue-600" /></div>;
  }

  if (error) {
    return <div className="alert alert-error text-sm">{error}</div>;
  }

  return (
    <div className="mx-auto space-y-6 px-4 py-6">
      <div className="rounded-xl border border-slate-200 bg-white shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-slate-50 via-white to-slate-50 px-6 py-5 border-b border-slate-200">
          <h1 className="text-2xl font-bold text-slate-900">My Subjects & Marks</h1>
          <p className="text-sm text-slate-600 mt-1">
            View assigned subjects year/session wise with Internal, Mid Sem, External and Viva performance.
          </p>
        </div>
      </div>

      {groupedSubjects.length === 0 ? (
        <SectionCard label="Subjects">
          <p className="text-sm text-slate-600">No subjects assigned yet.</p>
        </SectionCard>
      ) : (
        <div className="space-y-6">
          {groupedSubjects.map((group) => (
            <SectionCard key={`${group.year}-${group.session}`} label={`${group.year} · ${group.session} Session`}>
              <div className="grid grid-cols-1 gap-5">
                {group.items.map((subject) => (
                  <div key={`${subject.offering_id}-${subject.subject_code}`} className="rounded-xl border border-slate-200 bg-white p-4">
                    <div className="flex items-start justify-between gap-3 pb-3 border-b border-slate-200">
                      <div>
                        <h3 className="text-base font-bold text-slate-900">{subject.subject_name}</h3>
                        <p className="text-xs text-slate-500 mt-1">
                          {subject.subject_code || "-"} | Sem {subject.sem_number || "-"}
                        </p>
                      </div>
                      <span className="rounded-full border border-blue-200 bg-blue-50 px-2.5 py-0.5 text-xs font-semibold text-blue-700">
                        {subject.subject_code || "Subject"}
                      </span>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-4 gap-3 mt-4">
                      {EXAM_ORDER.map((examType) => {
                        const marks = subject.marksByExam?.[examType];
                        const hasMarks = marks && marks.obtained !== null && marks.obtained !== undefined;
                        const grade = hasMarks ? getGradeFromMarks(examType, marks.obtained) : "-";
                        const isGradeExam = examType === "external" || examType === "viva";

                        return (
                          <div key={examType} className="rounded-lg border border-slate-200 bg-slate-50/70 p-3">
                            <div className="flex items-center justify-between gap-2 mb-2">
                              <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">{examLabel(examType)}</p>
                              {isGradeExam ? <GradePill grade={grade} /> : null}
                            </div>

                            {hasMarks ? (
                              <>
                                {isGradeExam ? (
                                  <p className="text-sm font-semibold text-slate-900">Grade: {grade}</p>
                                ) : (
                                  <>
                                    <p className="text-sm font-semibold text-slate-900">
                                      {marks.obtained} / {marks.total}
                                    </p>
                                    <p className="text-[11px] text-slate-500 mt-1">
                                      {marks.total ? `${Math.round((Number(marks.obtained) / Number(marks.total)) * 100)}%` : "-"}
                                    </p>
                                  </>
                                )}
                              </>
                            ) : (
                              <p className="text-sm text-slate-500">Not Uploaded</p>
                            )}
                          </div>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            </SectionCard>
          ))}
        </div>
      )}
    </div>
  );
}