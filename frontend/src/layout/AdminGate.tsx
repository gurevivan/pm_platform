import type { ReactNode } from "react";
import { Navigate } from "react-router-dom";
import { useAuth } from "../auth/AuthProvider";

export function AdminGate({ children }: { children: ReactNode }) {
  const { isAuthed, isStaff, access, profileReady } = useAuth();

  if (!isAuthed) return <Navigate to="/login" replace />;
  if (access && !profileReady) {
    return (
      <div className="page">
        <div className="hint-banner">Подготовка рабочей области…</div>
      </div>
    );
  }
  if (!isStaff) return <Navigate to="/" replace />;
  return <>{children}</>;
}
