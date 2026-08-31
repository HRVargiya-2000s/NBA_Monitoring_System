import { useNavigate } from "react-router";

export default function Home () {
    const navigate = useNavigate();
    return (<>
        <section className="relative overflow-hidden px-4 pb-12 pt-12 md:px-8 md:pt-16">
            <div className="pointer-events-none absolute -left-20 top-0 h-72 w-72 rounded-full bg-primary/15 blur-3xl" />
            <div className="pointer-events-none absolute -right-16 bottom-0 h-72 w-72 rounded-full bg-secondary/20 blur-3xl" />

            <div className="relative mx-auto grid max-w-6xl items-center gap-8 lg:grid-cols-2">
                <div className="space-y-6">
                    <div className="badge badge-primary badge-outline">Academic Workflow Platform</div>
                    <h1 className="text-4xl font-black leading-tight md:text-5xl">
                        One Portal For Teaching,
                        <span className="text-primary"> Assessment</span>, and
                        <span className="text-secondary"> Outcome Tracking</span>
                    </h1>
                    <p className="max-w-xl text-base text-base-content/70">
                        Manage offerings, CO-PO mapping, assessments, attendance, and analytics with a role-based experience built for faculty, HoD, admin, and students.
                    </p>
                    <div className="flex flex-wrap gap-3">
                        <button className="btn btn-primary" onClick={() => navigate("/login")}>Get Started</button>
                        <a href="#features" className="btn btn-ghost">Explore Features</a>
                    </div>
                </div>

                <div className="card border border-base-300 bg-base-100 shadow-xl">
                    <div className="card-body">
                        <p className="text-sm font-semibold text-base-content/70">Platform Snapshot</p>
                        <div className="stats stats-vertical gap-2 bg-transparent shadow-none lg:stats-horizontal">
                            <div className="stat rounded-box border border-base-300 bg-base-200/60">
                                <div className="stat-title">Modules</div>
                                <div className="stat-value text-primary">8+</div>
                                <div className="stat-desc">Assessment to CO-PO</div>
                            </div>
                            <div className="stat rounded-box border border-base-300 bg-base-200/60">
                                <div className="stat-title">Roles</div>
                                <div className="stat-value text-secondary">4</div>
                                <div className="stat-desc">Student, Faculty, HoD, Admin</div>
                            </div>
                        </div>
                        <div className="divider my-1" />
                        <ul className="space-y-2 text-sm text-base-content/80">
                            <li className="flex items-center gap-2"><span className="badge badge-success badge-xs" /> Unified academic-year workflow</li>
                            <li className="flex items-center gap-2"><span className="badge badge-success badge-xs" /> Structured data with faster reports</li>
                            <li className="flex items-center gap-2"><span className="badge badge-success badge-xs" /> Secure, role-based access controls</li>
                        </ul>
                    </div>
                </div>
            </div>
        </section>

        <section id="features" className="mx-auto grid max-w-6xl gap-4 px-4 pb-12 md:grid-cols-2 md:px-8 lg:grid-cols-4">
            <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M9 17v-2a4 4 0 014-4h7M5 12h2a4 4 0 014 4v1m-6 0h14" />
                        </svg>
                    </div>
                    <h3 className="card-title text-lg">Assessment Operations</h3>
                    <p className="text-sm text-base-content/70">Create exams, upload marks, and manage attainment inputs in one guided flow.</p>
                </div>
            </div>
            <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-secondary/10 text-secondary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01" />
                        </svg>
                    </div>
                    <h3 className="card-title text-lg">CO-PO Insights</h3>
                    <p className="text-sm text-base-content/70">Track course outcomes and program outcomes with visual matrices and reports.</p>
                </div>
            </div>
            <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-info/10 text-info">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M3 7h18M3 12h18M3 17h18" />
                        </svg>
                    </div>
                    <h3 className="card-title text-lg">Subject & Offering Control</h3>
                    <p className="text-sm text-base-content/70">Configure offerings, map faculty, and maintain structured semester planning.</p>
                </div>
            </div>
            <div className="card border border-base-300 bg-base-100 shadow-sm">
                <div className="card-body">
                    <div className="mb-2 inline-flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 text-primary">
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="1.8" d="M8 7V3m8 4V3m-9 8h10M5 21h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v12a2 2 0 002 2z" />
                        </svg>
                    </div>
                    <h3 className="card-title text-lg">Attendance Module</h3>
                    <p className="text-sm text-base-content/70">Attendance capture, review, and integration with academic tracking workflows.</p>
                </div>
            </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
            <div className="rounded-2xl border border-base-300 bg-base-100 p-6 shadow-sm md:p-8">
                <div className="mb-5 flex flex-col justify-between gap-3 md:flex-row md:items-end">
                    <div>
                        <h2 className="text-2xl font-bold">Role-Based Workspace</h2>
                        <p className="text-sm text-base-content/70">Each role sees focused tools and dashboards relevant to their responsibilities.</p>
                    </div>
                    <button className="btn btn-primary btn-sm" onClick={() => navigate("/login")}>Continue to Login</button>
                </div>
                <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <div className="rounded-xl border border-base-300 bg-base-200/60 p-4">
                        <p className="font-semibold">Student</p>
                        <p className="mt-1 text-xs text-base-content/70">Subjects, attendance, profile</p>
                    </div>
                    <div className="rounded-xl border border-base-300 bg-base-200/60 p-4">
                        <p className="font-semibold">Faculty</p>
                        <p className="mt-1 text-xs text-base-content/70">Assessment, CO-PO, planning</p>
                    </div>
                    <div className="rounded-xl border border-base-300 bg-base-200/60 p-4">
                        <p className="font-semibold">HoD</p>
                        <p className="mt-1 text-xs text-base-content/70">Offerings, assignments, monitoring</p>
                    </div>
                    <div className="rounded-xl border border-base-300 bg-base-200/60 p-4">
                        <p className="font-semibold">Admin</p>
                        <p className="mt-1 text-xs text-base-content/70">User, subject, and system management</p>
                    </div>
                </div>
            </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
            <div className="grid gap-4 lg:grid-cols-3">
                <div className="card border border-base-300 bg-base-100 shadow-sm lg:col-span-2">
                    <div className="card-body">
                        <h2 className="card-title text-2xl">How It Works</h2>
                        <p className="text-sm text-base-content/70">A simple academic cycle from setup to measurable outcomes.</p>
                        <ul className="steps steps-vertical mt-2 w-full lg:steps-horizontal">
                            <li className="step step-primary">Create Subject & Offering</li>
                            <li className="step step-primary">Map Faculty & CO</li>
                            <li className="step step-primary">Enter Assessments</li>
                            <li className="step step-primary">View Attainment</li>
                        </ul>
                    </div>
                </div>

                <div className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body">
                        <h3 className="card-title text-lg">Why Teams Prefer It</h3>
                        <div className="space-y-2 text-sm text-base-content/80">
                            <p>Single source of truth for academic workflows</p>
                            <p>Less manual consolidation across spreadsheets</p>
                            <p>Faster review for HoD and faculty coordinators</p>
                            <p>Outcome-first reporting aligned with NBA needs</p>
                        </div>
                    </div>
                </div>
            </div>
        </section>

        <section className="mx-auto max-w-6xl px-4 pb-12 md:px-8">
            <div className="grid gap-4 lg:grid-cols-2">
                <div className="card border border-base-300 bg-base-100 shadow-sm">
                    <div className="card-body">
                        <h2 className="card-title text-2xl">Frequently Asked Questions</h2>

                        <div className="collapse-arrow collapse rounded-box border border-base-300 bg-base-200/50">
                            <input type="radio" name="home-faq" defaultChecked />
                            <div className="collapse-title text-sm font-semibold">Can one faculty handle multiple divisions?</div>
                            <div className="collapse-content text-sm text-base-content/70">
                                Yes. A faculty member can be assigned to multiple offerings and divisions as configured by HoD/Admin.
                            </div>
                        </div>

                        <div className="collapse-arrow collapse rounded-box border border-base-300 bg-base-200/50">
                            <input type="radio" name="home-faq" />
                            <div className="collapse-title text-sm font-semibold">Does this support CO-PO and PSO mappings?</div>
                            <div className="collapse-content text-sm text-base-content/70">
                                Yes. The platform includes mapping setup, strength matrix management, and attainment reporting.
                            </div>
                        </div>

                        <div className="collapse-arrow collapse rounded-box border border-base-300 bg-base-200/50">
                            <input type="radio" name="home-faq" />
                            <div className="collapse-title text-sm font-semibold">Can admins bulk setup users and subjects?</div>
                            <div className="collapse-content text-sm text-base-content/70">
                                Yes. Admin workflows support user/subject creation and operational setup from centralized tools.
                            </div>
                        </div>

                        <div className="collapse-arrow collapse rounded-box border border-base-300 bg-base-200/50">
                            <input type="radio" name="home-faq" />
                            <div className="collapse-title text-sm font-semibold">Will attendance be available here as well?</div>
                            <div className="collapse-content text-sm text-base-content/70">
                                Yes. Attendance workflow integration is planned in the next phase so faculty and students can track it in the same platform.
                            </div>
                        </div>
                    </div>
                </div>

                <div className="card border border-primary/30 bg-primary/5 shadow-sm">
                    <div className="card-body justify-between">
                        <div>
                            <h2 className="card-title text-2xl text-primary">Ready to streamline the semester?</h2>
                            <p className="mt-2 text-sm text-base-content/70">
                                Move from scattered workflows to a structured academic execution platform with visibility for every role.
                            </p>
                        </div>
                        <div className="card-actions mt-4">
                            <button className="btn btn-primary" onClick={() => navigate("/login")}>Login to Continue</button>
                        </div>
                    </div>
                </div>
            </div>
        </section>   
    </>)
}