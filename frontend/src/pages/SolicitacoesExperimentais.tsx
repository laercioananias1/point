import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type {
  Point,
  PointResumo,
  SolicitacaoExperimental,
  SolicitacaoExperimentalStatus,
  TurmaResumo,
} from "../api/types";
import { CategoriaBadge } from "../components/CategoriaBadge";
import { Icon, Layout } from "../components/Layout";
import { rotuloTurma } from "../lib/dias";

const PREFIXO_ROTA: Record<string, string> = {
  admin_point: "/admin-point",
  professor: "/professor",
};
const ORDEM_PRIORIDADE = ["admin_point", "professor"] as const;

const ABAS: { valor: SolicitacaoExperimentalStatus; rotulo: string }[] = [
  { valor: "pendente", rotulo: "Pendentes" },
  { valor: "aprovada", rotulo: "Aprovadas" },
  { valor: "recusada", rotulo: "Recusadas" },
];

function rotuloData(iso: string): string {
  return new Date(iso + "T00:00").toLocaleDateString("pt-BR", {
    weekday: "short",
    day: "2-digit",
    month: "2-digit",
  });
}

/** Tela de aprovação de aula experimental (pedido do usuário, 2026-09-14:
 * "isso cai para os professores ou adm e autorizam a aula") —
 * compartilhada entre admin e professor: o backend já escopa a listagem
 * certa pra cada um (admin vê tudo do Point, professor só as próprias
 * turmas), então o componente é o mesmo, só a rota de cada área muda
 * (mesmo padrão de Notificacoes.tsx). */
export default function SolicitacoesExperimentais() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const admin = user?.roles.includes("admin_point") ?? false;
  const area = ORDEM_PRIORIDADE.find((p) => user?.roles.includes(p));
  const rotaVoltar = area ? PREFIXO_ROTA[area] : "/";

  // Point do admin, só pra pegar o token do link público (pedido do
  // usuário, 2026-09-14: "nao identificar o id na url") — user.point_id
  // continua existindo, mas a URL usa link_experimental, não o id.
  const [pointAdmin, setPointAdmin] = useState<Point | null>(null);
  useEffect(() => {
    if (!admin) return;
    api.get<Point>("/points/me").then(setPointAdmin);
  }, [admin]);

  // Pontos onde o professor tem vínculo (pedido do usuário, 2026-09-14:
  // "esse link o professor pode divulgar") — ele pode dar aula em mais de
  // um Point, então mostra um link por Point, não só um fixo como o admin
  // (que sempre tem um Point só, user.point_id).
  const [pointsProfessor, setPointsProfessor] = useState<PointResumo[]>([]);
  useEffect(() => {
    if (admin) return;
    api.get<TurmaResumo[]>("/professores/me/turmas").then((turmas) => {
      const unicos = new Map(turmas.map((t) => [t.vinculo.point.id, t.vinculo.point]));
      setPointsProfessor(Array.from(unicos.values()));
    });
  }, [admin]);

  const [aba, setAba] = useState<SolicitacaoExperimentalStatus>("pendente");
  const [solicitacoes, setSolicitacoes] = useState<SolicitacaoExperimental[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setSolicitacoes(await api.get<SolicitacaoExperimental[]>(`/experimental/solicitacoes?status=${aba}`));
    } catch {
      setErro("Não foi possível carregar as solicitações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [aba]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <div className="screen-header">
        <button type="button" className="close-btn" onClick={() => navigate(rotaVoltar)} aria-label="Voltar">
          <Icon name="chevron-left" />
        </button>
        <h1>Aula experimental</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Pedidos feitos na página pública de aula experimental do seu Point.
      </p>

      {admin && pointAdmin && (
        <LinkPublico nome="Seu Point" link={pointAdmin.link_experimental} />
      )}
      {!admin &&
        pointsProfessor.map((p) => (
          <LinkPublico key={p.id} nome={p.nome} link={p.link_experimental} />
        ))}

      <div className="toggle-grid" style={{ marginBottom: 16 }}>
        {ABAS.map((a) => (
          <button
            key={a.valor}
            type="button"
            className={aba === a.valor ? "toggle-chip active" : "toggle-chip"}
            onClick={() => setAba(a.valor)}
          >
            {a.rotulo}
          </button>
        ))}
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <section className="section">
          {solicitacoes.length === 0 ? (
            <p className="empty-state">Nenhuma solicitação {ABAS.find((a) => a.valor === aba)?.rotulo.toLowerCase()}.</p>
          ) : (
            <div className="card-list">
              {solicitacoes.map((s) => (
                <SolicitacaoCard key={s.id} solicitacao={s} admin={admin} onDecidida={carregar} />
              ))}
            </div>
          )}
        </section>
      )}
    </Layout>
  );
}

function LinkPublico({ nome, link: token }: { nome: string; link: string }) {
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/experimental/${token}`;

  async function copiar() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      // Sem clipboard (ex.: navegador antigo) — o link já está selecionável
      // na tela, a pessoa copia manualmente.
    }
  }

  return (
    <div className="item-card" style={{ marginBottom: 16 }}>
      <div className="item-card-info">
        <span className="item-card-title">Link pra divulgar — {nome}</span>
        <span className="item-card-subtitle">{link}</span>
        <span className="item-card-subtitle">
          Manda no WhatsApp/Instagram — quem clicar vê a agenda com vaga livre e pede a aula
          experimental, sem precisar criar conta.
        </span>
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={copiar}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
      </div>
    </div>
  );
}

function SolicitacaoCard({
  solicitacao: s,
  admin,
  onDecidida,
}: {
  solicitacao: SolicitacaoExperimental;
  admin: boolean;
  onDecidida: () => void;
}) {
  const navigate = useNavigate();
  const [recusando, setRecusando] = useState(false);
  const [motivo, setMotivo] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function aprovar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.patch(`/experimental/solicitacoes/${s.id}/aprovar`, {});
      onDecidida();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível aprovar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  async function recusar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.patch(`/experimental/solicitacoes/${s.id}/recusar`, {
        motivo_recusa: motivo.trim() || null,
      });
      onDecidida();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível recusar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="item-card" style={{ alignItems: "flex-start" }}>
      <div className="item-card-info" style={{ flex: 1 }}>
        <span className="item-card-title">{s.nome}</span>
        <span className="item-card-subtitle">{s.email} · {s.celular}</span>
        <span className="item-card-subtitle">
          <CategoriaBadge nome={s.turma.categoria.nome} cor={s.turma.categoria.cor} /> ·{" "}
          {s.turma.modalidade.nome} · {rotuloTurma(s.turma.dias_semana, s.turma.horario)} · com{" "}
          {s.turma.professor_nome}
        </span>
        <span className="item-card-subtitle">
          Aula em {rotuloData(s.data)} · Já tem raquete: {s.tem_raquete ? "sim" : "não"}
        </span>
        {s.status === "recusada" && s.motivo_recusa && (
          <span className="item-card-subtitle">Motivo: {s.motivo_recusa}</span>
        )}
        {erro && <p className="form-error">{erro}</p>}

        {recusando && (
          <label style={{ marginTop: 6 }}>
            Motivo (opcional)
            <textarea
              value={motivo}
              onChange={(e) => setMotivo(e.target.value)}
              rows={2}
              placeholder="Ex.: já não tem mais vaga esse dia"
            />
          </label>
        )}
      </div>
      <div className="item-card-actions" style={{ flexDirection: "column", alignItems: "stretch" }}>
        {s.status === "pendente" && !recusando && (
          <>
            <button disabled={enviando} onClick={aprovar}>
              Aprovar
            </button>
            <button className="secondary" disabled={enviando} onClick={() => setRecusando(true)}>
              Recusar
            </button>
          </>
        )}
        {s.status === "pendente" && recusando && (
          <>
            <button disabled={enviando} onClick={recusar}>
              {enviando ? "Recusando..." : "Confirmar recusa"}
            </button>
            <button className="secondary" disabled={enviando} onClick={() => setRecusando(false)}>
              Cancelar
            </button>
          </>
        )}
        {s.status === "aprovada" && admin && (
          <button
            className="secondary"
            onClick={() =>
              navigate("/admin-point/aluno/convidar", {
                state: { nome: s.nome, email: s.email, celular: s.celular },
              })
            }
          >
            Convidar pra aluno
          </button>
        )}
      </div>
    </div>
  );
}
