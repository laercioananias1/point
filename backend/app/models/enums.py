"""Enums compartilhados pelo modelo de dados.

Espelham o vocabulário do documento de produto (seção 3). Onde o documento não
precisa de um estado explícito, mantemos o enum enxuto — extensões (ex.: status de
Vínculo com fluxo de aprovação) estão comentadas no ponto onde aparecem.
"""

import enum


class Role(str, enum.Enum):
    SUPER_ADMIN = "super_admin"
    ADMIN_POINT = "admin_point"
    PROFESSOR = "professor"
    ALUNO = "aluno"


class FormaPagamento(str, enum.Enum):
    PIX = "pix"
    DINHEIRO = "dinheiro"
    WELLHUB = "wellhub"
    TOTALPASS = "totalpass"


class ModeloRepasse(str, enum.Enum):
    PERCENTUAL = "percentual"
    VALOR_FIXO_MENSAL = "valor_fixo_mensal"
    VALOR_FIXO_POR_AULA = "valor_fixo_por_aula"


class VinculoStatus(str, enum.Enum):
    # "pendente" cobre o intervalo entre o professor solicitar o vínculo e o
    # admin do Point aprovar — o documento (seção 4.1) fala em aprovação, então
    # o vínculo não pode nascer direto como "ativo".
    PENDENTE = "pendente"
    ATIVO = "ativo"
    INATIVO = "inativo"
    RECUSADO = "recusado"


class MatriculaTipo(str, enum.Enum):
    AVULSA = "avulsa"
    MENSAL = "mensal"


class MatriculaStatus(str, enum.Enum):
    EM_ANALISE = "em_analise"
    ATIVA = "ativa"
    RECUSADA = "recusada"
    CANCELADA = "cancelada"


class PagamentoMeio(str, enum.Enum):
    PIX = "pix"
    DINHEIRO = "dinheiro"
    # BENEFICIO entra na Fase 2 (integração Wellhub/TotalPass, seção 5)


class PagamentoStatus(str, enum.Enum):
    PENDENTE = "pendente"
    CONFIRMADO = "confirmado"
    ESTORNADO = "estornado"


class CreditoMotivo(str, enum.Enum):
    FORCA_MAIOR = "forca_maior"
    CANCELAMENTO_ALUNO = "cancelamento_aluno"


class CreditoStatus(str, enum.Enum):
    DISPONIVEL = "disponivel"
    USADO = "usado"
    EXPIRADO = "expirado"


class CheckinOrigem(str, enum.Enum):
    PRESUMIDO = "presumido"
    # WELLHUB e TOTALPASS entram na Fase 2 (seção 5.4 do plano de arquitetura)


class CheckinStatus(str, enum.Enum):
    CONFIRMADO = "confirmado"
    PENDENTE_ATRIBUICAO = "pendente_atribuicao"


class PeriodoDia(str, enum.Enum):
    """Faixa de horário preferida pelo aluno ao declarar interesse numa
    Assinatura — usada pelo admin pra filtrar quais Turmas oferecer na hora
    de ativar (pedido do usuário, 2026-08-19)."""

    MANHA = "manha"
    TARDE = "tarde"
    NOITE = "noite"
