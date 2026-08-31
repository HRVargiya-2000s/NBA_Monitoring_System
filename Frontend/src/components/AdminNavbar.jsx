import { NavLink, useNavigate } from 'react-router';
import axios from 'axios';
import { useState } from 'react';

const SERVER_URL = import.meta.env.VITE_SERVER_URL || 'http://localhost:3000';

const getTabClass = ({ isActive }) =>
    isActive
        ? 'font-semibold text-blue-800 border-b-2 border-blue-800 bg-blue-50 rounded-lg px-4 py-2 cursor-pointer transition-all whitespace-nowrap'
        : 'font-semibold text-gray-600 hover:bg-gray-100 rounded-lg px-4 py-2 cursor-pointer transition-all whitespace-nowrap';

export default function AdminNavbar() {
    const navigate = useNavigate();
    const [isLoggingOut, setIsLoggingOut] = useState(false);

    const handleLogout = async () => {
        if (isLoggingOut) return;
        setIsLoggingOut(true);
        try {
            await axios.post(`${SERVER_URL}/user/logout`, {}, { withCredentials: true });
        } catch {
            // force logout regardless
        } finally {
            localStorage.removeItem('hasActiveSession');
            navigate('/login', { replace: true });
            setIsLoggingOut(false);
        }
    };

    return (
        <div className="bg-white shadow-md px-4 py-2 border-b border-gray-200">

            <div className="flex items-center justify-between">

                {/* LEFT: Logo & Title */}
                <div className="flex items-center gap-3">
                    <img src="/logo.svg" alt="LDCE Logo" className="w-12 h-12 rounded-full border border-gray-300" />
                    <div className="flex flex-col items-start leading-tight">
                        <span className="text-xl font-bold text-blue-900">LDCE Academic System</span>
                        <span className="text-xs text-gray-500 font-medium tracking-wide">
                            Admin Portal • User Management
                        </span>
                    </div>
                </div>

                {/* RIGHT: Profile Dropdown */}
                <div className="dropdown dropdown-end">
                    <label tabIndex={0} className="btn bg-white border border-gray-300 hover:bg-gray-50 flex items-center gap-2 rounded-lg px-4 py-2 min-h-0 h-auto cursor-pointer shadow-sm">
                        <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 text-gray-700">
                            <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                        </svg>
                        <span className="font-semibold text-gray-700 normal-case text-sm">Admin</span>
                        <svg xmlns="http://www.w3.org/2000/svg" className="h-4 w-4 text-gray-500 ml-1" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M19 9l-7 7-7-7" />
                        </svg>
                    </label>

                    <ul tabIndex={0} className="menu dropdown-content mt-3 p-2 shadow-lg bg-white border border-gray-200 rounded-lg w-44 z-50">
                        <li>
                            <NavLink
                                to="/admin/profile"
                                className="text-blue-800 hover:bg-blue-50 font-medium flex items-center gap-3 py-2.5 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 119 0 4.5 4.5 0 01-9 0zM3.751 20.105a8.25 8.25 0 0116.498 0 .75.75 0 01-.437.695A18.683 18.683 0 0112 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 01-.437-.695z" clipRule="evenodd" />
                                </svg>
                                Profile
                            </NavLink>
                        </li>
                        <div className="h-px bg-gray-200 my-1" />
                        <li>
                            <button
                                type="button"
                                onClick={handleLogout}
                                className="text-left text-red-600 hover:bg-red-50 font-semibold flex items-center gap-3 py-2.5 cursor-pointer"
                            >
                                <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                                    <path fillRule="evenodd" d="M7.5 3.75A1.5 1.5 0 006 5.25v13.5a1.5 1.5 0 001.5 1.5h6a1.5 1.5 0 001.5-1.5V15a.75.75 0 011.5 0v3.75a3 3 0 01-3 3h-6a3 3 0 01-3-3V5.25a3 3 0 013-3h6a3 3 0 013 3V9A.75.75 0 0115 9V5.25a1.5 1.5 0 00-1.5-1.5h-6zm10.72 4.72a.75.75 0 011.06 0l3 3a.75.75 0 010 1.06l-3 3a.75.75 0 11-1.06-1.06l1.72-1.72H9a.75.75 0 010-1.5h10.94l-1.72-1.72a.75.75 0 010-1.06z" clipRule="evenodd" />
                                </svg>
                                {isLoggingOut ? 'Logging out...' : 'Logout'}
                            </button>
                        </li>
                    </ul>
                </div>
            </div>

            {/* NAV TABS ROW */}
            <div className="mt-3 w-full overflow-x-auto h-8">
                <ul className="flex flex-nowrap justify-center gap-2 whitespace-nowrap px-1 min-w-max mx-auto">
                    <li>
                        <NavLink to="/admin" end className={getTabClass}>Dashboard</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/create-faculty" className={getTabClass}>Create Faculty</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/create-subject" className={getTabClass}>Create Subject</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/assign-subject" className={getTabClass}>Assign Subject</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/users" className={getTabClass}>Users</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/reset-password" className={getTabClass}>Reset Password</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/bulk-import" className={getTabClass}>Create Student</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/batch-report" className={getTabClass}>Batch Report</NavLink>
                    </li>
                    <li>
                        <NavLink to="/admin/outcomes" className={getTabClass}>PO/PSO Outcomes</NavLink>
                    </li>
                </ul>
            </div>
        </div>
    );
}
