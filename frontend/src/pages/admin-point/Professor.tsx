import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useLocation, useNavigate } from "react-router-dom";
import { api } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { ConviteVinculo, Matricula, TurmaResumo, Vinculo } from "../../api/types";
import { Avatar } from "../../components/Avatar";
import { useConfirm } from "../../components/ConfirmModal";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { DIAS_SEMANA } from "../../lib/dias";

/** Professores do Point no layout do kit de design
 * (design/telas/Professores.dc.html; pedido do usuário, 2026-10-01) — um
 * card por professor com turmas, alunos, ocupação e dias com aula, e os
 * convites pendentes no mesmo grid. O formulário de convite continua em
 * tela própria (ConvidarProfessor.tsx). Remuneração e "também dá aula em"
 * do protótipo ficaram de fora: o sistema não tem esses dados. */

type Resumo = {
  turmas: number;
  alunos: number;
  // null = sem vaga cadastrada (sem turma ativa).
  ocupacao: number | null;
  modalidades: string[];
  dias: Set<string>;
};

function resumoDoVinculo(vinculoId: number, turmas: TurmaResumo[], matriculas: Matricula[]): Resumo {
  const hoje = new Date().toISOString().slice(0, 10);
  const ativas = turmas.filter(
    (t) => t.vinculo_id === vinculoId && (t.periodo_fim === null || t.periodo_fim >= hoje),
  );
  const ids = new Set(ativas.map((t) => t.id));
  const doProfessor = matriculas.filter((m) => m.status === "ativa" && ids.has(m.turma_id));
  const mensais = doProfessor.filter((m) => m.tipo === "mensal").length;
  const vagas = ativas.reduce((soma, t) => soma + t.capacidade, 0);
  return {
    turmas: ativas.length,
    alunos: new Set(doProfessor.map((m) => m.aluno_id)).size,
    ocupacao: vagas > 0 ? Math.round((mensais / vagas) * 100) : null,
    modalidades: Array.from(new Set(ativas.map((t) => t.modalidade.nome))).sort(),
    dias: new Set(ativas.flatMap((t) => t.dias_semana)),
  };
}

export default function AdminPointProfessor() {
  const { user } = useAuth();
  const location = useLocation();
  const convidado = (location.state as { convidado?: string } | null)?.convidado;
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [convites, setConvites] = useState<ConviteVinculo[]>([]);
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [vinculosRes, convitesRes, turmasRes, matriculasRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<ConviteVinculo[]>("/convites-vinculo"),
        user?.point_id ? api.get<TurmaResumo[]>(`/turmas?point_id=${user.point_id}`) : Promise.resolve([]),
        api.get<Matricula[]>("/matriculas"),
      ]);
      setVinculos(vinculosRes);
      setConvites(convitesRes);
      setTurmas(turmasRes);
      setMatriculas(matriculasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os professores. Tente novamente.");
    }
  }, [user?.point_id]);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const pendentes = convites.filter((c) => c.status === "pendente");
  const ordenados = useMemo(
    () => [...vinculos].sort((a, b) => a.professor.nome.localeCompare(b.professor.nome)),
    [vinculos],
  );

  return (
    <Layout>
      <div className="pagina-topo">
        <div>
          <div className="pagina-contexto">
            Cadastros · {vinculos.length} {vinculos.length === 1 ? "professor" : "professores"}
            {pendentes.length > 0 &&
              ` · ${pendentes.length} ${pendentes.length === 1 ? "convite pendente" : "convites pendentes"}`}
          </div>
          <h1>Professores</h1>
        </div>
        <Link to="/admin-point/professor/convidar" className="botao-link">
          + Convidar professor
        </Link>
      </div>

      {convidado && <p className="form-success">Convite enviado pra {convidado}.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && ordenados.length === 0 && pendentes.length === 0 && (
        <p className="empty-state">Nenhum professor ainda — convide o primeiro.</p>
      )}

      {pronto && (
        <div className="prof-grid">
          {ordenados.map((v) => (
            <CardProfessor key={v.id} vinculo={v} resumo={resumoDoVinculo(v.id, turmas, matriculas)} />
          ))}
          {pendentes.map((c) => (
            <CardConvite key={`c-${c.id}`} convite={c} onMudanca={carregar} />
          ))}
        </div>
      )}
    </Layout>
  );
}

function CardProfessor({ vinculo, resumo }: { vinculo: Vinculo; resumo: Resumo }) {
  const navigate = useNavigate();
  const destino = `/admin-point/agenda?professor=${vinculo.professor.id}`;
  const p = vinculo.professor;

  return (
    <article
      className="prof-card prof-card-clicavel"
      role="link"
      tabIndex={0}
      onClick={() => navigate(destino)}
      onKeyDown={(e) => {
        if (e.key === "Enter") navigate(destino);
      }}
    >
      <div className="prof-topo">
        <Avatar nome={p.nome} foto={p.foto} tamanho={56} />
        <div className="prof-identidade">
          <h2>{p.nome}</h2>
          <span className="alunos-sub">{p.contato || p.email}</span>
        </div>
        <StatusPill status={vinculo.status} />
      </div>

      {resumo.modalidades.length > 0 && (
        <div className="prof-chips">
          {resumo.modalidades.map((m) => (
            <span key={m} className="prof-chip">
              {m}
            </span>
          ))}
        </div>
      )}

      <div className="prof-stats">
        <div className="prof-stat">
          <span className="prof-stat-valor">{resumo.turmas}</span>
          <span className="prof-stat-rotulo">turmas</span>
        </div>
        <div className="prof-stat">
          <span className="prof-stat-valor">{resumo.alunos}</span>
          <span className="prof-stat-rotulo">alunos</span>
        </div>
        <div className="prof-stat" title="Alunos mensais ativos / vagas das turmas">
          <span className="prof-stat-valor">{resumo.ocupacao === null ? "—" : `${resumo.ocupacao}%`}</span>
          <span className="prof-stat-rotulo">ocupação</span>
        </div>
      </div>

      <div className="prof-semana-bloco">
        <span className="prof-rotulo">Dias com aula</span>
        <div className="prof-semana">
          {DIAS_SEMANA.map((d) => (
            <span
              key={d.value}
              className={resumo.dias.has(d.value) ? "prof-dia ativo" : "prof-dia"}
              title={resumo.dias.has(d.value) ? `Dá aula ${d.value}` : `Sem aula ${d.value}`}
            >
              {d.label}
            </span>
          ))}
        </div>
      </div>
    </article>
  );
}

function CardConvite({ convite, onMudanca }: { convite: ConviteVinculo; onMudanca: () => void }) {
  const [cancelando, setCancelando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const { confirmar, modal } = useConfirm();
  const link = `${window.location.origin}/convite-vinculo/${convite.token}`;

  async function cancelar() {
    if (!(await confirmar(`Cancelar o convite de ${convite.nome}?`))) return;
    setCancelando(true);
    try {
      await api.patch(`/convites-vinculo/${convite.id}/cancelar`);
      onMudanca();
    } finally {
      setCancelando(false);
    }
  }

  async function copiarLink() {
    try {
      await navigator.clipboard.writeText(link);
      setCopiado(true);
      setTimeout(() => setCopiado(false), 2000);
    } catch {
      /* clipboard indisponível — o link já foi por e-mail/WhatsApp */
    }
  }

  return (
    <article className="prof-card">
      {modal}
      <div className="prof-topo">
        <Avatar nome={convite.nome} foto={null} tamanho={56} />
        <div className="prof-identidade">
          <h2>{convite.nome}</h2>
          <span className="alunos-sub">{convite.celular || convite.email}</span>
        </div>
        <span className={convite.expirado ? "status-pill status-risk" : "status-pill status-warn"}>
          {convite.expirado ? "Convite expirado" : "Convite enviado"}
        </span>
      </div>
      <p className="prof-convite-texto">
        Expira em {new Date(convite.expira_em + "T00:00").toLocaleDateString("pt-BR")}. Assim que o
        professor aceitar, ele aparece aqui com as turmas.
      </p>
      <div className="prof-convite-acoes">
        <button type="button" className="secondary" onClick={copiarLink}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button type="button" className="secondary" disabled={cancelando} onClick={cancelar}>
          {cancelando ? "Cancelando..." : "Cancelar convite"}
        </button>
      </div>
    </article>
  );
}
