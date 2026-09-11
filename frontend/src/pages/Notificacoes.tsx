import { useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import type { Notificacao } from "../api/types";
import { Icon, Layout } from "../components/Layout";

// Prefixo de rota por área — mesma tabela de components/Layout.tsx, só
// pra saber pra onde o botão "Voltar" leva (pedido do usuário, 2026-09-11:
// tela de notificações compartilhada entre os quatro papéis).
const PREFIXO_ROTA: Record<string, string> = {
  admin_point: "/admin-point",
  professor: "/professor",
  aluno: "/aluno",
  super_admin: "/dono-app",
};
const ORDEM_PRIORIDADE = ["admin_point", "super_admin", "professor", "aluno"] as const;

function rotuloRelativo(isoDataHora: string): string {
  const data = new Date(isoDataHora);
  const agora = new Date();
  const diffMs = agora.getTime() - data.getTime();
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return "agora";
  if (diffMin < 60) return `há ${diffMin} min`;
  const diffHoras = Math.floor(diffMin / 60);
  if (diffHoras < 24) return `há ${diffHoras}h`;
  const diffDias = Math.floor(diffHoras / 24);
  if (diffDias < 7) return `há ${diffDias}d`;
  return data.toLocaleDateString("pt-BR", { day: "2-digit", month: "2-digit" });
}

/** Tela de notificações (pedido do usuário, 2026-09-11: "esse tipo de msg
 * é bom tb ter no app... já tava previsto lá no início fazermos uma tela
 * de notificações") — compartilhada entre os quatro papéis, porque o
 * conteúdo é sempre "as notificações da MINHA conta" (o backend já
 * escopa por usuário logado, GET /notificacoes). Cada área monta sua
 * própria rota pra cá (ver App.tsx), só pra manter a barra de abas do
 * Layout visível — o componente em si não muda por papel. */
export default function Notificacoes() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const [notificacoes, setNotificacoes] = useState<Notificacao[]>([]);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const area = ORDEM_PRIORIDADE.find((p) => user?.roles.includes(p));
  const rotaVoltar = area ? PREFIXO_ROTA[area] : "/";

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setNotificacoes(await api.get<Notificacao[]>("/notificacoes"));
    } catch {
      setErro("Não foi possível carregar as notificações. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  async function marcarLida(id: number) {
    setNotificacoes((atual) => atual.map((n) => (n.id === id ? { ...n, lida: true } : n)));
    try {
      await api.patch(`/notificacoes/${id}/lida`, {});
    } catch {
      // Sem rollback visual por uma falha silenciosa aqui — pior caso é
      // marcar de novo na próxima visita; não vale travar a tela por isso.
    }
  }

  async function marcarTodasLidas() {
    setNotificacoes((atual) => atual.map((n) => ({ ...n, lida: true })));
    try {
      await api.post("/notificacoes/marcar-todas-lidas", {});
    } catch {
      carregar();
    }
  }

  const temNaoLida = notificacoes.some((n) => !n.lida);

  return (
    <Layout>
      <div className="screen-header">
        <button type="button" className="close-btn" onClick={() => navigate(rotaVoltar)} aria-label="Voltar">
          <Icon name="chevron-left" />
        </button>
        <h1>Notificações</h1>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && (
        <>
          {temNaoLida && (
            <section className="section" style={{ paddingBottom: 0 }}>
              <button className="secondary" onClick={marcarTodasLidas}>
                Marcar todas como lidas
              </button>
            </section>
          )}

          <section className="section">
            {notificacoes.length === 0 ? (
              <p className="empty-state">Nenhuma notificação por aqui ainda.</p>
            ) : (
              <div className="card-list">
                {notificacoes.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    className="item-card item-card-clickable"
                    style={{ alignItems: "flex-start", textAlign: "left", width: "100%" }}
                    onClick={() => !n.lida && marcarLida(n.id)}
                  >
                    {/* Emoji, não Icon/SVG — mesmo motivo do sino do
                        cabeçalho (components/Layout.tsx): o desenho de
                        sino do Feather ficou invisível pro usuário mesmo
                        depois de trocar cor/classe, provável bloqueador
                        reconhecendo o path específico de "notificação". */}
                    <span
                      className="action-card-icon"
                      aria-hidden="true"
                      style={{ fontSize: 22 }}
                    >
                      🔔
                    </span>
                    <div className="item-card-info">
                      <span
                        className="item-card-title"
                        style={{ display: "flex", alignItems: "center", gap: 8 }}
                      >
                        {!n.lida && (
                          <span
                            aria-hidden="true"
                            style={{
                              width: 8,
                              height: 8,
                              borderRadius: "100px",
                              background: "var(--coral)",
                              flexShrink: 0,
                            }}
                          />
                        )}
                        {n.titulo}
                      </span>
                      <span className="item-card-subtitle">{n.mensagem}</span>
                    </div>
                    <span className="item-card-actions" style={{ color: "var(--ink-muted)", fontSize: 12.5 }}>
                      {rotuloRelativo(n.created_at)}
                    </span>
                  </button>
                ))}
              </div>
            )}
          </section>
        </>
      )}
    </Layout>
  );
}
