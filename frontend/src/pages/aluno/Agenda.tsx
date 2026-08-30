import { useCallback, useEffect, useState } from "react";
import { api, ApiError } from "../../api/client";
import type { Matricula } from "../../api/types";
import { Layout } from "../../components/Layout";
import { toISODate } from "../../components/Calendar";
import { AgendaAlunoCalendario, type Ocorrencia } from "../../components/AgendaAlunoCalendario";

/** Agenda do aluno (pedido do usuário, 2026-08-25: virou aba própria, com a
 * home só mostrando um resumo dos "próximos agendamentos"). Só o calendário
 * + cancelamento de aula mensal com antecedência (gera crédito) — créditos
 * de reposição e comprar aula avulsa viraram uma tela própria a partir de
 * Início (pedido do usuário, 2026-08-26: "deixar dentro de créditos");
 * planos mensais (assinatura) ficam no Perfil.
 *
 * Pedido do usuário, 2026-08-26: tirou "Aulas ativas" (pagar/cancelar
 * avulsa, pagar mensalidade), "Histórico" e "Aguardando aprovação do
 * Point" — "vamos mudar essa forma de pagamento... deixa sem recebimento
 * por enquanto, vamos analisar junto com Wellhub quando for implementado".
 * Os endpoints (POST /pagamentos, PATCH /matriculas/{id}/aprovar|recusar|
 * cancelar) continuam existindo — o admin ainda aprova matrícula avulsa
 * pendente pelo painel dele —, só não tem mais nenhuma UI disso pro aluno
 * até a forma de cobrança nova ser decidida. */
export default function AlunoAgenda() {
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  // "pronto" só liga uma vez, no primeiro carregamento — recarregar depois
  // (ex.: após cancelar uma aula) não pode desmontar o calendário, senão ele
  // perde a visão/posição que o aluno tinha escolhido.
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [cancelando, setCancelando] = useState<Ocorrencia | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      setMatriculas(await api.get<Matricula[]>("/alunos/me/matriculas"));
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar sua agenda. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const ativas = matriculas.filter((m) => m.status === "ativa");

  return (
    <Layout>
      <h1>Agenda</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {cancelando && (
        <CancelarAulaModal
          ocorrencia={cancelando}
          onFechar={() => setCancelando(null)}
          onCancelado={() => {
            setCancelando(null);
            carregar();
          }}
        />
      )}

      {pronto && (
        <section className="section">
          <h2>Calendário</h2>
          {ativas.length === 0 ? (
            <p className="empty-state">
              Nenhuma matrícula ativa ainda — o calendário aparece aqui assim que você tiver uma.
            </p>
          ) : (
            <AgendaAlunoCalendario matriculas={ativas} onCancelar={setCancelando} />
          )}
        </section>
      )}
    </Layout>
  );
}

/** Cancelamento antecipado de uma aula específica (pedido do usuário,
 * 2026-08-20) — a matrícula continua ativa, só essa data sai da agenda e
 * gera um crédito de reposição. Popup, igual o resto do app (mesmo padrão
 * já usado na agenda do professor). */
function CancelarAulaModal({
  ocorrencia,
  onFechar,
  onCancelado,
}: {
  ocorrencia: Ocorrencia;
  onFechar: () => void;
  onCancelado: () => void;
}) {
  const { matriculaId, data } = ocorrencia;
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  const rotuloData = data.toLocaleDateString("pt-BR", {
    weekday: "long",
    day: "2-digit",
    month: "long",
  });

  async function cancelar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.post(`/matriculas/${matriculaId}/aulas/${toISODate(data)}/cancelar`, {});
      onCancelado();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível cancelar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">{ocorrencia.modalidadeNome}</span>
          <span className="item-card-subtitle">
            {rotuloData} · {ocorrencia.horario} · {ocorrencia.quadraNome} · {ocorrencia.pointNome}
          </span>
        </div>

        <p className="empty-state" style={{ padding: 0 }}>
          Cancelar com antecedência gera um crédito de reposição pra você usar em outra turma. Cada
          Point tem seu prazo mínimo — se for tarde demais, a gente avisa.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <div className="modal-actions">
          <button disabled={enviando} onClick={cancelar}>
            {enviando ? "Cancelando..." : "Cancelar esta aula (gera crédito)"}
          </button>
          <button className="secondary" disabled={enviando} onClick={onFechar}>
            Voltar
          </button>
        </div>
      </div>
    </div>
  );
}
