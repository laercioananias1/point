import { useCallback, useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { api } from "../../api/client";
import type { Credito, CreditoStatus } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

const FILTROS: { valor: CreditoStatus; label: string }[] = [
  { valor: "disponivel", label: "Ativos" },
  { valor: "expirado", label: "Vencidos" },
  { valor: "usado", label: "Usados" },
];

// Crédito que vence em até tantos dias ganha o aviso "vence em N dias".
const DIAS_AVISO_VENCIMENTO = 7;

function dataLocal(iso: string): Date {
  return new Date(iso + "T00:00");
}

function dataCurta(iso: string): string {
  return dataLocal(iso).toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Dias de hoje até a data (0 = hoje). */
function diasAte(iso: string): number {
  const hoje = new Date();
  hoje.setHours(0, 0, 0, 0);
  return Math.round((dataLocal(iso).getTime() - hoje.getTime()) / 86400000);
}

/** Pedido do usuário, 2026-08-26 (tela inicial parecida com app de
 * academia): "o botão Meus créditos, onde vai listar os créditos com
 * filtros de ativos, vencidos". Créditos de reposição, com aba de status.
 * Layout do kit (pedido do usuário, 2026-10-01): números no topo, filtros
 * em pílula e a lista num card, com o atalho pra comprar aula avulsa. */
export default function AlunoCreditos() {
  const [creditos, setCreditos] = useState<Credito[]>([]);
  const [pronto, setPronto] = useState(false);
  const [filtro, setFiltro] = useState<CreditoStatus>("disponivel");

  const carregar = useCallback(async () => {
    setCreditos(await api.get<Credito[]>("/alunos/me/creditos"));
    setPronto(true);
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const contagem = (status: CreditoStatus) => creditos.filter((c) => c.status === status).length;
  const disponiveis = creditos.filter((c) => c.status === "disponivel");
  const vencendo = disponiveis.filter((c) => diasAte(c.data_expiracao) <= DIAS_AVISO_VENCIMENTO).length;
  const filtrados = creditos
    .filter((c) => c.status === filtro)
    .sort((a, b) =>
      filtro === "disponivel"
        ? a.data_expiracao.localeCompare(b.data_expiracao)
        : b.data_aula.localeCompare(a.data_aula),
    );

  return (
    <Layout>
      <CabecalhoPagina
        titulo="Créditos"
        contexto="Reposição de aulas"
        novo={{ para: "/aluno/creditos/comprar", rotulo: "Comprar aula avulsa" }}
      />

      {!pronto && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <div className="chk-kpis creditos-kpis">
            <div className="chk-kpi limao">
              <span className="chk-kpi-rotulo">Disponíveis</span>
              <span className="chk-kpi-valor">{disponiveis.length}</span>
              <span className="chk-kpi-nota">prontos pra reagendar</span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Vencem em {DIAS_AVISO_VENCIMENTO} dias</span>
              <span className="chk-kpi-valor">{vencendo}</span>
              <span className="chk-kpi-nota">use antes de perder</span>
            </div>
            <div className="chk-kpi">
              <span className="chk-kpi-rotulo">Usados</span>
              <span className="chk-kpi-valor">{contagem("usado")}</span>
              <span className="chk-kpi-nota">aulas repostas</span>
            </div>
          </div>

          <p className="creditos-dica">
            Cada crédito vem de uma aula cancelada com antecedência — ou cancelada pelo Point por força
            maior. Use pra reagendar com o mesmo professor antes de vencer.
          </p>

          <section className="alunos-card">
            <div className="chk-meses creditos-filtros" role="tablist" aria-label="Situação do crédito">
              {FILTROS.map((f) => (
                <button
                  key={f.valor}
                  type="button"
                  role="tab"
                  aria-selected={filtro === f.valor}
                  className={filtro === f.valor ? "ativo" : ""}
                  onClick={() => setFiltro(f.valor)}
                >
                  {f.label} · {contagem(f.valor)}
                </button>
              ))}
            </div>

            {filtrados.length === 0 ? (
              <p className="alunos-vazio">
                {filtro === "disponivel" ? (
                  <>
                    Nenhum crédito ativo no momento. Quer treinar mesmo assim?{" "}
                    <Link to="/aluno/creditos/comprar">Compre uma aula avulsa</Link>.
                  </>
                ) : filtro === "expirado" ? (
                  "Nenhum crédito vencido."
                ) : (
                  "Nenhum crédito usado ainda."
                )}
              </p>
            ) : (
              <ul className="creditos-lista">
                {filtrados.map((c) => {
                  const dias = diasAte(c.data_expiracao);
                  const aula = dataLocal(c.data_aula);
                  return (
                    <li key={c.id} className="creditos-linha">
                      <span className="aluno-aula-data">
                        <span className="aluno-aula-dia">{aula.getDate()}</span>
                        <span className="aluno-aula-mes">
                          {aula.toLocaleDateString("pt-BR", { month: "short" }).replace(".", "")}
                        </span>
                      </span>
                      <span className="creditos-info">
                        <span className="alunos-nome">
                          {c.motivo === "forca_maior" ? "Aula cancelada pelo Point" : "Cancelamento antecipado"}
                        </span>
                        <span className="alunos-sub">
                          {c.modalidade_nome} com {c.professor_nome} · aula de {dataCurta(c.data_aula)}
                        </span>
                        <span className="alunos-sub">
                          {c.status === "disponivel"
                            ? `Válido até ${dataCurta(c.data_expiracao)}`
                            : c.status === "expirado"
                              ? `Venceu em ${dataCurta(c.data_expiracao)}`
                              : `Usado · era válido até ${dataCurta(c.data_expiracao)}`}
                          {c.status === "disponivel" && dias <= DIAS_AVISO_VENCIMENTO && (
                            <span className="creditos-vence">
                              {dias <= 0 ? "vence hoje" : dias === 1 ? "vence amanhã" : `vence em ${dias} dias`}
                            </span>
                          )}
                        </span>
                      </span>
                      {c.status === "disponivel" ? (
                        <Link to={`/aluno/creditos/${c.id}/reagendar`} className="botao-link creditos-reagendar">
                          <Icon name="calendar" size={16} /> Reagendar
                        </Link>
                      ) : (
                        <StatusPill status={c.status} />
                      )}
                    </li>
                  );
                })}
              </ul>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
