import type { CreditoStatus, MatriculaStatus, PagamentoStatus, VinculoStatus } from "../api/types";

type Status = VinculoStatus | MatriculaStatus | PagamentoStatus | CreditoStatus;

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
};

export function StatusPill({ status }: { status: Status }) {
  return <span className={`status-pill status-${TONE[status]}`}>{LABEL[status]}</span>;
}
