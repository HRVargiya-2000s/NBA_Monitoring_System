import { useEffect, useState } from 'react';
import axios from 'axios';
import { useNavigate } from 'react-router';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { z } from 'zod';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

// ─── tiny helpers ────────────────────────────────────────────
const SectionCard = ({ label, icon, children }) => (
    <div className="card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
        <div className="px-4 py-3 border-b border-base-200 bg-base-200/50 flex items-center gap-2">
            {icon ? (
                <span className="inline-flex h-5 w-5 items-center justify-center rounded-md bg-primary/10 text-primary">
                    {icon}
                </span>
            ) : null}
            <span className="text-xs font-bold text-base-content/70 uppercase tracking-wide">
                {label}
            </span>
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
        <p className="text-sm text-base-content font-medium break-all mt-1">{value || '—'}</p>
    </div>
);

const ProfRow = ({ label, value }) => (
    value ? (
        <div className="flex justify-between items-start py-3 border-b border-base-200 last:border-0 gap-4">
            <span className="text-xs font-semibold text-base-content/60 uppercase shrink-0">{label}</span>
            <span className="text-sm text-base-content text-right">{value}</span>
        </div>
    ) : null
);

const inputCls = "input input-bordered w-full text-sm";

const changePasswordSchema = z
    .object({
        oldPassword: z.string().trim().min(1, 'Old password is required.'),
        newPassword: z.string().trim().min(6, 'New password must be at least 6 characters.'),
        confirmPassword: z.string().trim().min(1, 'Confirm password is required.')
    })
    .refine((data) => data.newPassword !== data.oldPassword, {
        message: 'New password must be different from old password.',
        path: ['newPassword']
    })
    .refine((data) => data.newPassword === data.confirmPassword, {
        message: 'New password and confirm password do not match.',
        path: ['confirmPassword']
    });

const FormField = ({ label, children }) => (
    <div className="flex flex-col gap-1.5">
        <label className="text-xs font-semibold text-base-content/70">{label}</label>
        {children}
    </div>
);

// ─── main ────────────────────────────────────────────────────
export default function FacultyProfile() {
    const navigate = useNavigate();
    const [profile, setProfile]   = useState(null);
    const [isEditing, setIsEditing] = useState(false);
    const [form, setForm]          = useState({});
    const [saving, setSaving]      = useState(false);
    const [error, setError]        = useState(null);
    const [saveError, setSaveError] = useState(null);
    const [passwordLoading, setPasswordLoading] = useState(false);
    const [passwordError, setPasswordError] = useState('');
    const [passwordSuccess, setPasswordSuccess] = useState('');
    const [experienceForm, setExperienceForm] = useState([]);

    const {
        register,
        handleSubmit,
        reset,
        formState: { errors }
    } = useForm({
        resolver: zodResolver(changePasswordSchema),
        defaultValues: {
            oldPassword: '',
            newPassword: '',
            confirmPassword: ''
        }
    });

    useEffect(() => {
        axios.get(`${SERVER_URL}/user/profile`, { withCredentials: true })
            .then(res => {
                setProfile(res.data);
                flattenForm(res.data);
                setExperienceForm(normalizeExperienceList(res.data.experience));
            })
            .catch(() => setError('Could not load profile.'));
    }, []);

    const normalizeExperienceList = (list) => {
        if (!Array.isArray(list)) return [];
        return list.map((exp) => ({
            id: exp?.id,
            starting_month_year: exp?.starting_month_year || '',
            ending_month_year: exp?.ending_month_year || '',
            description: exp?.description || ''
        }));
    };

    const flattenForm = (p) => setForm({
        name:                p.name || '',
        mobile_no:           p.mobile_no || '',
        college_email:       p.college_email || '',
        years_of_experience: p.years_of_experience ?? '',
        joining_date:        p.joining_date ? p.joining_date.slice(0, 10) : '',
        line_1:              p.current_address?.line_1 || '',
        city:                p.current_address?.city   || '',
        state:               p.current_address?.state  || '',
        pincode:             p.current_address?.pincode || '',
    });

    const handleSave = async () => {
        setSaving(true); setSaveError(null);
        try {
            const payload = {
                ...form,
                experience: experienceForm
                    .filter((exp) => exp.starting_month_year || exp.description)
                    .map((exp) => ({
                        id: exp.id,
                        starting_month_year: exp.starting_month_year,
                        ending_month_year: exp.ending_month_year,
                        description: exp.description
                    }))
            };
            const res = await axios.put(`${SERVER_URL}/user/profile`, payload, { withCredentials: true });
            setProfile(res.data);
            setExperienceForm(normalizeExperienceList(res.data.experience));
            setIsEditing(false);
        } catch (err) {
            setSaveError(err.response?.data?.error || 'Failed to save.');
        } finally { setSaving(false); }
    };

    const f = field => e => setForm(p => ({ ...p, [field]: e.target.value }));

    const addExperienceRow = () => {
        setExperienceForm((prev) => ([
            ...prev,
            {
                id: undefined,
                starting_month_year: '',
                ending_month_year: '',
                description: ''
            }
        ]));
    };

    const removeExperienceRow = (index) => {
        setExperienceForm((prev) => prev.filter((_, i) => i !== index));
    };

    const updateExperienceRow = (index, field, value) => {
        setExperienceForm((prev) => prev.map((row, i) => (
            i === index ? { ...row, [field]: value } : row
        )));
    };

    const handleChangePassword = async (data) => {
        setPasswordError('');
        setPasswordSuccess('');

        try {
            setPasswordLoading(true);
            const res = await axios.post(
                `${SERVER_URL}/user/change-password`,
                { oldPassword: data.oldPassword, newPassword: data.newPassword },
                { withCredentials: true }
            );

            setPasswordSuccess(res.data?.message || 'Password changed successfully. Please login again.');
            reset();

            setTimeout(() => {
                navigate('/login', { replace: true });
            }, 1000);
        } catch (err) {
            setPasswordError(err.response?.data?.error || 'Failed to change password.');
        } finally {
            setPasswordLoading(false);
        }
    };

    if (error)    return <div className="p-10 text-center text-red-500">{error}</div>;
    if (!profile) return <div className="p-10 text-center"><span className="loading loading-dots loading-lg text-primary" /></div>;

    const p = profile;
    const hasAddress = p.current_address?.line_1 || p.current_address?.city;
    const subjects   = p.assigned_subjects || [];

    // group subjects by academic year for display
    const subjectsByYear = subjects.reduce((acc, s) => {
        const key = `${s.accadmic_year} · ${s.session}`;
        if (!acc[key]) acc[key] = [];
        acc[key].push(s);
        return acc;
    }, {});

    return (
        <div className="mx-auto space-y-6 px-4 py-6">

            {/* ── PAGE HEADER ── */}
            <div className="flex items-center justify-between">
                <h1 className="text-2xl font-bold text-base-content">Faculty Profile</h1>
                {!isEditing && (
                    <button onClick={() => { flattenForm(p); setExperienceForm(normalizeExperienceList(p.experience)); setIsEditing(true); setSaveError(null); }}
                        className="btn btn-primary btn-sm md:btn-md gap-2">
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round"
                                  d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"/>
                        </svg>
                        Edit Profile
                    </button>
                )}
            </div>

            {/* ── HERO BANNER ── */}
            <div className="card border border-base-300 bg-base-100 shadow-sm overflow-hidden">
                <div className="bg-linear-to-r from-base-100 via-base-200/60 to-base-100 px-6 py-5 flex flex-col sm:flex-row items-start sm:items-center gap-5 text-base-content border-b border-base-300">
                    {/* Avatar */}
                    <div className="avatar w-16 h-16 rounded-full bg-base-200 border border-base-300 flex items-center justify-center shrink-0">
                        {p.profile_url
                            ? <img src={p.profile_url} alt={p.name} className="w-full h-full rounded-full object-cover" />
                            : <svg className="w-8 h-8 text-base-content/60" fill="currentColor" viewBox="0 0 24 24">
                                <path d="M12 12c2.7 0 4.8-2.1 4.8-4.8S14.7 2.4 12 2.4 7.2 4.5 7.2 7.2 9.3 12 12 12zm0 2.4c-3.2 0-9.6 1.6-9.6 4.8v2.4h19.2v-2.4c0-3.2-6.4-4.8-9.6-4.8z"/>
                              </svg>
                        }
                    </div>
                    {/* Info */}
                    <div className="flex-1">
                        <h2 className="text-xl font-bold">{p.name}</h2>
                        <p className="text-sm text-base-content/70 font-medium mt-1">{p.role}</p>
                        <p className="text-sm text-base-content/70">{p.branch_name || '—'}</p>
                        {p.id && <p className="text-xs text-base-content/60 mt-2">ID: <span className="font-mono font-semibold">#{p.id}</span></p>}
                        <div className="mt-3 flex flex-wrap gap-2">
                            <span className="badge badge-outline badge-primary text-[11px]">Faculty</span>
                            <span className="badge badge-outline badge-success text-[11px]">Profile Active</span>
                        </div>
                    </div>
                </div>
            </div>

            {/* ── EDIT FORM ── */}
            {isEditing && (
                <div className="card border border-base-300 bg-base-100 p-6 md:p-8 space-y-6 shadow-sm">
                    {saveError && (
                        <div className="alert alert-error text-sm">
                            {saveError}
                        </div>
                    )}
                    <div>
                        <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide border-b border-base-200 pb-2 mb-4">Personal Information</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Full Name"><input className={inputCls} value={form.name} onChange={f('name')} /></FormField>
                            <FormField label="Mobile Number"><input className={inputCls} value={form.mobile_no} onChange={f('mobile_no')} /></FormField>
                            <FormField label="College Email"><input className={inputCls} type="email" value={form.college_email} onChange={f('college_email')} /></FormField>
                            <FormField label="Joining Date"><input className={inputCls} type="date" value={form.joining_date} onChange={f('joining_date')} /></FormField>
                            <FormField label="Years of Experience"><input className={inputCls} type="number" min="0" value={form.years_of_experience} onChange={f('years_of_experience')} /></FormField>
                        </div>
                    </div>
                    <div>
                        <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide border-b border-base-200 pb-2 mb-4">Current Address</p>
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                            <FormField label="Address Line"><input className={inputCls} placeholder="Street / Area" value={form.line_1} onChange={f('line_1')} /></FormField>
                            <FormField label="City"><input className={inputCls} value={form.city} onChange={f('city')} /></FormField>
                            <FormField label="State"><input className={inputCls} value={form.state} onChange={f('state')} /></FormField>
                            <FormField label="Pincode"><input className={inputCls} value={form.pincode} onChange={f('pincode')} /></FormField>
                        </div>
                    </div>
                    <div>
                        <div className="flex items-center justify-between border-b border-base-200 pb-2 mb-4">
                            <p className="text-xs font-bold text-base-content/60 uppercase tracking-wide">Professional Experience</p>
                            <button
                                type="button"
                                onClick={addExperienceRow}
                                className="btn btn-outline btn-sm btn-secondary"
                            >
                                + Add Experience
                            </button>
                        </div>

                        {experienceForm.length === 0 ? (
                            <p className="text-sm text-base-content/60">No experience entries added yet.</p>
                        ) : (
                            <div className="space-y-3">
                                {experienceForm.map((exp, i) => (
                                    <div key={exp.id ?? `new-${i}`} className="border border-base-300 rounded-xl p-4 bg-base-200/40 space-y-3">
                                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                            <FormField label="Start (Month-Year)">
                                                <input
                                                    className={inputCls}
                                                    type="month"
                                                    value={exp.starting_month_year}
                                                    onChange={(e) => updateExperienceRow(i, 'starting_month_year', e.target.value)}
                                                />
                                            </FormField>
                                            <FormField label="End (Month-Year)">
                                                <input
                                                    className={inputCls}
                                                    type="month"
                                                    value={exp.ending_month_year}
                                                    onChange={(e) => updateExperienceRow(i, 'ending_month_year', e.target.value)}
                                                />
                                            </FormField>
                                        </div>

                                        <FormField label="Description">
                                            <textarea
                                                className={inputCls}
                                                rows={2}
                                                value={exp.description}
                                                onChange={(e) => updateExperienceRow(i, 'description', e.target.value)}
                                                placeholder="Role, institute, highlights"
                                            />
                                        </FormField>

                                        <div>
                                            <button
                                                type="button"
                                                onClick={() => removeExperienceRow(i)}
                                                className="btn btn-outline btn-error btn-xs"
                                            >
                                                Remove
                                            </button>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                    <div className="flex gap-3 pt-1 flex-wrap">
                        <button onClick={handleSave} disabled={saving}
                            className="btn btn-primary gap-2">
                            {saving ? <span className="loading loading-spinner loading-xs" /> :
                                <svg className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7"/></svg>}
                            {saving ? 'Saving…' : 'Save Changes'}
                        </button>
                        <button onClick={() => setIsEditing(false)} disabled={saving}
                            className="btn btn-ghost">
                            Cancel
                        </button>
                    </div>
                </div>
            )}

            {/* ── VIEW SECTIONS ── */}
            {!isEditing && (
                <div className="space-y-5">

                    {/* CONTACT */}
                    {(p.email || p.mobile_no || p.college_email || p.joining_date) && (
                        <SectionCard
                            label="Contact Information"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M3 5h18v14H3V5zm2 2l7 5 7-5" /></svg>}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                                {p.email && <ContactCard label="Email" value={p.email} />}
                                {p.mobile_no && <ContactCard label="Phone" value={p.mobile_no} />}
                                {p.college_email && <ContactCard label="College Email" value={p.college_email} />}
                                {p.joining_date && (
                                    <ContactCard 
                                        label="Joining Date" 
                                        value={new Date(p.joining_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} 
                                    />
                                )}
                            </div>
                        </SectionCard>
                    )}

                    {/* PROFESSIONAL */}
                    {(p.role || p.branch_name || p.years_of_experience != null) && (
                        <SectionCard
                            label="Professional Information"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 7h16M6 7V5h12v2m-9 4h6m-7 8h8a2 2 0 002-2V7H6v10a2 2 0 002 2z" /></svg>}
                        >
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-x-12">
                                <div>
                                    <ProfRow label="Designation"  value={p.role} />
                                    <ProfRow label="Department"   value={p.branch_name} />
                                    <ProfRow label="Experience"   value={p.years_of_experience != null ? `${p.years_of_experience} years` : null} />
                                </div>
                            </div>
                        </SectionCard>
                    )}

                    <SectionCard
                        label="Change Password"
                        icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 11V7a4 4 0 10-8 0v4m-2 0h12v10H2V11z" /></svg>}
                    >
                        <form onSubmit={handleSubmit(handleChangePassword)} className="space-y-4">
                            {passwordError ? (
                                <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-lg px-4 py-3">
                                    {passwordError}
                                </div>
                            ) : null}

                            {passwordSuccess ? (
                                <div className="bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm rounded-lg px-4 py-3">
                                    {passwordSuccess}
                                </div>
                            ) : null}

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <FormField label="Old Password">
                                    <input
                                        className={inputCls}
                                        type="password"
                                        {...register('oldPassword')}
                                        autoComplete="current-password"
                                    />
                                    {errors.oldPassword ? (
                                        <p className="mt-1 text-xs text-red-600">{errors.oldPassword.message}</p>
                                    ) : null}
                                </FormField>

                                <FormField label="New Password">
                                    <input
                                        className={inputCls}
                                        type="password"
                                        {...register('newPassword')}
                                        autoComplete="new-password"
                                    />
                                    {errors.newPassword ? (
                                        <p className="mt-1 text-xs text-red-600">{errors.newPassword.message}</p>
                                    ) : null}
                                </FormField>

                                <FormField label="Confirm Password">
                                    <input
                                        className={inputCls}
                                        type="password"
                                        {...register('confirmPassword')}
                                        autoComplete="new-password"
                                    />
                                    {errors.confirmPassword ? (
                                        <p className="mt-1 text-xs text-red-600">{errors.confirmPassword.message}</p>
                                    ) : null}
                                </FormField>
                            </div>

                            <div className="pt-1">
                                <button
                                    type="submit"
                                    disabled={passwordLoading}
                                    className="btn btn-primary gap-2"
                                >
                                    {passwordLoading ? <span className="loading loading-spinner loading-xs" /> : null}
                                    {passwordLoading ? 'Updating...' : 'Change Password'}
                                </button>
                            </div>
                        </form>
                    </SectionCard>

                    {/* ADDRESS */}
                    {hasAddress && (
                        <SectionCard
                            label="Current Address"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 21s7-5.5 7-11a7 7 0 10-14 0c0 5.5 7 11 7 11z" /><circle cx="12" cy="10" r="2.5" /></svg>}
                        >
                            <p className="text-sm text-base-content leading-relaxed">
                                {p.current_address.line_1 && <>{p.current_address.line_1}<br /></>}
                                {(p.current_address.city || p.current_address.state) && (
                                    <>{[p.current_address.city, p.current_address.state].filter(Boolean).join(', ')}<br /></>
                                )}
                                {p.current_address.pincode && (
                                    <span className="font-mono font-black text-primary text-xs">
                                        Pin: {p.current_address.pincode}
                                    </span>
                                )}
                            </p>
                        </SectionCard>
                    )}

                    {/* ASSIGNED SUBJECTS */}
                    {subjects.length > 0 && (
                        <SectionCard
                            label="Assigned Subjects"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M4 19.5A2.5 2.5 0 016.5 17H20M6.5 17A2.5 2.5 0 014 14.5V5a2 2 0 012-2h14v14" /></svg>}
                        >
                            <div className="space-y-4">
                                {Object.entries(subjectsByYear).map(([yearSession, subs]) => (
                                    <div key={yearSession}>
                                        <p className="text-xs font-semibold text-slate-500 uppercase tracking-wide mb-3">{yearSession}</p>
                                        <div className="space-y-2">
                                            {subs.map((s, i) => (
                                                <div key={i} className="border border-base-300 bg-base-200/40 rounded-lg p-3">
                                                    <div className="flex items-start justify-between gap-3">
                                                        <div className="flex-1">
                                                            <p className="text-sm font-semibold text-base-content">{s.subject_name}</p>
                                                            <p className="text-xs text-base-content/60 mt-1">
                                                                {[
                                                                    `${s.subject_code}`,
                                                                    `Sem ${s.sem_number}`,
                                                                    `Div ${s.division}`,
                                                                    s.teaching_role && s.teaching_role.charAt(0).toUpperCase() + s.teaching_role.slice(1),
                                                                    s.total_lectures && `${s.total_lectures} lectures`
                                                                ].filter(Boolean).join(' • ')}
                                                            </p>
                                                        </div>
                                                    </div>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                    {/* EDUCATION */}
                    {p.education?.length > 0 && (
                        <SectionCard
                            label="Academic History"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M12 5l9 4.5-9 4.5-9-4.5L12 5zm0 9l7.5-3.75V15L12 19l-7.5-4v-4.75L12 14z" /></svg>}
                        >
                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead>
                                        <tr className="border-b border-slate-200">
                                            {['Institute', 'Year', 'Remarks'].map(h => (
                                                <th key={h} className="text-left py-2 px-3 text-xs font-semibold text-slate-600 uppercase">{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {p.education.map((edu, i) => (
                                            <tr key={i} className="border-b border-slate-100 last:border-0">
                                                <td className="py-3 px-3 text-sm text-slate-700">{edu.institute_name}</td>
                                                <td className="py-3 px-3 text-sm text-slate-600 font-mono">{edu.passing_year}</td>
                                                <td className="py-3 px-3 text-sm text-slate-600">{edu.remarks || '—'}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                        </SectionCard>
                    )}

                    {/* EXPERIENCE */}
                    {p.experience?.length > 0 && (
                        <SectionCard
                            label="Professional Experience"
                            icon={<svg className="h-3.5 w-3.5" fill="none" stroke="currentColor" strokeWidth="2" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" d="M8 7V5a2 2 0 012-2h4a2 2 0 012 2v2m-9 0h11a2 2 0 012 2v9a2 2 0 01-2 2H7a2 2 0 01-2-2V9a2 2 0 012-2z" /></svg>}
                        >
                            <div className="space-y-3">
                                {p.experience.map((exp, i) => (
                                    <div key={i} className="border border-base-300 bg-base-200/40 rounded-lg p-4">
                                        {exp.description && <p className="text-sm text-base-content font-medium">{exp.description}</p>}
                                        <p className="text-xs text-base-content/60 mt-2">
                                            {exp.starting_month_year} → {exp.ending_month_year || 'Present'}
                                        </p>
                                    </div>
                                ))}
                            </div>
                        </SectionCard>
                    )}

                </div>
            )}
        </div>
    );
}