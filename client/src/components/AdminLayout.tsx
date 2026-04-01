// client/src/components/AdminLayout.tsx
import { Link } from "wouter";
import { useAuth } from "../hooks/useAuth";
import { LogOut, LayoutDashboard, Users, MapPin, TrendingUp } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen bg-gray-100">
      {/* Sidebar */}
      <aside className="w-64 bg-gray-900 text-white flex flex-col">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">{user?.name}</p>
        </div>
        <nav className="flex-1 p-4 space-y-1">
          <Link href="/admin" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 transition">
            <LayoutDashboard size={18} /> Dashboard
          </Link>
          <Link href="/admin/users" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 transition">
            <Users size={18} /> Users
          </Link>
          <Link href="/admin/terminals" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 transition">
            <MapPin size={18} /> Terminals
          </Link>
          <Link href="/admin/forecasts" className="flex items-center gap-3 px-3 py-2 rounded hover:bg-gray-800 transition">
            <TrendingUp size={18} /> Forecasts
          </Link>
        </nav>
        <div className="p-4 border-t border-gray-800">
          <button
            onClick={logout}
            className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full px-3 py-2 rounded hover:bg-gray-800"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="flex-1 p-6">
        <div className="bg-white rounded-lg shadow p-6">{children}</div>
      </main>
    </div>
  );
}
