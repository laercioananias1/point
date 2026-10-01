import { useCallback, useEffect, useState } from "react";
import { api } from "../../api/client";
import type { AlunoResumo, Assinatura, PeriodoDia } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Layout } from "../../components/Layout";
import { PerfilTopo } from "../../components/PerfilTopo";
import { StatusPill } from "../../components/StatusPill";
import { TemaToggle } from "../../components/TemaToggle";
import { TrocarArea } from "../../components/TrocarArea";
import { rotuloTurma } from "../../lib/dias";
import { formatarReais, rotuloPagamentoMeio } from "../../lib/formato";

const PERIODOS_DIA: { value: PeriodoDia; label: string }[] = [
  { value: "manha", label: "Manhã" },
  { value: "tarde", label: "Tarde" },
  { value: "noite", label: "Noite" },
];

/** Perfil do aluno (pedido do usuário, 2026-08-25) — dados da conta e
 * gestão dos planos mensais (assinatura); pagar/cancelar aula avulsa e
 * calendário ficam na Agenda. Layout do kit (pedido do usuário,
 * 2026-10-01): topo com foto + cards. */
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
      <CabecalhoPagina titulo="Perfil" contexto="Minha conta" />

      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && perfil && (
        <>
          <PerfilTopo
            papel="Aluno"
            detalhes={[
              perfil.email,
              perfil.contato,
              `Pagamento preferido: ${rotuloPagamentoMeio(perfil.forma_pagamento_preferida)}`,
            ]}
          />
          <div className="perfil-grade">
            <section className="alunos-card perfil-card perfil-card-largo">
              <h2 className="chk-secao-titulo">Meus planos mensais</h2>
              {assinaturasAtivas.length === 0 ? (
                <p className="alunos-sub">Nenhum plano mensal ativo — fale com o Point pra ativar um.</p>
              ) : (
                <ul className="perfil-lista">
                  {assinaturasAtivas.map((a) => (
                    <AssinaturaRow key={a.id} assinatura={a} onMudanca={carregar} />
                  ))}
                </ul>
              )}

              {assinaturasHistorico.length > 0 && (
                <>
                  <button
                    type="button"
                    className="perfil-link-claro"
                    onClick={() => setMostrarHistorico((v) => !v)}
                  >
                    {mostrarHistorico ? "Esconder" : "Ver"} histórico ({assinaturasHistorico.length})
                  </button>
                  {mostrarHistorico && (
                    <ul className="perfil-lista">
                      {assinaturasHistorico.map((a) => (
                        <AssinaturaRow key={a.id} assinatura={a} onMudanca={carregar} />
                      ))}
                    </ul>
                  )}
                </>
              )}
            </section>
            <TemaToggle />
            <TrocarArea papelAtual="aluno" />
          </div>
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
    <li>
      <span className="alunos-pessoa-texto">
        <span className="alunos-nome">
          {assinatura.modalidade.nome} · {assinatura.frequencia_semanal_desejada}x por semana
        </span>
        <span className="alunos-sub">Período preferido: {rotuloPeriodo}</span>
        {assinatura.status === "ativa" && assinatura.turmas.length > 0 && (
          <span className="alunos-sub">
            {assinatura.turmas.map((t) => rotuloTurma(t.dias_semana, t.turma.horario)).join(" · ")} · desde{" "}
            {assinatura.data_inicio}
          </span>
        )}
        {assinatura.plano && <span className="alunos-sub">{formatarReais(assinatura.plano.preco)} / mês</span>}
        {assinatura.fonte_pagamento !== "pix" && (
          <span className="alunos-sub">Pagamento: {rotuloPagamentoMeio(assinatura.fonte_pagamento)}</span>
        )}
      </span>
      <span className="perfil-lista-acoes">
        <StatusPill status={assinatura.status} />
        {assinatura.status === "ativa" && (
          <button type="button" className="alunos-acao" disabled={enviando} onClick={desistir}>
            {enviando ? "Cancelando..." : "Desistir"}
          </button>
        )}
      </span>
    </li>
  );
}
