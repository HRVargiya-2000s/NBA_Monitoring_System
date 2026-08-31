import { useEffect, useState } from "react";
import { Link } from "react-router";
import axios from "axios";

const IconBadge = ({ children, tone = "slate" }) => {
  const toneClass = {
    blue: "bg-blue-100 text-blue-700",
    emerald: "bg-emerald-100 text-emerald-700",
    indigo: "bg-indigo-100 text-indigo-700",
    amber: "bg-amber-100 text-amber-700",
    rose: "bg-rose-100 text-rose-700",
    violet: "bg-violet-100 text-violet-700",
    slate: "bg-slate-100 text-slate-700"
  };

  return (
    <span className={`inline-flex h-10 w-10 items-center justify-center rounded-xl ${toneClass[tone] || toneClass.slate}`}>
      {children}
    </span>
  );
};

const FacultyIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4 20a8 8 0 0116 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 6h4m-2-2v4" />
  </svg>
);

const SubjectIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 4h8l6 6v10H5V4Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M13 4v6h6" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 15h8M8 18h5" />
  </svg>
);

const AssignIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 7V5a2 2 0 012-2h2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 7V5a2 2 0 00-2-2h-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 17v2a2 2 0 002 2h2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 17v2a2 2 0 01-2 2h-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 12h10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M14 9l3 3-3 3" />
  </svg>
);

const UsersIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M17 20a5 5 0 00-10 0" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12a4 4 0 100-8 4 4 0 000 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M19 8a3 3 0 010 6" />
  </svg>
);

const LockIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M7 11V8a5 5 0 0110 0v3" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 11h12v10H6V11Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2" />
  </svg>
);

const DownloadIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 4v10" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M8 11l4 4 4-4" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M5 20h14" />
  </svg>
);

const TargetIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9 9 0 100-18 9 9 0 000 18Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16a4 4 0 100-8 4 4 0 000 8Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 12l7-7" />
  </svg>
);

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 13.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
  </svg>
);

const ShieldIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l7 3v5c0 5-3.5 8.7-7 10-3.5-1.3-7-5-7-10V6l7-3Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-5" />
  </svg>
);

const ChecklistIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 6h11M9 12h11M9 18h11" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 6.5l1 1 2-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.5l1 1 2-2" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 18.5l1 1 2-2" />
  </svg>
);

const SecurityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10V7l8-4Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
  </svg>
);

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.SERVER_URL || "http://localhost:3000";

const StatCard = ({ title, value, subtitle, tone = "slate" }) => {
  const toneClass = {
    blue: "border-blue-200 bg-blue-50 text-blue-900",
    emerald: "border-emerald-200 bg-emerald-50 text-emerald-900",
    indigo: "border-indigo-200 bg-indigo-50 text-indigo-900",
    amber: "border-amber-200 bg-amber-50 text-amber-900",
    rose: "border-rose-200 bg-rose-50 text-rose-900",
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

const ActionLink = ({ to, label, description, icon, tone = "slate" }) => {
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
              {icon && <span className="text-lg">{icon}</span>}
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

export default function AdminDashboard() {
  const [profile, setProfile] = useState(null);
  
  const [metrics, setMetrics] = useState({
    assistants: 0,
    hods: 0,
    associates: 0,
    admins: 0,
    courses: 0,
    branches: 0
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
          assistantRes, 
          hodRes, 
          principalRes, 
          adminRes, 
          coursesRes,
          departmentsRes,
          branchCountRes
        ] = await Promise.all([
          axios.get(`${SERVER_URL}/user/profile`, config).catch(() => ({ data: null })),
          axios.get(`${SERVER_URL}/admin/list`, { params: { role: 'ASSISTANT' }, ...config }).catch(() => ({ data: { users: [] } })),
          axios.get(`${SERVER_URL}/admin/list`, { params: { role: 'HOD' }, ...config }).catch(() => ({ data: { users: [] } })),
          axios.get(`${SERVER_URL}/admin/list`, { params: { role: 'ASSOCIATE' }, ...config }).catch(() => ({ data: { users: [] } })),
          axios.get(`${SERVER_URL}/admin/list`, { params: { role: 'ADMIN' }, ...config }).catch(() => ({ data: { users: [] } })),
          axios.get(`${SERVER_URL}/admin/courses`, config),
          axios.get(`${SERVER_URL}/admin/departments`, config),
          axios.get(`${SERVER_URL}/admin/branch-count`, config).catch(() => ({ data: { count: 0 } }))
        ]);

        if (ignore) return;

        setProfile(profileRes?.data || null);
        
        setMetrics({
          assistants: assistantRes?.data?.users?.length || 0,
          hods: hodRes?.data?.users?.length || 0,
          associates: principalRes?.data?.users?.length || 0,
          admins: adminRes?.data?.users?.length || 0,
          courses: coursesRes?.data?.courses?.length || 0,
          branches: branchCountRes?.data?.count ?? (departmentsRes?.data?.departments?.length || 0)
        });
        
      } catch (err) {
        if (!ignore) {
          setError(err?.response?.data?.message || err.message || "Could not load admin dashboard data.");
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
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-linear-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-slate-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-20 h-48 w-48 rounded-full bg-zinc-400/20 blur-3xl" />
        
        <div className="relative">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-slate-300 opacity-80">System Administration</p>
            <h1 className="mt-2 text-4xl font-extrabold">Welcome, {profile?.name || "Admin"} <span aria-hidden="true">👋</span></h1>
            <p className="mt-2 text-base text-slate-300/90">
              {profile?.email || "admin@institution.edu"} • {today}
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
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Total Faculty Accounts" 
          value={metrics.assistants + metrics.hods} 
          subtitle={`${metrics.assistants} Assistants / ${metrics.hods} HODs`}
          tone="blue" 
        />
        <StatCard 
          title="Management Accounts" 
          value={metrics.associates + metrics.admins} 
          subtitle={`${metrics.associates} Associates / ${metrics.admins} Admins`}
          tone="rose" 
        />
        <StatCard 
          title="Courses Configured" 
          value={metrics.courses} 
          subtitle="Used for bulk data imports" 
          tone="emerald" 
        />
        <StatCard 
          title="Available Branches" 
          value={metrics.branches} 
          subtitle="Configured academic branches" 
          tone="indigo" 
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* OPERATIONS MODULES VIEW */}
        <div className="lg:col-span-2">
            <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Control Panel Modules</h2>
            <div className="grid gap-4 sm:grid-cols-2">
              <ActionLink
                to="/admin/create-faculty"
                label="Create Faculty"
                icon={<FacultyIcon />}
                description="Create ASSISTANT, HOD, ASSOCIATE, or ADMIN records."
                tone="blue"
              />
              <ActionLink
                to="/admin/create-subject"
                label="Create Subject"
                icon={<SubjectIcon />}
                description="Add new subject master entries with code & syllabus URL."
                tone="indigo"
              />
              <ActionLink
                to="/admin/assign-subject"
                label="Assign Subject"
                icon={<AssignIcon />}
                description="Upload student-subject mappings for session."
                tone="emerald"
              />
              <ActionLink
                to="/admin/users"
                label="Users Directory"
                icon={<UsersIcon />}
                description="Filter & review all student and faculty accounts."
                tone="amber"
              />
              <ActionLink
                to="/admin/reset-password"
                label="Reset Password"
                icon={<LockIcon />}
                description="Reset any user's password securely to default."
                tone="rose"
              />
              <ActionLink
                to="/admin/bulk-import"
                label="Bulk Import Students"
                icon={<DownloadIcon />}
                description="Upload excel files to cleanly auto-create batches."
                tone="violet"
              />
              <ActionLink
                to="/admin/outcomes"
                label="PO/PSO Outcomes"
                icon={<TargetIcon />}
                description="Define global PO and branch-specific PSO outcomes."
                tone="amber"
              />
            </div>
        </div>

        {/* SIDEBAR - SUMMARY & CHECKLIST */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/50 bg-linear-to-br from-slate-50 to-white p-5 shadow-sm">
            <h3 className="mb-4 flex items-center gap-2 text-sm font-bold text-slate-900">
              <span className="text-slate-500"><PinIcon /></span>
              Operations Checklist
            </h3>
            <ul className="space-y-3 text-sm text-slate-600">
              <li className="flex gap-2">
                <span className="font-bold text-slate-400">1.</span>
                <span>Create/update faculty accounts before any subject assignment.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-slate-400">2.</span>
                <span>Create subject master entries prior to offering.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-slate-400">3.</span>
                <span>Use 'Assign Subject' template and confirm correct session data.</span>
              </li>
              <li className="flex gap-2">
                <span className="font-bold text-slate-400">4.</span>
                <span>Use Reset Password strictly when identities are explicitly verified.</span>
              </li>
            </ul>
          </div>

          <div className="rounded-xl border border-slate-200/50 bg-slate-100 p-4 border-l-4 border-l-slate-400">
            <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-slate-900">
              <span className="text-slate-500"><SecurityIcon /></span>
              Security Note
            </p>
            <p className="text-xs text-slate-700">Actions taken inside the administration panel are permanently saved. Process imports carefully.</p>
          </div>
        </div>
      </div>
    </div>
  );
}
