import { useEffect, useState } from "react";
import axios from "axios";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.SERVER_URL || "http://localhost:3000";

const PinIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 22s6-5.2 6-11a6 6 0 10-12 0c0 5.8 6 11 6 11Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 13.5a2.5 2.5 0 100-5 2.5 2.5 0 000 5Z" />
  </svg>
);

const SecurityIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.9" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 3l8 4v6c0 5-3.5 8.7-8 10-4.5-1.3-8-5-8-10V7l8-4Z" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 8v5" />
    <path strokeLinecap="round" strokeLinejoin="round" d="M12 16h.01" />
  </svg>
);

const CloseIcon = () => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-5 w-5">
    <path strokeLinecap="round" strokeLinejoin="round" d="M6 6l12 12M18 6L6 18" />
  </svg>
);

const ModalShell = ({ open, title, subtitle, onClose, children, wide = false }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/55 p-4 backdrop-blur-sm">
      <div className={`max-h-[90vh] w-full ${wide ? "max-w-6xl" : "max-w-4xl"} overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl`}>
        <div className="flex items-start justify-between gap-4 border-b border-slate-200 px-5 py-4">
          <div>
            <p className="text-xs font-bold uppercase tracking-[0.2em] text-indigo-600">HOD Detail View</p>
            <h3 className="mt-1 text-xl font-extrabold text-slate-900">{title}</h3>
            {subtitle && <p className="mt-1 text-sm text-slate-500">{subtitle}</p>}
          </div>
          <button type="button" onClick={onClose} className="rounded-full border border-slate-200 p-2 text-slate-600 transition hover:bg-slate-100 hover:text-slate-900">
            <CloseIcon />
          </button>
        </div>
        <div className="max-h-[calc(90vh-81px)] overflow-y-auto px-5 py-5">{children}</div>
      </div>
    </div>
  );
};

const InfoChip = ({ label, value, tone = "slate" }) => {
  const toneClass = {
    blue: "bg-blue-50 text-blue-700 border-blue-200",
    emerald: "bg-emerald-50 text-emerald-700 border-emerald-200",
    indigo: "bg-indigo-50 text-indigo-700 border-indigo-200",
    amber: "bg-amber-50 text-amber-700 border-amber-200",
    slate: "bg-slate-50 text-slate-700 border-slate-200"
  };

  return (
    <div className={`rounded-xl border px-4 py-3 ${toneClass[tone] || toneClass.slate}`}>
      <p className="text-[11px] font-bold uppercase tracking-wide opacity-70">{label}</p>
      <p className="mt-1 text-sm font-semibold">{value}</p>
    </div>
  );
};

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

export default function HodDashboard() {
  const [profile, setProfile] = useState(null);
  const [departmentFaculties, setDepartmentFaculties] = useState([]);
  const [subjects, setSubjects] = useState([]);
  const [batches, setBatches] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [facultyDirectoryOpen, setFacultyDirectoryOpen] = useState(false);
  const [selectedFaculty, setSelectedFaculty] = useState(null);
  const [selectedFacultyDetails, setSelectedFacultyDetails] = useState(null);
  const [facultyDetailsLoading, setFacultyDetailsLoading] = useState(false);
  const [facultyDetailsError, setFacultyDetailsError] = useState("");
  const [selectedBatch, setSelectedBatch] = useState(null);
  const [selectedBatchDetails, setSelectedBatchDetails] = useState(null);
  const [batchDetailsLoading, setBatchDetailsLoading] = useState(false);
  const [batchDetailsError, setBatchDetailsError] = useState("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        setLoading(true);
        setError("");
        
        const config = { withCredentials: true };
        
        // Parallel fetching
        const [profileRes, facultiesRes, subjectsRes, batchesRes] = await Promise.all([
            axios.get(`${SERVER_URL}/user/profile`, config).catch(() => ({ data: null })),
            axios.get(`${SERVER_URL}/hod-assignment/department-faculties`, config).catch(() => ({ data: [] })),
            axios.get(`${SERVER_URL}/hod-assignment/subjects-list`, config).catch(() => ({ data: [] })),
            axios.get(`${SERVER_URL}/hod-assignment/batches-list`, config).catch(() => ({ data: [] }))
        ]);

        if(!profileRes.data && !facultiesRes.data && !subjectsRes.data && !batchesRes.data){
             throw new Error("Failed to connect to backend");
        }

        setProfile(profileRes.data);
        setDepartmentFaculties(facultiesRes.data || []);
        setSubjects(subjectsRes.data || []);
        setBatches(batchesRes.data || []);
        
      } catch (err) {
        setError(err?.response?.data?.error || err.message || "Could not load HOD dashboard data.");
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, []);

  const openFacultyDetails = async (faculty) => {
    setSelectedFaculty(faculty);
    setSelectedFacultyDetails(null);
    setFacultyDetailsError("");
    setFacultyDetailsLoading(true);

    try {
      const res = await axios.get(`${SERVER_URL}/hod-assignment/faculty/${faculty.id}`, { withCredentials: true });
      setSelectedFacultyDetails(res.data);
    } catch (err) {
      setFacultyDetailsError(err?.response?.data?.error || "Could not load faculty details.");
    } finally {
      setFacultyDetailsLoading(false);
    }
  };

  const openBatchDetails = async (batch) => {
    setSelectedBatch(batch);
    setSelectedBatchDetails(null);
    setBatchDetailsError("");
    setBatchDetailsLoading(true);

    try {
      const res = await axios.get(`${SERVER_URL}/hod-assignment/batch/${batch.batch_id}/students`, { withCredentials: true });
      setSelectedBatchDetails(res.data);
    } catch (err) {
      setBatchDetailsError(err?.response?.data?.error || "Could not load batch students.");
    } finally {
      setBatchDetailsLoading(false);
    }
  };

  const facultyCount = departmentFaculties.length;
  const visibleFaculties = departmentFaculties.slice(0, 6);
  const extraFacultyCount = Math.max(facultyCount - visibleFaculties.length, 0);

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

  if (error) {
    return (
      <div className="alert alert-error shadow-lg">
        <span>{error}</span>
      </div>
    );
  }

  return (
    <div className="space-y-8 pb-10">
      {/* HEADER BANNER */}
      <div className="relative overflow-hidden rounded-2xl border border-slate-200/50 bg-linear-to-br from-indigo-900 via-purple-900 to-slate-900 p-8 text-white shadow-lg">
        <div className="pointer-events-none absolute -right-20 -top-20 h-60 w-60 rounded-full bg-indigo-400/20 blur-3xl" />
        <div className="pointer-events-none absolute -bottom-12 -left-20 h-48 w-48 rounded-full bg-purple-400/20 blur-3xl" />
        
        <div className="relative">
          <div className="mb-6">
            <p className="text-sm font-semibold uppercase tracking-widest text-indigo-200 opacity-80">Head of Department Dashboard</p>
            <h1 className="mt-2 text-4xl font-extrabold">Welcome, {profile?.name || "HOD"} 👋</h1>
            <p className="mt-2 text-base text-indigo-100/90">
              {profile?.email || "hod@institution.edu"} • {today}
            </p>
          </div>
        </div>
      </div>

      {/* KPI CARDS */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard 
          title="Department Staff" 
          value={departmentFaculties.length} 
          subtitle="Total Faculty Members" 
          tone="blue" 
        />
        <StatCard 
          title="Active Batches" 
          value={batches.length} 
          subtitle="Department Batches" 
          tone="emerald" 
        />
        <StatCard 
          title="Curriculum Subjects" 
          value={subjects.length} 
          subtitle="Catalog Subjects" 
          tone="indigo" 
        />
        <StatCard 
          title="My Teaching Load" 
          value={profile?.assigned_subjects?.length || 0} 
          subtitle="Assigned Subjects" 
          tone="amber" 
        />
      </div>

      {/* MAIN CONTENT GRID */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* DATABASE CONTENT VIEW */}
        <div className="lg:col-span-2 space-y-8">
            
            {/* DEPARTMENT FACULTY LIST */}
            {departmentFaculties.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Department Faculty</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {visibleFaculties.map((fac) => (
                    <button
                      key={fac.id}
                      type="button"
                      onClick={() => openFacultyDetails(fac)}
                      className="flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-blue-300 hover:shadow-md"
                    >
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                        {fac.name?.charAt(0).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="truncate font-bold text-slate-800 text-sm">{fac.name}</p>
                        <p className="text-xs text-slate-500">{fac.type}</p>
                      </div>
                    </button>
                  ))}
                  {extraFacultyCount > 0 && (
                    <button
                      type="button"
                      onClick={() => setFacultyDirectoryOpen(true)}
                      className="flex items-center justify-center rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-center transition hover:border-indigo-300 hover:bg-indigo-50"
                    >
                      <p className="text-sm font-semibold text-slate-600">+{extraFacultyCount} more faculty</p>
                    </button>
                  )}
                </div>
              </div>
            )}

            {/* ACTIVE BATCHES LIST */}
            {batches.length > 0 && (
              <div>
                <h2 className="text-xl font-bold text-slate-900 mb-4 px-1">Active Batches</h2>
                <div className="grid gap-3 sm:grid-cols-2">
                  {batches.slice(0, 6).map((batch) => (
                    <button
                      key={batch.batch_id}
                      type="button"
                      onClick={() => openBatchDetails(batch)}
                      className="flex flex-col rounded-xl border border-slate-200 bg-white p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-emerald-300 hover:shadow-md"
                    >
                      <div className="mb-1">
                        <span className="rounded bg-emerald-100 px-2 py-0.5 text-[10px] font-bold text-emerald-700">
                          {batch.enrolled_year} - {batch.passing_year}
                        </span>
                      </div>
                      <p className="font-bold text-slate-800 text-sm mt-1">{batch.course_name}</p>
                      <p className="text-xs text-slate-500 mt-1">Batch ID: {batch.batch_id}</p>
                    </button>
                  ))}
                </div>
              </div>
            )}
            
            {/* CURRENT ASSIGNMENTS FROM USER PROFILE */}
            {profile?.assigned_subjects && profile.assigned_subjects.length > 0 && (
              <div>
                <div className="mb-4 flex items-center justify-between px-1">
                  <h2 className="text-xl font-bold text-slate-900">Your Current Offerings</h2>
                </div>
                <div className="space-y-3">
                  {profile.assigned_subjects.map((sub, idx) => (
                    <div key={idx} className="flex items-center justify-between rounded-lg border border-slate-200 bg-white p-4 shadow-sm hover:border-amber-300 transition">
                      <div>
                        <p className="font-bold text-slate-800">{sub.subject_code} - {sub.subject_name}</p>
                        <p className="text-xs text-slate-500 mt-1">Div: {sub.division || '-'} • Sem: {sub.sem_number || '-'}</p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
        </div>

        {/* SIDEBAR - SUMMARY */}
        <div className="space-y-6">
          <div className="rounded-xl border border-slate-200/50 bg-linear-to-br from-indigo-50 to-white p-5 shadow-sm">
            <h3 className="text-sm font-bold text-slate-900 mb-4 flex items-center gap-2"><span className="text-slate-500"><PinIcon /></span> Quick Snapshot</h3>
            <div className="space-y-3 text-sm">
              <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-100">
                <span className="font-medium text-slate-700">Faculties</span>
                <span className="font-bold text-blue-600">{departmentFaculties.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-100">
                <span className="font-medium text-slate-700">Available Subjects</span>
                <span className="font-bold text-indigo-600">{subjects.length}</span>
              </div>
              <div className="flex items-center justify-between rounded-lg bg-white p-3 border border-slate-100">
                <span className="font-medium text-slate-700">Experience</span>
                <span className="font-bold text-emerald-600">{profile?.years_of_experience || 0} Yrs</span>
              </div>
            </div>
          </div>

          {/* INFO CARD */}
          <div className="rounded-xl border border-slate-200/50 bg-indigo-50 p-4 border-l-4 border-l-indigo-500">
              <p className="mb-2 flex items-center gap-2 text-xs font-semibold text-indigo-900">
                <span className="text-indigo-600"><SecurityIcon /></span>
                Note
              </p>
            <p className="text-xs text-indigo-800">Assign subjects for upcoming sessions here to automatically update faculties' individual dashboards.</p>
          </div>
        </div>
      </div>

      <ModalShell
        open={facultyDirectoryOpen}
        title="All Department Faculty"
        subtitle="Click a faculty card to see full profile, experience, and assigned subjects."
        onClose={() => setFacultyDirectoryOpen(false)}
        wide
      >
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          {departmentFaculties.map((fac) => (
            <button
              key={fac.id}
              type="button"
              onClick={() => {
                setFacultyDirectoryOpen(false);
                openFacultyDetails(fac);
              }}
              className="flex items-center gap-3 rounded-xl border border-slate-200 bg-slate-50 p-4 text-left transition hover:border-blue-300 hover:bg-white"
            >
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-blue-100 text-blue-700 font-bold">
                {fac.name?.charAt(0).toUpperCase()}
              </div>
              <div className="min-w-0">
                <p className="truncate font-bold text-slate-800 text-sm">{fac.name}</p>
                <p className="text-xs text-slate-500">{fac.type}</p>
              </div>
            </button>
          ))}
        </div>
      </ModalShell>

      <ModalShell
        open={Boolean(selectedFaculty)}
        title={selectedFacultyDetails?.faculty?.name || selectedFaculty?.name || "Faculty Details"}
        subtitle={selectedFacultyDetails?.faculty ? `${selectedFacultyDetails.faculty.type} • ${selectedFacultyDetails.faculty.branch_name || selectedFacultyDetails.faculty.branch_code || "Department"}` : "Loading faculty profile from the database."}
        onClose={() => {
          setSelectedFaculty(null);
          setSelectedFacultyDetails(null);
          setFacultyDetailsError("");
        }}
        wide
      >
        {facultyDetailsLoading && (
          <div className="flex items-center justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!facultyDetailsLoading && facultyDetailsError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {facultyDetailsError}
          </div>
        )}

        {!facultyDetailsLoading && selectedFacultyDetails && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoChip label="Email" value={selectedFacultyDetails.faculty.email || "-"} tone="blue" />
              <InfoChip label="Mobile" value={selectedFacultyDetails.faculty.mobile_no || "-"} tone="emerald" />
              <InfoChip label="Branch" value={selectedFacultyDetails.faculty.branch_name || selectedFacultyDetails.faculty.branch_code || "-"} tone="indigo" />
              <InfoChip label="Experience" value={`${selectedFacultyDetails.faculty.years_of_experience || 0} Yrs`} tone="amber" />
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Assigned Subjects</h4>
              {selectedFacultyDetails.assigned_subjects?.length ? (
                <div className="space-y-2">
                  {selectedFacultyDetails.assigned_subjects.map((subject) => (
                    <div key={subject.assignment_id} className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
                      <p className="font-bold text-slate-900">{subject.subject_code} - {subject.subject_name}</p>
                      <p className="mt-1 text-sm text-slate-600">Academic Year: {subject.accadmic_year} • Sem: {subject.sem_number} • Div: {subject.division || "-"}</p>
                      <p className="mt-1 text-xs text-slate-500">Role: {subject.role || "-"} • Lectures: {subject.total_lectures || "-"}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No assigned subjects found for this faculty.</p>
              )}
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Experience</h4>
              {selectedFacultyDetails.experience?.length ? (
                <div className="space-y-2">
                  {selectedFacultyDetails.experience.map((exp) => (
                    <div key={exp.id} className="rounded-xl border border-slate-200 bg-slate-50 p-4">
                      <p className="text-sm font-semibold text-slate-800">{exp.starting_month_year || "-"} to {exp.ending_month_year || "Present"}</p>
                      <p className="mt-1 text-sm text-slate-600">{exp.description || "No description provided."}</p>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No experience records available.</p>
              )}
            </div>
          </div>
        )}
      </ModalShell>

      <ModalShell
        open={Boolean(selectedBatch)}
        title={selectedBatchDetails?.batch ? `${selectedBatchDetails.batch.course_name || selectedBatch?.course_name} Batch` : (selectedBatch?.course_name || "Batch Details")}
        subtitle={selectedBatchDetails?.batch ? `${selectedBatchDetails.batch.enrolled_year} - ${selectedBatchDetails.batch.passing_year} • ${selectedBatchDetails.batch.branch_name || selectedBatchDetails.batch.branch_code || "Department"}` : "Loading batch students from the database."}
        onClose={() => {
          setSelectedBatch(null);
          setSelectedBatchDetails(null);
          setBatchDetailsError("");
        }}
        wide
      >
        {batchDetailsLoading && (
          <div className="flex items-center justify-center py-16">
            <span className="loading loading-spinner loading-lg" />
          </div>
        )}

        {!batchDetailsLoading && batchDetailsError && (
          <div className="rounded-xl border border-rose-200 bg-rose-50 p-4 text-sm text-rose-700">
            {batchDetailsError}
          </div>
        )}

        {!batchDetailsLoading && selectedBatchDetails && (
          <div className="space-y-6">
            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-4">
              <InfoChip label="Batch ID" value={selectedBatchDetails.batch.batch_id} tone="blue" />
              <InfoChip label="Branch" value={selectedBatchDetails.batch.branch_name || selectedBatchDetails.batch.branch_code || "-"} tone="emerald" />
              <InfoChip label="Year Range" value={`${selectedBatchDetails.batch.enrolled_year} - ${selectedBatchDetails.batch.passing_year}`} tone="indigo" />
              <InfoChip label="Students" value={selectedBatchDetails.batch.student_count || selectedBatchDetails.students.length} tone="amber" />
            </div>

            <div>
              <h4 className="mb-3 text-sm font-bold uppercase tracking-wide text-slate-500">Students in Batch</h4>
              {selectedBatchDetails.students?.length ? (
                <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white shadow-sm">
                  <table className="min-w-full divide-y divide-slate-200">
                    <thead className="bg-slate-50">
                      <tr>
                        {['Enrollment No.', 'Name', 'Email', 'Division'].map((header) => (
                          <th key={header} className="px-4 py-3 text-left text-xs font-bold uppercase tracking-wide text-slate-600">
                            {header}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100 bg-white">
                      {selectedBatchDetails.students.map((student) => (
                        <tr key={student.enrollment_no} className="hover:bg-slate-50/70">
                          <td className="whitespace-nowrap px-4 py-3 text-sm font-mono text-slate-700">{student.enrollment_no}</td>
                          <td className="px-4 py-3 text-sm font-medium text-slate-900">{student.name}</td>
                          <td className="px-4 py-3 text-sm text-slate-600 break-all">{student.email || '-'}</td>
                          <td className="whitespace-nowrap px-4 py-3 text-sm text-slate-600">{student.current_division || '-'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="rounded-xl border border-dashed border-slate-300 bg-slate-50 p-4 text-sm text-slate-500">No students are linked to this batch.</p>
              )}
            </div>
          </div>
        )}
      </ModalShell>
    </div>
  );
}