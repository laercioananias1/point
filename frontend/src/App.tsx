import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import AdminPointDashboard from "./pages/admin-point/Dashboard";
import AdminPointFaturamento from "./pages/admin-point/Faturamento";
import AdminPointCadastro from "./pages/admin-point/Cadastro";
import ProfessorDashboard from "./pages/professor/Dashboard";
import AlunoDashboard from "./pages/aluno/Dashboard";
import DonoAppDashboard from "./pages/dono-app/Dashboard";

function Home() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  switch (user?.role) {
    case "admin_point":
      return <Navigate to="/admin-point" replace />;
    case "super_admin":
      return <Navigate to="/dono-app" replace />;
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
        path="/admin-point/faturamento"
        element={
          <ProtectedRoute>
            <AdminPointFaturamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/cadastro"
        element={
          <ProtectedRoute>
            <AdminPointCadastro />
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
      <Route
        path="/dono-app"
        element={
          <ProtectedRoute>
            <DonoAppDashboard />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
