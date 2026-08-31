import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router"; // Ensure you use react-router-dom
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.SERVER_URL || "http://localhost:3000";

const StatCard = ({ title, value, subtitle, tone = "slate" }) => {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900"
  };

  return (
    <div className={`rounded-lg border p-4 ${toneClass[tone] || toneClass.slate}`}>
      <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
      <p className="mt-2 text-3xl font-bold leading-none">{value}</p>
      {subtitle ? <p className="mt-2 text-xs opacity-80">{subtitle}</p> : null}
    </div>
  );
};

const ActionLink = ({ to, label, description, meta, tone = "slate" }) => {
  const toneClass = {
    blue: "border-blue-200/70 bg-blue-50/70 text-blue-900 hover:border-blue-300",
    amber: "border-amber-200/70 bg-amber-50/70 text-amber-900 hover:border-amber-300",
    emerald: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300",
    indigo: "border-indigo-200/70 bg-indigo-50/70 text-indigo-900 hover:border-indigo-300",
    slate: "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
  };

  return (
    <Link
      to={to}
      className={`group rounded-2xl border p-5 transition ${toneClass[tone] || toneClass.slate}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-semibold text-slate-900 group-hover:text-slate-900">{label}</p>
            <p className="mt-2 text-xs text-slate-600">{description}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition group-hover:border-slate-300">
            OPEN
          </span>
        </div>
        {meta ? (
          <div className="flex flex-wrap items-center gap-2 text-[11px] font-semibold text-slate-500">
            <span className="rounded-full border border-slate-200 bg-white/70 px-2 py-1">{meta}</span>
            <span className="rounded-full border border-slate-200 bg-white/70 px-2 py-1">Quick access</span>
          </div>
        ) : null}
      </div>
    </Link>
  );
};

const formatSubject = (subject) => {
  const code = subject.subject_code || "-";
  const name = subject.subject_name || "Unnamed Subject";
  const sem = subject.sem_number != null ? `Sem ${subject.sem_number}` : "Sem ?";
  const division = subject.division ? `Div ${subject.division}` : "Div ?";
  const role = subject.teaching_role ? subject.teaching_role : "faculty";
  const load = subject.total_lectures ? `${subject.total_lectures} lectures` : "No lecture count";

  return `${code} - ${name} (${sem}, ${division}, ${role}, ${load})`;
};

export default function FacultyDashboard() {
  const [profile, setProfile] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true });
        setProfile(res.data || null);
      } catch (err) {
        setError(err?.response?.data?.error || "Could not load faculty dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const subjects = useMemo(() => (Array.isArray(profile?.assigned_subjects) ? profile.assigned_subjects : []), [profile]);

  const groupedByYearSession = useMemo(() => {
    const grouped = {};

    for (const subject of subjects) {
      const year = subject.accadmic_year || "Unknown Year";
      const session = subject.session || "Unknown Session";
      const key = `${year} | ${session}`;
      if (!grouped[key]) grouped[key] = [];
      grouped[key].push(subject);
    }

    return Object.entries(grouped).sort((a, b) => b[0].localeCompare(a[0]));
  }, [subjects]);

  const totalLectures = useMemo(() => {
    return subjects.reduce((sum, row) => sum + (Number(row.total_lectures) || 0), 0);
  }, [subjects]);

  const uniqueDivisions = useMemo(() => {
    return new Set(subjects.map((row) => row.division).filter(Boolean)).size;
  }, [subjects]);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "short",
    day: "numeric",
    month: "short",
    year: "numeric"
  });

  if (loading) {
    return (
      <div className="py-10 text-center">
        <span className="loading loading-dots loading-lg text-primary" />
      </div>
    );
  }

  if (error) {
    return (
      <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
        {error}
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-10">
      
      {/* HEADER BANNER - Styled exactly like Student Portal */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-20 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
        
        <div className="relative flex flex-col gap-6 md:flex-row md:items-end md:justify-between">
          <div className="mb-2">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 opacity-80">
              Faculty Command Center
            </p>
            <h1 className="mt-2 text-4xl font-extrabold">
              Welcome, {profile?.name || "Faculty"} 👋
            </h1>
            <p className="mt-2 text-base text-blue-100/90">
              {profile?.role || "Faculty"} {profile?.branch_name ? `| ${profile.branch_name}` : ""} • {today}
            </p>
          </div>

          {/* Quick Action Buttons inside the header */}
          <div className="flex flex-wrap gap-3 pb-2">
            <Link 
              to="/faculty/subjects" 
              className="rounded-xl bg-white/10 px-5 py-2.5 text-sm font-bold text-white backdrop-blur-md transition hover:bg-white/20 border border-white/10"
            >
              Open Subjects
            </Link>
            <Link 
              to="/faculty/assessment" 
              className="rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-bold text-white shadow-lg shadow-blue-900/20 transition hover:bg-blue-500 hover:-translate-y-0.5"
            >
              Enter Assessment
            </Link>
          </div>
        </div>
      </div>

      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard title="Assigned Subjects" value={subjects.length} subtitle="Across all active offerings" tone="blue" />
        <StatCard title="Total Planned Lectures" value={totalLectures} subtitle="Sum of offering lecture load" tone="emerald" />
        <StatCard title="Divisions" value={uniqueDivisions} subtitle="Unique class divisions mapped" tone="indigo" />
        <StatCard
          title="Experience"
          value={profile?.years_of_experience != null ? profile.years_of_experience : "-"}
          subtitle="Years in teaching"
          tone="amber"
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-4">
        <div className="rounded-lg border border-slate-200 bg-white p-4 lg:col-span-3">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Teaching Assignments</h3>
              <p className="text-xs text-slate-500">Grouped by academic year and session</p>
            </div>
            <span className="rounded-full border border-slate-200 px-2 py-1 text-[10px] font-semibold text-slate-500">
              {groupedByYearSession.length} groups
            </span>
          </div>

          {groupedByYearSession.length === 0 ? (
            <div className="rounded-md border border-dashed border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
              No assigned subjects found yet.
            </div>
          ) : (
            <div className="space-y-4">
              {groupedByYearSession.map(([group, rows]) => (
                <div key={group} className="rounded-lg border border-slate-200 p-3">
                  <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">{group}</p>
                  <div className="mt-2 space-y-2">
                    {rows.map((subject, index) => (
                      <div key={`${subject.offering_id || subject.subject_code || index}-${index}`} className="rounded-md bg-slate-50 px-3 py-2 text-sm text-slate-700">
                        {formatSubject(subject)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="space-y-4 rounded-lg border border-slate-200 bg-white p-4">
          <div className="rounded-xl border border-slate-200 bg-slate-50 p-4">
            <p className="text-xs font-semibold uppercase tracking-wide text-slate-600">Focus Today</p>
            <div className="mt-3 space-y-2 text-xs text-slate-600">
              <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                <span className="font-semibold text-slate-700">Active groups</span>
                <span>{groupedByYearSession.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                <span className="font-semibold text-slate-700">Assigned subjects</span>
                <span>{subjects.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-md bg-white px-3 py-2">
                <span className="font-semibold text-slate-700">Planned lectures</span>
                <span>{totalLectures}</span>
              </div>
            </div>
          </div>

          <div>
            <h3 className="text-sm font-bold uppercase tracking-wide text-slate-700">Quick Actions</h3>
            <p className="mt-1 text-xs text-slate-500">Deep links into your highest-frequency workflows.</p>
          </div>
          <div className="grid gap-3">
            <ActionLink
              to="/faculty/subjects"
              label="Subject Workspace"
              description="Manage COs, POs, lecture plans and mappings"
              meta="Curriculum"
              tone="indigo"
            />
            <ActionLink
              to="/faculty/assessment"
              label="Assessment Entry"
              description="Create exams, upload marks, and review scores"
              meta="Evaluation"
              tone="blue"
            />
            <ActionLink
              to="/faculty/co-po-view"
              label="Attainment Reports"
              description="Track CO and CO-PO attainment status and gaps"
              meta="Analytics"
              tone="emerald"
            />
            <ActionLink
              to="/faculty/profile"
              label="Profile Settings"
              description="Update address, experience, and password"
              meta="Account"
              tone="amber"
            />
          </div>
        </div>
      </div>
    </div>
  );
}