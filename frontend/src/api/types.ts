export type ModeloRepasse = "percentual" | "valor_fixo_mensal" | "valor_fixo_por_aula";
export type VinculoStatus = "pendente" | "ativo" | "inativo" | "recusado";
export type MatriculaStatus = "em_analise" | "ativa" | "recusada" | "cancelada";
export type MatriculaTipo = "avulsa" | "mensal";
export type PagamentoMeio = "pix" | "dinheiro";
export type PagamentoStatus = "pendente" | "confirmado" | "estornado";
export type CreditoMotivo = "forca_maior" | "cancelamento_aluno";
export type CreditoStatus = "disponivel" | "usado" | "expirado";
export type PeriodoDia = "manha" | "tarde" | "noite";

export interface PointResumo {
  id: number;
  nome: string;
  endereco: string;
}

export interface Modalidade {
  id: number;
  point_id: number;
  nome: string;
  duracao_padrao_minutos: number;
}

export interface Quadra {
  id: number;
  point_id: number;
  nome: string;
  modalidades: Modalidade[];
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
  modalidade: Modalidade;
  quadra: Quadra;
  capacidade: number;
  dia_semana: string;
  horario: string;
  duracao_minutos: number;
  recorrencia: string;
  periodo_inicio: string;
  periodo_fim: string;
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

export interface Credito {
  id: number;
  matricula_id: number;
  motivo: CreditoMotivo;
  data_aula: string;
  data_expiracao: string;
  status: CreditoStatus;
  nova_matricula_id: number | null;
}

export interface RepasseFechamento {
  professor_id: number;
  professor_nome: string;
  valor: number;
}

export interface Fechamento {
  id: number;
  point_id: number;
  periodo_inicio: string;
  periodo_fim: string;
  taxa_servico_unitaria: number;
  quantidade_pagamentos: number;
  total_taxa_servico: number;
  repasses: RepasseFechamento[];
}

export interface PointRanking {
  point_id: number;
  nome: string;
  professores_ativos: number;
  alunos_ativos: number;
  total_taxa_servico: number;
  total_repassado: number;
}

export interface Plano {
  id: number;
  point_id: number;
  frequencia_semanal: number;
  preco: number;
}

export interface Assinatura {
  id: number;
  aluno: AlunoResumo;
  point_id: number;
  modalidade: Modalidade;
  frequencia_semanal_desejada: number;
  periodo_dia_desejado: PeriodoDia;
  fonte_pagamento: PagamentoMeio;
  status: MatriculaStatus;
  plano: Plano | null;
  data_inicio: string | null;
  turmas: TurmaResumo[];
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
  repasse_override_modelo: ModeloRepasse | null;
  repasse_override_valor: number | null;
}
