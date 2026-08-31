import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.SERVER_URL || "http://localhost:3000";

const StatCard = ({ title, value, subtitle, tone = "slate" }) => {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
    violet: "border-violet-200 bg-violet-50 text-violet-900",
    slate: "border-slate-200 bg-slate-50 text-slate-900"
  };

  return (
    <div className={`card border ${toneClass[tone] || toneClass.slate}`}>
      <div className="card-body p-4">
        <p className="text-xs font-semibold uppercase tracking-wide opacity-80">{title}</p>
        <p className="mt-2 text-3xl font-bold leading-none">{value}</p>
        {subtitle && <p className="mt-2 text-xs opacity-80">{subtitle}</p>}
      </div>
    </div>
  );
};

const ActionLink = ({ to, label, description, emoji, tone = "slate" }) => {
  const toneClass = {
    blue: "border-blue-200/70 bg-blue-50/70 text-blue-900 hover:border-blue-300",
    amber: "border-amber-200/70 bg-amber-50/70 text-amber-900 hover:border-amber-300",
    emerald: "border-emerald-200/70 bg-emerald-50/70 text-emerald-900 hover:border-emerald-300",
    indigo: "border-indigo-200/70 bg-indigo-50/70 text-indigo-900 hover:border-indigo-300",
    rose: "border-rose-200/70 bg-rose-50/70 text-rose-900 hover:border-rose-300",
    violet: "border-violet-200/70 bg-violet-50/70 text-violet-900 hover:border-violet-300",
    slate: "border-slate-200 bg-white text-slate-900 hover:border-slate-300"
  };

  return (
    <Link
      to={to}
      className={`card group rounded-2xl border p-5 transition ${toneClass[tone] || toneClass.slate}`}
    >
      <div className="flex flex-col gap-3">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-sm font-bold text-slate-900 group-hover:text-slate-900 flex items-center gap-2">
              {emoji && <span className="text-xl">{emoji}</span>}
              {label}
            </p>
            <p className="mt-2 text-xs text-slate-600">{description}</p>
          </div>
          <span className="rounded-full border border-slate-200 bg-white/70 px-2.5 py-1 text-[10px] font-semibold text-slate-600 transition group-hover:border-slate-300">
            OPEN
          </span>
        </div>
      </div>
    </Link>
  );
};

export default function StudentDashboard() {
  const [profile, setProfile] = useState(null);
  
  const [metrics, setMetrics] = useState({
    enrolledSubjects: 0,
    academicYear: "-",
    session: "-"
  });

  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    let ignore = false;
    
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        
        const config = { withCredentials: true };
        
        const [
          profileRes, 
          subjectsRes
        ] = await Promise.all([
          axios.get(`${SERVER_URL}/user/profile`, config).catch(() => ({ data: null })),
          axios.get(`${SERVER_URL}/subject/my/current-subjects`, config).catch(() => ({ data: { subjects: [] } }))
        ]);

        if (ignore) return;

        setProfile(profileRes?.data || null);
        
        const subsData = subjectsRes?.data?.subjects || subjectsRes?.data?.items || subjectsRes?.data?.data || subjectsRes?.data || [];
        
        setMetrics({
          enrolledSubjects: Array.isArray(subsData) ? subsData.length : 0,
          academicYear: subjectsRes?.data?.accadmic_year || "Current",
          session: subjectsRes?.data?.session || "Session"
        });
        
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err.message || "Could not load student dashboard data.");
        }
      } finally {
        if (!ignore) {
          setLoading(false);
        }
      }
    };

    fetchData();
    return () => { ignore = true; };
  }, []);

  const today = new Date().toLocaleDateString("en-IN", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric"
  });

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <span className="loading loading-spinner loading-lg"></span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-gradient-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-blue-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-20 h-48 w-48 rounded-full bg-sky-400/20 blur-3xl" />
        
        <div className="relative">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-blue-200 opacity-80">Student Portal</p>
            <h1 className="mt-2 text-4xl font-extrabold">Welcome back, {profile?.name || "Student"} 👋</h1>
            <p className="mt-2 text-base text-blue-100/90">
              {profile?.email || profile?.enrollment_no || "student@institution.edu"} • {today}
            </p>
          </div>
        </div>
      </div>

      {error && (
        <div className="alert alert-warning shadow-sm rounded-xl">
          <span>⚠️ {error}</span>
        </div>
      )}

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
        <StatCard 
          title="Enrolled Subjects" 
          value={metrics.enrolledSubjects} 
          subtitle="Currently active this semester"
          tone="blue" 
        />
        <StatCard 
          title="Academic Session" 
          value={metrics.academicYear} 
          subtitle={`${metrics.session} Semester`}
          tone="emerald" 
        />
        <StatCard 
          title="Quick Actions" 
          value="3" 
          subtitle="Learning modules available" 
          tone="indigo" 
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* OPERATIONS MODULES VIEW */}
        <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">My Modules</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <ActionLink
                to="/student/subjects"
                label="My Subjects"
                emoji="📚"
                description="View enrolled subjects, syllabus, and course details."
                tone="blue"
              />
              <ActionLink
                to="/student/attendance"
                label="My Attendance"
                emoji="📅"
                description="Check subject-wise attendance percentage and logs."
                tone="emerald"
              />
              <ActionLink
                to="/student/profile"
                label="My Profile"
                emoji="👤"
                description="View and update your student account details."
                tone="violet"
              />
            </div>
        </div>

        {/* SIDEBAR - SUMMARY & CHECKLIST */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/50 bg-gradient-to-br from-blue-50 to-indigo-50 p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4">📍 Semester Checklist</h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="font-bold text-blue-400">1.</span>
                <span>Review course mappings to ensure correct subjects.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-400">2.</span>
                <span>Track daily attendance requirements for term exams.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-blue-400">3.</span>
                <span>Prepare for internal mid-semester assessments.</span>
              </li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}