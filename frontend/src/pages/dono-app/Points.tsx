import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ConviteAdmin, PlataformaPainel, PointRanking } from "../../api/types";
import { useAuth, type User } from "../../auth/AuthContext";
import { useConfirm } from "../../components/ConfirmModal";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { formatarCelular, formatarReais } from "../../lib/formato";

/** Points da plataforma (pedido do usuário, 2026-08-26: "pode fazer" — a
 * tela de cadastrar Point/admin que faltava). Criar Point virou tela
 * própria (CriarPoint.tsx, pedido do usuário, 2026-08-31: "pode juntar
 * tudo... no padrao de convidar aluno") que já junta o convite do
 * primeiro admin — aqui na lista fica só o gatilho pra abrir aquela tela,
 * mais o "Convidar admin" por Point (ainda útil pra quando um Point fica
 * sem admin depois — convite cancelado/expirado, ou trocou de dono) e a
 * lista comparativa que antes vivia sozinha na home. */
export default function DonoAppPoints() {
  const { entrarComoSuporte } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const criado = (location.state as { criado?: string } | null)?.criado;
  const [ranking, setRanking] = useState<PointRanking[]>([]);
  const [painel, setPainel] = useState<PlataformaPainel | null>(null);
  const [convites, setConvites] = useState<ConviteAdmin[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [convidando, setConvidando] = useState<number | null>(null);
  const [entrandoComo, setEntrandoComo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [rankingRes, convitesRes, painelRes] = await Promise.all([
        api.get<PointRanking[]>("/points/ranking"),
        api.get<ConviteAdmin[]>("/convites-admin"),
        api.get<PlataformaPainel>("/plataforma/painel"),
      ]);
      setRanking(rankingRes);
      setConvites(convitesRes);
      setPainel(painelRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os Points. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const convitesPendentes = convites.filter((c) => c.status === "pendente");

  // Suporte (pedido do usuário, 2026-08-30: "quero nele [adm geral] para
  // fazer suporte poder trocar para o usuário do adm do Point") — troca a
  // sessão pro admin desse Point sem precisar da senha dele; volta pro
  // dono do app depois via a faixa de aviso (Layout.tsx + AuthContext.
  // sairDoSuporte, pedido do usuário, 2026-08-30: "pode fazer").
  async function handleEntrarComoSuporte(pointId: number) {
    setErro(null);
    setEntrandoComo(pointId);
    try {
      const res = await api.post<{ access_token: string; user: User }>(
        `/points/${pointId}/suporte-login`,
      );
      entrarComoSuporte(res.access_token, res.user);
      navigate("/admin-point");
    } catch (e) {
      setErro(
        e instanceof ApiError ? e.message : "Não foi possível entrar como o admin desse Point.",
      );
      setEntrandoComo(null);
    }
  }

  // Dados do painel da plataforma (admins, turmas, recebido no mês) por Point.
  const detalhes = new Map((painel?.points ?? []).map((p) => [p.id, p]));

  return (
    <Layout>
      <CabecalhoPagina
        titulo="Points"
        contexto={`Plataforma · ${ranking.length} ${ranking.length === 1 ? "Point" : "Points"}`}
        novo={{ para: "/dono-app/points/criar", rotulo: "Novo Point" }}
      />

      {erro && <p className="form-error">{erro}</p>}
      {criado && <p className="form-success">Point "{criado}" criado — convite de admin enviado.</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <div className="points-corpo">
          {ranking.length === 0 ? (
            <p className="alunos-card alunos-vazio">Nenhum Point cadastrado ainda — crie o primeiro em "+ Novo Point".</p>
          ) : (
            <div className="points-grade">
              {ranking.map((p) => {
                const d = detalhes.get(p.point_id);
                const semAdmin = d !== undefined && d.admins === 0;
                return (
                  <article key={p.point_id} className="alunos-card points-card">
                    <div className="points-card-topo">
                      <div>
                        <h2 className="points-nome">{p.nome}</h2>
                        {d && (
                          <span className="alunos-sub">
                            desde{" "}
                            {new Date(d.criado_em + "T00:00").toLocaleDateString("pt-BR", {
                              month: "long",
                              year: "numeric",
                            })}
                          </span>
                        )}
                      </div>
                      <span className={semAdmin ? "status-pill status-risk" : "status-pill status-good"}>
                        {semAdmin ? "Sem admin" : "Com admin"}
                      </span>
                    </div>

                    <div className="points-numeros">
                      <div>
                        <strong>{p.alunos_ativos}</strong>
                        <span>alunos</span>
                      </div>
                      <div>
                        <strong>{p.professores_ativos}</strong>
                        <span>{p.professores_ativos === 1 ? "professor" : "professores"}</span>
                      </div>
                      <div>
                        <strong>{d?.turmas ?? "–"}</strong>
                        <span>turmas</span>
                      </div>
                    </div>

                    {d && d.admins_lista.length > 0 && (
                      <div className="points-admins">
                        {d.admins_lista.map((a) => (
                          <div key={a.email} className="points-admin">
                            <span className="alunos-sub">Admin</span>
                            <strong>{a.nome}</strong>
                            <span className="points-admin-contato">{a.email}</span>
                            <span className="points-admin-contato">{formatarCelular(a.celular)}</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="points-recebido">
                      <span>
                        <span className="alunos-sub">Recebido no mês</span>
                        <strong>{formatarReais(d?.recebido_mes ?? 0)}</strong>
                      </span>
                      <span>
                        <span className="alunos-sub">Total recebido</span>
                        <strong>{formatarReais(p.total_recebido)}</strong>
                      </span>
                    </div>

                    <div className="points-acoes">
                      <button
                        type="button"
                        className="cobr-btn cobr-btn-pagar"
                        disabled={entrandoComo === p.point_id}
                        onClick={() => handleEntrarComoSuporte(p.point_id)}
                      >
                        {entrandoComo === p.point_id ? "Entrando..." : "Entrar como suporte"}
                      </button>
                      <button
                        type="button"
                        className="cobr-btn"
                        onClick={() => setConvidando(convidando === p.point_id ? null : p.point_id)}
                      >
                        {convidando === p.point_id ? "Fechar" : "Convidar admin"}
                      </button>
                    </div>

                    {convidando === p.point_id && (
                      <ConvidarAdminForm
                        pointId={p.point_id}
                        onEnviado={() => {
                          setConvidando(null);
                          carregar();
                        }}
                      />
                    )}
                  </article>
                );
              })}
            </div>
          )}

          <section className="alunos-card">
            <h2 className="chk-secao-titulo">Convites de admin pendentes</h2>
            {convitesPendentes.length === 0 ? (
              <p className="alunos-sub">Nenhum convite aguardando aceite.</p>
            ) : (
              <ul className="perfil-lista">
                {convitesPendentes.map((c) => (
                  <ConviteAdminPendenteRow key={c.id} convite={c} onMudanca={carregar} />
                ))}
              </ul>
            )}
          </section>
        </div>
      )}
    </Layout>
  );
}

/** Convite por link/e-mail — mesmo padrão de aluno e professor (pedido do
 * usuário, 2026-08-26: "não quero criar senha de admin"). Quem recebe cria
 * a própria senha, ou só confirma se já tem conta (com qualquer papel —
 * a conta ganha admin_point sem perder o que já tinha). */
function ConvidarAdminForm({ pointId, onEnviado }: { pointId: number; onEnviado: () => void }) {
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);
    setEnviando(true);
    try {
      await api.post("/convites-admin", { point_id: pointId, nome, celular, email });
      setSucesso(`Convite enviado pra ${nome}.`);
      setNome("");
      setCelular("");
      setEmail("");
      onEnviado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o convite. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="points-convite" onSubmit={handleSubmit}>
      <div className="form-row">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Celular
          <input
            type="tel"
            placeholder="(11) 91234-5678"
            value={celular}
            onChange={(e) => setCelular(formatarCelular(e.target.value))}
            required
          />
        </label>
      </div>
      <label>
        E-mail
        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
      </label>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">{sucesso}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar convite"}
      </button>
    </form>
  );
}

function ConviteAdminPendenteRow({
  convite,
  onMudanca,
}: {
  convite: ConviteAdmin;
  onMudanca: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/convite-admin/${convite.token}`;
  const { confirmar, modal } = useConfirm();

  async function cancelar() {
    if (!(await confirmar(`Cancelar o convite de ${convite.nome}?`))) return;
    setCancelando(true);
    try {
      await api.patch(`/convites-admin/${convite.id}/cancelar`);
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
      /* clipboard indisponível — sem problema, o link já foi mandado por e-mail */
    }
  }

  return (
    <li>
      {modal}
      <span className="alunos-pessoa-texto">
        <span className="alunos-nome">
          {convite.nome} · {convite.point.nome}
        </span>
        <span className="alunos-sub">
          {convite.celular} · {convite.email} · expira em{" "}
          {new Date(convite.expira_em + "T00:00").toLocaleDateString("pt-BR")}
          {convite.expirado && <span className="status-pill status-risk points-expirado">Expirado</span>}
        </span>
      </span>
      <span className="alunos-celula-acoes">
        <button type="button" className="alunos-acao" onClick={copiarLink}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button type="button" className="alunos-acao" disabled={cancelando} onClick={cancelar}>
          {cancelando ? "Cancelando..." : "Cancelar convite"}
        </button>
      </span>
    </li>
  );
}
