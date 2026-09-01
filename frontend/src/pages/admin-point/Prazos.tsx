import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra prazos (pedido do usuário, 2026-08-30: "configurações
 * do Point separa em 2: prazos e horários de funcionamento") — metade do
 * que antes era ConfiguracoesPoint.tsx. Prazos que cada Point pode
 * ajustar pro próprio funcionamento (pedido do usuário, 2026-08-21). */
export default function AdminPointPrazos() {
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
          onClick={() => navigate("/admin-point/mais")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Prazos</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && (
        <section className="section">
          <PrazosForm point={point} onSalvo={(p) => setPoint(p)} />
        </section>
      )}
    </Layout>
  );
}

function PrazosForm({ point, onSalvo }: { point: Point; onSalvo: (p: Point) => void }) {
  const [prazoCancelamento, setPrazoCancelamento] = useState(String(point.prazo_cancelamento_horas));
  const [prazoCredito, setPrazoCredito] = useState(String(point.prazo_credito_dias));
  const [diaVencimento, setDiaVencimento] = useState(String(point.dia_vencimento_mensalidade));
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
        prazo_cancelamento_horas: Number(prazoCancelamento),
        prazo_credito_dias: Number(prazoCredito),
        dia_vencimento_mensalidade: Number(diaVencimento),
        // Editados na tela de Horários de funcionamento, não aqui — só
        // reenvia o que o Point já tinha (mesmo esquema de passthrough
        // que já valia pro place_api_key).
        dias_semana_funcionamento: point.dias_semana_funcionamento,
        horarios_semana_funcionamento: point.horarios_semana_funcionamento,
        dias_fds_funcionamento: point.dias_fds_funcionamento,
        horarios_fds_funcionamento: point.horarios_fds_funcionamento,
        place_api_key: point.place_api_key ?? null,
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
        Antecedência mínima pra cancelar aula (horas)
        <input
          type="number"
          min="0"
          step="1"
          value={prazoCancelamento}
          onChange={(e) => setPrazoCancelamento(e.target.value)}
          required
        />
      </label>
      <label>
        Validade do crédito de reposição (dias)
        <input
          type="number"
          min="1"
          step="1"
          value={prazoCredito}
          onChange={(e) => setPrazoCredito(e.target.value)}
          required
        />
      </label>
      <label>
        Dia do vencimento da mensalidade
        <input
          type="number"
          min="1"
          max="28"
          step="1"
          value={diaVencimento}
          onChange={(e) => setDiaVencimento(e.target.value)}
          required
        />
      </label>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">Prazos salvos.</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar prazos"}
      </button>
    </form>
  );
}
