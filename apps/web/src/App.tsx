import { BrowserRouter, Routes, Route } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { AuthProvider } from '@/contexts/AuthContext';
import { ProtectedRoute, PublicOnlyRoute, AdminRoute } from '@/components/ProtectedRoute';
import AppLayout from '@/layouts/AppLayout';
import AdminLayout from '@/layouts/AdminLayout';
import LandingPage from '@/pages/LandingPage';
import LoginPage from '@/pages/LoginPage';
import RegisterPage from '@/pages/RegisterPage';
import DashboardPage from '@/pages/DashboardPage';
import ProfilePage from '@/pages/ProfilePage';
import SessionsPage from '@/pages/SessionsPage';
import ScanPage from '@/pages/ScanPage';
import ScanResultsPage from '@/pages/ScanResultsPage';
import ScanHistoryPage from '@/pages/ScanHistoryPage';
import { ScanComparePage } from '@/pages/ScanComparePage';
import { TargetsPage } from '@/pages/TargetsPage';
import { ReportsPage } from '@/pages/ReportsPage';
import { AdminDashboardPage } from '@/pages/admin/AdminDashboardPage';
import { AdminUsersPage } from '@/pages/admin/AdminUsersPage';
import { AdminScansPage } from '@/pages/admin/AdminScansPage';
import { AdminScanDetailPage } from '@/pages/admin/AdminScanDetailPage';
import { AdminFindingsPage } from '@/pages/admin/AdminFindingsPage';
import { AdminReportsPage } from '@/pages/admin/AdminReportsPage';
import { AdminAuditLogsPage } from '@/pages/admin/AdminAuditLogsPage';
import { AdminHealthPage } from '@/pages/admin/AdminHealthPage';
import NotFoundPage from '@/pages/NotFoundPage';

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public routes with shared layout */}
          <Route element={<AppLayout />}>
            {/* Always public */}
            <Route path="/" element={<LandingPage />} />

            {/* Public-only: redirect authenticated users to dashboard */}
            <Route element={<PublicOnlyRoute />}>
              <Route path="/login" element={<LoginPage />} />
              <Route path="/register" element={<RegisterPage />} />
            </Route>

            {/* Protected user workspace */}
            <Route element={<ProtectedRoute />}>
              <Route path="/dashboard" element={<DashboardPage />} />
              <Route path="/dashboard/scan" element={<ScanPage />} />
              <Route path="/dashboard/scans" element={<ScanHistoryPage />} />
              <Route path="/dashboard/scans/compare" element={<ScanComparePage />} />
              <Route path="/dashboard/scans/:id" element={<ScanResultsPage />} />
              <Route path="/dashboard/targets" element={<TargetsPage />} />
              <Route path="/dashboard/reports" element={<ReportsPage />} />
              <Route path="/scan" element={<ScanPage />} />
              <Route path="/profile" element={<ProfilePage />} />
              <Route path="/sessions" element={<SessionsPage />} />
            </Route>
          </Route>

          {/* Admin Subsystem: Strictly protected by AdminRoute */}
          <Route element={<AdminRoute />}>
            <Route element={<AdminLayout />}>
              <Route path="/admin" element={<AdminDashboardPage />} />
              <Route path="/admin/users" element={<AdminUsersPage />} />
              <Route path="/admin/scans" element={<AdminScansPage />} />
              <Route path="/admin/scans/:id" element={<AdminScanDetailPage />} />
              <Route path="/admin/findings" element={<AdminFindingsPage />} />
              <Route path="/admin/reports" element={<AdminReportsPage />} />
              <Route path="/admin/audit-logs" element={<AdminAuditLogsPage />} />
              <Route path="/admin/health" element={<AdminHealthPage />} />
            </Route>
          </Route>

          {/* 404 fallback */}
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </BrowserRouter>

      {/* Toast notifications */}
      <Toaster
        position="top-right"
        toastOptions={{
          style: {
            background: '#0f1629',
            color: '#e2e8f0',
            border: '1px solid rgba(71, 85, 105, 0.4)',
            borderRadius: '0.75rem',
            fontSize: '0.875rem',
          },
          success: {
            iconTheme: { primary: '#36a7ff', secondary: '#0a0f1a' },
          },
          error: {
            iconTheme: { primary: '#f87171', secondary: '#0a0f1a' },
          },
        }}
      />
    </AuthProvider>
  );
}
