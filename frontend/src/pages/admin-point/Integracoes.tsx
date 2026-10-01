import { useCallback, useEffect, useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";

/** Credenciais de benefício por Point (pedido do usuário, 2026-09-29:
 * "onde tá ficando o id_gym de cada point?" — não tinha tela nenhuma, só
 * dava pra configurar direto no banco). Gym ID (Wellhub) e place_api_key
 * (TotalPass) juntos numa tela só. Layout do kit (pedido do usuário,
 * 2026-10-01): um card por plataforma com o status. */
export default function AdminPointIntegracoes() {
  const { user } = useAuth();
  const [point, setPoint] = useState<Point | null>(null);
  const [loading, setLoading] = useState(true);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setLoading(true);
    setErro(null);
    try {
      setPoint(await api.get<Point>("/points/me"));
    } catch {
      setErro("Não foi possível carregar o Point. Tente novamente.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  return (
    <Layout>
      <CabecalhoPagina titulo="Integrações" contexto="Configurações" />
      <p className="pagina-intro">
        Ligue o Point às plataformas de benefício. Com os dados preenchidos, os check-ins de Wellhub e TotalPass
        entram sozinhos e aparecem em <Link to="/admin-point/wellhub">Checkins</Link>.
      </p>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && <IntegracoesForm point={point} onSalvo={(p) => setPoint(p)} />}
    </Layout>
  );
}

function IntegracoesForm({ point, onSalvo }: { point: Point; onSalvo: (p: Point) => void }) {
  const [wellhubGymId, setWellhubGymId] = useState(point.wellhub_gym_id ?? "");
  const [placeApiKey, setPlaceApiKey] = useState(point.place_api_key ?? "");
  const [mostrarChave, setMostrarChave] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setSucesso(false);
    setEnviando(true);
    try {
      const atualizado = await api.patch<Point>("/points/me/configuracoes", {
        // Editados noutras telas, não aqui — só reenvia o que o Point já
        // tinha (mesmo esquema de passthrough que Prazos/Horários usam).
        prazo_cancelamento_horas: point.prazo_cancelamento_horas,
        prazo_credito_dias: point.prazo_credito_dias,
        dia_vencimento_mensalidade: point.dia_vencimento_mensalidade,
        dias_semana_funcionamento: point.dias_semana_funcionamento,
        horarios_semana_funcionamento: point.horarios_semana_funcionamento,
        dias_fds_funcionamento: point.dias_fds_funcionamento,
        horarios_fds_funcionamento: point.horarios_fds_funcionamento,
        wellhub_gym_id: wellhubGymId.trim() || null,
        place_api_key: placeApiKey.trim() || null,
      });
      onSalvo(atualizado);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Confira os valores.");
    } finally {
      setEnviando(false);
    }
  }

  const wellhubOk = Boolean(point.wellhub_gym_id);
  const totalpassOk = Boolean(point.place_api_key);

  return (
    <form className="config" onSubmit={handleSubmit}>
      <div className="config-grade">
        <section className="alunos-card config-card">
          <div className="inicio-exp-topo">
            <span className="integ-marca wellhub">W</span>
            <span className={wellhubOk ? "status-pill status-good" : "status-pill status-neutral"}>
              {wellhubOk ? "Configurado" : "Não configurado"}
            </span>
          </div>
          <h2 className="chk-secao-titulo">Wellhub</h2>
          <p className="alunos-sub">
            O Gym ID identifica sua unidade na Wellhub — eles entregam esse número quando ativam a integração pro
            seu Point.
          </p>
          <label className="config-campo">
            Gym ID
            <input value={wellhubGymId} onChange={(e) => setWellhubGymId(e.target.value)} placeholder="Ex: 718" />
          </label>
        </section>

        <section className="alunos-card config-card">
          <div className="inicio-exp-topo">
            <span className="integ-marca totalpass">T</span>
            <span className={totalpassOk ? "status-pill status-good" : "status-pill status-neutral"}>
              {totalpassOk ? "Configurado" : "Não configurado"}
            </span>
          </div>
          <h2 className="chk-secao-titulo">TotalPass</h2>
          <p className="alunos-sub">Cada Point pega a sua chave no portal da TotalPass, na aba Integrações.</p>
          <label className="config-campo">
            Place API Key
            <span className="config-chave">
              <input
                type={mostrarChave ? "text" : "password"}
                value={placeApiKey}
                onChange={(e) => setPlaceApiKey(e.target.value)}
                placeholder="Cole aqui a chave do portal da TotalPass"
                autoComplete="off"
              />
              {placeApiKey && (
                <button type="button" className="alunos-acao" onClick={() => setMostrarChave((v) => !v)}>
                  {mostrarChave ? "ocultar" : "mostrar"}
                </button>
              )}
            </span>
          </label>
        </section>
      </div>

      {erro && <p className="form-error">{erro}</p>}
      <div className="config-salvar">
        {sucesso && (
          <span className="meupoint-salvo">
            <Icon name="check" size={14} /> Salvo
          </span>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar integrações"}
        </button>
      </div>
    </form>
  );
}
