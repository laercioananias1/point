import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ExperimentalConfig, Matricula, TurmaResumo, Vinculo } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { Layout } from "../../components/Layout";
import { rotuloDias, rotuloTurma } from "../../lib/dias";

function horaCurta(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

function rotuloPeriodo(inicio: string, fim: string | null): string {
  const data = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("pt-BR");
  return fim === null ? `desde ${data(inicio)} · recorrente` : `${data(inicio)} – ${data(fim)}`;
}

/** Mesma barra de vagas das Turmas do admin. */
function classeBarra(pct: number): string {
  if (pct >= 100) return "turmas-barra cheia";
  if (pct >= 75) return "turmas-barra alta";
  return "turmas-barra";
}

/** Turmas do professor (pedido do usuário, 2026-08-25: virou aba
 * própria). Tudo que é POR TURMA (não por data, que fica na Agenda):
 * criar turma (tela própria, CadastrarTurma.tsx — pedido do usuário,
 * 2026-09-09), prolongar período e aula experimental.
 *
 * Layout do kit (pedido do usuário, 2026-10-01: "a turmas do professor tb
 * precisa reajusta-la") — mesma tabela das Turmas do admin
 * (design/telas/Turmas.dc.html), sem a coluna Professor (o Point aparece
 * embaixo da quadra quando ele dá aula em mais de um) e com "Prolongar"
 * na linha.
 *
 * Pedido do usuário, 2026-08-26: sem "Matrículas ativas" e sem "Check-in
 * TotalPass" por turma (ver app/services/totalpass.py, intacto). */
export default function ProfessorTurmas() {
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [quadraId, setQuadraId] = useState("");
  const [pointId, setPointId] = useState("");
  const [prolongando, setProlongando] = useState<{
    turmaId: number;
    periodoFimAtual: string | null;
    titulo: string;
  } | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, matriculasRes, vinculosRes] = await Promise.all([
        api.get<TurmaResumo[]>("/professores/me/turmas"),
        api.get<Matricula[]>("/professores/me/matriculas"),
        api.get<Vinculo[]>("/professores/me/vinculos"),
      ]);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
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
  const points = Array.from(new Map(turmas.map((t) => [t.vinculo.point_id, t.vinculo.point])).values()).sort(
    (a, b) => a.nome.localeCompare(b.nome),
  );
  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values()).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
  const filtradas = turmas
    .filter((t) => {
      if (pointId && t.vinculo.point_id !== Number(pointId)) return false;
      if (quadraId && t.quadra.id !== Number(quadraId)) return false;
      return true;
    })
    .sort((a, b) => a.horario.localeCompare(b.horario) || a.modalidade.nome.localeCompare(b.modalidade.nome));

  return (
    <Layout>
      <CabecalhoPagina
        titulo="Turmas"
        contexto={pronto ? `Aulas · ${turmas.length} ${turmas.length === 1 ? "turma" : "turmas"}` : "Aulas"}
        novo={
          pronto && vinculosAtivos.length > 0 ? { para: "/professor/turmas/cadastrar", rotulo: "Nova turma" } : null
        }
      />

      {criada && <p className="form-success">{criada}</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}
      {pronto && vinculosAtivos.length === 0 && (
        <p className="form-error">Você precisa de um vínculo aprovado por um Point antes de criar turmas.</p>
      )}

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
        <section className="alunos-card">
          {turmas.length === 0 ? (
            <p className="alunos-vazio">Nenhuma turma ainda — crie uma dentro de um vínculo ativo.</p>
          ) : (
            <>
              {(points.length > 1 || quadras.length > 1) && (
                <div className="alunos-filtros turmas-filtros">
                  {points.length > 1 && (
                    <select
                      className="filtro-pilula"
                      aria-label="Filtrar por Point"
                      value={pointId}
                      onChange={(e) => setPointId(e.target.value)}
                    >
                      <option value="">Todos os Points</option>
                      {points.map((p) => (
                        <option key={p.id} value={p.id}>
                          {p.nome}
                        </option>
                      ))}
                    </select>
                  )}
                  {quadras.length > 1 && (
                    <select
                      className="filtro-pilula"
                      aria-label="Filtrar por quadra"
                      value={quadraId}
                      onChange={(e) => setQuadraId(e.target.value)}
                    >
                      <option value="">Todas as quadras</option>
                      {quadras.map((q) => (
                        <option key={q.id} value={q.id}>
                          {q.nome}
                        </option>
                      ))}
                    </select>
                  )}
                </div>
              )}

              <div className="alunos-tabela" role="table" aria-label="Suas turmas">
                <div className="alunos-linha turmas-grade prof-turmas-grade alunos-cabecalho" role="row">
                  <span role="columnheader">Turma</span>
                  <span role="columnheader">Dias e horário</span>
                  <span role="columnheader">Quadra</span>
                  <span role="columnheader">Vagas</span>
                  <span role="columnheader">Experimental</span>
                  <span role="columnheader" aria-label="Ações" />
                </div>
                {filtradas.map((t) => (
                  <TurmaLinha
                    key={t.id}
                    turma={t}
                    matriculas={matriculas}
                    mostrarPoint={points.length > 1}
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
                {filtradas.length === 0 && (
                  <p className="alunos-vazio">Nenhuma turma encontrada com esse filtro.</p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </Layout>
  );
}

function TurmaLinha({
  turma: t,
  matriculas,
  mostrarPoint,
  onProlongar,
  onAtualizada,
}: {
  turma: TurmaResumo;
  matriculas: Matricula[];
  mostrarPoint: boolean;
  onProlongar: () => void;
  onAtualizada: () => void;
}) {
  const [salvando, setSalvando] = useState(false);
  const ocupadas = matriculas.filter((m) => m.turma_id === t.id && m.status === "ativa" && m.tipo === "mensal").length;
  const pct = t.capacidade > 0 ? Math.min(100, Math.round((ocupadas / t.capacidade) * 100)) : 0;

  async function mudarAulaExperimental(valor: ExperimentalConfig) {
    setSalvando(true);
    try {
      await api.patch(`/turmas/${t.id}/aula-experimental`, { aula_experimental: valor });
      onAtualizada();
    } catch {
      // Select simples — falha só deixa o valor antigo até a próxima recarga.
    } finally {
      setSalvando(false);
    }
  }

  return (
    <div className="alunos-linha turmas-grade prof-turmas-grade" role="row">
      <div className="alunos-pessoa" role="cell">
        <div className="alunos-pessoa-texto">
          <span className="alunos-nome">
            {t.modalidade.nome} · {horaCurta(t.horario)}
          </span>
          <span className="turmas-selos">
            <CategoriaBadge nome={t.categoria.nome} cor={t.categoria.cor} />
            <span className="prof-chip">{t.tipo_turma.nome}</span>
            {t.privada && <span className="status-pill status-info">Privada</span>}
          </span>
        </div>
      </div>
      <span role="cell" data-rotulo="Dias e horário">
        <span className="turmas-dias">{rotuloDias(t.dias_semana)}</span>
        <span className="alunos-sub">
          {t.horario} · {t.duracao_minutos} min · {rotuloPeriodo(t.periodo_inicio, t.periodo_fim)}
        </span>
      </span>
      <span role="cell" data-rotulo="Quadra">
        {t.quadra.nome}
        {mostrarPoint && <span className="alunos-sub prof-turmas-point">{t.vinculo.point.nome}</span>}
      </span>
      <span role="cell" data-rotulo="Vagas" title="Alunos mensais ativos / capacidade da turma">
        <span className="turmas-vagas">
          <span className="turmas-trilho">
            <span className={classeBarra(pct)} style={{ width: `${pct}%` }} />
          </span>
          <span className="turmas-contagem">
            {ocupadas}/{t.capacidade}
          </span>
        </span>
      </span>
      <span role="cell" data-rotulo="Aula experimental">
        <select
          className="filtro-pilula turmas-experimental"
          aria-label={`Aula experimental — ${t.modalidade.nome} ${t.horario}`}
          value={t.aula_experimental}
          disabled={salvando}
          onChange={(e) => mudarAulaExperimental(e.target.value as ExperimentalConfig)}
        >
          <option value="nao">Não</option>
          <option value="aceita">Aceita</option>
          <option value="somente">Só experimental</option>
        </select>
      </span>
      <span role="cell" className="prof-turmas-acao">
        <button type="button" className="secondary" onClick={onProlongar}>
          {t.periodo_fim === null ? "Recorrente" : "Prolongar"}
        </button>
      </span>
    </div>
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

function daquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}
