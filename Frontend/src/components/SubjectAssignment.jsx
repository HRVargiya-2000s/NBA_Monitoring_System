import React, { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const SERVER_URL =
  import.meta.env.VITE_SERVER_URL ||
  import.meta.env.VITE_API_BASE_URL ||
  "http://localhost:3000";

const currentAcademicYear = () => {
  const now = new Date();
  const y = now.getMonth() + 1 >= 6 ? now.getFullYear() : now.getFullYear() - 1;
  const yy = String((y + 1) % 100).padStart(2, "0");
  return `${y}-${yy}`;
};

const normalizeSession = (value) => String(value || "").trim().toUpperCase();

const assignmentSchema = z.object({
  batch_id: z.string().optional(),
  accadmic_year: z.string().optional(),
  session: z.enum(["ODD", "EVEN"]),
  offering_id: z.string().min(1, "Offering is required"),
  subject_type: z.enum(["DISCIPLINARY", "MULTIDISCIPLINARY"]).default("DISCIPLINARY"),
  faculty_id: z.string().optional(),
  division: z.string().min(1, "Division is required"),
  role: z.enum(["coordinator", "assistant", "lab assistant"]),
  total_lectures: z.coerce.number().min(1, "Total Lectures must be at least 1"),
});

const SubjectAssignment = () => {
  const [facultyList, setFacultyList] = useState([]);
  const [offerings, setOfferings] = useState([]);
  const [assignments, setAssignments] = useState([]);
  const [requestTargets, setRequestTargets] = useState([]);
  const [facultyRequests, setFacultyRequests] = useState([]);
  const [requestFacultyOptions, setRequestFacultyOptions] = useState({});
  const [requestFacultySelection, setRequestFacultySelection] = useState({});
  const [targetBranchCode, setTargetBranchCode] = useState("");
  const [departments, setDepartments] = useState([]);
  const [selectedMultiDisciplinaryBranches, setSelectedMultiDisciplinaryBranches] = useState([]);
  const [academicYears, setAcademicYears] = useState([]);
  const [loadingYears, setLoadingYears] = useState(false);
  const [loadingRequests, setLoadingRequests] = useState(false);
  const [savingRequestId, setSavingRequestId] = useState(null);
  const [loadingOfferings, setLoadingOfferings] = useState(false);
  const [loadingFaculty, setLoadingFaculty] = useState(false);
  const [loadingAssignments, setLoadingAssignments] = useState(false);
  const [saving, setSaving] = useState(false);

  const {
    register,
    watch,
    setValue,
    reset,
    handleSubmit,
    formState: { errors },
  } = useForm({
    resolver: zodResolver(assignmentSchema),
    defaultValues: {
      accadmic_year: "",
      session: "ODD",
      offering_id: "",
      subject_type: "DISCIPLINARY",
      faculty_id: "",
      division: "",
      role: "coordinator",
      total_lectures: 1,
    },
  });

  const form = watch();
  const subjectType = form.subject_type || "DISCIPLINARY";

  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    const loadDepartments = async () => {
      try {
        const res = await axios.get(`${SERVER_URL}/subject/departments`, { withCredentials: true });
        const depts = Array.isArray(res.data?.departments) ? res.data.departments : [];
        console.log(`[SubjectAssignment] Loaded ${depts.length} departments:`, depts.map(d => `${d.branch_code}:${d.name}`).join(', '));
        setDepartments(depts);
      } catch (err) {
        console.error("[SubjectAssignment] Error loading departments:", err);
        setDepartments([]);
      }
    };
    loadDepartments();
  }, []);

  useEffect(() => {
    const loadAcademicYears = async () => {
      setLoadingYears(true);
      try {
        const res = await axios.get(`${SERVER_URL}/hod-assignment/academic-years-for-hod`, {
          withCredentials: true,
        });
        const years = Array.isArray(res.data?.academic_years) ? res.data.academic_years : [];
        console.log(`[SubjectAssignment] Loaded ${years.length} academic years for HOD:`, years);
        setAcademicYears(years);
        if (years.length > 0) {
          setValue("accadmic_year", years[0]);
        } else {
          setValue("accadmic_year", "2025-26");
        }
      } catch (err) {
        console.error("[SubjectAssignment] Error loading HOD academic years:", err);
        setAcademicYears([]);
        setValue("accadmic_year", "2025-26");
      } finally {
        setLoadingYears(false);
      }
    };
    loadAcademicYears();
  }, [setValue]);

  const toggleMultiDisciplinaryBranch = (branchCode) => {
    setSelectedMultiDisciplinaryBranches((prev) =>
      prev.includes(branchCode) ? prev.filter((code) => code !== branchCode) : [...prev, branchCode]
    );
  };

  const selectedOffering = useMemo(() => {
    const id = Number(form.offering_id);
    return offerings.find((o) => Number(o.offering_id) === id) || null;
  }, [offerings, form.offering_id]);

  const canAssignDirectly = facultyList.length > 0;
  const canRequestFaculty = selectedOffering && !canAssignDirectly && requestTargets.length > 0;
  const incomingRequests = facultyRequests.filter((request) => request.status === "PENDING" && request.direction === "INCOMING");
  const outgoingRequests = facultyRequests.filter((request) => request.direction === "OUTGOING");

  const loadAssignments = async (offeringId) => {
    const id = Number(offeringId);
    if (!id) {
      setAssignments([]);
      return;
    }

    setLoadingAssignments(true);
    try {
      const res = await axios.get(`${SERVER_URL}/subject/offered/${id}/assignments`, {
        withCredentials: true,
      });

      const rows = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data)
          ? res.data
          : [];
      setAssignments(rows);
    } catch (error) {
      setAssignments([]);
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Failed to load assigned faculty list for this offering.",
      });
    } finally {
      setLoadingAssignments(false);
    }
  };

  const loadOfferings = async () => {
    if (!form.accadmic_year || !form.session) {
      setOfferings([]);
      return;
    }

    setLoadingOfferings(true);
    try {
      const res = await axios.get(`${SERVER_URL}/subject/offered`, {
        params: {
          accadmic_year: form.accadmic_year,
          session: normalizeSession(form.session),
        },
        withCredentials: true,
      });

      const raw = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data?.offerings)
          ? res.data.offerings
          : Array.isArray(res.data)
            ? res.data
            : [];
      
      console.log(`[SubjectAssignment.loadOfferings] Year=${form.accadmic_year}, Session=${form.session} - Received ${raw.length} offerings:`, 
        raw.map(o => `ID:${o.offering_id} Subject:${o.subject_code} Coordinator:${o.faculty_coordinator_name} Batch:${o.batch_id || 'NONE'}`).join(', ')
      );
      
      const dedup = [];
      const seen = new Set();

      for (const row of raw) {
        const id = Number(row.offering_id);
        if (!id || seen.has(id)) continue;
        seen.add(id);
        dedup.push(row);
      }

      setOfferings(dedup);

      if (form.offering_id && !dedup.some((x) => Number(x.offering_id) === Number(form.offering_id))) {
        setValue("offering_id", "");
      }
    } catch (error) {
      setOfferings([]);
      console.error(`[SubjectAssignment.loadOfferings] Error:`, error.response?.data || error.message);
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Failed to load offerings for selected year/session.",
      });
    } finally {
      setLoadingOfferings(false);
    }
  };

  const loadFacultyForOffering = async (offeringId) => {
    const id = Number(offeringId);
    setValue("faculty_id", "");

    if (!id) {
      setFacultyList([]);
      setRequestTargets([]);
      setTargetBranchCode("");
      return;
    }

    setLoadingFaculty(true);
    try {
      const res = await axios.get(`${SERVER_URL}/subject/offered/${id}/eligible-faculties`, {
        withCredentials: true,
      });
      const facultyRows = Array.isArray(res.data?.items)
        ? res.data.items
        : Array.isArray(res.data?.faculty)
          ? res.data.faculty
          : Array.isArray(res.data)
            ? res.data
            : [];
      setFacultyList(facultyRows);
      const targets = Array.isArray(res.data?.request_targets) ? res.data.request_targets : [];
      setRequestTargets(targets);
      setTargetBranchCode(targets[0]?.branch_code || "");
    } catch (error) {
      setFacultyList([]);
      setRequestTargets([]);
      setTargetBranchCode("");
      setMessage({
        type: "error",
        text:
          error?.response?.data?.message ||
          "Failed to load eligible faculty list for this offering.",
      });
    } finally {
      setLoadingFaculty(false);
    }
  };

  const loadFacultyRequests = async () => {
    setLoadingRequests(true);
    try {
      const res = await axios.get(`${SERVER_URL}/subject/faculty-requests`, {
        withCredentials: true,
      });
      const rows = Array.isArray(res.data?.items) ? res.data.items : [];
      setFacultyRequests(rows);

      const pendingIncoming = rows.filter((request) => request.status === "PENDING");
      const optionPairs = await Promise.all(
        pendingIncoming.map(async (request) => {
          try {
            const facultyRes = await axios.get(`${SERVER_URL}/subject/offered/${request.offering_id}/eligible-faculties`, {
              withCredentials: true,
            });
            return [request.request_id, Array.isArray(facultyRes.data?.items) ? facultyRes.data.items : []];
          } catch {
            return [request.request_id, []];
          }
        })
      );
      setRequestFacultyOptions(Object.fromEntries(optionPairs));
    } catch {
      setFacultyRequests([]);
      setRequestFacultyOptions({});
    } finally {
      setLoadingRequests(false);
    }
  };

  const approveRequest = async (request) => {
    const facultyId = requestFacultySelection[request.request_id];
    if (!facultyId) {
      setMessage({ type: "error", text: "Select a faculty before approving the request." });
      return;
    }

    setSavingRequestId(request.request_id);
    setMessage({ type: "", text: "" });
    try {
      const res = await axios.post(`${SERVER_URL}/subject/faculty-requests/${request.request_id}/assign`, {
        faculty_id: Number(facultyId),
        role: request.role || "assistant",
        division: request.division,
        total_lectures: request.total_lectures || 1,
      }, {
        withCredentials: true,
      });

      setMessage({ type: "success", text: res.data?.message || "Request approved successfully." });
      await Promise.all([loadFacultyRequests(), loadAssignments(request.offering_id)]);
    } catch (error) {
      setMessage({
        type: "error",
        text: error?.response?.data?.message || "Failed to approve request.",
      });
    } finally {
      setSavingRequestId(null);
    }
  };

  useEffect(() => {
    loadOfferings();
    loadFacultyRequests();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.accadmic_year, form.session]);

  useEffect(() => {
    loadAssignments(form.offering_id);
    loadFacultyForOffering(form.offering_id);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [form.offering_id]);

  const onSubmit = async (data) => {
    setMessage({ type: "", text: "" });
    const isMultiDisciplinary = data.subject_type === "MULTIDISCIPLINARY";

    const basePayload = {
      offering_id: Number(data.offering_id),
      subject_type: data.subject_type,
      division: String(data.division || "").trim(),
      role: String(data.role || "coordinator").trim().toLowerCase(),
      total_lectures: Number(data.total_lectures),
    };

    // Disciplinary subject validation
    if (!isMultiDisciplinary && canAssignDirectly && !data.faculty_id) {
      setMessage({ type: "error", text: "Faculty is required for disciplinary subject assignment." });
      return;
    }

    // Multi-Disciplinary subject validation
    if (isMultiDisciplinary && selectedMultiDisciplinaryBranches.length === 0) {
      setMessage({ type: "error", text: "Select at least one department for multi-disciplinary subject." });
      return;
    }

    setSaving(true);
    try {
      if (isMultiDisciplinary) {
        // Create requests for each selected branch
        const results = await Promise.allSettled(
          selectedMultiDisciplinaryBranches.map((branchCode) =>
            axios.post(
              `${SERVER_URL}/subject/offered/${basePayload.offering_id}/faculty-requests`,
              {
                ...basePayload,
                target_branch_code: branchCode,
              },
              { withCredentials: true }
            )
          )
        );

        const failures = results.filter(r => r.status === "rejected");
        if (failures.length > 0) {
          const errorMsg = failures[0]?.reason?.response?.data?.message || failures[0]?.reason?.message || "Failed to send requests";
          throw new Error(errorMsg);
        }

        setMessage({
          type: "success",
          text: `Multi-disciplinary subject requests sent to ${selectedMultiDisciplinaryBranches.length} department(s) successfully.`,
        });
      } else {
        // Direct assignment for disciplinary subject
        const res = await axios.post(
          `${SERVER_URL}/subject/assignment/create`,
          {
            ...basePayload,
            faculty_id: Number(data.faculty_id),
          },
          { withCredentials: true }
        );

        setMessage({
          type: "success",
          text: res.data?.message || "Subject assigned successfully.",
        });
      }

      reset({
        accadmic_year: data.accadmic_year,
        session: data.session,
        offering_id: data.offering_id,
        subject_type: "DISCIPLINARY",
        faculty_id: "",
        division: "",
        role: "coordinator",
        total_lectures: 1,
      });
      setSelectedMultiDisciplinaryBranches([]);

      await Promise.all([loadAssignments(basePayload.offering_id), loadFacultyRequests()]);
    } catch (error) {
      const errorMsg = error?.response?.data?.message || error?.message || "Operation failed. Please verify details and try again.";
      setMessage({
        type: "error",
        text: errorMsg,
      });
    } finally {
      setSaving(false);
    }
  };

  return (
    // <div className="card w-full bg-white shadow-xl border border-slate-200">
      <div className="card-body">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3 mb-1">
          <div>
            <h2 className="card-title text-3xl font-bold text-slate-800">Assign Subject to Faculty</h2>
            <p className="text-slate-500 mt-1">
              Select an existing offering first, then assign a faculty member for a division.
            </p>
          </div>
          <button
            type="button"
            onClick={loadOfferings}
            className="btn btn-sm bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-200"
            disabled={loadingOfferings}
          >
            {loadingOfferings ? "Refreshing..." : "Refresh Offerings"}
          </button>
        </div>
        <div className="border-b border-slate-100 pb-4 mb-6" />

        {message.text ? (
          <div
            className={`mb-4 rounded border px-3 py-2 text-sm ${
              message.type === "error"
                ? "border-red-200 bg-red-50 text-red-700"
                : "border-green-200 bg-green-50 text-green-700"
            }`}
          >
            {message.text}
          </div>
        ) : null}

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-5 bg-white border border-slate-200 rounded-lg p-4">
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Academic Year</span>
            <select
              {...register("accadmic_year")}
              value={form.accadmic_year}
              onChange={(e) => setValue("accadmic_year", e.target.value)}
              className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
              disabled={loadingYears}
            >
              <option value="">-- Select Academic Year --</option>
              
              {/* Show fetched years if available */}
              {academicYears.length > 0 && academicYears.map((year) => (
                <option key={year} value={year}>
                  {year}
                </option>
              ))}
              
              {/* Always show default years as fallback */}
              <option value="2023-24">2023-24</option>
              <option value="2024-25">2024-25</option>
              <option value="2025-26">2025-26</option>
              <option value="2026-27">2026-27</option>
            </select>
            {errors.accadmic_year ? <p className="mt-1 text-xs text-red-600">{errors.accadmic_year.message}</p> : null}
            {loadingYears && <p className="mt-1 text-xs text-blue-600">Loading academic years...</p>}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Session</span>
            <select
              {...register("session")}
              value={form.session}
              onChange={(e) => setValue("session", normalizeSession(e.target.value))}
              className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
            >
              <option value="ODD">ODD</option>
              <option value="EVEN">EVEN</option>
            </select>
            {errors.session ? <p className="mt-1 text-xs text-red-600">{errors.session.message}</p> : null}
          </label>
        </div>

        <label className="block text-sm">
          <span className="mb-1 block font-medium text-gray-700">Offering</span>
          <select
            {...register("offering_id")}
            value={form.offering_id}
            onChange={(e) => setValue("offering_id", e.target.value)}
            className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
            disabled={loadingOfferings}
          >
            <option value="">{loadingOfferings ? "Loading offerings..." : "Select offering"}</option>
            {offerings.map((o) => (
              <option key={o.offering_id} value={o.offering_id}>
                {`#${o.offering_id} - ${o.subject_name} (${o.subject_code}) | Sem ${o.sem_number}`}
              </option>
            ))}
          </select>
          {!loadingOfferings && offerings.length === 0 ? (
            <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
              No offerings found for this year/session. Create one from the Create Offering tab.
            </p>
          ) : null}
          {errors.offering_id ? <p className="mt-1 text-xs text-red-600">{errors.offering_id.message}</p> : null}
        </label>

        {selectedOffering ? (
          <div className="rounded border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-800">
            {`Selected: ${selectedOffering.subject_name} (${selectedOffering.subject_code}), Sem ${selectedOffering.sem_number}, ${selectedOffering.accadmic_year} ${normalizeSession(selectedOffering.session)}`}
          </div>
        ) : null}

        {selectedOffering ? (
          <div className="space-y-3">
            <label className="block text-sm">
              <span className="mb-2 block font-medium text-gray-700">Subject Type</span>
              <div className="flex gap-4">
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    {...register("subject_type")}
                    value="DISCIPLINARY"
                    checked={subjectType === "DISCIPLINARY"}
                    onChange={(e) => setValue("subject_type", e.target.value)}
                    className="radio radio-sm"
                  />
                  <span className="text-sm text-slate-700">Disciplinary (Own Department)</span>
                </label>
                <label className="flex items-center gap-2">
                  <input
                    type="radio"
                    {...register("subject_type")}
                    value="MULTIDISCIPLINARY"
                    checked={subjectType === "MULTIDISCIPLINARY"}
                    onChange={(e) => setValue("subject_type", e.target.value)}
                    className="radio radio-sm"
                  />
                  <span className="text-sm text-slate-700">Multi-Disciplinary (Multiple Departments)</span>
                </label>
              </div>
            </label>

            {subjectType === "MULTIDISCIPLINARY" && (
              <label className="block text-sm">
                <span className="mb-2 block font-medium text-gray-700">Select Departments</span>
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2 rounded-lg border border-slate-200 bg-slate-50 p-3">
                  {departments.length > 0 ? (
                    departments.map((dept) => (
                      <label key={dept.branch_code} className="flex items-center gap-2 rounded-md bg-white border border-slate-200 px-3 py-2 text-sm text-slate-700 cursor-pointer hover:bg-blue-50">
                        <input
                          type="checkbox"
                          className="checkbox checkbox-sm checkbox-primary"
                          checked={selectedMultiDisciplinaryBranches.includes(dept.branch_code)}
                          onChange={() => toggleMultiDisciplinaryBranch(dept.branch_code)}
                        />
                        <span>{dept.display_name || `${dept.branch_code} - ${dept.name}`}</span>
                      </label>
                    ))
                  ) : (
                    <p className="text-xs text-slate-500 col-span-full">Loading departments...</p>
                  )}
                </div>
                {selectedMultiDisciplinaryBranches.length > 0 ? (
                  <p className="mt-2 text-xs text-green-700 bg-green-50 border border-green-200 rounded px-2 py-1">
                    Requests will be sent to {selectedMultiDisciplinaryBranches.length} department(s).
                  </p>
                ) : null}
              </label>
            )}
          </div>
        ) : null}

        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {subjectType === "DISCIPLINARY" && canRequestFaculty ? (
            <label className="block text-sm">
              <span className="mb-1 block font-medium text-gray-700">Request To Department</span>
              <select
                value={targetBranchCode}
                onChange={(e) => setTargetBranchCode(e.target.value)}
                className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
              >
                {requestTargets.map((target) => (
                  <option key={target.branch_code} value={target.branch_code}>
                    {`${target.branch_name || "Department"} (${target.branch_code})`}
                  </option>
                ))}
              </select>
              <p className="mt-2 text-xs text-blue-700 bg-blue-50 border border-blue-100 rounded px-2 py-1">
                This subject is handled by another department. Send a request; that department HOD will choose the faculty.
              </p>
            </label>
          ) : (
            subjectType === "DISCIPLINARY" && (
              <label className="block text-sm">
                <span className="mb-1 block font-medium text-gray-700">Faculty</span>
                <select
                  {...register("faculty_id")}
                  value={form.faculty_id || ""}
                  onChange={(e) => setValue("faculty_id", e.target.value)}
                  className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
                  disabled={loadingFaculty || !selectedOffering}
                >
                  <option value="">{!selectedOffering ? "Select offering first" : loadingFaculty ? "Loading eligible faculty..." : "Select faculty"}</option>
                  {facultyList.map((f) => (
                    <option key={f.id} value={f.id}>
                      {`${f.name}${f.type ? ` (${f.type})` : ""}${f.branch_code ? ` - ${f.branch_code}` : ""}`}
                    </option>
                  ))}
                </select>
                {selectedOffering && !loadingFaculty && facultyList.length === 0 && requestTargets.length === 0 ? (
                  <p className="mt-2 text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded px-2 py-1">
                    No eligible faculty or request department found for this offering.
                  </p>
                ) : null}
                {errors.faculty_id ? <p className="mt-1 text-xs text-red-600">{errors.faculty_id.message}</p> : null}
              </label>
            )
          )}

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Division</span>
            <input
              {...register("division")}
              value={form.division}
              onChange={(e) => setValue("division", e.target.value)}
              placeholder="A"
              className="input input-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
            />
            {errors.division ? <p className="mt-1 text-xs text-red-600">{errors.division.message}</p> : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Role</span>
            <select
              {...register("role")}
              value={form.role}
              onChange={(e) => setValue("role", e.target.value)}
              className="select select-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
            >
              <option value="coordinator">Coordinator</option>
              <option value="assistant">Assistant</option>
              <option value="lab assistant">Lab Assistant</option>
            </select>
            {errors.role ? <p className="mt-1 text-xs text-red-600">{errors.role.message}</p> : null}
          </label>

          <label className="block text-sm">
            <span className="mb-1 block font-medium text-gray-700">Total Lectures</span>
            <input
              type="number"
              {...register("total_lectures")}
              value={form.total_lectures}
              onChange={(e) => setValue("total_lectures", Number(e.target.value))}
              min={1}
              className="input input-bordered w-full border-2 border-slate-300 bg-white text-slate-800 focus:border-blue-500"
            />
            {errors.total_lectures ? <p className="mt-1 text-xs text-red-600">{errors.total_lectures.message}</p> : null}
          </label>
        </div>

        <div className="flex justify-end">
          <button
            type="submit"
            className="btn border-none bg-blue-600 hover:bg-blue-700 text-white px-6 disabled:opacity-60"
            disabled={saving || offerings.length === 0 || (!canAssignDirectly && !canRequestFaculty)}
          >
            {saving ? (canAssignDirectly ? "Assigning..." : "Sending...") : (canAssignDirectly ? "Assign" : "Send Request")}
          </button>
        </div>
        </form>

        <div className="mt-6 grid grid-cols-1 xl:grid-cols-2 gap-4">
          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Incoming Faculty Requests</h3>
              <span className="text-xs text-slate-500">{loadingRequests ? "Loading..." : `${incomingRequests.length} pending`}</span>
            </div>
            {incomingRequests.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-600">No pending requests for your department.</div>
            ) : (
              <div className="divide-y divide-slate-200">
                {incomingRequests.map((request) => {
                  const options = requestFacultyOptions[request.request_id] || [];
                  return (
                    <div key={request.request_id} className="p-4 space-y-3">
                      <div>
                        <p className="text-sm font-semibold text-slate-800">{request.subject_name} ({request.subject_code})</p>
                        <p className="text-xs text-slate-500">Requested by {request.requesting_hod_name || "HOD"} | Sem {request.sem_number} | Division {request.division || "-"}</p>
                      </div>
                      <div className="flex flex-col sm:flex-row gap-2">
                        <select
                          className="select select-bordered flex-1 border-2 border-slate-300 bg-white text-slate-800"
                          value={requestFacultySelection[request.request_id] || ""}
                          onChange={(e) => setRequestFacultySelection((prev) => ({ ...prev, [request.request_id]: e.target.value }))}
                        >
                          <option value="">Select faculty</option>
                          {options.map((faculty) => (
                            <option key={faculty.id} value={faculty.id}>{`${faculty.name}${faculty.type ? ` (${faculty.type})` : ""}`}</option>
                          ))}
                        </select>
                        <button
                          type="button"
                          className="btn bg-emerald-600 hover:bg-emerald-700 text-white border-none disabled:opacity-60"
                          disabled={savingRequestId === request.request_id || options.length === 0}
                          onClick={() => approveRequest(request)}
                        >
                          {savingRequestId === request.request_id ? "Allocating..." : "Allocate"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          <div className="border border-slate-200 rounded-lg overflow-hidden">
            <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
              <h3 className="text-sm font-semibold text-slate-800">Sent Requests</h3>
              <span className="text-xs text-slate-500">{outgoingRequests.length}</span>
            </div>
            {outgoingRequests.length === 0 ? (
              <div className="px-4 py-4 text-sm text-slate-600">No requests sent yet.</div>
            ) : (
              <div className="overflow-x-auto">
                <table className="min-w-full text-sm">
                  <thead className="bg-slate-100 text-slate-700">
                    <tr>
                      <th className="px-4 py-2 text-left">Subject</th>
                      <th className="px-4 py-2 text-left">Department</th>
                      <th className="px-4 py-2 text-left">Division</th>
                      <th className="px-4 py-2 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {outgoingRequests.map((request) => (
                      <tr key={request.request_id} className="border-t border-slate-200">
                        <td className="px-4 py-2 text-slate-800">{request.subject_name} ({request.subject_code})</td>
                        <td className="px-4 py-2 text-slate-700">{request.target_branch_name || request.target_branch_code}</td>
                        <td className="px-4 py-2 text-slate-700">{request.division || "-"}</td>
                        <td className="px-4 py-2 text-slate-700">{request.status}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
        </div>

        <div className="mt-6 border border-slate-200 rounded-lg overflow-hidden">
          <div className="px-4 py-3 bg-slate-50 border-b border-slate-200 flex items-center justify-between">
            <h3 className="text-sm font-semibold text-slate-800">Assigned Faculty For Selected Offering</h3>
            {selectedOffering ? (
              <span className="text-xs text-slate-600">
                {`${selectedOffering.subject_code} | Sem ${selectedOffering.sem_number} | ${selectedOffering.accadmic_year} ${normalizeSession(selectedOffering.session)}`}
              </span>
            ) : null}
          </div>

          {!selectedOffering ? (
            <div className="px-4 py-4 text-sm text-slate-600">Select an offering to view assigned faculty.</div>
          ) : loadingAssignments ? (
            <div className="px-4 py-4 text-sm text-slate-600">Loading assigned faculty...</div>
          ) : assignments.length === 0 ? (
            <div className="px-4 py-4 text-sm text-slate-600">No faculty assigned yet for this offering.</div>
          ) : (
            <div className="overflow-x-auto">
              <table className="min-w-full text-sm">
                <thead className="bg-slate-100 text-slate-700">
                  <tr>
                    <th className="px-4 py-2 text-left">Faculty</th>
                    <th className="px-4 py-2 text-left">Role</th>
                    <th className="px-4 py-2 text-left">Division</th>
                    <th className="px-4 py-2 text-left">Total Lectures</th>
                  </tr>
                </thead>
                <tbody>
                  {assignments.map((row) => (
                    <tr key={row.assignment_id} className="border-t border-slate-200">
                      <td className="px-4 py-2 text-slate-800">
                        {row.faculty_name}
                        {row.faculty_email ? (
                          <span className="ml-1 text-xs text-slate-500">({row.faculty_email})</span>
                        ) : null}
                      </td>
                      <td className="px-4 py-2 text-slate-700">{row.role || "-"}</td>
                      <td className="px-4 py-2 text-slate-700">{row.division || "-"}</td>
                      <td className="px-4 py-2 text-slate-700">{row.total_lectures ?? "-"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    // </div>
  );
};

export default SubjectAssignment;
