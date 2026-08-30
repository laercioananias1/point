import type { CreditoStatus, MatriculaStatus, PagamentoStatus, VinculoStatus } from "../api/types";

// "em_atraso"/"realizada"/"agendada" não são status reais de nenhum enum —
// são pseudo-status só pra UI (pedido do usuário, 2026-08-21: badge de
// mensalidade em atraso, e status de cada aula no extrato de pagamento).
type Status =
  | VinculoStatus
  | MatriculaStatus
  | PagamentoStatus
  | CreditoStatus
  | "em_atraso"
  | "realizada"
  | "agendada";

const TONE: Record<Status, "good" | "warn" | "risk"> = {
  ativo: "good",
  ativa: "good",
  confirmado: "good",
  disponivel: "good",
  usado: "good",
  pendente: "warn",
  em_analise: "warn",
  inativo: "risk",
  recusado: "risk",
  recusada: "risk",
  cancelada: "risk",
  estornado: "risk",
  expirado: "risk",
  em_atraso: "risk",
  realizada: "good",
  agendada: "warn",
};

const LABEL: Record<Status, string> = {
  ativo: "Ativo",
  ativa: "Ativa",
  confirmado: "Pago",
  disponivel: "Disponível",
  usado: "Usado",
  pendente: "Pendente",
  em_analise: "Em análise",
  inativo: "Inativo",
  recusado: "Recusado",
  recusada: "Recusada",
  cancelada: "Cancelada",
  estornado: "Estornado",
  expirado: "Expirado",
  em_atraso: "Em atraso",
  realizada: "Realizada",
  agendada: "Agendada",
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill status-${TONE[status]}`}>{LABEL[status]}</span>;
}
