import React, { useState } from 'react';
import { NavLink, Outlet, useNavigate } from 'react-router-dom';
import { useAuth } from '@/features/auth/AuthContext';
import { Users, Upload, LogOut, Shield, UserCog, ChevronRight, Wallet, FileSpreadsheet } from 'lucide-react';
import { UserDetailsModal } from '@/features/admin/UserDetailsModal';

export const AppShell: React.FC = () => {
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);

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

            <NavLink
              to="/accounts"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800'
                }`
              }
            >
              <Wallet className="h-5 w-5" />
              <span>Accounts</span>
            </NavLink>

            <NavLink
              to="/exports"
              className={({ isActive }) =>
                `flex items-center space-x-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-colors ${
                  isActive
                    ? 'bg-primary text-white'
                    : 'text-text-muted hover:bg-slate-100 hover:text-text-main dark:hover:bg-slate-800'
                }`
              }
            >
              <FileSpreadsheet className="h-5 w-5" />
              <span>Exports</span>
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

        <div className="border-t border-border pt-4 space-y-1">
          <button
            type="button"
            onClick={() => setIsProfileModalOpen(true)}
            className="w-full text-left px-3 py-2.5 rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors group cursor-pointer border border-transparent hover:border-slate-200"
            title="View Profile Details"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-sm font-semibold text-text-main truncate group-hover:text-primary transition-colors">
                {user?.full_name || user?.email}
              </div>
              <ChevronRight className="h-4 w-4 text-text-muted group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
            </div>
            <div className="text-xs text-text-muted capitalize mt-0.5">Role: {user?.user_type.toLowerCase()}</div>
          </button>

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

      {/* Profile View/Edit Modal */}
      <UserDetailsModal
        isOpen={isProfileModalOpen}
        onClose={() => setIsProfileModalOpen(false)}
        targetUser={user}
        initialMode="view"
        canEditRole={user?.user_type === 'ADMIN'}
      />
    </div>
  );
};
