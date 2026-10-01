import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { AlunoResumo, Convite, Matricula, PagamentoMeio } from "../../api/types";
import { Avatar } from "../../components/Avatar";
import { useConfirm } from "../../components/ConfirmModal";
import { Layout } from "../../components/Layout";

/** Alunos do Point no layout do kit de design (design/telas/Alunos.dc.html;
 * pedido do usuário, 2026-10-01: "refazer a tela de alunos... acrescenta
 * no layout novo os convites pendentes"). Uma tabela só com alunos e
 * convites pendentes — as antigas abas de assinaturas e mensalidades
 * viraram as colunas Plano e Pagamento (cancelar assinatura continua na
 * tela do aluno). */

type Plano = "Mensal" | "Wellhub" | "TotalPass" | "Avulso";
type Pagamento = "Em dia" | "Em aberto" | "Vencida" | "—";
type Filtro = "Todos" | "Mensal" | "Wellhub" | "Em atraso" | "Convites";

type LinhaAluno = {
  tipo: "aluno";
  aluno: AlunoResumo;
  turmas: string;
  plano: Plano;
  pagamento: Pagamento;
  // Matrícula em aberto pra mandar lembrete (a mais atrasada primeiro).
  lembreteMatriculaId: number | null;
};
type LinhaConvite = { tipo: "convite"; convite: Convite; plano: Plano };
type Linha = LinhaAluno | LinhaConvite;

const FILTROS: Filtro[] = ["Todos", "Mensal", "Wellhub", "Em atraso", "Convites"];

function planoDaFonte(fonte: PagamentoMeio | null, mensal: boolean): Plano {
  if (fonte === "wellhub") return "Wellhub";
  if (fonte === "totalpass") return "TotalPass";
  return mensal ? "Mensal" : "Avulso";
}

function horaCurta(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

function montarLinhaAluno(aluno: AlunoResumo, doAluno: Matricula[]): LinhaAluno {
  const ativas = doAluno.filter((m) => m.status === "ativa");
  const turmas = Array.from(
    new Set(
      ativas.map((m) =>
        m.tipo === "avulsa" ? "Aula avulsa" : `${m.turma.modalidade.nome} ${horaCurta(m.turma.horario)}`,
      ),
    ),
  ).join(", ");

  const beneficio = ativas.find((m) => m.fonte_pagamento === "wellhub" || m.fonte_pagamento === "totalpass");
  const mensais = ativas.filter((m) => m.tipo === "mensal");
  const plano = planoDaFonte(beneficio?.fonte_pagamento ?? null, mensais.length > 0);

  // Pagamento só faz sentido pra mensalidade paga pelo aluno (Pix/dinheiro).
  const cobradas = mensais.filter((m) => m.fonte_pagamento === "pix" || m.fonte_pagamento === "dinheiro");
  const vencida = cobradas.find((m) => m.inadimplente);
  const emAberto = cobradas.find((m) => !m.mes_atual_pago);
  const pagamento: Pagamento =
    cobradas.length === 0 ? "—" : vencida ? "Vencida" : emAberto ? "Em aberto" : "Em dia";

  return {
    tipo: "aluno",
    aluno,
    turmas: turmas || "Sem turma ativa",
    plano,
    pagamento,
    lembreteMatriculaId: (vencida ?? emAberto)?.id ?? null,
  };
}

function nomeDaLinha(l: Linha): string {
  return l.tipo === "aluno" ? l.aluno.nome : l.convite.nome;
}

export default function AdminPointAluno() {
  // Confirmação de convite enviado (pedido do usuário, 2026-08-26) — a tela
  // de convidar manda o nome de volta pra cá via navigate state.
  const location = useLocation();
  const convidado = (location.state as { convidado?: string } | null)?.convidado;
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [filtro, setFiltro] = useState<Filtro>(convidado ? "Convites" : "Todos");
  const [busca, setBusca] = useState("");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, convitesRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Convite[]>("/convites"),
      ]);
      setMatriculas(matriculasRes);
      setConvites(convitesRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os alunos. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const linhas = useMemo<Linha[]>(() => {
    // Sem endpoint de "alunos do Point" (GET /alunos é busca global) —
    // dedupe por aluno a partir das matrículas.
    const porAluno = new Map<number, Matricula[]>();
    for (const m of matriculas) porAluno.set(m.aluno.id, [...(porAluno.get(m.aluno.id) ?? []), m]);
    const alunos: Linha[] = Array.from(porAluno.values()).map((ms) => montarLinhaAluno(ms[0].aluno, ms));
    const pendentes: Linha[] = convites
      .filter((c) => c.status === "pendente")
      .map((c) => ({ tipo: "convite", convite: c, plano: planoDaFonte(c.fonte_pagamento, !c.avulso) }));
    return [...alunos, ...pendentes].sort((a, b) => nomeDaLinha(a).localeCompare(nomeDaLinha(b)));
  }, [matriculas, convites]);

  const totalAlunos = linhas.filter((l) => l.tipo === "aluno").length;
  const totalConvites = linhas.length - totalAlunos;

  const termo = busca.trim().toLowerCase();
  const visiveis = linhas.filter((l) => {
    if (termo && !nomeDaLinha(l).toLowerCase().includes(termo)) return false;
    if (filtro === "Todos") return true;
    if (filtro === "Convites") return l.tipo === "convite";
    if (filtro === "Em atraso") return l.tipo === "aluno" && l.pagamento === "Vencida";
    return l.plano === filtro;
  });

  return (
    <Layout>
      <div className="alunos-topo">
        <div>
          <div className="alunos-contexto">
            Cadastros · {totalAlunos} {totalAlunos === 1 ? "aluno" : "alunos"}
            {totalConvites > 0 &&
              ` · ${totalConvites} ${totalConvites === 1 ? "convite pendente" : "convites pendentes"}`}
          </div>
          <h1>Alunos</h1>
        </div>
        <Link to="/admin-point/aluno/convidar" className="botao-link">
          + Convidar aluno
        </Link>
      </div>

      {convidado && <p className="form-success">Convite enviado pra {convidado}.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="alunos-card">
          <div className="alunos-filtros">
            <div className="toggle-grid" role="group" aria-label="Filtrar alunos">
              {FILTROS.map((f) => (
                <button
                  key={f}
                  type="button"
                  className={filtro === f ? "toggle-chip active" : "toggle-chip"}
                  onClick={() => setFiltro(f)}
                >
                  {f}
                  {f === "Convites" && totalConvites > 0 ? ` (${totalConvites})` : ""}
                </button>
              ))}
            </div>
            <input
              type="search"
              className="alunos-busca"
              aria-label="Buscar aluno"
              placeholder="Buscar por nome"
              value={busca}
              onChange={(e) => setBusca(e.target.value)}
            />
          </div>

          <div className="alunos-tabela" role="table" aria-label="Alunos">
            <div className="alunos-linha alunos-cabecalho" role="row">
              <span role="columnheader">Aluno</span>
              <span role="columnheader">Turmas</span>
              <span role="columnheader">Plano</span>
              <span role="columnheader">Pagamento</span>
              <span role="columnheader">Acesso ao app</span>
            </div>
            {visiveis.map((l) =>
              l.tipo === "aluno" ? (
                <LinhaDeAluno key={`a-${l.aluno.id}`} linha={l} />
              ) : (
                <LinhaDeConvite key={`c-${l.convite.id}`} linha={l} onMudanca={carregar} />
              ),
            )}
            {visiveis.length === 0 && (
              <p className="alunos-vazio">
                {linhas.length === 0 ? "Nenhum aluno ainda — convide o primeiro." : "Nenhum aluno encontrado."}
              </p>
            )}
          </div>
        </section>
      )}
    </Layout>
  );
}

const CLASSE_PAGAMENTO: Record<Pagamento, string> = {
  "Em dia": "status-pill status-good",
  "Em aberto": "status-pill status-warn",
  Vencida: "status-pill status-risk",
  "—": "",
};

function SeloPlano({ plano }: { plano: Plano }) {
  return <span className={`status-pill plano-${plano.toLowerCase()}`}>{plano}</span>;
}

function LinhaDeAluno({ linha }: { linha: LinhaAluno }) {
  const navigate = useNavigate();
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const destino = `/admin-point/aluno/${linha.aluno.id}/agenda`;

  async function lembrar(e: React.MouseEvent) {
    e.stopPropagation();
    if (linha.lembreteMatriculaId === null) return;
    setEnviando(true);
    try {
      await api.post(`/matriculas/${linha.lembreteMatriculaId}/lembrete-pagamento`);
      setEnviado(true);
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div
      className="alunos-linha alunos-linha-clicavel"
      role="row"
      tabIndex={0}
      onClick={() => navigate(destino)}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(destino);
      }}
    >
      <div className="alunos-pessoa" role="cell">
        <Avatar nome={linha.aluno.nome} foto={linha.aluno.foto} tamanho={36} />
        <div className="alunos-pessoa-texto">
          <span className="alunos-nome">{linha.aluno.nome}</span>
          <span className="alunos-sub">{linha.aluno.contato || linha.aluno.email}</span>
        </div>
      </div>
      <span role="cell" data-rotulo="Turmas">
        {linha.turmas}
      </span>
      <span role="cell" data-rotulo="Plano">
        <SeloPlano plano={linha.plano} />
      </span>
      <span role="cell" data-rotulo="Pagamento" className="alunos-celula-acoes">
        {linha.pagamento === "—" ? (
          <span className="alunos-sub">—</span>
        ) : (
          <span className={CLASSE_PAGAMENTO[linha.pagamento]}>{linha.pagamento}</span>
        )}
        {linha.lembreteMatriculaId !== null && (
          <button type="button" className="alunos-acao" disabled={enviando || enviado} onClick={lembrar}>
            {enviado ? "Lembrete enviado" : enviando ? "Enviando..." : "Enviar lembrete"}
          </button>
        )}
      </span>
      <span role="cell" data-rotulo="Acesso ao app">
        <span className="status-pill status-info">Ativo no app</span>
      </span>
    </div>
  );
}

function LinhaDeConvite({ linha, onMudanca }: { linha: LinhaConvite; onMudanca: () => void }) {
  const { convite } = linha;
  const [cancelando, setCancelando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { confirmar, modal } = useConfirm();
  const link = `${window.location.origin}/convite/${convite.token}`;
  const turmas = convite.avulso
    ? "Sem turma (avulso)"
    : `${convite.modalidade?.nome ?? ""}${convite.plano ? ` · ${convite.plano.frequencia_semanal}x/semana` : ""}`;

  async function cancelar() {
    if (!(await confirmar(`Cancelar o convite de ${convite.nome}?`))) return;
    setCancelando(true);
    try {
      await api.patch(`/convites/${convite.id}/cancelar`);
      onMudanca();
    } finally {
      setCancelando(false);
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o link já foi por e-mail/WhatsApp */
    }
  }

  return (
    <div className="alunos-linha" role="row">
      {modal}
      <div className="alunos-pessoa" role="cell">
        <Avatar nome={convite.nome} foto={null} tamanho={36} />
        <div className="alunos-pessoa-texto">
          <span className="alunos-nome">{convite.nome}</span>
          <span className="alunos-sub">{convite.celular || convite.email}</span>
        </div>
      </div>
      <span role="cell" data-rotulo="Turmas">
        {turmas}
      </span>
      <span role="cell" data-rotulo="Plano">
        <SeloPlano plano={linha.plano} />
      </span>
      <span role="cell" data-rotulo="Pagamento">
        <span className="alunos-sub">—</span>
      </span>
      <span role="cell" data-rotulo="Acesso ao app" className="alunos-celula-acoes">
        <span className={convite.expirado ? "status-pill status-risk" : "status-pill status-warn"}>
          {convite.expirado ? "Convite expirado" : "Convite enviado"}
        </span>
        <span className="alunos-acoes">
          <button type="button" className="alunos-acao" onClick={copiarLink}>
            {copiado ? "Copiado!" : "Copiar link"}
          </button>
          <button type="button" className="alunos-acao" disabled={cancelando} onClick={cancelar}>
            {cancelando ? "Cancelando..." : "Cancelar"}
          </button>
        </span>
      </span>
    </div>
  );
}
