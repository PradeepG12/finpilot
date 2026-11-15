import React from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Users, Upload, LogOut, Shield, UserCog } from 'lucide-react';

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();

  const handleLogout = async () => {
    await logout();
    navigate('/login');
  };

  return (
    <div className="h-screen w-screen bg-bg flex flex-col md:flex-row overflow-hidden">
      {/* Sidebar for Desktop - Fixed Left Column */}
      <aside className="w-full md:w-64 h-full bg-surface border-r border-border flex flex-col justify-between p-4 flex-shrink-0 z-20 overflow-y-auto">
        <div>
          <div className="flex items-center space-x-2 px-2 py-4 border-b border-border mb-6">
            <Shield className="h-6 w-6 text-primary" />
            <span className="font-bold text-xl text-text-main tracking-tight">FinPilot</span>
          </div>

          <nav className="space-y-1">
            <NavLink
              to="/customers"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800'
                }`
              }
            >
              <Users className="h-5 w-5" />
              <span>Customers</span>
            </NavLink>

            {user?.user_type === 'ADMIN' && (
              <>
                <NavLink
                  to="/admin/imports"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <Upload className="h-5 w-5" />
                  <span>Admin Imports</span>
                </NavLink>

                <NavLink
                  to="/admin/users"
                  className={({ isActive }) =>
                    `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                      isActive
                        ? 'bg-primary text-white'
                        : 'text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800'
                    }`
                  }
                >
                  <UserCog className="h-5 w-5" />
                  <span>User Management</span>
                </NavLink>
              </>
            )}
          </nav>
        </div>

        <div className="border-t border-border pt-4">
          <div className="px-3 py-2">
            <div className="text-sm font-medium text-text-main truncate">
              {user?.full_name || user?.email}
            </div>
            <div className="text-xs text-text-muted capitalize">Role: {user?.user_type.toLowerCase()}</div>
          </div>
          <button
            onClick={handleLogout}
            className="w-full flex items-center space-x-3 px-3 py-2 rounded-lg text-sm font-medium text-loss hover:bg-red-50 transition-colors"
          >
            <LogOut className="h-5 w-5" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* Main Content Area - Scrollable Right Part */}
      <main className="flex-1 h-full overflow-y-auto p-4 sm:p-6 lg:p-8">
        <Outlet />
      </main>
    </div>
  );
};
