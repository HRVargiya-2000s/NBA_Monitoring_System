import { useState } from "react";
import axios from "axios";
import { useNavigate } from "react-router";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";
const emailRegex = /^\S+@\S+\.\S+$/;

export default function ForgotPassword() {
  const navigate = useNavigate();
  const [step, setStep] = useState(1);
  const [role, setRole] = useState("student");
  const [email, setEmail] = useState("");
  const [otp, setOtp] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const clearFeedback = () => {
    setError("");
    setSuccess("");
  };

  const requestOtp = async () => {
    clearFeedback();

    if (!emailRegex.test(email)) {
      setError("Please enter a valid email.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${SERVER_URL}/user/forgot-password`, {
        email,
        role,
      });
      setSuccess(response.data?.message || "OTP sent to your email.");
      setStep(2);
    } catch (err) {
      setError(err.response?.data?.error || "Unable to send OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const verifyOtp = async () => {
    clearFeedback();

    if (!otp.trim()) {
      setError("OTP is required.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${SERVER_URL}/user/verify-otp`, {
        email,
        otp,
      });
      setSuccess(response.data?.message || "OTP verified.");
      setStep(3);
    } catch (err) {
      setError(err.response?.data?.error || "Invalid or expired OTP.");
    } finally {
      setIsLoading(false);
    }
  };

  const resetPassword = async () => {
    clearFeedback();

    if (newPassword.length < 6) {
      setError("Password must be at least 6 characters.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setIsLoading(true);
    try {
      const response = await axios.post(`${SERVER_URL}/user/reset-password`, {
        email,
        newPassword,
        role,
      });
      setSuccess(response.data?.message || "Password reset successful.");
      setTimeout(() => navigate("/login"), 1200);
    } catch (err) {
      setError(err.response?.data?.error || "Password reset failed.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-linear-to-br from-blue-50 via-white to-sky-100 p-4 md:p-8">
      <div className="mx-auto flex min-h-[calc(100vh-2rem)] w-full max-w-6xl items-center justify-center">
        <section className="grid w-full overflow-hidden rounded-3xl border border-blue-100 bg-white shadow-2xl lg:grid-cols-2">
          <div className="relative hidden bg-linear-to-b from-blue-700 to-blue-500 p-10 text-white lg:flex lg:flex-col lg:justify-between">
            <div className="absolute -right-16 -top-14 h-48 w-48 rounded-full bg-blue-300/20" />
            <div className="absolute -bottom-16 -left-12 h-56 w-56 rounded-full bg-sky-200/20" />
            <div className="relative z-10">
              <img src="/logo.svg" alt="Portal logo" className="h-16 w-16 rounded-lg bg-white/95 p-2" />
              <h1 className="mt-6 text-3xl font-bold leading-tight">Forgot Password</h1>
              <p className="mt-3 max-w-sm text-blue-100">
                Recover access in three quick steps: request OTP, verify, and set a new password.
              </p>
            </div>
            <p className="relative z-10 text-sm text-blue-100">Security first, recovery made simple.</p>
          </div>

          <div className="p-6 sm:p-10">
            <div className="mb-6 flex items-center gap-3 lg:hidden">
              <img src="/logo.svg" alt="Portal logo" className="h-10 w-10 rounded-lg bg-blue-50 p-1.5" />
              <h2 className="text-xl font-semibold text-blue-900">Forgot Password</h2>
            </div>

            <ul className="steps steps-horizontal mb-6 w-full text-xs">
              <li className={`text-black step ${step >= 1 ? "step-primary" : ""}`}>Request</li>
              <li className={`text-black step ${step >= 2 ? "step-primary" : ""}`}>Verify OTP</li>
              <li className={`text-black step ${step >= 3 ? "step-primary" : ""}`}>Reset</li>
            </ul>

            <div className="space-y-4">
              {step === 1 && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">Account Type</label>
                    <select
                      className="select select-bordered w-full border-blue-200 bg-white text-slate-800 focus:border-blue-500 focus:outline-none"
                      value={role}
                      onChange={(e) => setRole(e.target.value)}
                    >
                      <option value="student">Student</option>
                      <option value="faculty">Faculty</option>
                    </select>
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">Registered Email</label>
                    <input
                      type="email"
                      className="input input-bordered w-full border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="name@college.edu"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                    />
                  </div>
                </>
              )}

              {step === 2 && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">One-Time Password (OTP)</label>
                    <input
                      type="text"
                      className="input input-bordered w-full border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter 6-digit OTP"
                      value={otp}
                      onChange={(e) => setOtp(e.target.value)}
                    />
                  </div>
                  <p className="text-xs text-slate-500">Sent to {email}</p>
                </>
              )}

              {step === 3 && (
                <>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">New Password</label>
                    <input
                      type="password"
                      className="input input-bordered w-full border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Enter new password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                    />
                  </div>
                  <div>
                    <label className="mb-1 block text-sm font-medium text-blue-900">Confirm Password</label>
                    <input
                      type="password"
                      className="input input-bordered w-full border-blue-200 bg-white text-slate-800 placeholder:text-slate-400 focus:border-blue-500 focus:outline-none"
                      placeholder="Re-enter password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                    />
                  </div>
                </>
              )}

              {error && (
                <div role="alert" className="alert alert-error alert-soft text-sm">
                  <span>{error}</span>
                </div>
              )}

              {success && (
                <div role="alert" className="alert alert-success alert-soft text-sm">
                  <span>{success}</span>
                </div>
              )}

              <div className="mt-2 flex gap-3">
                <button
                  type="button"
                  className="btn btn-outline border-blue-200 text-blue-800 hover:bg-blue-50"
                  onClick={() => navigate("/login")}
                >
                  Back to Login
                </button>

                {step === 1 && (
                  <button type="button" className="btn btn-primary text-white" disabled={isLoading} onClick={requestOtp}>
                    {isLoading ? "Sending..." : "Send OTP"}
                  </button>
                )}

                {step === 2 && (
                  <button type="button" className="btn btn-primary text-white" disabled={isLoading} onClick={verifyOtp}>
                    {isLoading ? "Verifying..." : "Verify OTP"}
                  </button>
                )}

                {step === 3 && (
                  <button type="button" className="btn btn-primary text-white" disabled={isLoading} onClick={resetPassword}>
                    {isLoading ? "Resetting..." : "Reset Password"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
