export const FACULTY_ROLES = ["ASSISTANT", "HOD", "ASSOCIATE", "ADMIN"];

export function getDashboardPathByRole(role) {
  const rolePathMap = {
    student: "/student",
    ASSISTANT: "/faculty",
    HOD: "/hod",
    ASSOCIATE: "/faculty",
    ADMIN: "/admin",
  };

  return rolePathMap[role] || null;
}
