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
  // Cor de destaque do Point (pedido do usuário, 2026-09-14) — nula = usa
  // a cor padrão do sistema. Ver lib/cor.ts.
  cor_destaque: string | null;
  // Token do link público de aula experimental (pedido do usuário,
  // 2026-09-14: "nao identificar o id na url") — usa isso em vez do id
  // sequencial na URL /experimental/....
  link_experimental: string;
}

// Resolução do Point do usuário logado pra mostrar no cabeçalho (pedido
// do usuário, 2026-08-30: "logomarca... no canto esquerdo", pra todo
// mundo) — ver GET /points/meu-logo e components/Layout.tsx.
export interface PointLogo {
  point_id: number | null;
  nome: string | null;
  logo: string | null;
  cor_destaque: string | null;
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
  cor_destaque: string | null;
  link_experimental: string;
}

export interface Checkin {
  id: number;
  turma_id: number;
  matricula_id: number | null;
  // Presença de visitante de aula experimental aprovada (pedido do
  // usuário, 2026-09-15: "quase um aluno, só não tem senha").
  solicitacao_experimental_id: number | null;
  aluno_nome: string | null;
  data_hora: string;
  origem: "presumido" | "totalpass" | "wellhub" | "experimental";
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

// Tipo/formato de turma cadastrado pelo Point (pedido do usuário,
// 2026-09-09) — ex.: "Padrão", "Aula individual", "Dupla", "Família". Só
// etiqueta organizacional — o flag de turma privada é independente, fica
// em Turma.privada, não aqui.
export interface TipoTurma {
  id: number;
  point_id: number;
  nome: string;
}

// Nível de aluno cadastrado pelo Point (pedido do usuário, 2026-09-08) — ex.:
// "Iniciante", "Intermediário", "Avançado". Cor pra identificar na agenda;
// Turma fica exclusiva de uma Categoria.
export interface Categoria {
  id: number;
  point_id: number;
  nome: string;
  cor: string; // "#rrggbb"
}

// Classificação do aluno POR Point (pedido do usuário, 2026-09-08) — Aluno é
// global, Categoria é cadastrada por Point, então não dá pra ter um campo
// direto e único no Aluno (ver AlunoCategoria no backend).
export interface AlunoCategoria {
  id: number;
  aluno_id: number;
  point_id: number;
  categoria: Categoria;
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
  foto?: string | null;
}

export interface AlunoResumo {
  id: number;
  nome: string;
  contato: string;
  email: string | null;
  forma_pagamento_preferida: PagamentoMeio;
  foto?: string | null;
}

export interface Vinculo {
  id: number;
  professor_id: number;
  point_id: number;
  status: VinculoStatus;
  professor: ProfessorResumo;
  point: PointResumo;
}

// Data + motivo de uma aula cancelada por força maior (pedido do usuário,
// 2026-09-01: "o cancelar aula do professor ou adm precisa dar um
// motivo... essa informação precisa aparecer no calendário com um ícone
// tb de cancelamento e mostrar motivo") — `excecoes` (só as datas)
// continua existindo pra quem só precisa filtrar ocorrência.
export interface TurmaCancelamento {
  data: string;
  motivo: string | null;
}

export interface TurmaResumo {
  id: number;
  vinculo_id: number;
  modalidade: Modalidade;
  quadra: Quadra;
  categoria: Categoria;
  tipo_turma: TipoTurma;
  privada: boolean;
  aula_experimental: ExperimentalConfig;
  capacidade: number;
  dias_semana: string[];
  horario: string;
  duracao_minutos: number;
  recorrencia: string;
  periodo_inicio: string;
  periodo_fim: string | null;
  excecoes: string[];
  cancelamentos: TurmaCancelamento[];
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

// Histórico de cancelamentos (pedido do usuário, 2026-09-01: "sim,
// inclusive coloca usuario q fez acao" / "e datahora") — ver GET
// /matriculas/historico.
export type HistoricoEventoTipo =
  | "aula_cancelada"
  | "matricula_cancelada"
  | "assinatura_cancelada"
  | "credito_expirado";

export interface HistoricoEvento {
  tipo: HistoricoEventoTipo;
  data_hora: string;
  aluno_id: number;
  aluno_nome: string;
  modalidade_nome: string;
  detalhe: string;
  cancelado_por_nome: string | null;
}

// Feriado nacional (calculado) ou local (cadastrado pelo admin) — pedido
// do usuário, 2026-09-01: "preciso ter um cadastro de feriados... o
// sistema nesse caso não pode criar [aula] nesses dias". id null =
// nacional (não é uma linha no banco, só dá pra remover quando não é
// null).
export interface Feriado {
  id: number | null;
  data: string;
  nome: string;
  nacional: boolean;
}

export type CobrancaStatus = "aberta" | "paga";

export interface Cobranca {
  id: number;
  aluno_id: number;
  aluno_nome: string;
  descricao: string;
  valor: number;
  vencimento: string;
  status: CobrancaStatus;
  atrasada: boolean;
  pago_em: string | null;
  recorrente: boolean;
  turma_ids: number[];
}

export interface CobrancaAluno {
  id: number;
  nome: string;
}

export type LancamentoTipo = "entrada" | "saida";

export interface LancamentoCaixa {
  id: number;
  tipo: LancamentoTipo;
  descricao: string;
  valor: number;
  data: string;
  conta_id: number | null;
  conta_nome: string | null;
  automatico: boolean;
  fixo_id: number | null;
  fixo_ativo: boolean;
}

export interface ContaCaixa {
  id: number;
  nome: string;
}

export interface RelatorioMes {
  mes: string;
  receita: number;
  despesa: number;
}

export interface RelatorioResumo {
  alunos_ativos: number;
  turmas: number;
  recebido_mes: number;
  alunos_inadimplentes: number;
  inadimplencia_pct: number;
  serie_mensal: RelatorioMes[];
  entrou: number;
  saiu: number;
  a_receber: number;
  atrasado: number;
  saldo: number;
}

export interface PointRanking {
  point_id: number;
  nome: string;
  professores_ativos: number;
  alunos_ativos: number;
  // Soma das entradas do Caixa do Point.
  total_recebido: number;
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
  // Obrigatório (pedido do usuário, 2026-09-11) — o convite sempre sai
  // por WhatsApp também, além do e-mail.
  celular: string;
  point: PointResumo;
  // Convite avulso (pedido do usuário, 2026-09-11) — só entra na
  // plataforma, sem assinatura nenhuma; os campos abaixo vêm todos null.
  avulso: boolean;
  modalidade: Modalidade | null;
  plano: Plano | null;
  // Wellhub/TotalPass mostra o benefício em vez do preço na tela de aceite
  // (pedido do usuário, 2026-09-01) — quem paga é o benefício, não o
  // aluno via Pix pro Point.
  fonte_pagamento: PagamentoMeio | null;
  turmas: ConviteTurmaEscolha[];
  data_inicio: string | null;
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
  // Distingue "Aula Avulsa" (compra direta) de "Aula de Reposição" (nasceu
  // de um crédito reagendado) — pedido do usuário, 2026-09-01: ícones
  // diferentes no calendário do aluno. Sempre false pra mensal.
  e_reposicao: boolean;
}

export type NotificacaoTipo = "cancelamento_aula" | "solicitacao_experimental";

// Programa de aula experimental (pedido do usuário, 2026-09-14) — "aceita"
// é turma normal que também abre vaga livre pra visitante experimentar;
// "somente" é dedicada só a isso, sem matrícula normal.
export type ExperimentalConfig = "nao" | "aceita" | "somente";

export type SolicitacaoExperimentalStatus = "pendente" | "aprovada" | "recusada";

// Versão pública da Turma pra página de aula experimental — sem contato
// do professor, só o nome (ver backend schemas/solicitacao_experimental.py).
export interface TurmaExperimental {
  id: number;
  modalidade: Modalidade;
  quadra: Quadra;
  categoria: Categoria;
  professor_nome: string;
  dias_semana: string[];
  horario: string;
  duracao_minutos: number;
}

export interface DisponibilidadeDia {
  data: string;
  disponivel: boolean;
}

export interface TurmaExperimentalAgenda extends TurmaExperimental {
  proximas_datas: DisponibilidadeDia[];
}

export interface SolicitacaoExperimental {
  id: number;
  turma: TurmaExperimental;
  point: PointResumo;
  data: string;
  nome: string;
  email: string;
  celular: string;
  tem_raquete: boolean;
  status: SolicitacaoExperimentalStatus;
  motivo_recusa: string | null;
  created_at: string;
  decidido_em: string | null;
}

export interface Notificacao {
  id: number;
  tipo: NotificacaoTipo;
  titulo: string;
  mensagem: string;
  lida: boolean;
  created_at: string;
}
