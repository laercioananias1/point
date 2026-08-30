import { useCallback, useEffect, useState } from "react";
import { Link, useLocation } from "react-router-dom";
import { api } from "../../api/client";
import type { ConviteVinculo, Vinculo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { StatusPill } from "../../components/StatusPill";
import { rotuloRepasse } from "../../lib/formato";

/** Gestão de professores do Point (pedido do usuário, 2026-08-25: "seguindo
 * o mesmo padrão" — virou aba própria). Vínculos e convite. O cancelamento
 * de aula por força maior saiu daqui (pedido do usuário, 2026-08-28: "esse
 * botão sai da tela do professor e fica tb na agenda") — agora é o check
 * "gerar crédito" na remoção de ocorrência da Agenda.
 *
 * Pedido do usuário, 2026-08-30: "essa lista de professores leva pro
 * início da tela, depois embaixo deixa um botão para convidar professor
 * que abre uma nova tela no padrão de convidar alunos" — o formulário de
 * convite saiu daqui e virou tela própria (ConvidarProfessor.tsx), igual
 * ConvidarAluno.tsx já funciona pro aluno. */
export default function AdminPointProfessor() {
  const location = useLocation();
  const convidado = (location.state as { convidado?: string } | null)?.convidado;
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [convitesVinculo, setConvitesVinculo] = useState<ConviteVinculo[]>([]);
  const [pronto, setPronto] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setErro(null);
    try {
      const [vinculosRes, convitesVinculoRes] = await Promise.all([
        api.get<Vinculo[]>("/vinculos"),
        api.get<ConviteVinculo[]>("/convites-vinculo"),
      ]);
      setVinculos(vinculosRes);
      setConvitesVinculo(convitesVinculoRes);
      setPronto(true);
    } catch {
      setErro("Não foi possível carregar os dados dos professores. Tente novamente.");
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  const convitesVinculoPendentes = convitesVinculo.filter((c) => c.status === "pendente");

  return (
    <Layout>
      <h1>Professores {pronto && `(${vinculos.length})`}</h1>

      {convidado && <p className="form-success">Convite enviado pra {convidado}.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {!pronto && !erro && <p className="empty-state">Carregando...</p>}

      {pronto && (
        <>
          <section className="section">
            {vinculos.length === 0 ? (
              <p className="empty-state">Nenhum vínculo por aqui ainda — convide um professor.</p>
            ) : (
              <div className="card-list">
                {vinculos.map((v) => (
                  <div className="item-card" key={v.id}>
                    <div className="item-card-info">
                      <span className="item-card-title">{v.professor.nome}</span>
                      <span className="item-card-subtitle">
                        {v.professor.modalidades.join(", ") || "sem modalidade informada"} · repasse{" "}
                        {rotuloRepasse(v.modelo_repasse, v.valor_repasse)}
                      </span>
                    </div>
                    <StatusPill status={v.status} />
                  </div>
                ))}
              </div>
            )}
          </section>

          <section className="section">
            <Link to="/admin-point/professor/convidar" className="action-card">
              <span className="action-card-icon">
                <Icon name="user-plus" />
              </span>
              <span className="action-card-info">
                <span className="action-card-title">Convidar professor</span>
                <span className="action-card-subtitle">
                  Decide o acordo de repasse e manda o convite por e-mail
                </span>
              </span>
              <span className="action-card-chevron" aria-hidden="true">
                →
              </span>
            </Link>
          </section>

          <section className="section">
            <h2>Convites de vínculo pendentes ({convitesVinculoPendentes.length})</h2>
            {convitesVinculoPendentes.length === 0 ? (
              <p className="empty-state">Nenhum convite aguardando aceite.</p>
            ) : (
              <div className="card-list">
                {convitesVinculoPendentes.map((c) => (
                  <ConviteVinculoPendenteRow key={c.id} convite={c} onMudanca={carregar} />
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}

function ConviteVinculoPendenteRow({
  convite,
  onMudanca,
}: {
  convite: ConviteVinculo;
  onMudanca: () => void;
}) {
  const [cancelando, setCancelando] = useState(false);
  const [copiado, setCopiado] = useState(false);
  const link = `${window.location.origin}/convite-vinculo/${convite.token}`;

  async function cancelar() {
    if (!confirm(`Cancelar o convite de ${convite.nome}?`)) return;
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
      /* clipboard indisponível — sem problema, o link já foi mandado por e-mail */
    }
  }

  return (
    <div className="item-card">
      <div className="item-card-info">
        <span className="item-card-title">
          {convite.nome} · repasse {rotuloRepasse(convite.modelo_repasse, convite.valor_repasse)}
        </span>
        <span className="item-card-subtitle">
          {convite.celular} · {convite.email} · expira em{" "}
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
