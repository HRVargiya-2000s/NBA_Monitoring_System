import { useEffect, useState } from "react";
import axios from "axios";
import { Navigate } from "react-router";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function RequireAuth({ allowedRoles, children }) {
  const [status, setStatus] = useState("checking");

  useEffect(() => {
    let isMounted = true;

    const validateSession = async () => {
      try {
        const response = await axios.get(`${SERVER_URL}/user/me`, {
          withCredentials: true,
        });

        const role = response.data?.user?.role;

        if (!isMounted) return;

        if (allowedRoles.includes(role)) {
          setStatus("authorized");
          return;
        }

        setStatus("forbidden");
      } catch {
        if (!isMounted) return;
        setStatus("unauthenticated");
      }
    };

    validateSession();

    return () => {
      isMounted = false;
    };
  }, [allowedRoles]);

  if (status === "checking") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-blue-50 text-blue-700">
        Checking session...
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  if (status === "forbidden") {
    return <Navigate to="/" replace />;
  }

  return children;
}
