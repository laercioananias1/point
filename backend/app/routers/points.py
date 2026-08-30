from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.core.deps import get_current_user, require_role
from app.core.security import create_access_token
from app.models.enums import MatriculaStatus, PagamentoStatus, Role, VinculoStatus
from app.models.fechamento import Fechamento
from app.models.matricula import Matricula
from app.models.pagamento import Pagamento
from app.models.point import DIAS_FIM_DE_SEMANA, DIAS_UTEIS, HORARIOS_PADRAO, Point
from app.models.turma import Turma
from app.models.user import User
from app.models.vinculo import Vinculo
from app.schemas.auth import TokenResponse
from app.schemas.point import (
    PointConfiguracoesUpdate,
    PointCreate,
    PointLogoOut,
    PointOut,
    PointPerfilUpdate,
    PointRankingOut,
    PointResumo,
)
from app.services.configuracao import get_ou_criar_configuracao
from app.services.uploads import TAMANHO_MAXIMO_BYTES, remover_imagem_point, salvar_imagem_point

router = APIRouter(prefix="/points", tags=["points"])


@router.get("/meu-logo", response_model=PointLogoOut)
def meu_point_logo(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> PointLogoOut:
    """Resolve o Point do usuário logado, seja qual for o papel (pedido do
    usuário, 2026-08-30: "logomarca... pra todo mundo (admin, professor,
    aluno)... no canto esquerdo") — admin_point tem o Point direto
    (user.point_id); professor/aluno podem ter mais de um vínculo/
    matrícula ativa, usa o primeiro encontrado (mesmo critério já usado
    na Início do aluno, pages/aluno/Inicio.tsx). Sem Point resolvido (dono
    do app, ou professor/aluno sem nada ativo ainda), devolve tudo nulo —
    o cabeçalho cai na marca genérica do app nesse caso."""
    point: Point | None = None
    if user.point_id is not None:
        point = db.get(Point, user.point_id)
    elif user.professor_id is not None:
        vinculo = (
            db.query(Vinculo)
            .filter(Vinculo.professor_id == user.professor_id, Vinculo.status == VinculoStatus.ATIVO)
            .first()
        )
        point = vinculo.point if vinculo else None
    elif user.aluno_id is not None:
        matricula = (
            db.query(Matricula)
            .join(Turma, Matricula.turma_id == Turma.id)
            .join(Vinculo, Turma.vinculo_id == Vinculo.id)
            .filter(Matricula.aluno_id == user.aluno_id, Matricula.status == MatriculaStatus.ATIVA)
            .first()
        )
        point = matricula.turma.vinculo.point if matricula else None

    if point is None:
        return PointLogoOut(point_id=None, nome=None, logo=None)
    return PointLogoOut(point_id=point.id, nome=point.nome, logo=point.logo)

# Pedido do usuário, 2026-08-30: "permitir inserir até 5 fotos do point".
MAX_FOTOS_POINT = 5
# Pedido do usuário, 2026-08-30: "anúncios será imagens também, como
# banners" — mesmo limite das fotos, categoria diferente (ver
# app/services/uploads.py::salvar_imagem_point).
MAX_BANNERS_POINT = 5


@router.get("/directorio", response_model=list[PointResumo])
def listar_points_para_vinculo(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(get_current_user)],
) -> list[Point]:
    """Lista enxuta, para o professor escolher um Point ao solicitar vínculo
    (POST /vinculos). Qualquer usuário autenticado pode ver — não expõe dados
    de gestão do Point, só o suficiente para identificá-lo."""
    return db.query(Point).all()


@router.post("", response_model=PointOut, status_code=201)
def criar_point(
    payload: PointCreate,
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> Point:
    # formas_pagamento_habilitadas nasce vazio de propósito: só o dono do app
    # habilita, em uma ação separada (seção 4.1) — nunca no cadastro em si.
    point = Point(**payload.model_dump(), formas_pagamento_habilitadas=[])
    db.add(point)
    db.commit()
    db.refresh(point)
    return point


@router.get("", response_model=list[PointOut])
def listar_points(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> list[Point]:
    return db.query(Point).all()


@router.post("/{point_id}/suporte-login", response_model=TokenResponse)
def entrar_como_admin_do_point(
    point_id: int,
    db: Annotated[Session, Depends(get_db)],
    _dono: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> TokenResponse:
    """Suporte (pedido do usuário, 2026-08-30: "quero nele [adm geral] pra
    fazer suporte poder trocar para o usuário do adm do Point") — o dono
    do app troca de sessão pra virar o admin desse Point, sem precisar
    saber a senha dele. Mesmo mecanismo de token que /auth/login usa; o
    front troca de sessão com esse token (AuthContext.loginComToken),
    igual já faz ao aceitar convite. point_id só é preenchido em User pra
    quem tem o papel admin_point (ver app/models/user.py), então filtrar
    por ele já resolve certo sem precisar checar `roles` de novo."""
    admin = db.query(User).filter(User.point_id == point_id).first()
    if admin is None:
        raise HTTPException(404, "Esse Point não tem um admin cadastrado ainda")

    token = create_access_token({"sub": str(admin.id)})
    return TokenResponse(access_token=token, user=admin)


@router.get("/ranking", response_model=list[PointRankingOut])
def ranking_points(
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> list[PointRankingOut]:
    """Dashboard comparativo entre Points (seção 6.5) — só o dono do app vê
    isso; é a única exceção ao isolamento entre Points (seção 3.1).

    total_taxa_servico e total_pago_confirmado são calculados na hora,
    direto dos pagamentos confirmados (pedido do usuário, 2026-08-26) — não
    dependem de alguém ter rodado um fechamento pra esse Point antes, senão
    um Point com movimento real aparecia com R$0. total_repassado continua
    vindo só dos fechamentos já gerados (dinheiro já reconciliado de
    verdade — não dá pra estimar isso ao vivo sem risco de errar, ver
    schemas/point.py)."""
    config = get_ou_criar_configuracao(db)
    resultado = []
    for point in db.query(Point).all():
        professores_ativos = (
            db.query(Vinculo)
            .filter(Vinculo.point_id == point.id, Vinculo.status == VinculoStatus.ATIVO)
            .count()
        )
        alunos_ativos = (
            db.query(Matricula.aluno_id)
            .join(Turma, Matricula.turma_id == Turma.id)
            .join(Vinculo, Turma.vinculo_id == Vinculo.id)
            .filter(Vinculo.point_id == point.id, Matricula.status == MatriculaStatus.ATIVA)
            .distinct()
            .count()
        )
        pagamentos_confirmados = (
            db.query(Pagamento)
            .join(Matricula, Pagamento.matricula_id == Matricula.id)
            .join(Turma, Matricula.turma_id == Turma.id)
            .join(Vinculo, Turma.vinculo_id == Vinculo.id)
            .filter(Vinculo.point_id == point.id, Pagamento.status == PagamentoStatus.CONFIRMADO)
            .all()
        )
        total_taxa = len(pagamentos_confirmados) * float(config.taxa_servico)
        total_pago_confirmado = sum(float(p.valor) for p in pagamentos_confirmados)

        fechamentos = db.query(Fechamento).filter(Fechamento.point_id == point.id).all()
        total_repassado = sum(float(r.valor) for f in fechamentos for r in f.repasses)

        resultado.append(
            PointRankingOut(
                point_id=point.id,
                nome=point.nome,
                professores_ativos=professores_ativos,
                alunos_ativos=alunos_ativos,
                total_taxa_servico=total_taxa,
                total_repassado=total_repassado,
                total_pago_confirmado=total_pago_confirmado,
            )
        )

    return sorted(resultado, key=lambda r: r.total_taxa_servico, reverse=True)


@router.get("/me", response_model=PointOut)
def meu_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    return point


@router.patch("/me/configuracoes", response_model=PointOut)
def atualizar_configuracoes_do_meu_point(
    payload: PointConfiguracoesUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    """Prazo de crédito e antecedência mínima de cancelamento — cada Point
    define o seu (pedido do usuário, 2026-08-21). Diferente de
    formas-pagamento, aqui é o próprio admin do Point quem ajusta, não o
    dono do app."""
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if payload.prazo_credito_dias < 1 or payload.prazo_cancelamento_horas < 0:
        raise HTTPException(422, "Prazos precisam ser positivos")
    if not 1 <= payload.dia_vencimento_mensalidade <= 28:
        raise HTTPException(422, "Dia de vencimento precisa ser entre 1 e 28")
    if not payload.dias_semana_funcionamento or not payload.horarios_semana_funcionamento:
        raise HTTPException(422, "Escolha pelo menos um dia e um horário nos dias de semana")
    if not payload.dias_fds_funcionamento or not payload.horarios_fds_funcionamento:
        raise HTTPException(422, "Escolha pelo menos um dia e um horário no fim de semana")
    if set(payload.dias_semana_funcionamento) - set(DIAS_UTEIS):
        raise HTTPException(422, "Dia de semana inválido (só segunda a sexta)")
    if set(payload.dias_fds_funcionamento) - set(DIAS_FIM_DE_SEMANA):
        raise HTTPException(422, "Dia de fim de semana inválido (só sábado ou domingo)")
    if set(payload.horarios_semana_funcionamento) - set(HORARIOS_PADRAO) or set(
        payload.horarios_fds_funcionamento
    ) - set(HORARIOS_PADRAO):
        raise HTTPException(422, "Horário inválido")

    point.prazo_credito_dias = payload.prazo_credito_dias
    point.prazo_cancelamento_horas = payload.prazo_cancelamento_horas
    point.dia_vencimento_mensalidade = payload.dia_vencimento_mensalidade
    point.dias_semana_funcionamento = payload.dias_semana_funcionamento
    point.horarios_semana_funcionamento = payload.horarios_semana_funcionamento
    point.dias_fds_funcionamento = payload.dias_fds_funcionamento
    point.horarios_fds_funcionamento = payload.horarios_fds_funcionamento
    point.place_api_key = payload.place_api_key or None
    db.commit()
    db.refresh(point)
    return point


@router.patch("/me/perfil", response_model=PointOut)
def atualizar_perfil_do_meu_point(
    payload: PointPerfilUpdate,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    """Nome, endereço, "Sobre", "Informações importantes" e "Anúncios" do
    Point (pedido do usuário, 2026-08-30) — sobre/informações aparecem no
    fim da Início do aluno (depois de "Próximas aulas"); anúncios preenche
    o banner reservado no meio da página. Nome/endereço não tinham tela
    nenhuma pra editar depois do cadastro inicial (feito pelo dono do app
    em POST /points) — pedido do usuário, 2026-08-30: "precisa tb no
    cadastro do point: Nome do point, endereço"."""
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if not payload.nome.strip() or not payload.endereco.strip():
        raise HTTPException(422, "Nome e endereço não podem ficar em branco")
    point.nome = payload.nome.strip()
    point.endereco = payload.endereco.strip()
    point.sobre = payload.sobre or None
    point.informacoes_importantes = payload.informacoes_importantes or None
    point.anuncios = payload.anuncios or None
    db.commit()
    db.refresh(point)
    return point


@router.post("/me/fotos", response_model=PointOut)
async def adicionar_foto_do_meu_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    arquivo: Annotated[UploadFile, File()],
) -> Point:
    """Até MAX_FOTOS_POINT fotos por Point (pedido do usuário, 2026-08-30) —
    salvas em disco (app/services/uploads.py), servidas como estático em
    /uploads (app/main.py). Guarda só a URL na lista `fotos` do Point."""
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if len(point.fotos) >= MAX_FOTOS_POINT:
        raise HTTPException(422, f"Máximo de {MAX_FOTOS_POINT} fotos por Point")

    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(422, "Imagem maior que 5 MB")

    try:
        url = salvar_imagem_point(point.id, "fotos", arquivo, conteudo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    point.fotos = [*point.fotos, url]
    db.commit()
    db.refresh(point)
    return point


@router.delete("/me/fotos", response_model=PointOut)
def remover_foto_do_meu_point(
    url: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if url not in point.fotos:
        raise HTTPException(404, "Foto não encontrada")

    point.fotos = [f for f in point.fotos if f != url]
    remover_imagem_point(url)
    db.commit()
    db.refresh(point)
    return point


@router.post("/me/banners", response_model=PointOut)
async def adicionar_banner_do_meu_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    arquivo: Annotated[UploadFile, File()],
) -> Point:
    """Até MAX_BANNERS_POINT banners por Point (pedido do usuário,
    2026-08-30: "anúncios será imagens também, como banners") — mesmo
    esquema de adicionar_foto_do_meu_point, categoria própria. Aparecem em
    carrossel no banner do meio da Início do aluno, junto do texto de
    `anuncios`."""
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if len(point.banners) >= MAX_BANNERS_POINT:
        raise HTTPException(422, f"Máximo de {MAX_BANNERS_POINT} banners por Point")

    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(422, "Imagem maior que 5 MB")

    try:
        url = salvar_imagem_point(point.id, "banners", arquivo, conteudo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    point.banners = [*point.banners, url]
    db.commit()
    db.refresh(point)
    return point


@router.delete("/me/banners", response_model=PointOut)
def remover_banner_do_meu_point(
    url: str,
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if url not in point.banners:
        raise HTTPException(404, "Banner não encontrado")

    point.banners = [b for b in point.banners if b != url]
    remover_imagem_point(url)
    db.commit()
    db.refresh(point)
    return point


@router.post("/me/logo", response_model=PointOut)
async def definir_logo_do_meu_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
    arquivo: Annotated[UploadFile, File()],
) -> Point:
    """Logomarca do Point (pedido do usuário, 2026-08-30: "coloque também
    um ícone (logomarca do point)... no canto esquerdo") — slot único,
    diferente de fotos/banners: enviar um novo logo substitui o anterior
    (apaga o arquivo velho do disco). Aparece no canto esquerdo do
    cabeçalho pra qualquer papel logado nesse Point (GET /points/meu-logo,
    ver components/Layout.tsx)."""
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")

    conteudo = await arquivo.read()
    if len(conteudo) > TAMANHO_MAXIMO_BYTES:
        raise HTTPException(422, "Imagem maior que 5 MB")

    try:
        url = salvar_imagem_point(point.id, "logo", arquivo, conteudo)
    except ValueError as e:
        raise HTTPException(422, str(e)) from e

    logo_antigo = point.logo
    point.logo = url
    db.commit()
    db.refresh(point)
    if logo_antigo is not None:
        remover_imagem_point(logo_antigo)
    return point


@router.delete("/me/logo", response_model=PointOut)
def remover_logo_do_meu_point(
    db: Annotated[Session, Depends(get_db)],
    admin: Annotated[User, Depends(require_role(Role.ADMIN_POINT))],
) -> Point:
    point = db.get(Point, admin.point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")
    if point.logo is None:
        raise HTTPException(404, "Esse Point não tem logo cadastrado")

    logo_antigo = point.logo
    point.logo = None
    db.commit()
    db.refresh(point)
    remover_imagem_point(logo_antigo)
    return point


@router.patch("/{point_id}/formas-pagamento", response_model=PointOut)
def atualizar_formas_pagamento(
    point_id: int,
    formas: list[str],
    db: Annotated[Session, Depends(get_db)],
    _user: Annotated[User, Depends(require_role(Role.SUPER_ADMIN))],
) -> Point:
    point = db.get(Point, point_id)
    if point is None:
        raise HTTPException(404, "Point não encontrado")

    point.formas_pagamento_habilitadas = formas
    db.commit()
    db.refresh(point)
    return point


# Convidar admin do Point deixou de ser um POST direto com senha definida
# pelo dono do app — virou convite por e-mail (pedido do usuário,
# 2026-08-26: "não quero criar senha de admin, faça o mesmo padrão de
# aluno e professor"). Ver app/routers/convites_admin.py.
