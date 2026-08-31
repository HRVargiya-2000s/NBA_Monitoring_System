import { useEffect, useMemo, useState } from "react";
import axios from "axios";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const getCurrentAcademicYearLabel = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;
  const startYear = month >= 6 ? year : year - 1;
  const endYearShort = String((startYear + 1) % 100).padStart(2, "0");
  return `${startYear}-${endYearShort}`;
};

const normalizeAcademicYear = (value) => String(value || "").trim();

const formatSubjectLabel = (subject) => {
  const code = subject.subject_code || "-";
  const name = subject.subject_name || "Unnamed";
  const sem = subject.sem_number != null ? `Sem ${subject.sem_number}` : "Sem ?";
  const division = subject.division || "Div ?";
  const session = subject.session || "Session ?";
  const year = subject.accadmic_year || subject.academic_year || "Year ?";
  return `${code} - ${name} (${sem}, ${division}, ${session}, ${year})`;
};

const componentLabel = {
  mid_sem: "Mid Sem",
  internal: "Internal",
  external: "External",
  viva: "Viva"
};

const toFixed2 = (value) => {
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "-";
};

const toFixed2OrBlank = (value) => {
  if (value === null || value === undefined) {
    return "";
  }
  const n = Number(value);
  return Number.isFinite(n) ? n.toFixed(2) : "";
};

const parseContentDispositionFilename = (headerValue, fallback) => {
  if (!headerValue) return fallback;
  const filenameMatch = headerValue.match(/filename\*?=(?:UTF-8''|"?)([^";]+)/i);
  if (!filenameMatch) return fallback;
  try {
    return decodeURIComponent(filenameMatch[1]).replace(/"/g, "");
  } catch {
    return filenameMatch[1].replace(/"/g, "");
  }
};

const coPoViewSchema = z.object({
  offering_id: z.string().min(1, "Please select an offering")
});

const fixedOutcomes = [
  ...Array.from({ length: 11 }, (_, index) => ({ type: "PO", code: index + 1 })),
  ...Array.from({ length: 4 }, (_, index) => ({ type: "PSO", code: index + 1 }))
].map((item) => ({
  ...item,
  key: `${item.type}|${item.code}`
}));

const formatOutcomeLabel = (type, code) => `${String(type || "").toUpperCase()}${Number(code)}`;

export default function CoPoView() {
  const [offerings, setOfferings] = useState([]);
  const {
    register,
    watch,
    setValue,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(coPoViewSchema),
    defaultValues: {
      offering_id: ""
    }
  });

  const offeringId = watch("offering_id");

  const [componentRows, setComponentRows] = useState([]);
  const [overallRows, setOverallRows] = useState([]);
  const [coPoRows, setCoPoRows] = useState([]);
  const [strengthMappings, setStrengthMappings] = useState([]);

  const [loadingOfferings, setLoadingOfferings] = useState(true);
  const [loadingReports, setLoadingReports] = useState(false);
  const [busyGenerate, setBusyGenerate] = useState(false);
  const [busyDownload, setBusyDownload] = useState(false);

  const [message, setMessage] = useState({ type: "", text: "" });

  useEffect(() => {
    if (!message.text) return;
    const timer = setTimeout(() => setMessage({ type: "", text: "" }), 3500);
    return () => clearTimeout(timer);
  }, [message.text]);

  const selectedOffering = useMemo(
    () => offerings.find((row) => String(row.offering_id) === String(offeringId)) || null,
    [offerings, offeringId]
  );

  const summaryRows = useMemo(() => {
    const map = new Map();

    for (const row of overallRows) {
      const coNo = Number(row.co_number);
      if (!coNo || Number.isNaN(coNo)) continue;
      map.set(coNo, {
        co_number: coNo,
        overall_internal: row.overall_internal,
        overall_external: row.overall_external,
        overall_total: row.overall_total,
        co_description: row.co_description || ""
      });
    }

    return [...map.values()].sort((a, b) => a.co_number - b.co_number);
  }, [overallRows]);

  const componentWiseTableRows = useMemo(() => {
    const map = new Map();

    for (const row of componentRows) {
      const coNo = Number(row.co_number);
      if (!coNo || Number.isNaN(coNo)) continue;

      if (!map.has(coNo)) {
        map.set(coNo, {
          co_number: coNo,
          co_description: row.co_description || "",
          mid_sem: "",
          internal: "",
          external: "",
          viva: ""
        });
      }

      const target = map.get(coNo);
      const key = String(row.component || "").toLowerCase();
      if (Object.prototype.hasOwnProperty.call(target, key)) {
        target[key] = row.attainment_level;
      }
    }

    for (const row of summaryRows) {
      if (!map.has(row.co_number)) {
        map.set(row.co_number, {
          co_number: row.co_number,
          co_description: row.co_description || "",
          mid_sem: "",
          internal: "",
          external: "",
          viva: ""
        });
      }
    }

    return [...map.values()]
      .sort((a, b) => a.co_number - b.co_number)
      .map((row) => {
        const summary = summaryRows.find((item) => item.co_number === row.co_number);
        return {
          ...row,
          overall_internal: summary?.overall_internal,
          overall_external: summary?.overall_external,
          overall_total: summary?.overall_total
        };
      });
  }, [componentRows, summaryRows]);

  const coPoMatrix = useMemo(() => {
    const coSet = new Set(summaryRows.map((row) => Number(row.co_number)).filter((v) => Number.isFinite(v)));
    const valueMap = new Map();

    for (const row of coPoRows) {
      const coNo = Number(row.co_number);
      const outcomeType = String(row.outcome_type || "").toUpperCase();
      const outcomeCode = Number(row.outcome_code);
      if (!coNo || Number.isNaN(coNo) || !outcomeType || Number.isNaN(outcomeCode)) continue;

      coSet.add(coNo);
      valueMap.set(`${coNo}|${outcomeType}|${outcomeCode}`, Number(row.attainment_level) || 0);
    }

    const strengthMap = new Map();
    for (const row of strengthMappings) {
      const coNo = Number(row.co_number);
      const outcomeType = String(row.outcome_type || "").toUpperCase();
      const outcomeCode = Number(row.outcome_code);
      if (!coNo || Number.isNaN(coNo) || !outcomeType || Number.isNaN(outcomeCode)) continue;
      strengthMap.set(`${coNo}|${outcomeType}|${outcomeCode}`, Number(row.strength) || 0);
    }

    const coNumbers = [...coSet].sort((a, b) => a - b);
    const outcomes = fixedOutcomes;

    const rows = coNumbers.map((coNo) => {
      const values = {};
      for (const outcome of outcomes) {
        const key = `${coNo}|${outcome.type}|${outcome.code}`;
        values[outcome.key] = valueMap.has(key) ? valueMap.get(key) : null;
      }
      return { co_number: coNo, values };
    });

    const average = {};
    for (const outcome of outcomes) {
      const mappedRows = rows.filter((r) => {
        const key = `${r.co_number}|${outcome.type}|${outcome.code}`;
        const strength = strengthMap.get(key) || 0;
        return strength > 0;
      });

      let sum = 0;
      let count = 0;
      for (const r of mappedRows) {
        const val = r.values[outcome.key];
        if (val !== null && val !== undefined) {
          sum += Number(val);
          count += 1;
        }
      }
      average[outcome.key] = count ? sum / count : 0;
    }

    return { outcomes, rows, average };
  }, [coPoRows, summaryRows, strengthMappings]);

  const justificationRows = useMemo(() => {
    return strengthMappings
      .map((row) => ({
        co_number: Number(row.co_number),
        outcome_type: String(row.outcome_type || "").toUpperCase(),
        outcome_code: Number(row.outcome_code),
        strength: Number(row.strength),
        justification: String(row.justification || "")
      }))
      .filter((row) => Number.isFinite(row.co_number) && row.outcome_type && Number.isFinite(row.outcome_code))
      .sort((a, b) =>
        a.co_number - b.co_number ||
        a.outcome_type.localeCompare(b.outcome_type) ||
        a.outcome_code - b.outcome_code
      );
  }, [strengthMappings]);

  const loadReports = async (selectedOfferingId) => {
    if (!selectedOfferingId) return;

    try {
      setLoadingReports(true);
      setMessage({ type: "", text: "" });

      const [coResult, coPoResult, strengthResult] = await Promise.allSettled([
        axios.get(`${SERVER_URL}/attainment/co/${selectedOfferingId}`, { withCredentials: true }),
        axios.get(`${SERVER_URL}/attainment/co-po-pso/attainment/${selectedOfferingId}`, { withCredentials: true }),
        axios.get(`${SERVER_URL}/attainment/co-po-pso/strength/${selectedOfferingId}`, { withCredentials: true })
      ]);

      const coOk = coResult.status === "fulfilled";
      const coPoOk = coPoResult.status === "fulfilled";

      setComponentRows(coOk && Array.isArray(coResult.value.data?.component_wise) ? coResult.value.data.component_wise : []);
      setOverallRows(coOk && Array.isArray(coResult.value.data?.overall) ? coResult.value.data.overall : []);
      setCoPoRows(coPoOk && Array.isArray(coPoResult.value.data?.attainment_levels) ? coPoResult.value.data.attainment_levels : []);
      setStrengthMappings(
        strengthResult.status === "fulfilled" && Array.isArray(strengthResult.value.data?.strength_mappings)
          ? strengthResult.value.data.strength_mappings
          : []
      );

      if (coOk && coPoOk) {
        setMessage({ type: "success", text: "Attainment reports loaded." });
      } else {
        setMessage({
          type: "info",
          text: "Some report sections are not available yet. Generate reports to populate all sections."
        });
      }
    } catch (err) {
      setComponentRows([]);
      setOverallRows([]);
      setCoPoRows([]);
      setStrengthMappings([]);

      if (err?.response?.status === 404) {
        setMessage({
          type: "info",
          text: "No stored report for this offering. Click Generate Reports to create it."
        });
      } else {
        setMessage({ type: "error", text: err?.response?.data?.message || "Failed to fetch report data." });
      }
    } finally {
      setLoadingReports(false);
    }
  };

  useEffect(() => {
    const loadOfferings = async () => {
      try {
        setLoadingOfferings(true);
        const profileRes = await axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true });
        const assigned = Array.isArray(profileRes.data?.assigned_subjects) ? profileRes.data.assigned_subjects : [];

        const dedupMap = new Map();
        for (const row of assigned) {
          const id = String(row.offering_id || "");
          if (!id) continue;
          if (!dedupMap.has(id)) dedupMap.set(id, row);
        }

        const deduped = [...dedupMap.values()];
        setOfferings(deduped);

        if (!deduped.length) {
          setMessage({ type: "info", text: "No assigned offerings found for your account." });
          return;
        }

        const currentYear = getCurrentAcademicYearLabel();
        const defaultOffering =
          deduped.find((row) => normalizeAcademicYear(row.accadmic_year || row.academic_year) === currentYear) ||
          deduped[0];

        setValue("offering_id", String(defaultOffering.offering_id), { shouldValidate: true });
      } catch (err) {
        setMessage({ type: "error", text: err?.response?.data?.error || "Failed to load assigned offerings." });
      } finally {
        setLoadingOfferings(false);
      }
    };

    loadOfferings();
  }, []);

  useEffect(() => {
    if (!offeringId) return;
    loadReports(offeringId);
  }, [offeringId]);

  const handleGenerateReports = async () => {
    if (!offeringId) {
      setMessage({ type: "error", text: "Select an offering first." });
      return;
    }

    try {
      setBusyGenerate(true);
      setMessage({ type: "", text: "" });

      await axios.post(`${SERVER_URL}/attainment/co/generate`, { offering_id: Number(offeringId) }, { withCredentials: true });
      await axios.post(
        `${SERVER_URL}/attainment/co-po-pso/generate`,
        { offering_id: Number(offeringId) },
        { withCredentials: true }
      );

      await loadReports(offeringId);
      setMessage({ type: "success", text: "Reports generated and loaded successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err?.response?.data?.message || "Failed to generate reports." });
    } finally {
      setBusyGenerate(false);
    }
  };

  const handleDownload = async () => {
    if (!offeringId) {
      setMessage({ type: "error", text: "Select an offering first." });
      return;
    }

    try {
      setBusyDownload(true);
      const res = await axios.get(`${SERVER_URL}/attainment/nba-report/${offeringId}/download`, {
        withCredentials: true,
        responseType: "blob"
      });

      const fallbackName = `nba_report_offering_${offeringId}.xlsx`;
      const filename = parseContentDispositionFilename(res.headers?.["content-disposition"], fallbackName);

      const url = URL.createObjectURL(new Blob([res.data]));
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      URL.revokeObjectURL(url);

      setMessage({ type: "success", text: "Report downloaded successfully." });
    } catch (err) {
      setMessage({ type: "error", text: err?.response?.data?.message || "Failed to download report." });
    } finally {
      setBusyDownload(false);
    }
  };

  const hasAnyData = componentRows.length > 0 || overallRows.length > 0 || coPoRows.length > 0;
  const isCoPoAllZero =
    coPoMatrix.rows.length > 0 &&
    coPoMatrix.rows.some((row) => coPoMatrix.outcomes.some((outcome) => row.values[outcome.key] !== null && row.values[outcome.key] !== undefined)) &&
    coPoMatrix.rows.every((row) =>
      coPoMatrix.outcomes.every((outcome) => {
        const value = row.values[outcome.key];
        return value === null || value === undefined || Number(value) === 0;
      })
    );
  const coPoEmptyReason =
    strengthMappings.length === 0
      ? "No CO-PO/PSO strength mappings found. Go to Subjects page, fill CO-PO matrix and save it first."
      : "No CO-PO/PSO attainment rows found. Ensure global PO and branch PSO outcomes are configured, then generate again.";
  const inputStyles =
    "select w-full bg-white text-gray-900 border-gray-300 focus:bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 shadow-sm";
  const cardStyles = "rounded-lg border border-slate-200 bg-white p-6 shadow-sm";
  const tableHeaderStyles = "bg-slate-50 text-slate-700 border-b border-slate-200";
  const primaryButtonStyles =
    "inline-flex items-center justify-center rounded-md bg-blue-600 px-4 py-2 text-sm font-semibold text-white shadow-sm transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:bg-blue-300";
  const secondaryButtonStyles =
    "inline-flex items-center justify-center rounded-md border border-slate-300 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm transition hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60";

  return (
    <div className="w-full space-y-6 text-slate-800">
      <div className="mb-2">
        <h2 className="text-3xl font-bold text-slate-800 mb-1">CO-PO View</h2>
        <p className="text-slate-500 border-b border-slate-200 pb-4">
          Select an assigned offering to view CO attainment and CO-PO/PSO attainment reports.
        </p>
      </div>

      {message.text ? (
        <div
          className={`alert shadow-sm ${
            message.type === "error"
              ? "bg-red-100 text-red-800 border-red-200"
              : message.type === "success"
              ? "bg-emerald-100 text-emerald-800 border-emerald-200"
              : "bg-blue-100 text-blue-800 border-blue-200"
          }`}
        >
          {message.text}
        </div>
      ) : null}

      <div className={`${cardStyles} shadow-md`}>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-slate-700">Offering</span>
            </label>
            <select
              {...register("offering_id")}
              value={offeringId}
              onChange={(e) => setValue("offering_id", e.target.value, { shouldValidate: true })}
              className={inputStyles}
              disabled={loadingOfferings || offerings.length === 0}
            >
              {offerings.length === 0 ? <option value="">No offerings found</option> : null}
              {offerings.map((row) => (
                <option key={row.offering_id} value={row.offering_id}>
                  {formatSubjectLabel(row)}
                </option>
              ))}
            </select>
            {errors.offering_id ? <p className="mt-1 text-xs text-red-600">{errors.offering_id.message}</p> : null}
          </div>

          <div className="form-control">
            <label className="label py-1">
              <span className="label-text font-bold text-slate-700">Actions</span>
            </label>
            <div className="flex flex-col gap-2 sm:flex-row">
              <button
                type="button"
                className={secondaryButtonStyles}
                onClick={handleGenerateReports}
                disabled={!offeringId || busyGenerate || loadingReports || loadingOfferings}
              >
                {busyGenerate ? "Generating..." : "Generate Reports"}
              </button>

              <button
                type="button"
                className={primaryButtonStyles}
                onClick={handleDownload}
                disabled={!offeringId || busyDownload || loadingOfferings}
              >
                {busyDownload ? "Downloading..." : "Download Excel Report"}
              </button>
            </div>
          </div>
        </div>

        {loadingOfferings ? <div className="mt-3 text-sm text-slate-500 font-medium">Loading assigned offerings...</div> : null}
        {loadingReports ? <div className="mt-2 text-sm text-slate-500 font-medium">Loading report data...</div> : null}
      </div>

      {selectedOffering ? (
        <div className={cardStyles}>
          <h3 className="font-bold text-lg text-slate-800 border-b border-slate-100 pb-2">Selected Offering Details</h3>
          <div className="mt-4 text-sm text-slate-600 grid grid-cols-1 md:grid-cols-3 gap-y-3 gap-x-6">
            <p><span className="font-semibold text-slate-800">Subject:</span> {selectedOffering.subject_name || "-"}</p>
            <p><span className="font-semibold text-slate-800">Code:</span> {selectedOffering.subject_code || "-"}</p>
            <p><span className="font-semibold text-slate-800">Offering ID:</span> {selectedOffering.offering_id || "-"}</p>
            <p><span className="font-semibold text-slate-800">Academic Year:</span> {selectedOffering.academic_year || selectedOffering.accadmic_year || "-"}</p>
            <p><span className="font-semibold text-slate-800">Session:</span> {selectedOffering.session || "-"}</p>
            <p><span className="font-semibold text-slate-800">Semester:</span> {selectedOffering.sem_number ?? "-"}</p>
          </div>
        </div>
      ) : null}

      {hasAnyData ? (
        <>
          <div className={cardStyles}>
            <h3 className="text-lg font-semibold text-slate-900">CO Attainment Report</h3>
            <p className="mt-1 text-sm text-slate-600">Component-wise and overall CO attainment levels.</p>

            <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
              <table className="table table-sm w-full">
                <thead className={tableHeaderStyles}>
                  <tr>
                    <th className="border border-slate-200">CO</th>
                    <th className="border border-slate-200">Mid Sem</th>
                    <th className="border border-slate-200">Internal</th>
                    <th className="border border-slate-200">Overall Internal</th>
                    <th className="border border-slate-200">External</th>
                    <th className="border border-slate-200">Viva</th>
                    <th className="border border-slate-200">Overall External</th>
                    <th className="border border-slate-200">Overall Total</th>
                  </tr>
                </thead>
                <tbody>
                  {componentWiseTableRows.map((row) => (
                    <tr key={`co-row-${row.co_number}`}>
                      <td className="border border-slate-200">CO{row.co_number}</td>
                      <td className="border border-slate-200">{toFixed2OrBlank(row.mid_sem)}</td>
                      <td className="border border-slate-200">{toFixed2OrBlank(row.internal)}</td>
                      <td className="border border-slate-200 font-medium">{toFixed2OrBlank(row.overall_internal)}</td>
                      <td className="border border-slate-200">{toFixed2OrBlank(row.external)}</td>
                      <td className="border border-slate-200">{toFixed2OrBlank(row.viva)}</td>
                      <td className="border border-slate-200 font-medium">{toFixed2OrBlank(row.overall_external)}</td>
                      <td className="border border-slate-200 font-semibold">{toFixed2OrBlank(row.overall_total)}</td>
                    </tr>
                  ))}

                  {componentWiseTableRows.length === 0 ? (
                    <tr>
                      <td colSpan={8} className="border border-slate-200 p-3 text-sm text-slate-500">
                        No CO attainment rows available.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {componentRows.length > 0 ? (
              <div className="mt-3 text-xs text-slate-500">
                Components: {Object.keys(componentLabel)
                  .filter((key) => componentRows.some((row) => String(row.component).toLowerCase() === key))
                  .map((key) => componentLabel[key])
                  .join(", ") || "-"}
              </div>
            ) : null}
          </div>

          <div className={cardStyles}>
            <h3 className="text-lg font-semibold text-slate-900">CO-PO / PSO Attainment Report</h3>
            <p className="mt-1 text-sm text-slate-600">Computed CO contributions to PO and PSO outcomes.</p>

            <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
              <table className="table table-sm w-full">
                <thead className={tableHeaderStyles}>
                  <tr>
                    <th className="border border-slate-200">CO</th>
                    {coPoMatrix.outcomes.map((outcome) => (
                      <th key={outcome.key} className="border border-slate-200">
                        {outcome.type}
                        {outcome.code}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {coPoMatrix.rows.map((row) => (
                    <tr key={`matrix-row-${row.co_number}`}>
                      <td className="border border-slate-200">CO{row.co_number}</td>
                      {coPoMatrix.outcomes.map((outcome) => {
                        const value = row.values[outcome.key];
                        return <td key={`matrix-cell-${row.co_number}-${outcome.key}`} className="border border-slate-200">{toFixed2OrBlank(value)}</td>;
                      })}
                    </tr>
                  ))}

                  {coPoMatrix.rows.length > 0 ? (
                    <tr className="bg-slate-50 font-medium">
                      <td className="border border-slate-200" colSpan={1}>
                        Average
                      </td>
                      {coPoMatrix.outcomes.map((outcome) => {
                        const value = coPoMatrix.average[outcome.key] || 0;
                        return <td key={`matrix-avg-${outcome.key}`} className="border border-slate-200">{toFixed2(value)}</td>;
                      })}
                    </tr>
                  ) : null}

                  {coPoMatrix.rows.length === 0 ? (
                    <tr>
                      <td colSpan={Math.max(1 + coPoMatrix.outcomes.length, 2)} className="border border-slate-200 p-3 text-sm text-slate-500">
                        {coPoEmptyReason}
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>

            {coPoMatrix.rows.length === 0 ? (
              <div className="mt-3 text-xs text-slate-500">
                Saved strength mappings: {strengthMappings.length}
              </div>
            ) : null}

            {isCoPoAllZero ? (
              <div className="mt-3 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-800">
                CO-PO/PSO values are all 0.00. This usually means mapped strengths are 0, or global PO / branch PSO outcomes are not configured in backend.
              </div>
            ) : null}
          </div>

          <div className={cardStyles}>
            <h3 className="text-lg font-semibold text-slate-900">CO-PO/PSO Justifications</h3>
            <p className="mt-1 text-sm text-slate-600">Strength justification statements saved for this offering.</p>

            <div className="mt-4 overflow-auto rounded-lg border border-slate-200">
              <table className="table table-sm w-full">
                <thead className={tableHeaderStyles}>
                  <tr>
                    <th className="border border-slate-200">CO</th>
                    <th className="border border-slate-200">PO/PSO</th>
                    <th className="border border-slate-200">Strength</th>
                    <th className="border border-slate-200">Justification</th>
                  </tr>
                </thead>
                <tbody>
                  {justificationRows.map((row, index) => (
                    <tr key={`just-row-${row.co_number}-${row.outcome_type}-${row.outcome_code}-${index}`}>
                      <td className="border border-slate-200">CO{row.co_number}</td>
                      <td className="border border-slate-200">{formatOutcomeLabel(row.outcome_type, row.outcome_code)}</td>
                      <td className="border border-slate-200">{Number.isFinite(row.strength) ? row.strength : ""}</td>
                      <td className="border border-slate-200">{row.justification || ""}</td>
                    </tr>
                  ))}

                  {justificationRows.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="border border-slate-200 p-3 text-sm text-slate-500">
                        No justifications found for this offering.
                      </td>
                    </tr>
                  ) : null}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : (
        <div className={cardStyles}>
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <p className="text-sm text-slate-600">No report data loaded yet. Select an offering and generate reports.</p>
            <button
              type="button"
              className={primaryButtonStyles}
              onClick={handleGenerateReports}
              disabled={!offeringId || busyGenerate || loadingReports || loadingOfferings}
            >
              {busyGenerate ? "Generating..." : "Generate Now"}
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

