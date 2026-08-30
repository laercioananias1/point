import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import type { Credito, CreditoStatus } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";

const FILTROS: { valor: CreditoStatus; label: string }[] = [
  { valor: "disponivel", label: "Ativos" },
  { valor: "expirado", label: "Vencidos" },
  { valor: "usado", label: "Usados" },
];

/** Pedido do usuário, 2026-08-26 (tela inicial parecida com app de
 * academia): "o botão Meus créditos, onde vai listar os créditos com
 * filtros de ativos, vencidos". Tela cheia própria, separada da Agenda —
 * é só sobre créditos de reposição, com aba de status. */
export default function AlunoCreditos() {
  const navigate = useNavigate();
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

  const filtrados = creditos.filter((c) => c.status === filtro);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/aluno")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Meus créditos</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Cada crédito vem de uma aula cancelada com antecedência — use pra reagendar em outra sessão.
        Sem crédito disponível? Compre uma aula avulsa pelo atalho "Agendar" na Início.
      </p>

      {!pronto && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <div className="view-switch" style={{ marginBottom: 16 }}>
            {FILTROS.map((f) => (
              <button
                key={f.valor}
                type="button"
                className={filtro === f.valor ? "view-switch-btn active" : "view-switch-btn"}
                onClick={() => setFiltro(f.valor)}
              >
                {f.label} ({creditos.filter((c) => c.status === f.valor).length})
              </button>
            ))}
          </div>

          {filtrados.length === 0 ? (
            <p className="empty-state">
              {filtro === "disponivel"
                ? "Nenhum crédito ativo no momento — créditos aparecem aqui quando você cancela uma aula com antecedência, ou quando o Point cancela por força maior."
                : filtro === "expirado"
                  ? "Nenhum crédito vencido."
                  : "Nenhum crédito usado ainda."}
            </p>
          ) : (
            <div className="card-list">
              {filtrados.map((c) => (
                <div className="item-card" key={c.id}>
                  <div className="item-card-info">
                    <span className="item-card-title">
                      {c.motivo === "forca_maior" ? "Aula cancelada pelo Point" : "Cancelamento antecipado"}
                    </span>
                    <span className="item-card-subtitle">
                      {c.modalidade_nome} com {c.professor_nome} · aula de {c.data_aula}
                    </span>
                    <span className="item-card-subtitle">
                      {c.status === "disponivel" ? "válido até" : c.status === "expirado" ? "venceu em" : "usado — válido até"}{" "}
                      {c.data_expiracao}
                    </span>
                  </div>
                  {c.status === "disponivel" ? (
                    <button onClick={() => navigate(`/aluno/creditos/${c.id}/reagendar`)}>Reagendar</button>
                  ) : (
                    <StatusPill status={c.status} />
                  )}
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
