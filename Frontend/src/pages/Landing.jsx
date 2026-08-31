import { useEffect, useState, useRef } from "react";
import axios from "axios";
import { Outlet, useNavigate } from "react-router";
import { getDashboardPathByRole } from "../utils/roleRouting";
import HomeNavbar from "../components/HomeNavbar";
import Footer from "../components/Footer";

const SERVER_URL = import.meta.env.VITE_SERVER_URL || import.meta.env.VITE_API_BASE_URL || "http://localhost:3000";

export default function Landing() {
    const navigate = useNavigate();
    const redirectAttemptedRef = useRef(false);

    useEffect(() => {
        const revealElements = document.querySelectorAll("[data-reveal]");
        if (!revealElements.length) return;

        const observer = new IntersectionObserver(
            (entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;

                    const el = entry.target;
                    const delay = Number(el.getAttribute("data-reveal-delay") || 0);

                    el.style.transitionDelay = `${delay}ms`;
                    el.classList.remove("opacity-0", "translate-y-6");
                    el.classList.add("opacity-100", "translate-y-0");

                    observer.unobserve(el);
                });
            },
            { threshold: 0.15 }
        );

        revealElements.forEach((el) => observer.observe(el));

        return () => observer.disconnect();
    }, []);

    useEffect(() => {
        // Prevent multiple redirect attempts
        if (redirectAttemptedRef.current) return;
        redirectAttemptedRef.current = true;

        const redirectIfLoggedIn = async () => {
            try {
                const response = await axios.get(`${SERVER_URL}/user/me`, {
                    withCredentials: true,
                });

                const role = response.data?.user?.role;

                const dashboardPath = getDashboardPathByRole(role);
                if (dashboardPath) {
                    navigate(dashboardPath, { replace: true });
                    return;
                }
            } catch {
                // Not logged in; show landing actions.
            }
        };

        redirectIfLoggedIn();
    }, []);

    return (
        <main className="min-h-screen bg-base-200 text-base-content">
            <HomeNavbar />
            <Outlet />
            <Footer />
        </main>
    );
}