import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ConviteAdmin, PointRanking } from "../../api/types";
import { useAuth, type User } from "../../auth/AuthContext";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

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
  const [convites, setConvites] = useState<ConviteAdmin[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [convidando, setConvidando] = useState<number | null>(null);
  const [entrandoComo, setEntrandoComo] = useState<number | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [rankingRes, convitesRes] = await Promise.all([
        api.get<PointRanking[]>("/points/ranking"),
        api.get<ConviteAdmin[]>("/convites-admin"),
      ]);
      setRanking(rankingRes);
      setConvites(convitesRes);
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

  return (
    <Layout>
      <h1>Points ({ranking.length})</h1>

      {erro && <p className="form-error">{erro}</p>}
      {criado && <p className="form-success">Point "{criado}" criado — convite de admin enviado.</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
            {ranking.length === 0 ? (
              <p className="empty-state">Nenhum Point cadastrado ainda.</p>
            ) : (
              <div className="card-list">
                {ranking.map((p, i) => (
                  <div className="item-card" key={p.point_id} style={{ alignItems: "flex-start" }}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        #{i + 1} · {p.nome}
                      </span>
                      <span className="item-card-subtitle">
                        {p.professores_ativos} professor(es) · {p.alunos_ativos} aluno(s) ativo(s)
                      </span>
                      <span className="item-card-subtitle">
                        pago {formatarReais(p.total_pago_confirmado)} · taxa{" "}
                        {formatarReais(p.total_taxa_servico)} · repassado{" "}
                        {formatarReais(p.total_repassado)}
                      </span>
                      {convidando === p.point_id && (
                        <div style={{ marginTop: 10 }}>
                          <ConvidarAdminForm
                            pointId={p.point_id}
                            onEnviado={() => {
                              setConvidando(null);
                              carregar();
                            }}
                          />
                        </div>
                      )}
                    </div>
                    <div className="item-card-actions">
                      <button
                        className="secondary"
                        disabled={entrandoComo === p.point_id}
                        onClick={() => handleEntrarComoSuporte(p.point_id)}
                      >
                        {entrandoComo === p.point_id ? "Entrando..." : "Entrar como suporte"}
                      </button>
                      <button
                        className="secondary"
                        onClick={() => setConvidando(convidando === p.point_id ? null : p.point_id)}
                      >
                        {convidando === p.point_id ? "Fechar" : "Convidar admin"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <Link to="/dono-app/points/criar" className="action-card">
              <span className="action-card-icon">
                <Icon name="plus" />
              </span>
              <span className="action-card-info">
                <span className="action-card-title">Criar Point</span>
                <span className="action-card-subtitle">
                  Cadastra a arena e já manda o convite de admin por e-mail
                </span>
              </span>
              <span className="action-card-chevron" aria-hidden="true">
                →
              </span>
            </Link>
          </section>

          <section className="section">
            <h2>Convites de admin pendentes ({convitesPendentes.length})</h2>
            {convitesPendentes.length === 0 ? (
              <p className="empty-state">Nenhum convite aguardando aceite.</p>
            ) : (
              <div className="card-list">
                {convitesPendentes.map((c) => (
                  <ConviteAdminPendenteRow key={c.id} convite={c} onMudanca={carregar} />
                ))}
              </div>
            )}
          </section>
        </>
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
    <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
      <div className="form-row">
        <label>
          Nome
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Celular
          <input value={celular} onChange={(e) => setCelular(e.target.value)} required />
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

  async function cancelar() {
    if (!confirm(`Cancelar o convite de ${convite.nome}?`)) return;
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
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {convite.nome} · {convite.point.nome}
        </span>
        <span className="item-card-subtitle">
          {convite.celular} · {convite.email} · expira em{" "}
          {new Date(convite.expira_em + "T00:00").toLocaleDateString("pt-BR")}
        </span>
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={copiarLink}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button className="secondary" disabled={cancelando} onClick={cancelar}>
          {cancelando ? "Cancelando..." : "Cancelar"}
        </button>
      </div>
    </div>
  );
}
