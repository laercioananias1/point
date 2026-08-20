import type { MatriculaStatus, VinculoStatus } from "../api/types";

const TONE: Record<VinculoStatus | MatriculaStatus, "good" | "warn" | "risk"> = {
  ativo: "good",
  ativa: "good",
  pendente: "warn",
  em_analise: "warn",
  inativo: "risk",
  recusado: "risk",
  recusada: "risk",
  cancelada: "risk",
};

const LABEL: Record<VinculoStatus | MatriculaStatus, string> = {
  ativo: "Ativo",
  ativa: "Ativa",
  pendente: "Pendente",
  em_analise: "Em análise",
  inativo: "Inativo",
  recusado: "Recusado",
  recusada: "Recusada",
  cancelada: "Cancelada",
};

export function StatusPill({ status }: { status: VinculoStatus | MatriculaStatus }) {
  return <span className={`status-pill status-${TONE[status]}`}>{LABEL[status]}</span>;
}
