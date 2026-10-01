import { useState } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import type { SolicitacaoExperimental } from "../api/types";
import { Icon } from "./Layout";

const MAXIMO_NA_LISTA = 4;

function horaCurta(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

/** Pedidos de aula experimental pendentes, com Confirmar/Recusar ali
 * mesmo — card do Início do admin e do professor (kit de design,
 * Dashboard.dc.html e AgendaProfessor.dc.html; pedido do usuário,
 * 2026-10-01). GET /experimental/solicitacoes já escopa: admin vê o Point
 * inteiro, professor só as próprias turmas. */
export function PedidosExperimentais({
  pedidos,
  onMudanca,
  linkTodos,
}: {
  pedidos: SolicitacaoExperimental[];
  onMudanca: () => void;
  linkTodos: string;
}) {
  const [processando, setProcessando] = useState<number | null>(null);
  const [erro, setErro] = useState<string | null>(null);

  async function decidir(id: number, acao: "aprovar" | "recusar") {
    setErro(null);
    setProcessando(id);
    try {
      await api.patch(`/experimental/solicitacoes/${id}/${acao}`, acao === "recusar" ? { motivo_recusa: null } : {});
      onMudanca();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível responder. Tente de novo.");
    } finally {
      setProcessando(null);
    }
  }

  return (
    <aside className="alunos-card chk-recebidos">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">Aulas experimentais</h2>
        {pedidos.length > 0 && (
          <span className="status-pill status-good">
            {pedidos.length} {pedidos.length === 1 ? "pendente" : "pendentes"}
          </span>
        )}
      </div>
      <p className="alunos-sub inicio-exp-explica">
        Pedidos feitos pela página pública. Ao confirmar, o visitante é avisado pelo WhatsApp.
      </p>
      {erro && <p className="form-error">{erro}</p>}
      {pedidos.length === 0 && <p className="empty-state">Nenhum pedido aguardando resposta.</p>}
      {pedidos.slice(0, MAXIMO_NA_LISTA).map((s) => (
        <div className="inicio-exp-pedido" key={s.id}>
          <div className="inicio-exp-linha">
            <div className="alunos-pessoa-texto">
              <span className="alunos-nome">{s.nome}</span>
              <span className="alunos-sub">
                {s.turma.modalidade.nome} · {s.turma.categoria.nome}
              </span>
            </div>
            <span className="inicio-exp-quando">
              {new Date(s.data + "T00:00").toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" })}{" "}
              {horaCurta(s.turma.horario)}
            </span>
          </div>
          <div className="inicio-exp-botoes">
            <button type="button" disabled={processando !== null} onClick={() => decidir(s.id, "aprovar")}>
              {processando === s.id ? "..." : "Confirmar"}
            </button>
            <button
              type="button"
              className="secondary"
              disabled={processando !== null}
              onClick={() => decidir(s.id, "recusar")}
            >
              Recusar
            </button>
          </div>
        </div>
      ))}
      {pedidos.length > MAXIMO_NA_LISTA && (
        <Link to={linkTodos} className="inicio-checkins-link inicio-link-claro">
          Ver todos os {pedidos.length} pedidos <Icon name="chevron-right" size={14} />
        </Link>
      )}
    </aside>
  );
}
