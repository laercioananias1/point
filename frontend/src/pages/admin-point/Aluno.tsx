import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import type { Assinatura, Convite, Matricula } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { rotuloTurma } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

/** Gestão de alunos do Point (pedido do usuário, 2026-08-25: "seguindo o
 * mesmo padrão" — virou aba própria). Convite → matrícula → assinatura →
 * mensalidade. A conferência manual de pagamento Pix saiu daqui (pedido
 * do usuário, 2026-08-30: "o pagamento pix vai ser automatizado, então
 * por enquanto pode tirar tudo isso. Vamos ter uma api de pix") — volta
 * quando a integração de verdade existir; os endpoints de pagamento
 * (POST /pagamentos, PATCH .../confirmar|estornar) continuam no backend,
 * só não tem mais nenhuma tela usando. */
export default function AdminPointAluno() {
  // Confirmação de convite enviado (pedido do usuário, 2026-08-26: "quando
  // clicar e efetuar o convite volta para tela anterior") — a tela de
  // convidar manda o nome de volta pra cá via navigate state.
  const location = useLocation();
  const convidado = (location.state as { convidado?: string } | null)?.convidado;
  const [matriculas, setMatriculas] = useState<Matricula[]>([]);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [convites, setConvites] = useState<Convite[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [processando, setProcessando] = useState<Set<string>>(new Set());
  const [lembretesEnviados, setLembretesEnviados] = useState<Set<number>>(new Set());

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [matriculasRes, assinaturasRes, convitesRes] = await Promise.all([
        api.get<Matricula[]>("/matriculas"),
        api.get<Assinatura[]>("/assinaturas"),
        api.get<Convite[]>("/convites"),
      ]);
      setMatriculas(matriculasRes);
      setAssinaturas(assinaturasRes);
      setConvites(convitesRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os dados dos alunos. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function enviarLembrete(matriculaId: number) {
    const chave = `lembrete-${matriculaId}`;
    setProcessando((atual) => new Set(atual).add(chave));
    try {
      await api.post(`/matriculas/${matriculaId}/lembrete-pagamento`);
      setLembretesEnviados((atual) => new Set(atual).add(matriculaId));
    } finally {
      setProcessando((atual) => {
        const proximo = new Set(atual);
        proximo.delete(chave);
        return proximo;
      });
    }
  }

  // Mensalidade recorrente de verdade (pedido do usuário, 2026-08-21) — quem
  // já pagou o mês corrente não aparece aqui; "inadimplente" (deve o mês
  // anterior) vem primeiro.
  const mensalidadesEmAberto = matriculas
    .filter((m) => m.tipo === "mensal" && m.status === "ativa" && !m.mes_atual_pago)
    .sort((a, b) => Number(b.inadimplente) - Number(a.inadimplente));
  const assinaturasAtivas = assinaturas.filter((a) => a.status === "ativa");
  const convitesPendentes = convites.filter((c) => c.status === "pendente");
  // Lista de alunos do Point (pedido do usuário, 2026-08-30: "alunos
  // também lista os alunos no início. não preciso dessa lista de
  // matrículas") — mesmo padrão de Professor.tsx (vínculos no topo):
  // dedupe por aluno a partir das matrículas, já que não tem endpoint de
  // "alunos do Point" (GET /alunos é busca global, sem filtro de Point).
  const alunosUnicos = Array.from(new Map(matriculas.map((m) => [m.aluno.id, m.aluno])).values()).sort(
    (a, b) => a.nome.localeCompare(b.nome),
  );

  return (
    <Layout>
      <h1>Alunos {pronto && `(${alunosUnicos.length})`}</h1>

      {convidado && <p className="form-success">Convite enviado pra {convidado}.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
            {alunosUnicos.length === 0 ? (
              <p className="empty-state">Nenhum aluno matriculado ainda — convide um aluno.</p>
            ) : (
              <div className="card-list">
                {alunosUnicos.map((a) => (
                  <div className="item-card" key={a.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{a.nome}</span>
                      <span className="item-card-subtitle">
                        {a.contato}
                        {a.email && ` · ${a.email}`}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <Link to="/admin-point/aluno/convidar" className="action-card">
              <span className="action-card-icon">
                <Icon name="user-plus" />
              </span>
              <span className="action-card-info">
                <span className="action-card-title">Convidar aluno</span>
                <span className="action-card-subtitle">
                  Monta a assinatura (plano, turmas, forma de pagamento) e manda o convite por e-mail
                </span>
              </span>
              <span className="action-card-chevron" aria-hidden="true">
                →
              </span>
            </Link>
          </section>

          <section className="section">
            <h2>Convites pendentes ({convitesPendentes.length})</h2>
            {convitesPendentes.length === 0 ? (
              <p className="empty-state">Nenhum convite aguardando aceite.</p>
            ) : (
              <div className="card-list">
                {convitesPendentes.map((c) => (
                  <ConvitePendenteRow key={c.id} convite={c} onMudanca={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Assinaturas ativas ({assinaturasAtivas.length})</h2>
            {assinaturasAtivas.length === 0 ? (
              <p className="empty-state">Nenhuma assinatura ativa ainda.</p>
            ) : (
              <div className="card-list">
                {assinaturasAtivas.map((a) => (
                  <AssinaturaAtivaRow key={a.id} assinatura={a} onMudanca={carregar} />
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <h2>Mensalidades em aberto ({mensalidadesEmAberto.length})</h2>
            {mensalidadesEmAberto.length === 0 ? (
              <p className="empty-state">Ninguém com mensalidade em aberto no mês corrente.</p>
            ) : (
              <div className="card-list">
                {mensalidadesEmAberto.map((m) => (
                  <div className="item-card" key={m.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">
                        {m.aluno.nome} · {formatarReais(m.turma.modalidade.preco_plano)}
                        {m.inadimplente && " "}
                        {m.inadimplente && <StatusPill status="em_atraso" />}
                      </span>
                      <span className="item-card-subtitle">{m.turma.modalidade.nome}</span>
                    </div>
                    <div className="item-card-actions">
                      <button
                        className="secondary"
                        disabled={processando.has(`lembrete-${m.id}`) || lembretesEnviados.has(m.id)}
                        onClick={() => enviarLembrete(m.id)}
                      >
                        {lembretesEnviados.has(m.id)
                          ? "Lembrete enviado"
                          : processando.has(`lembrete-${m.id}`)
                            ? "Enviando..."
                            : "Lembrar por e-mail"}
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>

          {/* "Pagamentos pendentes" (conferência manual de Pix) saiu daqui
              (pedido do usuário, 2026-08-30: "o pagamento pix vai ser
              automatizado, então por enquanto pode tirar tudo isso. Vamos
              ter uma api de pix") — volta integrada com a API de verdade. */}

          {/* "Histórico de pagamentos" saiu daqui (pedido do usuário, 2026-08-30:
              "isso vai precisar melhorar") — a lista crua de todo pagamento já
              lançado não estava rendendo nada útil nesse formato; volta
              redesenhada mais pra frente. */}

          {/* "Matrículas do Point" (lista crua de matrícula, sem agrupar por
              aluno) saiu daqui também (pedido do usuário, 2026-08-30) — a
              lista de alunos no topo da tela já cobre "quem tá matriculado". */}
        </>
      )}
    </Layout>
  );
}

function AssinaturaAtivaRow({
  assinatura,
  onMudanca,
}: {
  assinatura: Assinatura;
  onMudanca: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);

  async function cancelar() {
    if (!confirm(`Cancelar a assinatura de ${assinatura.aluno.nome}?`)) return;
    setCancelando(true);
    try {
      await api.patch(`/assinaturas/${assinatura.id}/cancelar`);
      onMudanca();
    } finally {
      setCancelando(false);
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {assinatura.aluno.nome} · {assinatura.modalidade.nome} · {assinatura.plano?.frequencia_semanal}
          x/semana
        </span>
        <span className="item-card-subtitle">
          {assinatura.turmas.map((t) => rotuloTurma(t.dias_semana, t.turma.horario)).join(" · ")} · desde{" "}
          {assinatura.data_inicio}
        </span>
      </div>
      <button className="secondary" disabled={cancelando} onClick={cancelar}>
        {cancelando ? "Cancelando..." : "Cancelar"}
      </button>
    </div>
  );
}

function ConvitePendenteRow({ convite, onMudanca }: { convite: Convite; onMudanca: () => void }) {
  const [cancelando, setCancelando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/convite/${convite.token}`;

  async function cancelar() {
    if (!confirm(`Cancelar o convite de ${convite.nome}?`)) return;
    setCancelando(true);
    try {
      await api.patch(`/convites/${convite.id}/cancelar`);
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
      /* clipboard indisponível — sem problema, o link já foi mandado por e-mail */
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {convite.nome} · {convite.modalidade.nome} · {convite.plano.frequencia_semanal}x/semana
        </span>
        <span className="item-card-subtitle">
          {convite.email} · expira em{" "}
          {new Date(convite.expira_em + "T00:00").toLocaleDateString("pt-BR")}
        </span>
      </div>
      <div className="item-card-actions">
        <button className="secondary" onClick={copiarLink}>
          {copiado ? "Copiado!" : "Copiar link"}
        </button>
        <button className="secondary" disabled={cancelando} onClick={cancelar}>
          {cancelando ? "Cancelando..." : "Cancelar"}
        </button>
      </div>
    </div>
  );
}

