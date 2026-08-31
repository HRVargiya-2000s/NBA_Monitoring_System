import { NavLink } from "react-router";

export default function HomeNavbar () {
    return (
        <div className="navbar sticky top-0 z-20 border-b border-base-300 bg-base-100/90 px-4 backdrop-blur md:px-8">
            <div className="navbar-start">
                <div className="flex items-center gap-3">
                    <div className="avatar placeholder">
                        <img src="/logo.svg" alt="LDCE Logo" className="w-12 h-12 rounded-full border border-gray-300" />
                    </div>
                    <div>
                        <p className="text-sm font-bold leading-tight md:text-base">LDCE Academic System</p>
                        <p className="text-xs text-base-content/60">Curriculum • Assessment • Outcomes</p>
                    </div>
                </div>
            </div>
            <div className="navbar-end">
                <NavLink to="/" className="btn btn-ghost btn-sm mr-2 md:btn-md">
                    Home
                </NavLink>
                <NavLink to="/about" className="btn btn-ghost btn-sm mr-2 md:btn-md">
                    About Us
                </NavLink>
                <NavLink to="/login" className="btn btn-primary btn-sm md:btn-md">
                    Login
                </NavLink>
            </div>
        </div>
    )
}