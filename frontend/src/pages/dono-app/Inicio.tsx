import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { ConviteAdmin, IntegracaoNome, PlataformaPainel } from "../../api/types";
import { useAuth } from "../../auth/AuthContext";
import { Icon, Layout } from "../../components/Layout";
import { formatarReais } from "../../lib/formato";

const NOME_INTEGRACAO: Record<IntegracaoNome, string> = {
  whatsapp: "WhatsApp",
  email: "E-mail",
  wellhub: "Wellhub",
  totalpass: "TotalPass",
  mercadopago: "Mercado Pago",
};

function saudacao(): string {
  const h = new Date().getHours();
  return h < 12 ? "Bom dia" : h < 18 ? "Boa tarde" : "Boa noite";
}

function plural(n: number, um: string, varios: string): string {
  return `${n} ${n === 1 ? um : varios}`;
}

function variacao(atual: number, anterior: number): { texto: string; boa: boolean | null } {
  if (anterior === 0) return atual === 0 ? { texto: "igual ao mês passado", boa: null } : { texto: "▲ sem receita no mês passado", boa: true };
  const pct = Math.round(((atual - anterior) / anterior) * 100);
  if (pct === 0) return { texto: "igual ao mês passado", boa: null };
  return { texto: `${pct > 0 ? "▲ +" : "▼ "}${pct}% vs. mês passado`, boa: pct > 0 };
}

function quando(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
}

/** Início do dono do app no layout do kit (pedido do usuário, 2026-10-01:
 * "fazer o início do adm do sistema") — panorama da plataforma: o que
 * pede ação (Point sem admin, convite parado, integração com erro), os
 * números do mês, a tabela comparativa dos Points e a saúde das
 * integrações nas últimas 24h. Gestão dos Points (criar, convidar admin,
 * entrar como suporte) continua na aba Points. */
export default function DonoAppInicio() {
  const { user } = useAuth();
  const [painel, setPainel] = useState<PlataformaPainel | null>(null);
  const [convites, setConvites] = useState<ConviteAdmin[]>([]);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [painelRes, convitesRes] = await Promise.all([
        api.get<PlataformaPainel>("/plataforma/painel"),
        api.get<ConviteAdmin[]>("/convites-admin"),
      ]);
      setPainel(painelRes);
      setConvites(convitesRes);
    } catch {
      setErro("Não foi possível carregar os dados da plataforma. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const hoje = new Date()
    .toLocaleDateString("pt-BR", { weekday: "long", day: "numeric", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());
  const primeiroNome = user?.nome.split(" ")[0] ?? "";

  const convitesPendentes = convites.filter((c) => c.status === "pendente" && !c.expirado);
  const convitesExpirados = convites.filter((c) => c.status === "pendente" && c.expirado);
  const semAdmin = painel?.points.filter((p) => p.admins === 0) ?? [];
  const errosIntegracao = painel?.integracoes.reduce((s, i) => s + i.erros_24h, 0) ?? 0;

  const pendencias: { texto: string; para: string }[] = [];
  if (semAdmin.length > 0)
    pendencias.push({ texto: plural(semAdmin.length, "Point sem admin", "Points sem admin"), para: "/dono-app/points" });
  if (convitesExpirados.length > 0)
    pendencias.push({
      texto: plural(convitesExpirados.length, "convite de admin expirado", "convites de admin expirados"),
      para: "/dono-app/points",
    });
  if (errosIntegracao > 0)
    pendencias.push({
      texto: `${plural(errosIntegracao, "erro", "erros")} de integração nas últimas 24h`,
      para: "/dono-app/integracoes",
    });

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">Plataforma OPoint · {hoje}</div>
          <h1>
            {saudacao()}, {primeiroNome}
          </h1>
          {painel && (
            <p className="alunos-sub">
              {plural(painel.totais.points, "Point", "Points")} · {plural(painel.totais.professores, "professor", "professores")}{" "}
              · {plural(painel.totais.alunos, "aluno ativo", "alunos ativos")}
            </p>
          )}
        </div>
        <Link to="/dono-app/points/criar" className="botao-link">
          + Novo Point
        </Link>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {!painel && !erro && <p className="empty-state">Carregando...</p>}

      {painel && (
        <div className="plat-corpo">
          <div className="inicio-pendencias plat-pendencias">
            {pendencias.length === 0 ? (
              <span className="inicio-pendencia ok">
                <Icon name="check-circle" size={16} /> Nada pendente na plataforma
              </span>
            ) : (
              pendencias.map((p) => (
                <Link key={p.texto} to={p.para} className="inicio-pendencia">
                  {p.texto} <Icon name="chevron-right" size={16} />
                </Link>
              ))
            )}
          </div>

          <div className="chk-kpis">
            <div className="chk-kpi escuro">
              <span className="chk-kpi-rotulo">Points</span>
              <span className="chk-kpi-valor">{painel.totais.points}</span>
              <span className="chk-kpi-nota">
                {painel.totais.points_novos_mes > 0
                  ? `+${painel.totais.points_novos_mes} neste mês`
                  : "nenhum novo neste mês"}
              </span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Alunos ativos</span>
              <span className="chk-kpi-valor">{painel.totais.alunos}</span>
              <span className="chk-kpi-nota">
                {painel.totais.alunos_novos_mes > 0
                  ? `+${painel.totais.alunos_novos_mes} neste mês`
                  : "nenhum novo neste mês"}
              </span>
            </div>
            <div className="chk-kpi limao">
              <span className="chk-kpi-rotulo">Recebido no mês</span>
              <span className="chk-kpi-valor plat-valor">{formatarReais(painel.totais.recebido_mes)}</span>
              <span className="chk-kpi-nota">
                {variacao(painel.totais.recebido_mes, painel.totais.recebido_mes_anterior).texto}
              </span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Movimento no mês</span>
              <span className="chk-kpi-valor">{painel.totais.checkins_mes}</span>
              <span className="chk-kpi-nota">
                check-ins de plataforma · {plural(painel.totais.experimentais_mes, "experimental", "experimentais")}
              </span>
            </div>
          </div>

          <div className="plat-linha">
            <section className="alunos-card plat-points">
              <div className="inicio-exp-topo">
                <h2 className="chk-secao-titulo">Points</h2>
                <Link to="/dono-app/points" className="inicio-link-claro aluno-link">
                  Gerenciar <Icon name="chevron-right" size={16} />
                </Link>
              </div>
              {painel.points.length === 0 ? (
                <p className="alunos-vazio">Nenhum Point ainda — crie o primeiro em "+ Novo Point".</p>
              ) : (
                <div className="alunos-tabela" role="table" aria-label="Points">
                  <div className="alunos-linha plat-grade alunos-cabecalho" role="row">
                    <span role="columnheader">Point</span>
                    <span role="columnheader">Alunos</span>
                    <span role="columnheader">Professores</span>
                    <span role="columnheader">Turmas</span>
                    <span role="columnheader">Recebido (mês)</span>
                  </div>
                  {painel.points.map((p) => (
                    <div key={p.id} className="alunos-linha plat-grade" role="row">
                      <div className="alunos-pessoa-texto" role="cell">
                        <span className="alunos-nome">{p.nome}</span>
                        <span className="alunos-sub">
                          {p.admins === 0 ? (
                            <span className="plat-sem-admin">sem admin</span>
                          ) : (
                            `desde ${new Date(p.criado_em + "T00:00").toLocaleDateString("pt-BR", { month: "short", year: "numeric" }).replace(".", "")}`
                          )}
                        </span>
                      </div>
                      <span role="cell" data-rotulo="Alunos">
                        {p.alunos}
                      </span>
                      <span role="cell" data-rotulo="Professores">
                        {p.professores}
                      </span>
                      <span role="cell" data-rotulo="Turmas">
                        {p.turmas}
                      </span>
                      <span role="cell" data-rotulo="Recebido no mês" className="plat-recebido">
                        <strong>{formatarReais(p.recebido_mes)}</strong>
                        {(() => {
                          const v = variacao(p.recebido_mes, p.recebido_mes_anterior);
                          return v.boa === null ? null : (
                            <span className={v.boa ? "plat-var boa" : "plat-var ruim"}>{v.texto.split(" vs.")[0]}</span>
                          );
                        })()}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </section>

            <div className="plat-lateral">
              <section className="plat-integracoes">
                <div className="inicio-exp-topo">
                  <h2>Integrações</h2>
                  <span className="plat-24h">últimas 24h</span>
                </div>
                {painel.integracoes.map((i) => {
                  const status = i.erros_24h > 0 ? "erro" : i.total_24h > 0 ? "ok" : "parado";
                  return (
                    <div key={i.integracao} className="plat-integracao">
                      <span className={`plat-status ${status}`} aria-hidden="true" />
                      <span className="plat-integracao-texto">
                        <span className="plat-integracao-nome">{NOME_INTEGRACAO[i.integracao]}</span>
                        <span className="plat-integracao-sub">
                          {i.total_24h === 0
                            ? i.ultimo_erro_em
                              ? `sem chamadas · último erro ${quando(i.ultimo_erro_em)}`
                              : "sem chamadas"
                            : `${plural(i.total_24h, "chamada", "chamadas")}${i.erros_24h > 0 ? ` · ${plural(i.erros_24h, "erro", "erros")}` : " · tudo certo"}`}
                        </span>
                      </span>
                    </div>
                  );
                })}
                <Link to="/dono-app/integracoes" className="inicio-checkins-link">
                  Ver logs <Icon name="chevron-right" size={14} />
                </Link>
              </section>

              <section className="alunos-card">
                <h2 className="chk-secao-titulo">Convites de admin</h2>
                {convitesPendentes.length === 0 && convitesExpirados.length === 0 ? (
                  <p className="alunos-sub">Nenhum convite pendente.</p>
                ) : (
                  <ul className="perfil-lista">
                    {[...convitesPendentes, ...convitesExpirados].slice(0, 5).map((c) => (
                      <li key={c.id}>
                        <span className="alunos-pessoa-texto">
                          <span className="alunos-nome">{c.nome}</span>
                          <span className="alunos-sub">{c.point.nome}</span>
                        </span>
                        <span className={c.expirado ? "status-pill status-risk" : "status-pill status-neutral"}>
                          {c.expirado ? "Expirado" : "Aguardando"}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </div>
        </div>
      )}
    </Layout>
  );
}
