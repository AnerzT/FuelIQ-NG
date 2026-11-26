// client/src/components/AdminLayout.tsx
import { Link } from "wouter";
import { useAuth } from "@/lib/auth";
import { LogOut, LayoutDashboard, Users, MapPin, TrendingUp } from "lucide-react";

interface AdminLayoutProps {
  children: React.ReactNode;
}

export default function AdminLayout({ children }: AdminLayoutProps) {
  const { user, logout } = useAuth();

  return (
    <div className="flex min-h-screen flex-col bg-gray-100 md:flex-row">
      {/* Sidebar */}
      <aside className="flex w-full shrink-0 flex-col bg-gray-900 text-white md:w-64">
        <div className="p-4 border-b border-gray-800">
          <h1 className="text-xl font-bold">Admin Panel</h1>
          <p className="text-sm text-gray-400 mt-1">{user?.name}</p>
        </div>
        <nav className="flex flex-wrap gap-1 p-3 md:flex-1 md:flex-col md:space-y-1 md:p-4">
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
        <div className="border-t border-gray-800 p-3 md:p-4">
          <button
            onClick={logout}
            className="flex items-center gap-3 text-red-400 hover:text-red-300 w-full px-3 py-2 rounded hover:bg-gray-800"
          >
            <LogOut size={18} /> Logout
          </button>
        </div>
      </aside>

      {/* Main content */}
      <main className="min-w-0 flex-1 p-3 sm:p-4 md:p-6">
        <div className="min-w-0 overflow-hidden rounded-lg bg-white p-3 shadow sm:p-4 md:p-6">{children}</div>
      </main>
    </div>
  );
}
