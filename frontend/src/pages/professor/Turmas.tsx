import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Modalidade, Quadra, TurmaResumo, Vinculo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA, rotuloTurma } from "../../lib/dias";

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
 * intactos no backend). */
export default function ProfessorTurmas() {
  const navigate = useNavigate();
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
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Turmas</h1>
      </div>

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
            <h2>Criar turma</h2>
            {vinculosAtivos.length === 0 ? (
              <p className="empty-state">
                Você precisa de um vínculo aprovado por um Point antes de criar turmas.
              </p>
            ) : (
              <CriarTurmaForm vinculos={vinculosAtivos} onCriada={carregar} />
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

function TurmaCard({ turma, onProlongar }: { turma: TurmaResumo; onProlongar: () => void }) {
  return (
    <div className="item-card" style={{ alignItems: "flex-start" }}>
      <div className="item-card-info" style={{ flex: 1 }}>
        <span className="item-card-title">{rotuloTurma(turma.dias_semana, turma.horario)}</span>
        <span className="item-card-subtitle">
          {turma.modalidade.nome} · {turma.quadra.nome} · {turma.vinculo.point.nome} · com{" "}
          {turma.vinculo.professor.nome} · {turma.capacidade} vaga(s)
        </span>
        <span className="item-card-subtitle">
          {rotuloPeriodo(turma.periodo_inicio, turma.periodo_fim)}
        </span>
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={onProlongar}>
          Prolongar período
        </button>
      </div>
    </div>
  );
}

// Horas cheias disponíveis pra seleção — cobre a janela típica de
// funcionamento de uma arena (manhã cedo até o fim da noite).
const HORAS_DISPONIVEIS = Array.from({ length: 19 }, (_, i) => i + 5); // 5h..23h

function toggleEmLista<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function daquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

function CriarTurmaForm({
  vinculos,
  onCriada,
}: {
  vinculos: Vinculo[];
  onCriada: () => void;
}) {
  const [vinculoId, setVinculoId] = useState(vinculos[0]?.id ?? 0);
  const vinculoAtual = vinculos.find((v) => v.id === vinculoId);
  const pointId = vinculoAtual?.point_id ?? 0;

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeId, setModalidadeId] = useState<number | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<number | null>(null);

  const [capacidade, setCapacidade] = useState("4");
  const [duracaoMinutos, setDuracaoMinutos] = useState("60");
  const [periodoInicio, setPeriodoInicio] = useState(hoje());
  const [periodoFim, setPeriodoFim] = useState(daquiA(90));
  const [recorrente, setRecorrente] = useState(false);
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<number[]>([]);

  // Dias/horários que o Point permite (pedido do usuário, 2026-08-21) — só
  // mostra o que dá pra escolher, em vez de deixar tentar e levar erro. Dia
  // de semana e fim de semana têm horários independentes (sábado costuma
  // ter só parte da manhã), então o horário liberado depende de quais dias
  // já estão marcados — mostra a união dos grupos representados.
  const diasPermitidos = [
    ...(vinculoAtual?.point.dias_semana_funcionamento ?? []),
    ...(vinculoAtual?.point.dias_fds_funcionamento ?? []),
  ];
  const temDiaDeSemanaMarcado = diasSemana.some((d) => d !== "sábado" && d !== "domingo");
  const temFdsMarcado = diasSemana.some((d) => d === "sábado" || d === "domingo");
  const horariosPermitidos = Array.from(
    new Set([
      ...(temDiaDeSemanaMarcado || !temFdsMarcado
        ? vinculoAtual?.point.horarios_semana_funcionamento ?? []
        : []),
      ...(temFdsMarcado || !temDiaDeSemanaMarcado
        ? vinculoAtual?.point.horarios_fds_funcionamento ?? []
        : []),
    ]),
  );

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState<string | null>(null);

  useEffect(() => {
    if (!pointId) return;
    api.get<Modalidade[]>(`/modalidades?point_id=${pointId}`).then((res) => {
      setModalidades(res);
      setModalidadeId(res[0]?.id ?? null);
    });
  }, [pointId]);

  useEffect(() => {
    const modalidade = modalidades.find((m) => m.id === modalidadeId);
    if (modalidade) setDuracaoMinutos(String(modalidade.duracao_padrao_minutos));

    if (!pointId || modalidadeId === null) {
      setQuadras([]);
      setQuadraId(null);
      return;
    }
    api.get<Quadra[]>(`/quadras?point_id=${pointId}&modalidade_id=${modalidadeId}`).then((res) => {
      setQuadras(res);
      setQuadraId(res[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, modalidadeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(null);

    if (modalidadeId === null || quadraId === null) return;
    if (diasSemana.length === 0 || horarios.length === 0) {
      setErro("Escolha pelo menos um dia e um horário.");
      return;
    }
    if (!recorrente && periodoInicio > periodoFim) {
      setErro("O início do período precisa ser antes do fim.");
      return;
    }

    setEnviando(true);
    try {
      const turmasCriadas = await api.post<unknown[]>("/turmas", {
        vinculo_id: vinculoId,
        modalidade_id: modalidadeId,
        quadra_id: quadraId,
        capacidade: Number(capacidade),
        periodo_inicio: periodoInicio,
        periodo_fim: recorrente ? null : periodoFim,
        dias_semana: diasSemana,
        horarios: horarios.map((h) => `${String(h).padStart(2, "0")}:00`),
        duracao_minutos: Number(duracaoMinutos),
        recorrencia: "semanal",
      });
      setSucesso(
        turmasCriadas.length === 1
          ? `1 turma criada (${diasSemana.length} dia(s) por semana).`
          : `${turmasCriadas.length} turmas criadas — uma por horário, cada uma nos ${diasSemana.length} dia(s) marcados.`,
      );
      setDiasSemana([]);
      setHorarios([]);
      onCriada();
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível criar a turma. Confira os valores e tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (modalidades.length === 0) {
    return (
      <p className="empty-state">
        Nenhuma modalidade cadastrada nesse Point ainda — peça pro admin cadastrar
        modalidades e quadras antes.
      </p>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit}>
      {vinculos.length > 1 && (
        <label>
          Point
          <select value={vinculoId} onChange={(e) => setVinculoId(Number(e.target.value))}>
            {vinculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.point.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Modalidade
        <select
          value={modalidadeId ?? ""}
          onChange={(e) => setModalidadeId(Number(e.target.value))}
        >
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      {quadras.length === 0 ? (
        <p className="empty-state" style={{ padding: 0 }}>
          Nenhuma quadra cadastrada pra essa modalidade — peça pro admin associar uma.
        </p>
      ) : (
        <div className="form-row">
          <label>
            Quadra
            <select value={quadraId ?? ""} onChange={(e) => setQuadraId(Number(e.target.value))}>
              {quadras.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacidade
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              required
            />
          </label>
        </div>
      )}

      <label>
        Duração da aula (min)
        <input
          type="number"
          min="15"
          step="15"
          value={duracaoMinutos}
          onChange={(e) => setDuracaoMinutos(e.target.value)}
          required
        />
      </label>

      <div className="form-row">
        <label>
          Início do período
          <input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            required
          />
        </label>
        <label>
          Fim do período
          <input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            disabled={recorrente}
            required={!recorrente}
          />
        </label>
      </div>

      <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={recorrente}
          onChange={(e) => setRecorrente(e.target.checked)}
          style={{ width: "auto" }}
        />
        Sem data de término (recorrente)
      </label>

      <label>
        Dias da semana
        {diasPermitidos.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Esse Point ainda não configurou os dias em que funciona.
          </p>
        ) : (
          <div className="toggle-grid">
            {DIAS_SEMANA.filter((d) => diasPermitidos.includes(d.value)).map((d) => (
              <button
                key={d.value}
                type="button"
                className={diasSemana.includes(d.value) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setDiasSemana((atual) => toggleEmLista(atual, d.value))}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </label>

      <label>
        Horários (hora cheia)
        {horariosPermitidos.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Esse Point ainda não configurou os horários em que funciona.
          </p>
        ) : (
          <div className="toggle-grid">
            {HORAS_DISPONIVEIS.filter((h) =>
              horariosPermitidos.includes(`${String(h).padStart(2, "0")}:00`),
            ).map((h) => (
              <button
                key={h}
                type="button"
                className={horarios.includes(h) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setHorarios((atual) => toggleEmLista(atual, h))}
              >
                {h}h
              </button>
            ))}
          </div>
        )}
      </label>

      <p className="empty-state" style={{ padding: 0 }}>
        Cria uma turma pra cada horário marcado acima, cada uma acontecendo em todos os dias
        selecionados.
      </p>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">{sucesso}</p>}

      <button type="submit" disabled={enviando || quadras.length === 0}>
        {enviando ? "Criando..." : "Criar turma(s)"}
      </button>
    </form>
  );
}
