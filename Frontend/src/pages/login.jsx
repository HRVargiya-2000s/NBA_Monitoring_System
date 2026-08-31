import { useEffect, useState } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import axios from "axios";
import { useNavigate } from "react-router";
import { getDashboardPathByRole } from "../utils/roleRouting";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const emailRegex = /^\S+@\S+\.\S+$/;

const loginSchema = z
    .object({
        loginType: z.enum(["student", "faculty"]),
        identifier: z.string().min(1, "Identifier is required"),
        password: z.string().min(6, "Password must be at least 6 characters"),
    })
    .superRefine((data, ctx) => {
        if (data.loginType === "faculty" && !emailRegex.test(data.identifier)) {
            ctx.addIssue({
                code: z.ZodIssueCode.custom,
                path: ["identifier"],
                message: "Enter a valid faculty email address",
            });
        }
    });

function Login() {
    const navigate = useNavigate();
    const [loginType, setLoginType] = useState("student");
    const [isLoading, setIsLoading] = useState(false);
    const [serverError, setServerError] = useState("");
    const [serverSuccess, setServerSuccess] = useState("");
    const [showPassword, setShowPassword] = useState(false);

    const {
        register,
        handleSubmit,
        setValue,
        formState: { errors },
    } = useForm({
        resolver: zodResolver(loginSchema),
        defaultValues: {
            loginType: "student",
            identifier: "",
            password: "",
        },
    });

    useEffect(() => {
        const checkExistingSession = async () => {
            if (localStorage.getItem("hasActiveSession") !== "true") {
                return;
            }

            try {
                const response = await axios.get(`${SERVER_URL}/user/me`, { withCredentials: true });
                const currentRole = response.data?.user?.role;

                const dashboardPath = getDashboardPathByRole(currentRole);
                if (dashboardPath) {
                    navigate(dashboardPath, { replace: true });
                }
            } catch {
                localStorage.removeItem("hasActiveSession");
                // Not logged in or session expired; stay on login page.
            }
        };

        checkExistingSession();
    }, [navigate]);

    const onSubmit = async (data) => {
        setServerError("");
        setServerSuccess("");
        setIsLoading(true);

        const payload = {
            identifier: data.identifier,
            password: data.password,
            role: data.loginType === "student" ? "student" : "faculty",
        };

        try {
            const response = await axios.post(
                `${SERVER_URL}/user/login`,
                payload,
                { withCredentials: true }
            );

            const loggedInRole = response.data?.user?.role;
            setServerSuccess(response.data?.message || "Login successful.");
            localStorage.setItem("hasActiveSession", "true");

            const dashboardPath = getDashboardPathByRole(loggedInRole);
            if (dashboardPath) {
                navigate(dashboardPath, { replace: true });
                return;
            }

            setServerError("Login succeeded but role could not be resolved.");
        } catch (err) {
            setServerError(err.response?.data?.error || "Unable to login. Please try again.");
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <main className="relative min-h-screen overflow-hidden bg-[#edf3ff] p-4 md:p-8">
            <div className="pointer-events-none absolute -left-28 top-16 h-72 w-72 rounded-full bg-blue-300/30 blur-3xl" />
            <div className="pointer-events-none absolute -right-24 bottom-8 h-80 w-80 rounded-full bg-blue-200/40 blur-3xl" />

            <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center">
                <section className="grid w-full overflow-hidden rounded-[28px] border border-blue-100/80 bg-white shadow-[0_30px_80px_-30px_rgba(29,78,216,0.30)] lg:grid-cols-2">
                    <div className="relative hidden bg-linear-to-br from-blue-800 via-blue-700 to-blue-600 p-10 text-white lg:flex lg:flex-col lg:justify-between">
                        <div className="absolute -right-16 -top-14 h-52 w-52 rounded-full bg-white/10" />
                        <div className="absolute -bottom-20 -left-16 h-64 w-64 rounded-full bg-blue-100/20" />

                        <div className="relative z-10">
                            <img src="/logo.svg" alt="Portal logo" className="h-16 w-16 rounded-xl border border-white/25 bg-white/95 p-2" />
                            <h1 className="mt-7 text-4xl font-extrabold leading-tight tracking-tight">Welcome Back</h1>
                            <p className="mt-3 max-w-sm text-base text-blue-50/95">
                                One trusted place to manage learning workflows, assessment operations, and academic progress.
                            </p>

                            <div className="mt-8 space-y-3 text-sm text-blue-50/95">
                                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Outcome and assessment workflows</p>
                                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Subject and offering coordination</p>
                                <p className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-300" /> Attendance-ready role dashboards</p>
                            </div>
                        </div>

                        <div className="relative z-10 rounded-xl border border-white/20 bg-white/10 px-4 py-3 text-sm text-blue-50/95 backdrop-blur-sm">
                            Use your official institution credentials to continue.
                        </div>
                    </div>

                    <div className="p-6 sm:p-10">
                        <div className="mb-6 flex items-center gap-3 lg:hidden">
                            <img src="/logo.svg" alt="Portal logo" className="h-10 w-10 rounded-lg bg-blue-50 p-1.5" />
                            <h2 className="text-xl font-bold text-slate-800">LDCE Academic Portal</h2>
                        </div>

                        <div className="mb-6">
                            <h2 className="text-3xl font-extrabold tracking-tight text-slate-900">Sign In</h2>
                            <p className="mt-1 text-sm text-slate-500">Choose your role and enter your credentials.</p>
                        </div>

                        <div className="mb-6 rounded-xl bg-slate-100 p-1">
                            <button
                                type="button"
                                className={`w-1/2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                    loginType === "student"
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                                onClick={() => {
                                    setLoginType("student");
                                    setValue("loginType", "student", { shouldValidate: true });
                                }}
                            >
                                Student
                            </button>
                            <button
                                type="button"
                                className={`w-1/2 rounded-lg px-4 py-2 text-sm font-semibold transition ${
                                    loginType === "faculty"
                                        ? "bg-white text-blue-700 shadow-sm"
                                        : "text-slate-500 hover:text-slate-700"
                                }`}
                                onClick={() => {
                                    setLoginType("faculty");
                                    setValue("loginType", "faculty", { shouldValidate: true });
                                }}
                            >
                                Faculty
                            </button>
                        </div>

                        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
                            <input type="hidden" {...register("loginType")} />

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">
                                    {loginType === "student" ? "Enrollment Number or Email" : "Faculty Email"}
                                </label>
                                <input
                                    type="text"
                                    placeholder={
                                        loginType === "student"
                                            ? "e.g. 230280116157 or student@ldce.ac.in"
                                            : "e.g. faculty@ldce.ac.in"
                                    }
                                    className={`input w-full rounded-xl border bg-white text-slate-800 placeholder:text-slate-400 focus:outline-none ${
                                        errors.identifier
                                            ? "border-red-300"
                                            : "border-slate-200 focus:border-blue-500"
                                    }`}
                                    {...register("identifier")}
                                />
                                {errors.identifier ? <p className="mt-1 text-xs text-red-600">{errors.identifier.message}</p> : null}
                            </div>

                            <div>
                                <label className="mb-1 block text-sm font-semibold text-slate-700">Password</label>
                                <label
                                    className={`input flex items-center gap-2 rounded-xl border bg-white pr-2 ${
                                        errors.password ? "border-red-300" : "border-slate-200 focus-within:border-blue-500"
                                    }`}
                                >
                                    <input
                                        type={showPassword ? "text" : "password"}
                                        placeholder="Enter password"
                                        className="grow bg-transparent text-slate-800 placeholder:text-slate-400"
                                        {...register("password")}
                                    />
                                    <button
                                        type="button"
                                        className="rounded-md px-2 py-1 text-xs font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
                                        onClick={() => setShowPassword((prev) => !prev)}
                                    >
                                        {showPassword ? "Hide" : "Show"}
                                    </button>
                                </label>
                                {errors.password ? <p className="mt-1 text-xs text-red-600">{errors.password.message}</p> : null}
                            </div>

                            {serverError ? (
                                <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
                                    {serverError}
                                </div>
                            ) : null}

                            {serverSuccess ? (
                                <div role="alert" className="rounded-xl border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-700">
                                    {serverSuccess}
                                </div>
                            ) : null}

                            <button
                                type="submit"
                                className="mt-2 w-full rounded-xl bg-blue-600 px-4 py-3 text-sm font-semibold text-white shadow-lg shadow-blue-600/25 transition hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-70"
                                disabled={isLoading}
                            >
                                {isLoading ? (
                                    <span className="inline-flex items-center gap-2">
                                        <span className="loading loading-spinner loading-xs" />
                                        Signing in...
                                    </span>
                                ) : `Login as ${loginType === "student" ? "Student" : "Faculty"}`}
                            </button>

                            <button
                                type="button"
                                className="mt-1 w-full text-sm font-semibold text-blue-700 transition hover:text-blue-800"
                                onClick={() => navigate("/forgot-password")}
                            >
                                Forgot password?
                            </button>

                            <div className="rounded-xl border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                                Faculty must login using official email. Students can use enrollment number or email.
                            </div>
                        </form>
                    </div>
                </section>
            </div>
        </main>
    );
}

export default Login;
