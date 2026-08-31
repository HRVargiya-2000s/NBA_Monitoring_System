import { useEffect, useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || "http://localhost:3000";

const SectionCard = ({ label, icon, children }) => (
  <div className="card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
    <div className="px-4 py-3 border-b border-base-200 bg-base-200/50 flex items-center gap-2">
      {icon ? (
        <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
          {icon}
        </span>
      ) : null}
      <span className="text-xs font-bold text-base-content/70 uppercase tracking-wide">{label}</span>
    </div>
    <div className="p-4">{children}</div>
  </div>
);

const ContactCard = ({ label, value }) => (
  <div className="rounded-xl border border-base-300 bg-base-100 p-3 text-left">
    <p className="text-xs font-semibold text-base-content/60 uppercase flex items-center gap-1.5">
      <span className="h-2 w-2 rounded-full bg-primary/60" />
      {label}
    </p>
    <p className="text-sm text-base-content font-medium break-all mt-1">{value || "-"}</p>
  </div>
);

const InfoRow = ({ label, value }) => (
  value !== undefined && value !== null && value !== "" ? (
    <div className="flex justify-between items-start py-3 border-b border-base-200 last:border-0 gap-4">
      <span className="text-xs font-semibold text-base-content/60 uppercase shrink-0">{label}</span>
      <span className="text-sm text-base-content text-right">{value}</span>
    </div>
  ) : null
);

const changePasswordSchema = z
  .object({
    oldPassword: z.string().trim().min(1, "Old password is required."),
    newPassword: z.string().trim().min(6, "New password must be at least 6 characters."),
    confirmPassword: z.string().trim().min(1, "Confirm password is required.")
  })
  .refine((data) => data.newPassword !== data.oldPassword, {
    message: "New password must be different from old password.",
    path: ["newPassword"]
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "New password and confirm password do not match.",
    path: ["confirmPassword"]
  });

const inputCls = "input input-bordered w-full text-sm";

const FormField = ({ label, children }) => (
  <div className="flex flex-col gap-1.5">
    <label className="text-xs font-semibold text-base-content/70">{label}</label>
    {children}
  </div>
);

export default function StudentProfile() {
  const navigate = useNavigate();
  const [profile, setProfile] = useState(null);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(true);
  const [passwordLoading, setPasswordLoading] = useState(false);
  const [passwordError, setPasswordError] = useState("");
  const [passwordSuccess, setPasswordSuccess] = useState("");

  const {
    register,
    handleSubmit,
    reset,
    formState: { errors }
  } = useForm({
    resolver: zodResolver(changePasswordSchema),
    defaultValues: {
      oldPassword: "",
      newPassword: "",
      confirmPassword: ""
    }
  });

  useEffect(() => {
    const loadProfile = async () => {
      try {
        setLoading(true);
        setError("");
        const res = await axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true });
        setProfile(res.data || null);
      } catch (err) {
        setError(err?.response?.data?.error || "Could not load profile.");
      } finally {
        setLoading(false);
      }
    };

    loadProfile();
  }, []);

  const handleChangePassword = async (data) => {
    setPasswordError("");
    setPasswordSuccess("");

    try {
      setPasswordLoading(true);
      const res = await axios.post(
        `${SERVER_URL}/user/change-password`,
        { oldPassword: data.oldPassword, newPassword: data.newPassword },
        { withCredentials: true }
      );

      setPasswordSuccess(res.data?.message || "Password updated. Please login again.");
      reset();
      setTimeout(() => {
        navigate("/login", { replace: true });
      }, 1000);
    } catch (err) {
      setPasswordError(err?.response?.data?.error || "Failed to change password.");
    } finally {
      setPasswordLoading(false);
    }
  };

  if (loading) {
    return <div className="p-10 text-center"><span className="loading loading-dots loading-lg text-primary" /></div>;
  }

  if (error) {
    return <div className="rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-red-700">{error}</div>;
  }

  if (!profile) {
    return <div className="rounded-lg border border-slate-200 bg-white px-4 py-3 text-slate-600">Profile unavailable.</div>;
  }

  const education = Array.isArray(profile.education) ? profile.education : [];
  const hasAddress = profile.current_address?.line_1 || profile.current_address?.city;
  const p = profile;

  return (
    <div className="mx-auto space-y-6 px-4 py-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold text-base-content">Student Profile</h1>
      </div>

      <div className="card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
        <div className="bg-linear-to-r from-base-100 via-base-200/60 to-base-100 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 text-base-content border-b border-base-300">
          <div className="avatar w-16 h-16 rounded-full bg-base-200 border border-base-300 flex items-center justify-center shrink-0">
            {p.profile_url ? (
              <img src={p.profile_url} alt={p.name || "Student"} className="w-full h-full rounded-full object-cover" />
            ) : (
              <svg className="w-8 h-8 text-base-content/60" fill="currentColor" viewBox="0 0 24 24">
                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z" />
              </svg>
            )}
          </div>
          <div className="flex-1">
            <h2 className="text-xl font-bold">{p.name || "Student"}</h2>
            <p className="text-sm text-base-content/70 font-medium mt-1">Enrollment: {p.enrollment_no || "-"}</p>
            <p className="text-sm text-base-content/70">{p.branch_name || "-"}</p>
            {p.id ? (
              <p className="text-xs text-base-content/60 mt-2">
                ID: <span className="font-mono font-semibold">#{p.id}</span>
              </p>
            ) : null}
            <div className="mt-3 flex flex-wrap gap-2">
              <span className="badge badge-outline badge-primary text-[11px]">Student</span>
              <span className="badge badge-outline badge-success text-[11px]">
                {p.is_deleted ? "Profile Inactive" : "Profile Active"}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="space-y-5">
        <SectionCard
          label="Contact Information"
          icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3V5zm2 2l7 5 7-5" /></svg>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            <ContactCard label="Email" value={p.email} />
            <ContactCard label="Phone" value={p.mobile_no} />
            <ContactCard label="Branch" value={p.branch_name} />
            <ContactCard label="Semester" value={p.current_sem ?? "-"} />
          </div>
        </SectionCard>

        <SectionCard
          label="Academic Details"
          icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5l9 4.5-9 4.5-9-4.5L12 5zm0 9l7.5-3.75V15L12 19l-7.5-4v-4.75L12 14z" /></svg>}
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
            <div>
              <InfoRow label="Role" value="Student" />
              <InfoRow label="Enrolled Year" value={p.enrolled_year ?? "-"} />
              <InfoRow label="Passing Year" value={p.passing_year ?? "-"} />
              <InfoRow label="Status" value={p.is_deleted ? "Inactive" : "Active"} />
            </div>
          </div>
        </SectionCard>
      </div>

      {hasAddress ? (
        <SectionCard
          label="Current Address"
          icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
        >
          <p className="text-sm text-base-content leading-relaxed">
            {p.current_address?.line_1 ? <>{p.current_address.line_1}<br /></> : null}
            {[p.current_address?.city, p.current_address?.state].filter(Boolean).join(", ") || "-"}
            {p.current_address?.pincode ? (
              <>
                <br />Pin: <span className="font-mono font-black text-primary text-xs">{p.current_address.pincode}</span>
              </>
            ) : null}
          </p>
        </SectionCard>
      ) : null}

      {education.length > 0 ? (
        <SectionCard
          label="Education History"
          icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5l9 4.5-9 4.5-9-4.5L12 5zm0 9l7.5-3.75V15L12 19l-7.5-4v-4.75L12 14z" /></svg>}
        >
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-200">
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-600">Institute</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-600">Year</th>
                  <th className="px-2 py-2 text-left text-xs font-semibold uppercase text-slate-600">Remarks</th>
                </tr>
              </thead>
              <tbody>
                {education.map((row, idx) => (
                  <tr key={idx} className="border-b border-slate-100 last:border-0">
                    <td className="px-2 py-2 text-sm text-slate-700">{row.institute_name || "-"}</td>
                    <td className="px-2 py-2 text-sm text-slate-600">{row.passing_year || "-"}</td>
                    <td className="px-2 py-2 text-sm text-slate-600">{row.remarks || "-"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </SectionCard>
      ) : null}

      <SectionCard
        label="Change Password"
        icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 10-8 0v4m-2 0h12v10H2V11z" /></svg>}
      >
        <form onSubmit={handleSubmit(handleChangePassword)} className="space-y-4">
          {passwordError ? (
            <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">{passwordError}</div>
          ) : null}

          {passwordSuccess ? (
            <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">{passwordSuccess}</div>
          ) : null}

          <div className="grid gap-4 md:grid-cols-3">
            <FormField label="Old Password">
              <input type="password" className={inputCls} {...register("oldPassword")} autoComplete="current-password" />
              {errors.oldPassword ? <p className="mt-1 text-xs text-red-600">{errors.oldPassword.message}</p> : null}
            </FormField>

            <FormField label="New Password">
              <input type="password" className={inputCls} {...register("newPassword")} autoComplete="new-password" />
              {errors.newPassword ? <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p> : null}
            </FormField>

            <FormField label="Confirm Password">
              <input type="password" className={inputCls} {...register("confirmPassword")} autoComplete="new-password" />
              {errors.confirmPassword ? <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p> : null}
            </FormField>
          </div>

          <div className="pt-1">
            <button type="submit" disabled={passwordLoading} className="btn btn-primary gap-2">
              {passwordLoading ? <span className="loading loading-spinner loading-xs" /> : null}
              {passwordLoading ? "Updating..." : "Change Password"}
            </button>
          </div>
        </form>
      </SectionCard>
    </div>
  );
}