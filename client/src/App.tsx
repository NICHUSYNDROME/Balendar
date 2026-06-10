import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { useAuthStore } from './stores/authStore';
import Login from './pages/Login';
import Calendars from './pages/Calendars';
import CalendarDetail from './pages/CalendarDetail';
import Gigs from './pages/Gigs';
import GigDetail from './pages/GigDetail';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const token = useAuthStore((s) => s.token);
  if (!token) return <Navigate to="/login" replace />;
  return <>{children}</>;
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<Login />} />
        <Route
          path="/calendars"
          element={
            <ProtectedRoute>
              <Calendars />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendars/:id"
          element={
            <ProtectedRoute>
              <CalendarDetail />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendars/:calendarId/gigs"
          element={
            <ProtectedRoute>
              <Gigs />
            </ProtectedRoute>
          }
        />
        <Route
          path="/calendars/:calendarId/gigs/:gigId"
          element={
            <ProtectedRoute>
              <GigDetail />
            </ProtectedRoute>
          }
        />
        <Route path="*" element={<Navigate to="/calendars" replace />} />
      </Routes>
    </BrowserRouter>
  );
}

export default App;
