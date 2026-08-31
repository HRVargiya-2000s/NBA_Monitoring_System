import React from "react";

// GitHub SVG Icon
const GitHubIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M12 0C5.37 0 0 5.37 0 12c0 5.31 3.435 9.795 8.205 11.385.6.105.825-.255.825-.57 0-.285-.015-1.23-.015-2.235-3.015.555-3.795-.735-4.035-1.41-.135-.345-.72-1.41-1.23-1.695-.42-.225-1.02-.78-.015-.795.945-.015 1.62.87 1.845 1.23 1.08 1.815 2.805 1.305 3.495.99.105-.78.42-1.305.765-1.605-2.67-.3-5.46-1.335-5.46-5.925 0-1.305.465-2.385 1.23-3.225-.12-.3-.54-1.53.12-3.18 0 0 1.005-.315 3.3 1.23.96-.27 1.98-.405 3-.405s2.04.135 3 .405c2.295-1.56 3.3-1.23 3.3-1.23.66 1.65.24 2.88.12 3.18.765.84 1.23 1.905 1.23 3.225 0 4.605-2.805 5.625-5.475 5.925.435.375.81 1.095.81 2.22 0 1.605-.015 2.895-.015 3.3 0 .315.225.69.825.57A12.02 12.02 0 0 0 24 12c0-6.63-5.37-12-12-12z" />
  </svg>
);

// LinkedIn SVG Icon
const LinkedInIcon = () => (
  <svg
    xmlns="http://www.w3.org/2000/svg"
    width="22"
    height="22"
    viewBox="0 0 24 24"
    fill="currentColor"
  >
    <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433a2.062 2.062 0 0 1-2.063-2.065 2.064 2.064 0 1 1 2.063 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
  </svg>
);

const teamMembers = [
  {
    name: "Hiren Vargiya",
    photo: "/about-us/hiren.jpeg",
    photoPosition: "center center",
    photoScale: 1.1,
    github: "https://github.com/HRVargiya-2000s",
    linkedin: "https://linkedin.com/in/hrvargiya-2000s",
  },
  {
    name: "Souvik Hazra",
    photo: "/about-us/souvik.png",
    photoPosition: "center center",
    photoScale: 1.15,
    github: "https://github.com/souvikhazra15",
    linkedin: "https://www.linkedin.com/in/hazrasouvik21",
  },
  {
    name: "Viraj Rathod",
    photo: "/about-us/viraj.jpeg",
    photoPosition: "center 15%",
    photoScale: 1.4,
    github: "https://github.com/RathodViraj",
    linkedin: "https://www.linkedin.com/in/viraj-rathod-058ba4280",
  },
  {
    name: "Bhumika Vasan",
    photo: "/about-us/bhumika.jpeg",
    photoPosition: "center center",
    photoScale: 1.14,
    github: "https://github.com/bhumika031",
    linkedin: "https://www.linkedin.com/in/bhumika-vasan-266207346",
  },
  {
    name: "Mercy Vasant",
    photo: "/about-us/mercy.jpeg",
    photoPosition: "center center",
    photoScale: 1.08,
    github: "https://github.com/MercyVasant",
    linkedin: "https://www.linkedin.com/in/mercy-vasant",
  },
  {
    name: "Het Virani",
    photo: "/about-us/het.jpeg",
    photoPosition: "center center",
    photoScale: 1.14,
    github: "https://github.com/hetvirani18",
    linkedin: "https://www.linkedin.com/in/hetvirani-gec-ldce-it-dte",
  },

];

export default function AboutUs() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: "#f9fafb", padding: "40px 16px" }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto" }}>
        {/* Page Title */}
        <h1
          style={{
            fontSize: "2.25rem",
            fontWeight: "700",
            textAlign: "center",
            color: "#1e3a8a",
            marginBottom: "2rem",
          }}
        >
          About Us
        </h1>

        {/* Project Overview */}
        <div
          style={{
            backgroundColor: "#fff",
            borderRadius: "12px",
            boxShadow: "0 2px 8px rgba(0,0,0,0.08)",
            padding: "2rem",
            marginBottom: "3rem",
          }}
        >
          <h2 style={{ fontSize: "1.5rem", fontWeight: "600", color: "#1f2937", marginBottom: "1rem" }}>
            Project Overview
          </h2>
          <p style={{ color: "#4b5563", lineHeight: "1.8", fontSize: "1.05rem" }}>
            This Academic System is a comprehensive platform designed to streamline and automate
            educational and administrative processes. It serves as an integrated solution for students,
            faculty, head of departments, and administrators to seamlessly handle activities like tracking
            attendance, generating outcomes, managing course assignments, and tracking student performance.
            Our goal is to simplify academic management with cutting-edge tools and intuitive interfaces.
          </p>
        </div>

        {/* Meet the Team */}
        <div>
          <h2
            style={{
              fontSize: "1.875rem",
              fontWeight: "600",
              textAlign: "center",
              color: "#1f2937",
              marginBottom: "0.5rem",
            }}
          >
            Meet the Team
          </h2>

          {/* Batch 2027 Badge */}
          <p
            style={{
              fontSize: "1.15rem",
              fontWeight: "600",
              color: "#374151",
              marginBottom: "1.75rem",
              marginTop: "1rem",
            }}
          >
            Batch 2027
          </p>

          {/* Team Cards Grid */}
          <div
            style={{
              display: "grid",
              gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))",
              gap: "1.5rem",
            }}
          >
            {teamMembers.map((member, index) => (
              <div
                key={index}
                style={{
                  backgroundColor: "#f3f4f6",
                  borderRadius: "12px",
                  padding: "2rem 1.5rem",
                  display: "flex",
                  flexDirection: "column",
                  alignItems: "center",
                  boxShadow: "0 1px 4px rgba(0,0,0,0.06)",
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.currentTarget.style.boxShadow = "0 4px 16px rgba(0,0,0,0.13)")
                }
                onMouseLeave={(e) =>
                  (e.currentTarget.style.boxShadow = "0 1px 4px rgba(0,0,0,0.06)")
                }
              >
                {/* Avatar */}
                <div
                  style={{
                    width: "130px",
                    height: "130px",
                    borderRadius: "50%",
                    marginBottom: "1rem",
                    border: "none",
                    boxShadow: "0 3px 10px rgba(59,130,246,0.18)",
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                    overflow: "hidden",
                  }}
                >
                  <img
                    src={member.photo}
                    alt={member.name}
                    style={{
                      width: "100%",
                      height: "100%",
                      objectFit: "cover",
                      objectPosition: member.photoPosition || "center center",
                      transform: `scale(${member.photoScale || 1})`,
                      transformOrigin: "center center",
                      borderRadius: "50%",
                      backgroundColor: "transparent",
                    }}
                  />
                </div>

                {/* Name */}
                <h3
                  style={{
                    fontSize: "1.1rem",
                    fontWeight: "600",
                    color: "#111827",
                    marginBottom: "0.25rem",
                    textAlign: "center",
                  }}
                >
                  {member.name}
                </h3>

                {/* Role */}
                <p
                  style={{
                    fontSize: "0.875rem",
                    color: "#6b7280",
                    marginBottom: "1rem",
                    textAlign: "center",
                  }}
                >
                  {member.role}
                </p>

                {/* Social Icons */}
                <div style={{ display: "flex", gap: "1rem" }}>
                  <a
                    href={member.github}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#374151", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#111827")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
                    title="GitHub"
                  >
                    <GitHubIcon />
                  </a>
                  <a
                    href={member.linkedin}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={{ color: "#374151", transition: "color 0.2s" }}
                    onMouseEnter={(e) => (e.currentTarget.style.color = "#0a66c2")}
                    onMouseLeave={(e) => (e.currentTarget.style.color = "#374151")}
                    title="LinkedIn"
                  >
                    <LinkedInIcon />
                  </a>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
