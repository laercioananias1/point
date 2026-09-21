import { useCallback, useEffect, useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ExperimentalConfig, TurmaResumo, Vinculo } from "../../api/types";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { Icon, Layout } from "../../components/Layout";
import { BotaoFlutuante } from "../../components/BotaoFlutuante";
import { rotuloTurma } from "../../lib/dias";

function rotuloPeriodo(inicio: string, fim: string | null): string {
  const data = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("pt-BR");
  return fim === null ? `desde ${data(inicio)} · recorrente` : `${data(inicio)} – ${data(fim)}`;
}

/** Turmas do professor (pedido do usuário, 2026-08-25: "seguindo o mesmo
 * padrão" do aluno — virou aba própria). Tudo que é POR TURMA (não por
 * data específica, que fica na Agenda): criar turma e prolongar período.
 *
 * Pedido do usuário, 2026-08-26: tirou "Matrículas ativas" — desde que
 * dinheiro saiu do sistema, essa lista tinha virado só um status estático
 * ("aguardando o aluno pagar via Pix") sem nenhuma ação possível pro
 * professor, "não to vendo sentido nesse relatório". Também tirou o
 * "Check-in TotalPass" de cada turma (pedido do usuário, 2026-08-26) — sem
 * a credencial da TotalPass configurada ainda, o botão não fazia nada;
 * volta fácil quando a integração for liberada (ver
 * app/services/totalpass.py e app/routers/checkins.py, que continuam
 * intactos no backend).
 *
 * Criar turma virou tela própria (pedido do usuário, 2026-09-09: "o
 * cadastro de turma precisa seguir o padrão de cadastro. Tem que abrir
 * uma nova tela") — mesmo padrão de Modalidades/Categorias/TiposTurma:
 * um botão aqui abre CadastrarTurma.tsx, que volta pra esta lista com a
 * mensagem de sucesso via navigate state. */
export default function ProfessorTurmas() {
  const navigate = useNavigate();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [prolongando, setProlongando] = useState<{
    turmaId: number;
    periodoFimAtual: string | null;
    titulo: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, vinculosRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Vinculo[]>("/professores/me/vinculos"),
      ]);
      setTurmas(turmasRes);
      setVinculos(vinculosRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar seus dados. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const vinculosAtivos = vinculos.filter((v) => v.status === "ativo");

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/professor")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Turmas</h1>
      </div>

      {criada && <p className="form-success">{criada}</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {prolongando && (
        <ProlongarTurmaModal
          turmaId={prolongando.turmaId}
          periodoFimAtual={prolongando.periodoFimAtual}
          titulo={prolongando.titulo}
          onFechar={() => setProlongando(null)}
          onProlongada={() => {
            setProlongando(null);
            carregar();
          }}
        />
      )}

      {pronto && (
        <>
          <section className="section">
            <h2>Turmas ({turmas.length})</h2>
            {turmas.length === 0 ? (
              <p className="empty-state">
                Nenhuma turma ainda — crie uma dentro de um vínculo ativo.
              </p>
            ) : (
              <div className="card-list">
                {turmas.map((t) => (
                  <TurmaCard
                    key={t.id}
                    turma={t}
                    onAtualizada={carregar}
                    onProlongar={() =>
                      setProlongando({
                        turmaId: t.id,
                        periodoFimAtual: t.periodo_fim,
                        titulo: rotuloTurma(t.dias_semana, t.horario),
                      })
                    }
                  />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            {vinculosAtivos.length === 0 ? (
              <p className="form-error">
                Você precisa de um vínculo aprovado por um Point antes de criar turmas.
              </p>
            ) : (
              <BotaoFlutuante to="/professor/turmas/cadastrar" rotulo="Nova turma" />
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

/** Modal isolado só pra estender o período de uma turma (pedido do usuário,
 * 2026-08-20). */
function ProlongarTurmaModal({
  turmaId,
  periodoFimAtual,
  titulo,
  onFechar,
  onProlongada,
}: {
  turmaId: number;
  periodoFimAtual: string | null;
  titulo: string;
  onFechar: () => void;
  onProlongada: () => void;
}) {
  const [semFim, setSemFim] = useState(false);
  const [novoFim, setNovoFim] = useState(() => daquiA(90));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") onFechar();
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [onFechar]);

  async function prolongar() {
    setEnviando(true);
    setErro(null);
    try {
      await api.patch(`/turmas/${turmaId}/periodo`, { periodo_fim: semFim ? null : novoFim });
      onProlongada();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível prolongar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="modal-backdrop" onClick={onFechar}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <div className="item-card-info">
          <span className="item-card-title">{titulo}</span>
        </div>

        {erro && <p className="form-error">{erro}</p>}

        {periodoFimAtual === null ? (
          <p className="empty-state" style={{ padding: 0 }}>
            Essa turma já é recorrente, sem data de término.
          </p>
        ) : (
          <>
            <p className="empty-state" style={{ padding: 0 }}>
              Termina em {new Date(periodoFimAtual + "T00:00").toLocaleDateString("pt-BR")}. Escolha
              a nova data de término.
            </p>
            <label>
              Novo fim do período
              <input
                type="date"
                value={novoFim}
                min={periodoFimAtual}
                onChange={(e) => setNovoFim(e.target.value)}
                disabled={semFim}
              />
            </label>
            <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
              <input
                type="checkbox"
                checked={semFim}
                onChange={(e) => setSemFim(e.target.checked)}
                style={{ width: "auto" }}
              />
              Sem data de término (recorrente)
            </label>
          </>
        )}

        <div className="modal-actions">
          {periodoFimAtual !== null && (
            <button disabled={enviando} onClick={prolongar}>
              {enviando ? "Salvando..." : "Confirmar"}
            </button>
          )}
          <button className="secondary" disabled={enviando} onClick={onFechar}>
            {periodoFimAtual === null ? "Fechar" : "Cancelar"}
          </button>
        </div>
      </div>
    </div>
  );
}

function TurmaCard({
  turma,
  onProlongar,
  onAtualizada,
}: {
  turma: TurmaResumo;
  onProlongar: () => void;
  onAtualizada: () => void;
}) {
  const [salvandoExperimental, setSalvandoExperimental] = useState(false);

  async function mudarAulaExperimental(valor: ExperimentalConfig) {
    setSalvandoExperimental(true);
    try {
      await api.patch(`/turmas/${turma.id}/aula-experimental`, { aula_experimental: valor });
      onAtualizada();
    } catch {
      // Sem tratamento especial de erro aqui — é um select simples; se
      // falhar, a turma continua com o valor antigo na próxima recarga.
    } finally {
      setSalvandoExperimental(false);
    }
  }

  return (
    <div className="item-card" style={{ alignItems: "flex-start" }}>
      <div className="item-card-info" style={{ flex: 1 }}>
        <span className="item-card-title">
          {rotuloTurma(turma.dias_semana, turma.horario)}
          {turma.privada && (
            <span className="status-pill status-info" style={{ marginLeft: 8 }}>
              Privada
            </span>
          )}
          {turma.aula_experimental !== "nao" && (
            <span className="status-pill status-good" style={{ marginLeft: 8 }}>
              {turma.aula_experimental === "somente" ? "Só experimental" : "Aceita experimental"}
            </span>
          )}
        </span>
        <span className="item-card-subtitle">
          <CategoriaBadge nome={turma.categoria.nome} cor={turma.categoria.cor} /> · {turma.tipo_turma.nome}
        </span>
        <span className="item-card-subtitle">
          {turma.modalidade.nome} · {turma.quadra.nome} · {turma.vinculo.point.nome} · com{" "}
          {turma.vinculo.professor.nome} · {turma.capacidade} vaga(s)
        </span>
        <span className="item-card-subtitle">
          {rotuloPeriodo(turma.periodo_inicio, turma.periodo_fim)}
        </span>
        <label style={{ marginTop: 4 }}>
          Aula experimental
          <select
            value={turma.aula_experimental}
            disabled={salvandoExperimental}
            onChange={(e) => mudarAulaExperimental(e.target.value as ExperimentalConfig)}
          >
            <option value="nao">Não participa</option>
            <option value="aceita">Aceita (vaga livre pra visitante)</option>
            <option value="somente">Somente experimental</option>
          </select>
        </label>
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={onProlongar}>
          Prolongar período
        </button>
      </div>
    </div>
  );
}

function daquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}
