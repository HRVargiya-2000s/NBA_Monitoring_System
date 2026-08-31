import HODNavbar from "../components/HODNavbar";
import { Outlet } from "react-router";

export default function Hod() {
  return (
    <div className="min-h-screen bg-gray-50">
      <HODNavbar />

      <div className="p-4 md:p-6 lg:p-8">

        <div className="min-h-[60vh] rounded-lg border border-gray-100 bg-white p-6 shadow-sm">
          <Outlet />
        </div>
      </div>
    </div>
  );
}