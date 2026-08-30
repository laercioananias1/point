import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { diaSemanaDeData, somarDias, toISODate } from "../../components/Calendar";
import { DIAS_SEMANA, horarioFim } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

const DIAS_NA_TIRA = 21;

function sessoesDoDia(turmas: TurmaResumo[], data: Date): TurmaResumo[] {
  const iso = toISODate(data);
  const diaSemana = diaSemanaDeData(data);
  return turmas
    .filter((t) => {
      if (!t.dias_semana.includes(diaSemana)) return false;
      if (iso < t.periodo_inicio) return false;
      if (t.periodo_fim !== null && iso > t.periodo_fim) return false;
      if (t.excecoes.includes(iso)) return false;
      return true;
    })
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

/** Pedido do usuário, 2026-08-26: "a forma que está comprar aula avulsa
 * está errada. Primeiro precisa deixar ela dentro de créditos... o fluxo
 * da compra pode ser parecido com a utilização dos créditos — abre o
 * calendário de dias, seleciona o horário e confirma a compra". Mesmo
 * padrão da tela de reagendar crédito (tira de dias + lista de sessões),
 * mas sem restrição de professor — é uma compra nova, não o uso de um
 * crédito já ligado a um professor específico. */
export default function AlunoComprarAvulsa() {
  const navigate = useNavigate();
  const [modalidade, setModalidade] = useState("");
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [diaSelecionado, setDiaSelecionado] = useState(() => new Date());
  const [sessaoSelecionada, setSessaoSelecionada] = useState<TurmaResumo | null>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const buscar = useCallback(async (filtro: string) => {
    setCarregando(true);
    try {
      const query = filtro ? `?modalidade=${encodeURIComponent(filtro)}` : "";
      setTurmas(await api.get<TurmaResumo[]>(`/turmas${query}`));
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    buscar("");
  }, [buscar]);

  async function confirmar() {
    if (!sessaoSelecionada) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/matriculas", {
        turma_id: sessaoSelecionada.id,
        tipo: "avulsa",
        fonte_pagamento: "pix",
        data_aula: toISODate(diaSelecionado),
      });
      navigate("/aluno/creditos");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível comprar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  const dias = Array.from({ length: DIAS_NA_TIRA }, (_, i) => somarDias(new Date(), i));
  const sessoes = sessoesDoDia(turmas, diaSelecionado);
  const rotuloDia = diaSelecionado
    .toLocaleDateString("pt-BR", { weekday: "long", day: "2-digit", month: "long" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/aluno/creditos")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Comprar aula avulsa</h1>
      </div>

      {sessaoSelecionada ? (
        <div className="section">
          <div className="item-card-info">
            <span className="item-card-title">{sessaoSelecionada.modalidade.nome}</span>
            <span className="item-card-subtitle">
              {rotuloDia} · {sessaoSelecionada.horario} –{" "}
              {horarioFim(sessaoSelecionada.horario, sessaoSelecionada.duracao_minutos)} ·{" "}
              {sessaoSelecionada.quadra.nome} · {sessaoSelecionada.vinculo.point.nome} · com{" "}
              {sessaoSelecionada.vinculo.professor.nome}
            </span>
            <span className="item-card-subtitle">
              {formatarReais(sessaoSelecionada.modalidade.preco_avulso)} · pagamento via Pix
            </span>
          </div>

          {erro && <p className="form-error">{erro}</p>}

          <div className="modal-actions" style={{ marginTop: 12 }}>
            <button disabled={enviando} onClick={confirmar}>
              {enviando ? "Comprando..." : "Confirmar compra"}
            </button>
            <button className="secondary" disabled={enviando} onClick={() => setSessaoSelecionada(null)}>
              Escolher outra sessão
            </button>
          </div>
        </div>
      ) : (
        <>
          <form
            onSubmit={(e) => {
              e.preventDefault();
              buscar(modalidade);
            }}
            style={{ display: "flex", gap: "8px", margin: "8px 0" }}
          >
            <input
              placeholder="Filtrar por modalidade (ex.: beach tennis)"
              value={modalidade}
              onChange={(e) => setModalidade(e.target.value)}
              style={{ flex: 1 }}
            />
            <button type="submit" className="secondary">
              Buscar
            </button>
          </form>

          <div className="day-strip">
            {dias.map((data) => {
              const iso = toISODate(data);
              const ativo = iso === toISODate(diaSelecionado);
              const temSessao = sessoesDoDia(turmas, data).length > 0;
              return (
                <button
                  key={iso}
                  type="button"
                  className={ativo ? "day-pill active" : "day-pill"}
                  disabled={!temSessao}
                  onClick={() => setDiaSelecionado(data)}
                >
                  <span className="day-pill-label">
                    {DIAS_SEMANA.find((d) => d.value === diaSemanaDeData(data))?.label ?? ""}
                  </span>
                  <span className="day-pill-numero">{data.getDate()}</span>
                </button>
              );
            })}
          </div>

          <h2 style={{ fontSize: 15, marginTop: 4 }}>{rotuloDia}</h2>
          {carregando ? (
            <p className="empty-state">Carregando turmas...</p>
          ) : sessoes.length === 0 ? (
            <p className="empty-state">Nenhuma sessão nesse dia — escolha outro na tira acima.</p>
          ) : (
            <div className="card-list">
              {sessoes.map((t) => (
                <div
                  key={t.id}
                  className="item-card item-card-clickable"
                  role="button"
                  tabIndex={0}
                  onClick={() => setSessaoSelecionada(t)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") setSessaoSelecionada(t);
                  }}
                >
                  <div className="item-card-info">
                    <span className="item-card-title">{t.modalidade.nome}</span>
                    <span className="item-card-subtitle">
                      {t.horario} – {horarioFim(t.horario, t.duracao_minutos)} · {t.quadra.nome} ·{" "}
                      {t.vinculo.point.nome} · com {t.vinculo.professor.nome}
                    </span>
                  </div>
                  <span className="item-card-subtitle">{formatarReais(t.modalidade.preco_avulso)}</span>
                </div>
              ))}
            </div>
          )}
        </>
      )}
    </Layout>
  );
}
