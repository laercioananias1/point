"""Carregamento em lote das listas de turmas e matrículas (pedido do
usuário, 2026-10-02: "to achando um pouquinho lento as telas", sobretudo
depois que a produção passou pro MySQL compartilhado).

Sem isso, serializar uma lista de matrículas buscava aluno, turma,
modalidade, quadra, professor, pagamentos... um por um, item a item
(~120 consultas pra uma lista pequena). Com `selectinload`, cada
relacionamento vira UMA consulta pra lista inteira. Usado nas listas que
as telas pedem com mais frequência."""

from sqlalchemy.orm import selectinload

from app.models.assinatura import Assinatura
from app.models.matricula import Matricula
from app.models.professor import Professor
from app.models.turma import Turma
from app.models.vinculo import Vinculo


def opcoes_turma(caminho=None) -> list:
    """Tudo que TurmaOut lê. `caminho` = loader até a turma (pra usar a
    partir da matrícula)."""

    def rel(atributo):
        return caminho.selectinload(atributo) if caminho is not None else selectinload(atributo)

    vinculo = rel(Turma.vinculo)
    return [
        rel(Turma.modalidade),
        rel(Turma.quadra),
        rel(Turma.categoria),
        rel(Turma.tipo_turma),
        rel(Turma.excecoes_rel),
        rel(Turma.dias_semana_rel),
        vinculo.selectinload(Vinculo.point),
        vinculo.selectinload(Vinculo.professor).selectinload(Professor.user),
    ]


def opcoes_matricula() -> list:
    """Tudo que MatriculaOut lê (inclusive a turma inteira)."""
    return [
        selectinload(Matricula.aluno),
        selectinload(Matricula.pagamentos),
        selectinload(Matricula.excecoes_rel),
        selectinload(Matricula.dias_semana_rel),
        selectinload(Matricula.cancelado_por),
        selectinload(Matricula.assinatura).selectinload(Assinatura.plano),
        *opcoes_turma(selectinload(Matricula.turma)),
    ]
