import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { WellhubCheckin, WellhubReconciliacao } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** "2026-09-05" — sem passar por UTC (toISOString mudaria o dia à noite). */
function isoLocal(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

/** "2026-09-05" → "05/09". */
function diaMes(iso: string): string {
  const [, mes, dia] = iso.split("-");
  return `${dia}/${mes}`;
}

function mensagemDeErro(e: unknown, padrao: string): string {
  return e instanceof ApiError ? e.message : padrao;
}

/** Wellhub (pedido do usuário, 2026-09-22/29, protocolo 15968485) — os
 * check-ins que a Wellhub validou nesse Point (automático via webhook ou
 * digitado na hora) e o "acerto do mês": check-ins feitos x aulas de fato
 * frequentadas por aluno. Sem trava nenhuma — é só pra acompanhar (ver
 * app/services/wellhub.py no backend pro porquê de não amarrar check-in
 * com aula). */
export default function AdminPointWellhub() {
  const navigate = useNavigate();

  const [mes, setMes] = useState(() => {
    const hoje = new Date();
    return new Date(hoje.getFullYear(), hoje.getMonth(), 1);
  });
  const [checkins, setCheckins] = useState<WellhubCheckin[]>([]);
  const [reconciliacao, setReconciliacao] = useState<WellhubReconciliacao | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);
  const [formularioAberto, setFormularioAberto] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    const mesParam = isoLocal(mes).slice(0, 7);
    try {
      const [checkinsRes, reconciliacaoRes] = await Promise.all([
        api.get<WellhubCheckin[]>(`/wellhub/checkins?mes=${mesParam}`),
        api.get<WellhubReconciliacao>(`/wellhub/reconciliacao?mes=${mesParam}`),
      ]);
      setCheckins(checkinsRes);
      setReconciliacao(reconciliacaoRes);
    } catch {
      setErro("Não foi possível carregar os check-ins da Wellhub. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, [mes]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  function mudarMes(delta: number) {
    setLoading(true);
    setMes((atual) => new Date(atual.getFullYear(), atual.getMonth() + delta, 1));
  }

  const rotuloMes = mes.toLocaleDateString("pt-BR", { month: "long", year: "numeric" });

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Wellhub</h1>
      </div>

      <p className="cobranca-subtitulo">
        Check-ins validados pela Wellhub nesse Point. A Wellhub não sabe em qual aula o aluno vai —
        só que o benefício está ativo no dia. "Aulas feitas" vem da presença normal que já é
        marcada na agenda.
      </p>

      <div className="caixa-mes-nav">
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mudarMes(-1)}
          aria-label="Mês anterior"
        >
          <Icon name="chevron-left" size={16} />
        </button>
        <span className="caixa-mes-rotulo">{rotuloMes}</span>
        <button
          type="button"
          className="secondary cobranca-btn-icone"
          onClick={() => mudarMes(1)}
          aria-label="Próximo mês"
        >
          <Icon name="chevron-right" size={16} />
        </button>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && (
        <>
          <section className="section">
            <h2>Acerto do mês</h2>
            {!reconciliacao || reconciliacao.linhas.length === 0 ? (
              <p className="empty-state">Ninguém com check-in ou aula Wellhub nesse mês.</p>
            ) : (
              <div className="card-list">
                {reconciliacao.linhas.map((linha, i) => (
                  <div className="item-card" key={linha.aluno_id ?? linha.gympass_id ?? i}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {linha.aluno_nome ?? "Aluno não vinculado"}
                      </span>
                      <span className="item-card-subtitle">
                        {linha.gympass_id ?? "sem Gympass ID nos check-ins"}
                      </span>
                    </div>
                    <div className="wellhub-contagens">
                      <div className="wellhub-contagem">
                        <span className="wellhub-contagem-numero">{linha.checkins_no_mes}</span>
                        <span className="wellhub-contagem-rotulo">check-ins</span>
                      </div>
                      <div className="wellhub-contagem">
                        <span className="wellhub-contagem-numero">{linha.aulas_no_mes}</span>
                        <span className="wellhub-contagem-rotulo">aulas</span>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Check-ins do mês ({checkins.length})</h2>
            {checkins.length === 0 ? (
              <p className="empty-state">Nenhum check-in nesse mês.</p>
            ) : (
              <div className="card-list">
                {checkins.map((c) => (
                  <div className="item-card" key={c.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{c.aluno_nome ?? c.gympass_id}</span>
                      <span className="item-card-subtitle">
                        {diaMes(c.data)} · {c.gympass_id}
                      </span>
                    </div>
                    <span className={`status-pill ${c.origem === "webhook" ? "status-good" : "status-info"}`}>
                      {c.origem === "webhook" ? "Automático" : "Manual"}
                    </span>
                  </div>
                ))}
              </div>
            )}
          </section>
        </>
      )}

      <button type="button" className="fab" onClick={() => setFormularioAberto(true)}>
        <Icon name="plus" />
        Registrar check-in
      </button>

      {formularioAberto && (
        <CheckinManualModal
          onFechar={() => setFormularioAberto(false)}
          onSalvo={() => {
            setFormularioAberto(false);
            carregar();
          }}
        />
      )}
    </Layout>
  );
}

function CheckinManualModal({ onFechar, onSalvo }: { onFechar: () => void; onSalvo: () => void }) {
  const [gympassId, setGympassId] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function salvar(e: React.FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/wellhub/checkins", { gympass_id: gympassId.trim() });
      onSalvo();
    } catch (e) {
      setErro(mensagemDeErro(e, "Não foi possível validar esse check-in."));
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <form className="modal-card form-card" onClick={(e) => e.stopPropagation()} onSubmit={salvar}>
        <div className="cobranca-modal-topo">
          <h2>Registrar check-in</h2>
          <button
            type="button"
            className="secondary cobranca-btn-icone"
            onClick={onFechar}
            aria-label="Fechar"
          >
            <Icon name="x" size={16} />
          </button>
        </div>

        <label>
          Gympass ID
          <input
            value={gympassId}
            onChange={(e) => setGympassId(e.target.value)}
            placeholder="13 dígitos, do app do aluno"
            maxLength={20}
            required
            autoFocus
          />
        </label>

        <p className="cobranca-dica">
          Use quando o aluno mostrar o Gympass ID na recepção — o mesmo que o webhook automático
          registraria sozinho, se já estiver cadastrado no portal da Wellhub.
        </p>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Validando..." : "Validar check-in"}
        </button>
      </form>
    </div>
  );
}
