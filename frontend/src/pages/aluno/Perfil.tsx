import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AlunoResumo, Assinatura, PeriodoDia } from "../../api/types";
import { Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { TrocarArea } from "../../components/TrocarArea";
import { rotuloTurma } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

const PERIODOS_DIA: { value: PeriodoDia; label: string }[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

const ROTULO_FORMA_PAGAMENTO: Record<string, string> = {
  pix: "Pix",
  dinheiro: "Dinheiro",
  wellhub: "Wellhub",
  totalpass: "TotalPass",
};

/** Perfil do aluno (pedido do usuário, 2026-08-25) — dados da conta e
 * gestão dos planos mensais (assinatura); pagar/cancelar aula avulsa e
 * calendário ficam na Agenda. */
export default function AlunoPerfil() {
  const [perfil, setPerfil] = useState<AlunoResumo | null>(null);
  const [assinaturas, setAssinaturas] = useState<Assinatura[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [mostrarHistorico, setMostrarHistorico] = useState(false);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [perfilRes, assinaturasRes] = await Promise.all([
        api.get<AlunoResumo>("/alunos/me"),
        api.get<Assinatura[]>("/alunos/me/assinaturas"),
      ]);
      setPerfil(perfilRes);
      setAssinaturas(assinaturasRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar seu perfil. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const assinaturasAtivas = assinaturas.filter((a) => a.status === "ativa");
  const assinaturasHistorico = assinaturas.filter((a) => a.status !== "ativa");

  return (
    <Layout>
      <h1>Perfil</h1>

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && perfil && (
        <>
          <section className="section">
            <h2>Minha conta</h2>
            <div className="item-card" style={{ alignItems: "flex-start" }}>
              <div className="item-card-info">
                <span className="item-card-title">{perfil.nome}</span>
                <span className="item-card-subtitle">{perfil.email}</span>
                <span className="item-card-subtitle">{perfil.contato}</span>
                <span className="item-card-subtitle">
                  Pagamento preferido:{" "}
                  {ROTULO_FORMA_PAGAMENTO[perfil.forma_pagamento_preferida] ??
                    perfil.forma_pagamento_preferida}
                </span>
              </div>
            </div>
          </section>

          <section className="section">
            <h2>Meus planos mensais ({assinaturasAtivas.length})</h2>
            {assinaturasAtivas.length === 0 ? (
              <p className="empty-state">
                Nenhum plano mensal ativo — fale com o Point pra ativar um.
              </p>
            ) : (
              <div className="card-list">
                {assinaturasAtivas.map((a) => (
                  <AssinaturaRow key={a.id} assinatura={a} onMudanca={carregar} />
                ))}
              </div>
            )}

            {assinaturasHistorico.length > 0 && (
              <>
                <button
                  type="button"
                  className="link-btn"
                  style={{ marginTop: 12 }}
                  onClick={() => setMostrarHistorico((v) => !v)}
                >
                  {mostrarHistorico ? "Esconder" : "Ver"} histórico ({assinaturasHistorico.length})
                </button>
                {mostrarHistorico && (
                  <div className="card-list" style={{ marginTop: 10 }}>
                    {assinaturasHistorico.map((a) => (
                      <AssinaturaRow key={a.id} assinatura={a} onMudanca={carregar} />
                    ))}
                  </div>
                )}
              </>
            )}
          </section>

          <TrocarArea papelAtual="aluno" />
        </>
      )}
    </Layout>
  );
}

function AssinaturaRow({
  assinatura,
  onMudanca,
}: {
  assinatura: Assinatura;
  onMudanca: () => void;
}) {
  const [enviando, setEnviando] = useState(false);

  async function desistir() {
    setEnviando(true);
    try {
      await api.patch(`/assinaturas/${assinatura.id}/cancelar`);
      onMudanca();
    } finally {
      setEnviando(false);
    }
  }

  const rotuloPeriodo = PERIODOS_DIA.find((p) => p.value === assinatura.periodo_dia_desejado)?.label;

  return (
    <div className="item-card" style={{ alignItems: "flex-start" }}>
      <div className="item-card-info">
        <span className="item-card-title">
          {assinatura.modalidade.nome} · {assinatura.frequencia_semanal_desejada}x por semana
        </span>
        <span className="item-card-subtitle">Período preferido: {rotuloPeriodo}</span>
        {assinatura.status === "ativa" && assinatura.turmas.length > 0 && (
          <span className="item-card-subtitle">
            {assinatura.turmas
              .map((t) => rotuloTurma(t.dias_semana, t.turma.horario))
              .join(" · ")}{" "}
            · desde {assinatura.data_inicio}
          </span>
        )}
        {assinatura.plano && (
          <span className="item-card-subtitle">{formatarReais(assinatura.plano.preco)} / mês</span>
        )}
      </div>
      <div className="item-card-actions">
        <StatusPill status={assinatura.status} />
        {assinatura.status === "ativa" && (
          <button className="secondary" disabled={enviando} onClick={desistir}>
            {enviando ? "Cancelando..." : "Desistir"}
          </button>
        )}
      </div>
    </div>
  );
}
