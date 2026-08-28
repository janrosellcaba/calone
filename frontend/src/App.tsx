import { Navigate, Route, Routes } from "react-router-dom";
import { AppLayout } from "./components/AppLayout";
import { ProtectedRoute } from "./components/ProtectedRoute";
import { CalendarPage } from "./pages/CalendarPage";
import { IntegrationsPage } from "./pages/IntegrationsPage";
import { LoginPage } from "./pages/LoginPage";

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AppLayout />}>
          <Route index element={<CalendarPage />} />
          <Route path="settings" element={<IntegrationsPage />} />
          <Route
            path="integrations"
            element={<Navigate to="/settings" replace />}
          />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Route>
      </Route>
    </Routes>
  );
}
