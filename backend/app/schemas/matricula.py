from datetime import date

from app.models.enums import MatriculaStatus, MatriculaTipo, ModeloRepasse, PagamentoMeio
from app.schemas.aluno import AlunoOut
from app.schemas.common import ORMModel
from app.schemas.pagamento import PagamentoResumo
from app.schemas.turma import TurmaOut


class MatriculaCreate(ORMModel):
    turma_id: int
    tipo: MatriculaTipo
    fonte_pagamento: PagamentoMeio
    # Obrigatório pra avulsa (pedido do usuário, 2026-08-26: "abre o
    # calendário de dias, seleciona o horário e confirma a compra") — o
    # router valida isso; nulo/ignorado pra mensal, que não usa data única.
    data_aula: date | None = None


class RepasseOverrideUpdate(ORMModel):
    """None em ambos os campos remove a exceção — volta a usar o padrão do
    Vínculo (seção 3.2)."""

    modelo: ModeloRepasse | None
    valor: float | None


class MatriculaOut(ORMModel):
    id: int
    aluno_id: int
    turma_id: int
    tipo: MatriculaTipo
    status: MatriculaStatus
    fonte_pagamento: PagamentoMeio
    aluno: AlunoOut
    turma: TurmaOut
    pagamentos: list[PagamentoResumo] = []
    repasse_override_modelo: ModeloRepasse | None
    repasse_override_valor: float | None
    # Datas que o aluno cancelou com antecedência nessa matrícula (pedido do
    # usuário, 2026-08-20) — o frontend soma com turma.excecoes pra montar
    # a agenda certa (a turma continua rodando pros outros alunos).
    excecoes: list[date] = []
    # Início real dessa matrícula pro aluno (pedido do usuário, 2026-08-21)
    # — pode ser depois do periodo_inicio da Turma, se a Assinatura começou
    # mais tarde que a turma já vinha rodando pra outros alunos.
    data_inicio_efetiva: date
    # Dias que ESSE aluno frequenta dentro da turma (pedido do usuário,
    # 2026-08-21) — subconjunto de turma.dias_semana; só matrícula mensal
    # usa isso, avulsa fica com a lista vazia.
    dias_semana: list[str] = []
    # Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21): se
    # já tem pagamento confirmado do mês corrente (mensal) ou de qualquer
    # pagamento confirmado (avulsa, sem mês).
    mes_atual_pago: bool = False
    # Deve o mês anterior (pedido do usuário, 2026-08-21) — trava a geração
    # de aula nova do mês (gerar_aulas_do_mes) até regularizar.
    inadimplente: bool = False
    # Pagamento do período atual lançado mas ainda não confirmado pelo admin
    # (pedido do usuário, 2026-08-21) — Pix também passa por conferência
    # manual agora, não confirma mais sozinho na hora.
    pagamento_pendente_atual: bool = False
