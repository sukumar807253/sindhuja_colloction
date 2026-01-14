import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";

export default function ProtectedRoute({ children, admin = false }) {
  const { user } = useAuth();

  // Not logged in
  if (!user) {
    return <Navigate to="/" replace />;
  }

  // Admin route but user is not admin
  if (admin && !user.isAdmin) {
    return <Navigate to="/centers" replace />;
  }

  return children;
}
