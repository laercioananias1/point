import { useCallback, useEffect, useState } from "react";
import { useLocation } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { ExperimentalConfig, Matricula, TurmaResumo } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { CategoriaBadge } from "../../components/CategoriaBadge";
import { Layout } from "../../components/Layout";
import { rotuloDias } from "../../lib/dias";

function horaCurta(horario: string): string {
  return horario.endsWith(":00") ? `${Number(horario.slice(0, 2))}h` : horario;
}

function rotuloPeriodo(inicio: string, fim: string | null): string {
  const data = (iso: string) => new Date(iso + "T00:00").toLocaleDateString("pt-BR");
  return fim === null ? `desde ${data(inicio)}` : `${data(inicio)} – ${data(fim)}`;
}

/** Barra de vagas do kit: cheia (≥100%) em azul, alta (≥75%) em azul-3,
 * resto em azul-claro. */
function classeBarra(pct: number): string {
  if (pct >= 100) return "turmas-barra cheia";
  if (pct >= 75) return "turmas-barra alta";
  return "turmas-barra";
}

/** Turmas do Point inteiro no layout do kit (design/telas/Turmas.dc.html;
 * pedido do usuário, 2026-10-01). Criar turma continua em tela própria
 * (admin-point/CadastrarTurma.tsx); prolongar período continua exclusivo
 * do professor dono da turma. A coluna de aula experimental não está no
 * protótipo, mas é a forma de configurar isso por turma. */
export default function AdminPointTurmas() {
  const { user } = useAuth();
  const location = useLocation();
  const criada = (location.state as { criada?: string } | null)?.criada;
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  // Filtros por professor e por quadra (pedido do usuário, 2026-08-26) —
  // "" = todos, os dois podem estar ativos ao mesmo tempo.
  const [professorId, setProfessorId] = useState("");
  const [quadraId, setQuadraId] = useState("");

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [turmasRes, matriculasRes] = await Promise.all([
        user?.point_id ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`) : Promise.resolve([]),
        api.get<Matricula[]>("/matriculas"),
      ]);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar as turmas. Tente novamente.");
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const professores = Array.from(
    new Map(turmas.map((t) => [t.vinculo.professor.id, t.vinculo.professor])).values(),
  ).sort((a, b) => a.nome.localeCompare(b.nome));
  const quadras = Array.from(new Map(turmas.map((t) => [t.quadra.id, t.quadra])).values()).sort((a, b) =>
    a.nome.localeCompare(b.nome),
  );
  const filtradas = turmas
    .filter((t) => {
      if (professorId && t.vinculo.professor.id !== Number(professorId)) return false;
      if (quadraId && t.quadra.id !== Number(quadraId)) return false;
      return true;
    })
    .sort((a, b) => a.horario.localeCompare(b.horario) || a.modalidade.nome.localeCompare(b.modalidade.nome));

  return (
    <Layout>
      <CabecalhoPagina
        titulo="Turmas"
        contexto={pronto ? `Cadastros · ${turmas.length} ${turmas.length === 1 ? "turma" : "turmas"}` : "Cadastros"}
        novo={pronto ? { para: "/admin-point/turmas/cadastrar", rotulo: "Nova turma" } : null}
      />

      {criada && <p className="form-success">{criada}</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <section className="alunos-card">
          {turmas.length === 0 ? (
            <p className="empty-state">Nenhuma turma cadastrada nesse Point ainda.</p>
          ) : (
            <>
              <div className="alunos-filtros turmas-filtros">
                <select
                  className="filtro-pilula"
                  aria-label="Filtrar por professor"
                  value={professorId}
                  onChange={(e) => setProfessorId(e.target.value)}
                >
                  <option value="">Todos os professores</option>
                  {professores.map((p) => (
                    <option key={p.id} value={p.id}>
                      {p.nome}
                    </option>
                  ))}
                </select>
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
              </div>

              <div className="alunos-tabela" role="table" aria-label="Turmas">
                <div className="alunos-linha turmas-grade alunos-cabecalho" role="row">
                  <span role="columnheader">Turma</span>
                  <span role="columnheader">Dias e horário</span>
                  <span role="columnheader">Professor</span>
                  <span role="columnheader">Quadra</span>
                  <span role="columnheader">Vagas</span>
                  <span role="columnheader">Experimental</span>
                </div>
                {filtradas.map((t) => (
                  <TurmaLinha key={t.id} turma={t} matriculas={matriculas} onAtualizada={carregar} />
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
  onAtualizada,
}: {
  turma: TurmaResumo;
  matriculas: Matricula[];
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
    <div className="alunos-linha turmas-grade" role="row">
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
      <span role="cell" data-rotulo="Professor">
        {t.vinculo.professor.nome}
      </span>
      <span role="cell" data-rotulo="Quadra">
        {t.quadra.nome}
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
    </div>
  );
}
