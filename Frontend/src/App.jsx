import { useEffect } from "react";
import { Routes, Route } from "react-router";
import Landing from "./pages/Landing";
import Login from "./pages/login";
import ForgotPassword from "./pages/ForgotPassword";
import Student from "./pages/Student";
import Faculty from "./pages/Faculty";
import FacultyDashboard from "./components/FacultyDashboard"
import CoPoView from "./components/CoPoView"
import FacultyProfile from "./components/FacultyProfile";
import Assesment from "./components/Assessment";
import Hod from "./pages/Hod";
import Principle from "./pages/Principle";
import Admin from "./pages/Admin";
import RequireAuth from "./components/RequireAuth";
import FacultySubjects from "./components/FacultySubjects";
import AdminDashboard from "./components/AdminDashboard";
import AdminCreateFaculty from "./components/AdminCreateFaculty";
import AdminUsersList from "./components/AdminUsersList";
import AdminResetPassword from "./components/AdminResetPassword";
import AdminBulkImport from "./components/AdminBulkImport";
import AdminCreateSubject from "./components/AdminCreateSubject";
import AdminAssignSubject from "./components/AdminAssignSubject";
import AdminBatchReport from "./components/AdminBatchReport";
import AdminOutcomes from "./components/AdminOutcomes";
import SubjectAssignment from "./components/SubjectAssignment";
import HodCreateOffering from "./components/HodCreateOffering";
import HodDashboard from "./components/HodDashboard";
import StudentDashboard from "./components/StudentDashboard";
import StudentSubjects from "./components/StudentSubjects";
import StudentAttendance from "./components/StudentAttendance";
import StudentProfile from "./components/StudentProfile";
import AboutUs from "./pages/AboutUs";
import Home from "./components/Home";

// Role constants to prevent unnecessary re-renders
const STUDENT_ROLES = ["student"];
const ASSISTANT_ROLES = ["ASSISTANT", "ASSOCIATE"];
const HOD_ROLES = ["HOD"];
const ADMIN_ROLES = ["ADMIN"];

function App() {
  useEffect(() => {
    const savedTheme = localStorage.getItem("theme");
    const nextTheme = savedTheme === "dark" ? "dark" : "light";
    document.documentElement.setAttribute("data-theme", nextTheme);
  }, []);
  
  return (<>
    <Routes>
      
      <Route path="/" element={<Landing />} >
        <Route index element={<Home />} />
        <Route path="about" element={<AboutUs />} />
      </Route>
      <Route path="/login" element={<Login />} />
      <Route path="/forgot-password" element={<ForgotPassword />} />


      <Route
        path="/student"
        element={
          <RequireAuth allowedRoles={STUDENT_ROLES}>
            <Student />
          </RequireAuth>
        }
      >
        <Route index element={<StudentDashboard />} />
        <Route path="subjects" element={<StudentSubjects />} />
        <Route path="attendance" element={<StudentAttendance />} />
        <Route path="profile" element={<StudentProfile />} />
        <Route path="about" element={<AboutUs />} />
        </Route>


      <Route
        path="/faculty"
        element={<RequireAuth allowedRoles={ASSISTANT_ROLES}> <Faculty /></RequireAuth>}>
        <Route index element={<FacultyDashboard />} />
        <Route path="co-po-view" element={<CoPoView />} />
        <Route path="assessment" element={<Assesment />} />
        <Route path="subjects" element={<FacultySubjects />} />
        <Route path="profile" element={<FacultyProfile />} />
      </Route>
      
      
      <Route
        path="/hod"
        element={
          <RequireAuth allowedRoles={HOD_ROLES}>
            <Hod />
          </RequireAuth>
        }
      >
        <Route index element={<HodDashboard />} />
        <Route path="co-po-view" element={<CoPoView />} />
        <Route path="assessment" element={<Assesment />} />
        <Route path="subjects" element={<FacultySubjects />} />
        <Route path="profile" element={<FacultyProfile />} />
          <Route path="create-offering" element={<HodCreateOffering />} />
        <Route path="subject-assignment" element={<SubjectAssignment />} />
      </Route>


      <Route
        path="/admin"
        element={
          <RequireAuth allowedRoles={ADMIN_ROLES}>
            <Admin />
          </RequireAuth>
        }
      >
        <Route index element={<AdminDashboard />} />
        <Route path="create-faculty" element={<AdminCreateFaculty />} />
        <Route path="create-subject" element={<AdminCreateSubject />} />
        <Route path="assign-subject" element={<AdminAssignSubject />} />
        <Route path="users" element={<AdminUsersList />} />
        <Route path="reset-password" element={<AdminResetPassword />} />
        <Route path="bulk-import" element={<AdminBulkImport />} />
        <Route path="batch-report" element={<AdminBatchReport />} />
        <Route path="outcomes" element={<AdminOutcomes />} />
        <Route path="profile" element={<FacultyProfile />} />
        <Route path="about" element={<AboutUs />} />
      </Route>


    </Routes>
  </>)
}
export default App;