import { Navigate, Outlet } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export function ProtectedRoute() {
  const { status } = useAuth();

  if (status === "loading") {
    return (
      <div className="relative flex min-h-svh items-center justify-center text-[#1d1d1f]/50">
        <div className="pointer-events-none absolute inset-0 apple-mesh" />
        <p className="relative">Checking session…</p>
      </div>
    );
  }

  if (status === "unauthenticated") {
    return <Navigate to="/login" replace />;
  }

  return <Outlet />;
}
