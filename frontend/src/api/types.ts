export type ModeloRepasse = "percentual" | "valor_fixo_mensal" | "valor_fixo_por_aula";
export type VinculoStatus = "pendente" | "ativo" | "inativo" | "recusado";
export type MatriculaStatus = "em_analise" | "ativa" | "recusada" | "cancelada";
export type MatriculaTipo = "avulsa" | "mensal";
export type PagamentoMeio = "pix" | "dinheiro";
export type PagamentoStatus = "pendente" | "confirmado" | "estornado";

export interface PointResumo {
  id: number;
  nome: string;
  endereco: string;
}

export interface ProfessorResumo {
  id: number;
  nome: string;
  contato: string;
  email: string | null;
  modalidades: string[];
}

export interface AlunoResumo {
  id: number;
  nome: string;
  contato: string;
  email: string | null;
  forma_pagamento_preferida: PagamentoMeio | "wellhub" | "totalpass";
}

export interface Vinculo {
  id: number;
  professor_id: number;
  point_id: number;
  preco_avulso: number;
  preco_plano: number;
  modelo_repasse: ModeloRepasse;
  valor_repasse: number;
  status: VinculoStatus;
  professor: ProfessorResumo;
  point: PointResumo;
}

export interface TurmaResumo {
  id: number;
  vinculo_id: number;
  modalidade: string;
  quadra: string;
  capacidade: number;
  dia_semana: string;
  horario: string;
  recorrencia: string;
  vinculo: Vinculo;
}

export interface PagamentoResumo {
  id: number;
  valor: number;
  meio: PagamentoMeio;
  status: PagamentoStatus;
  registrado_por_id: number | null;
}

export interface Pagamento extends PagamentoResumo {
  matricula_id: number;
  aluno_nome: string;
  turma_modalidade: string;
}

export interface Matricula {
  id: number;
  aluno_id: number;
  turma_id: number;
  tipo: MatriculaTipo;
  status: MatriculaStatus;
  fonte_pagamento: PagamentoMeio;
  aluno: AlunoResumo;
  turma: TurmaResumo;
  pagamentos: PagamentoResumo[];
}
