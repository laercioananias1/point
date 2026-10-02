"""Aula avulsa comprada com Pix (pedido do usuário, 2026-10-02: "segura a
vaga por um tempo").

Na compra, com o Point recebendo online: a matrícula nasce
AGUARDANDO_PAGAMENTO (ocupa a vaga, ver aulas.vagas_ocupadas_em), com uma
cobrança no valor da avulsa e um Pix que vale PRAZO_PIX. Pagou ->
cobrancas.marcar_paga confirma a matrícula. Não pagou -> `expirar_reservas`
(job a cada 2 minutos) cancela a reserva e apaga a cobrança, depois de
conferir uma última vez no gateway."""

from datetime import date, datetime, timedelta

from sqlalchemy.orm import Session

from app.models.cobranca import Cobranca
from app.models.enums import CobrancaStatus, MatriculaStatus
from app.models.matricula import Matricula
from app.services.pix_cobranca import conferir_pix, garantir_pix

# O gateway aceita Pix a partir de 30 minutos de validade.
PRAZO_PIX = timedelta(minutes=30)
# Folga depois do Pix vencer antes de soltar a vaga (aviso atrasado).
FOLGA_RESERVA = timedelta(minutes=3)


def reservar_com_pix(db: Session, matricula: Matricula, *, valor: float, descricao: str) -> Cobranca:
    """Põe a matrícula (já adicionada à sessão) em reserva e cria a
    cobrança + Pix. Sem commit; GatewayErro sobe pra quem chamou desfazer."""
    agora = datetime.now()
    pagar_ate = agora + PRAZO_PIX
    matricula.status = MatriculaStatus.AGUARDANDO_PAGAMENTO
    matricula.reserva_expira_em = pagar_ate + FOLGA_RESERVA
    db.flush()
    cobranca = Cobranca(
        point_id=matricula.turma.vinculo.point_id,
        aluno_id=matricula.aluno_id,
        descricao=descricao[:120],
        valor=valor,
        vencimento=date.today(),
        status=CobrancaStatus.ABERTA,
        matricula_id=matricula.id,
        pagar_ate=pagar_ate,
    )
    db.add(cobranca)
    db.flush()
    garantir_pix(db, cobranca)
    return cobranca


def expirar_reservas(db: Session, agora: datetime | None = None) -> int:
    """Cancela as reservas vencidas (com commit). Devolve quantas."""
    agora = agora or datetime.now()
    vencidas = (
        db.query(Matricula)
        .filter(
            Matricula.status == MatriculaStatus.AGUARDANDO_PAGAMENTO,
            Matricula.reserva_expira_em < agora,
        )
        .all()
    )
    canceladas = 0
    for matricula in vencidas:
        cobranca = db.query(Cobranca).filter(Cobranca.matricula_id == matricula.id).first()
        if cobranca is not None and conferir_pix(db, cobranca):
            # Pagou no último minuto: marcar_paga já confirmou a aula.
            db.commit()
            continue
        matricula.status = MatriculaStatus.CANCELADA
        matricula.cancelado_em = agora
        matricula.reserva_expira_em = None
        if cobranca is not None and cobranca.status == CobrancaStatus.ABERTA:
            db.delete(cobranca)
        db.commit()
        canceladas += 1
    return canceladas
