import { Outlet, NavLink, useNavigate } from "react-router";
import logo from "@/assets/logo.png";
import { MdSpaceDashboard } from "react-icons/md";
import { RiTestTubeFill } from "react-icons/ri";
import { LuWorkflow } from "react-icons/lu";
import { FaCircleNodes } from "react-icons/fa6";
import { IoLogOut } from "react-icons/io5";
import { useAuth } from "@/context/AuthContext";

export default function AppLayout() {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const navItems = [
    { name: "Dashboard", path: "/app/dashboard", icon: <MdSpaceDashboard /> },
    { name: "Playground", path: "/app/playground", icon: <RiTestTubeFill /> },
    {
      name: "Workflows",
      path: "/app/workflows",
      icon: <LuWorkflow />,
    },
    { name: "Actions", path: "/app/actions", icon: <FaCircleNodes /> },
  ];

  const handleLogout = () => {
    logout();
    navigate("/login");
  };

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Sidebar */}
      <aside className="w-64 bg-white border-r border-gray-200 flex flex-col">
        {/* Logo Section */}
        <div className="p-4 border-b border-gray-200">
          <div className="flex items-center gap-3">
            <img src={logo} alt="Flow Nova" className="w-8 h-8 rounded-lg" />
            <div className="flex-1 min-w-0">
              <h1 className="font-semibold text-gray-900 truncate">Flow Nova</h1>
              <p className="text-xs text-gray-500 truncate">
                {user?.first_name} {user?.last_name}
              </p>
            </div>
          </div>
        </div>

        {/* Navigation */}
        <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
          {navItems.map((item) => (
            <NavLink
              key={item.path}
              to={item.path}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? "bg-gray-100 text-gray-900"
                    : "text-gray-600 hover:bg-gray-50 hover:text-gray-900"
                }`
              }
            >
              <span className="text-lg">{item.icon}</span>
              <span className="flex-1">{item.name}</span>
            </NavLink>
          ))}
        </nav>

        {/* Footer */}
        <div className="p-4 border-t border-gray-200">
          <div className="space-y-2">
            <NavLink
              to="/app/settings"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span className="text-lg">�</span>
              <span>Settings</span>
            </NavLink>
            <NavLink
              to="/app/help"
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium text-gray-600 hover:bg-gray-50 hover:text-gray-900 transition-colors"
            >
              <span className="text-lg">S</span>
              <span>Help</span>
            </NavLink>
          </div>
        </div>
      </aside>

      {/* Main Content */}
      <main className="flex-1 overflow-y-auto">
        <Outlet />
      </main>
    </div>
  );
}
