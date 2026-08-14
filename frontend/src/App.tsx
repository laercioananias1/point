import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import AdminPointDashboard from "./pages/admin-point/Dashboard";
import ProfessorDashboard from "./pages/professor/Dashboard";
import AlunoDashboard from "./pages/aluno/Dashboard";

function Home() {
  const { user } = useAuth();

  switch (user?.role) {
    case "admin_point":
    case "super_admin":
      return <Navigate to="/admin-point" replace />;
    case "professor":
      return <Navigate to="/professor" replace />;
    case "aluno":
      return <Navigate to="/aluno" replace />;
    default:
      return <Navigate to="/login" replace />;
  }
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route
        path="/"
        element={
          <ProtectedRoute>
            <Home />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point"
        element={
          <ProtectedRoute>
            <AdminPointDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor"
        element={
          <ProtectedRoute>
            <ProfessorDashboard />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno"
        element={
          <ProtectedRoute>
            <AlunoDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
