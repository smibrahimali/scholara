import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { DocumentsPage } from './pages/DocumentsPage';
import { ApplicationsPage } from './pages/ApplicationsPage';
import { ApplicationDetailPage } from './pages/ApplicationDetailPage';
import { StudentDashboardPage } from './pages/StudentDashboardPage';
import { ProfilePage } from './pages/ProfilePage';

const queryClient = new QueryClient();

function ConsultantStudentDashboard() {
  const { studentId } = useParams<{ studentId: string }>();
  return <StudentDashboardPage studentId={studentId} />;
}

function ConsultantStudentDocuments() {
  const { studentId } = useParams<{ studentId: string }>();
  return <DocumentsPage studentId={studentId} canReview />;
}

function ConsultantStudentApplications() {
  const { studentId } = useParams<{ studentId: string }>();
  return <ApplicationsPage studentId={studentId} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            <Route path="/login" element={<LoginPage />} />
            <Route
              path="/app"
              element={
                <ProtectedRoute>
                  <AppLayout />
                </ProtectedRoute>
              }
            >
              <Route index element={<HomeRedirect />} />
              <Route path="documents" element={<DocumentsPage />} />
              <Route path="applications" element={<ApplicationsPage />} />
              <Route path="profile" element={<ProfilePage />} />
              <Route
                path="applications/:id"
                element={<ApplicationDetailPage />}
              />
              <Route
                path="students/:studentId"
                element={
                  <ProtectedRoute roles={['CONSULTANT']}>
                    <ConsultantStudentDashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="students/:studentId/documents"
                element={
                  <ProtectedRoute roles={['CONSULTANT']}>
                    <ConsultantStudentDocuments />
                  </ProtectedRoute>
                }
              />
              <Route
                path="students/:studentId/applications"
                element={
                  <ProtectedRoute roles={['CONSULTANT']}>
                    <ConsultantStudentApplications />
                  </ProtectedRoute>
                }
              />
              <Route
                path="students/:studentId/applications/:id"
                element={
                  <ProtectedRoute roles={['CONSULTANT']}>
                    <ApplicationDetailPage />
                  </ProtectedRoute>
                }
              />
            </Route>
            <Route path="/dashboard" element={<Navigate to="/app" replace />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
