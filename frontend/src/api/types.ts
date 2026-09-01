export type ModeloRepasse = "percentual" | "valor_fixo_mensal" | "valor_fixo_por_aula";
export type VinculoStatus = "pendente" | "ativo" | "inativo" | "recusado";
export type MatriculaStatus = "em_analise" | "ativa" | "recusada" | "cancelada";
export type MatriculaTipo = "avulsa" | "mensal";
export type PagamentoMeio = "pix" | "dinheiro" | "wellhub" | "totalpass";
export type PagamentoStatus = "pendente" | "confirmado" | "estornado";
export type CreditoMotivo = "forca_maior" | "cancelamento_aluno";
export type CreditoStatus = "disponivel" | "usado" | "expirado";
export type PeriodoDia = "manha" | "tarde" | "noite";

export interface PointResumo {
  id: number;
  nome: string;
  endereco: string;
  dias_semana_funcionamento: string[];
  horarios_semana_funcionamento: string[];
  dias_fds_funcionamento: string[];
  horarios_fds_funcionamento: string[];
  prazo_cancelamento_horas: number;
  // Perfil do Point pra Início do aluno (pedido do usuário, 2026-08-30).
  sobre: string | null;
  informacoes_importantes: string | null;
  fotos: string[];
  anuncios: string | null;
  banners: string[];
  logo: string | null;
}

// Resolução do Point do usuário logado pra mostrar no cabeçalho (pedido
// do usuário, 2026-08-30: "logomarca... no canto esquerdo", pra todo
// mundo) — ver GET /points/meu-logo e components/Layout.tsx.
export interface PointLogo {
  point_id: number | null;
  nome: string | null;
  logo: string | null;
}

export interface Point {
  id: number;
  nome: string;
  endereco: string;
  formas_pagamento_habilitadas: string[];
  prazo_credito_dias: number;
  prazo_cancelamento_horas: number;
  // Dia do mês em que a mensalidade vence (pedido do usuário, 2026-08-21) —
  // 1 a 28, cada Point define o seu. Padrão 10.
  dia_vencimento_mensalidade: number;
  dias_semana_funcionamento: string[];
  horarios_semana_funcionamento: string[];
  dias_fds_funcionamento: string[];
  horarios_fds_funcionamento: string[];
  // Credencial TotalPass/Wellhub desse Point (pedido do usuário,
  // 2026-08-25) — nula até o admin configurar em Configurações.
  place_api_key: string | null;
  // Perfil do Point (pedido do usuário, 2026-08-30: "Meu Point... Sobre,
  // informações importantes, até 5 fotos") — aparece na Início do aluno.
  sobre: string | null;
  informacoes_importantes: string | null;
  fotos: string[];
  anuncios: string | null;
  banners: string[];
  logo: string | null;
}

export interface Checkin {
  id: number;
  turma_id: number;
  matricula_id: number | null;
  aluno_nome: string | null;
  data_hora: string;
  origem: "presumido" | "totalpass" | "wellhub";
  status: "confirmado" | "pendente_atribuicao";
  beneficiario_nome: string | null;
  beneficiario_documento: string | null;
}

export interface Modalidade {
  id: number;
  point_id: number;
  nome: string;
  duracao_padrao_minutos: number;
  preco_avulso: number;
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
  email: string;
  modalidades: string[];
}

export interface AlunoResumo {
  id: number;
  nome: string;
  contato: string;
  email: string | null;
  forma_pagamento_preferida: PagamentoMeio;
}

export interface Vinculo {
  id: number;
  professor_id: number;
  point_id: number;
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
  dias_semana: string[];
  horario: string;
  duracao_minutos: number;
  recorrencia: string;
  periodo_inicio: string;
  periodo_fim: string | null;
  excecoes: string[];
  vinculo: Vinculo;
}

export interface AulaCoberta {
  data: string;
  status: "realizada" | "agendada" | "cancelada";
}

export interface PagamentoResumo {
  id: number;
  valor: number;
  meio: PagamentoMeio;
  status: PagamentoStatus;
  registrado_por_id: number | null;
  // Mês que esse pagamento cobre (pedido do usuário, 2026-08-21) — só
  // matrícula mensal usa isso; avulsa fica null.
  mes_referencia: string | null;
  // Extrato: as aulas do mês cobertas por este pagamento (pedido do
  // usuário, 2026-08-21) — vazio pra avulsa.
  aulas_cobertas: AulaCoberta[];
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
  // Reagendamento fica restrito ao mesmo professor da aula original
  // (pedido do usuário, 2026-08-25) — usado pra já buscar só as turmas dele.
  professor_id: number;
  professor_nome: string;
  modalidade_nome: string;
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
  // Calculada na hora, direto dos pagamentos confirmados (pedido do
  // usuário, 2026-08-26) — não depende de fechamento já ter rodado.
  total_taxa_servico: number;
  // Só o que já passou por um fechamento gerado — dinheiro reconciliado.
  total_repassado: number;
  // Soma bruta de pagamento confirmado desse Point, sem entrar em taxa/
  // repasse — visão de volume mesmo sem nenhum fechamento gerado.
  total_pago_confirmado: number;
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
  turmas: ConviteTurmaEscolha[];
}

export type ConviteStatus = "pendente" | "aceito" | "cancelado";

export interface ConviteTurmaEscolha {
  turma: TurmaResumo;
  dias_semana: string[];
}

export interface Convite {
  id: number;
  token: string;
  nome: string;
  email: string;
  point: PointResumo;
  modalidade: Modalidade;
  plano: Plano;
  turmas: ConviteTurmaEscolha[];
  data_inicio: string;
  status: ConviteStatus;
  expira_em: string;
  expirado: boolean;
  aluno_ja_cadastrado: boolean;
}

export interface ConviteVinculo {
  id: number;
  token: string;
  nome: string;
  celular: string;
  email: string;
  point: PointResumo;
  modelo_repasse: ModeloRepasse;
  valor_repasse: number;
  status: ConviteStatus;
  expira_em: string;
  expirado: boolean;
  professor_ja_cadastrado: boolean;
}

export interface ConviteAdmin {
  id: number;
  token: string;
  nome: string;
  celular: string;
  email: string;
  point: PointResumo;
  status: ConviteStatus;
  expira_em: string;
  expirado: boolean;
  admin_ja_cadastrado: boolean;
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
  // Datas que o próprio aluno cancelou com antecedência nessa matrícula
  // (pedido do usuário, 2026-08-20) — soma com turma.excecoes na agenda.
  excecoes: string[];
  // Início real pro aluno (pedido do usuário, 2026-08-21) — pode ser depois
  // do periodo_inicio da turma, se a assinatura começou mais tarde.
  data_inicio_efetiva: string;
  // Dias da semana que ESSE aluno frequenta dentro da turma (pedido do
  // usuário, 2026-08-21) — subconjunto de turma.dias_semana; outros alunos
  // na mesma turma podem ter dias diferentes.
  dias_semana: string[];
  // Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21): se já
  // tem pagamento confirmado do mês corrente (mensal) ou de qualquer
  // pagamento confirmado (avulsa, sem mês).
  mes_atual_pago: boolean;
  // Deve o mês anterior (pedido do usuário, 2026-08-21) — trava a geração
  // de aula nova do mês até regularizar.
  inadimplente: boolean;
  // Pagamento do período atual lançado mas ainda não confirmado pelo admin
  // (pedido do usuário, 2026-08-21) — Pix também passa por conferência
  // manual agora.
  pagamento_pendente_atual: boolean;
  // Preço da mensalidade, vindo do Plano da assinatura (pedido do usuário,
  // 2026-09-01) — null pra avulsa, que não tem mensalidade recorrente.
  valor_mensalidade: number | null;
}
