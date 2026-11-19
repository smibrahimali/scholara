import { lazy, Suspense } from 'react';
import { BrowserRouter, Navigate, Route, Routes, useParams } from 'react-router-dom';
import { QueryClientProvider } from '@tanstack/react-query';
import { Toaster } from 'sonner';
import { AuthProvider } from './context/AuthContext';
import { ProtectedRoute } from './components/ProtectedRoute';
import { AppLayout } from './layouts/AppLayout';
import { LoginPage } from './pages/LoginPage';
import { HomeRedirect } from './pages/HomeRedirect';
import { queryClient } from './lib/queryClient';

const DocumentsPage = lazy(() =>
  import('./pages/DocumentsPage').then((m) => ({ default: m.DocumentsPage })),
);
const ApplicationsPage = lazy(() =>
  import('./pages/ApplicationsPage').then((m) => ({
    default: m.ApplicationsPage,
  })),
);
const ApplicationDetailPage = lazy(() =>
  import('./pages/ApplicationDetailPage').then((m) => ({
    default: m.ApplicationDetailPage,
  })),
);
const StudentDashboardPage = lazy(() =>
  import('./pages/StudentDashboardPage').then((m) => ({
    default: m.StudentDashboardPage,
  })),
);
const ProfilePage = lazy(() =>
  import('./pages/ProfilePage').then((m) => ({ default: m.ProfilePage })),
);
const PersonalInformationPage = lazy(() =>
  import('./pages/PersonalInformationPage').then((m) => ({
    default: m.PersonalInformationPage,
  })),
);
const MyConsultantPage = lazy(() =>
  import('./pages/MyConsultantPage').then((m) => ({
    default: m.MyConsultantPage,
  })),
);
const LiveCallPage = lazy(() =>
  import('./pages/LiveCallPage').then((m) => ({ default: m.LiveCallPage })),
);
const EmailLogPage = lazy(() =>
  import('./pages/EmailLogPage').then((m) => ({ default: m.EmailLogPage })),
);
const MessagesPage = lazy(() =>
  import('./pages/MessagesPage').then((m) => ({ default: m.MessagesPage })),
);

function RouteFallback() {
  return (
    <p className="px-5 py-8 text-sm text-muted-foreground" aria-busy="true">
      Loading…
    </p>
  );
}

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

function ConsultantStudentCalls() {
  const { studentId } = useParams<{ studentId: string }>();
  return <MyConsultantPage studentId={studentId} />;
}

function ConsultantStudentEmails() {
  const { studentId } = useParams<{ studentId: string }>();
  return <EmailLogPage studentId={studentId} />;
}

function ConsultantStudentMessages() {
  const { studentId } = useParams<{ studentId: string }>();
  return <MessagesPage studentId={studentId} />;
}

export default function App() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <BrowserRouter>
          <Suspense fallback={<RouteFallback />}>
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
                <Route
                  path="documents"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <DocumentsPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="applications"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <ApplicationsPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="profile" element={<ProfilePage />} />
                <Route
                  path="profile/personal"
                  element={<PersonalInformationPage />}
                />
                <Route
                  path="emails"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <EmailLogPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="consultant"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <MyConsultantPage />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="messages"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <MessagesPage />
                    </ProtectedRoute>
                  }
                />
                <Route path="live-call/:callId" element={<LiveCallPage />} />
                <Route
                  path="applications/:id"
                  element={
                    <ProtectedRoute roles={['STUDENT', 'GUARDIAN']}>
                      <ApplicationDetailPage />
                    </ProtectedRoute>
                  }
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
                  path="students/:studentId/calls"
                  element={
                    <ProtectedRoute roles={['CONSULTANT']}>
                      <ConsultantStudentCalls />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="students/:studentId/emails"
                  element={
                    <ProtectedRoute roles={['CONSULTANT']}>
                      <ConsultantStudentEmails />
                    </ProtectedRoute>
                  }
                />
                <Route
                  path="students/:studentId/messages"
                  element={
                    <ProtectedRoute roles={['CONSULTANT']}>
                      <ConsultantStudentMessages />
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
          </Suspense>
        </BrowserRouter>
        <Toaster richColors position="top-right" />
      </AuthProvider>
    </QueryClientProvider>
  );
}
