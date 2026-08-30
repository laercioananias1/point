import { Navigate, Route, Routes } from "react-router-dom";
import { useAuth, type Role } from "./auth/AuthContext";
import { ProtectedRoute } from "./auth/ProtectedRoute";
import Login from "./pages/Login";
import ConviteAceite from "./pages/ConviteAceite";
import ConviteVinculoAceite from "./pages/ConviteVinculoAceite";
import ConviteAdminAceite from "./pages/ConviteAdminAceite";
import AdminPointInicio from "./pages/admin-point/Inicio";
import AdminPointAluno from "./pages/admin-point/Aluno";
import AdminPointConvidarAluno from "./pages/admin-point/ConvidarAluno";
import AdminPointProfessor from "./pages/admin-point/Professor";
import AdminPointConvidarProfessor from "./pages/admin-point/ConvidarProfessor";
import AdminPointFaturamento from "./pages/admin-point/Faturamento";
import AdminPointPerfil from "./pages/admin-point/Perfil";
import AdminPointVerMais from "./pages/admin-point/VerMais";
import AdminPointMeuPoint from "./pages/admin-point/MeuPoint";
import AdminPointPrazos from "./pages/admin-point/Prazos";
import AdminPointHorariosFuncionamento from "./pages/admin-point/HorariosFuncionamento";
import AdminPointModalidades from "./pages/admin-point/Modalidades";
import AdminPointQuadras from "./pages/admin-point/Quadras";
import AdminPointPlanos from "./pages/admin-point/Planos";
import AdminPointTurmas from "./pages/admin-point/Turmas";
import AdminPointOcupacao from "./pages/admin-point/Ocupacao";
import AdminPointAgenda from "./pages/admin-point/Agenda";
import ProfessorInicio from "./pages/professor/Inicio";
import ProfessorAgenda from "./pages/professor/Agenda";
import ProfessorOcupacao from "./pages/professor/Ocupacao";
import ProfessorTurmas from "./pages/professor/Turmas";
import ProfessorPerfil from "./pages/professor/Perfil";
import AlunoInicio from "./pages/aluno/Inicio";
import AlunoAgenda from "./pages/aluno/Agenda";
import AlunoReagendarCredito from "./pages/aluno/ReagendarCredito";
import AlunoCreditos from "./pages/aluno/Creditos";
import AlunoComprarAvulsa from "./pages/aluno/ComprarAvulsa";
import AlunoNovoAgendamento from "./pages/aluno/NovoAgendamento";
import AlunoPerfil from "./pages/aluno/Perfil";
import DonoAppInicio from "./pages/dono-app/Inicio";
import DonoAppPoints from "./pages/dono-app/Points";
import DonoAppPerfil from "./pages/dono-app/Perfil";

// Ordem de prioridade pra decidir a HOME inicial de quem tem mais de um
// papel (pedido do usuário, 2026-08-26 — dono do Point que também é
// professor) — cai na área de gestão primeiro; depois de logado, a pessoa
// troca de área quando quiser (ver "Trocar de área" nas telas de Perfil).
const ROTA_POR_PAPEL: Record<Role, string> = {
  super_admin: "/dono-app",
  admin_point: "/admin-point",
  professor: "/professor",
  aluno: "/aluno",
};
const ORDEM_PRIORIDADE: Role[] = ["admin_point", "super_admin", "professor", "aluno"];

function Home() {
  const { user, initializing } = useAuth();

  if (initializing) return null;

  const papel = ORDEM_PRIORIDADE.find((p) => user?.roles.includes(p));
  return <Navigate to={papel ? ROTA_POR_PAPEL[papel] : "/login"} replace />;
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route path="/convite/:token" element={<ConviteAceite />} />
      <Route path="/convite-vinculo/:token" element={<ConviteVinculoAceite />} />
      <Route path="/convite-admin/:token" element={<ConviteAdminAceite />} />
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
            <AdminPointInicio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/aluno"
        element={
          <ProtectedRoute>
            <AdminPointAluno />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/aluno/convidar"
        element={
          <ProtectedRoute>
            <AdminPointConvidarAluno />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/professor"
        element={
          <ProtectedRoute>
            <AdminPointProfessor />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/professor/convidar"
        element={
          <ProtectedRoute>
            <AdminPointConvidarProfessor />
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
        path="/admin-point/turmas"
        element={
          <ProtectedRoute>
            <AdminPointTurmas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/ocupacao"
        element={
          <ProtectedRoute>
            <AdminPointOcupacao />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/agenda"
        element={
          <ProtectedRoute>
            <AdminPointAgenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/perfil"
        element={
          <ProtectedRoute>
            <AdminPointPerfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/mais"
        element={
          <ProtectedRoute>
            <AdminPointVerMais />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/meu-point"
        element={
          <ProtectedRoute>
            <AdminPointMeuPoint />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/configuracoes/prazos"
        element={
          <ProtectedRoute>
            <AdminPointPrazos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/configuracoes/horarios"
        element={
          <ProtectedRoute>
            <AdminPointHorariosFuncionamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/configuracoes/modalidades"
        element={
          <ProtectedRoute>
            <AdminPointModalidades />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/configuracoes/quadras"
        element={
          <ProtectedRoute>
            <AdminPointQuadras />
          </ProtectedRoute>
        }
      />
      <Route
        path="/admin-point/configuracoes/planos"
        element={
          <ProtectedRoute>
            <AdminPointPlanos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor"
        element={
          <ProtectedRoute>
            <ProfessorInicio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/agenda"
        element={
          <ProtectedRoute>
            <ProfessorAgenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/ocupacao"
        element={
          <ProtectedRoute>
            <ProfessorOcupacao />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/turmas"
        element={
          <ProtectedRoute>
            <ProfessorTurmas />
          </ProtectedRoute>
        }
      />
      <Route
        path="/professor/perfil"
        element={
          <ProtectedRoute>
            <ProfessorPerfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno"
        element={
          <ProtectedRoute>
            <AlunoInicio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/agenda"
        element={
          <ProtectedRoute>
            <AlunoAgenda />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/agendar"
        element={
          <ProtectedRoute>
            <AlunoNovoAgendamento />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/creditos"
        element={
          <ProtectedRoute>
            <AlunoCreditos />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/creditos/comprar"
        element={
          <ProtectedRoute>
            <AlunoComprarAvulsa />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/creditos/:creditoId/reagendar"
        element={
          <ProtectedRoute>
            <AlunoReagendarCredito />
          </ProtectedRoute>
        }
      />
      <Route
        path="/aluno/perfil"
        element={
          <ProtectedRoute>
            <AlunoPerfil />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dono-app"
        element={
          <ProtectedRoute>
            <DonoAppInicio />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dono-app/points"
        element={
          <ProtectedRoute>
            <DonoAppPoints />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dono-app/perfil"
        element={
          <ProtectedRoute>
            <DonoAppPerfil />
          </ProtectedRoute>
        }
      />
    </Routes>
  );
}
