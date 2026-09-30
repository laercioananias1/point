import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { AjudaIcone } from "../../components/AjudaIcone";
import { Icon, Layout } from "../../components/Layout";

/** Credenciais de benefício por Point (pedido do usuário, 2026-09-29:
 * "onde tá ficando o id_gym de cada point?" — não tinha tela nenhuma, só
 * dava pra configurar direto no banco). Gym ID (Wellhub) e place_api_key
 * (TotalPass) estavam na mesma situação — nenhum dos dois tinha campo,
 * então juntei os dois aqui numa tela só. */
export default function AdminPointIntegracoes() {
  const navigate = useNavigate();
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
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Integrações</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && (
        <section className="section">
          <IntegracoesForm point={point} onSalvo={(p) => setPoint(p)} />
        </section>
      )}
    </Layout>
  );
}

function IntegracoesForm({ point, onSalvo }: { point: Point; onSalvo: (p: Point) => void }) {
  const [wellhubGymId, setWellhubGymId] = useState(point.wellhub_gym_id ?? "");
  const [placeApiKey, setPlaceApiKey] = useState(point.place_api_key ?? "");
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
        // tinha (mesmo esquema de passthrough que Prazos/Horários usam
        // pra esses dois campos).
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

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ marginTop: 0 }}>
      <label>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          Gym ID (Wellhub)
          <AjudaIcone texto="Identifica sua unidade pra Wellhub — eles entregam esse número quando ativam a integração pro seu Point." />
        </span>
        <input
          value={wellhubGymId}
          onChange={(e) => setWellhubGymId(e.target.value)}
          placeholder="Ex: 718"
        />
      </label>

      <label>
        <span style={{ display: "inline-flex", alignItems: "center" }}>
          Place API Key (TotalPass)
          <AjudaIcone texto="Cada Point pega a sua no portal da TotalPass, aba Integrações." />
        </span>
        <input
          value={placeApiKey}
          onChange={(e) => setPlaceApiKey(e.target.value)}
          placeholder="Cole aqui a chave do portal da TotalPass"
        />
      </label>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">Salvo!</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar"}
      </button>
    </form>
  );
}
