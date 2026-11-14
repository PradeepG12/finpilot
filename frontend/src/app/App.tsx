import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { AuthProvider } from '@/features/auth/AuthContext';
import { ProtectedRoute, RoleGate } from '@/features/auth/ProtectedRoute';
import { LoginPage } from '@/features/auth/LoginPage';
import { AppShell } from '@/components/layout/AppShell';
import { CustomerListPage } from '@/features/customers/CustomerListPage';
import { CustomerOverviewPage } from '@/features/customers/CustomerOverviewPage';
import { ImportPage } from '@/features/imports/ImportPage';

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnWindowFocus: false,
      retry: 1,
      staleTime: 60 * 1000,
    },
  },
});

export const App: React.FC = () => {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />

            <Route
              path="/"
              element={
                <ProtectedRoute>
                  <AppShell />
                </ProtectedRoute>
              }
            >
              <Route index element={<Navigate to="/customers" replace />} />
              <Route path="customers" element={<CustomerListPage />} />
              <Route path="customers/:customerCode" element={<CustomerOverviewPage />} />
              <Route
                path="admin/imports"
                element={
                  <RoleGate allowedRoles={['ADMIN']} fallback={<div className="p-8 text-center text-loss">Access Denied: Admins Only.</div>}>
                    <ImportPage />
                  </RoleGate>
                }
              />
            </Route>

            <Route path="*" element={<Navigate to="/customers" replace />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </QueryClientProvider>
  );
};
