import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra prazos (pedido do usuário, 2026-08-30: "configurações
 * do Point separa em 2: prazos e horários de funcionamento"). Prazos que
 * cada Point pode ajustar pro próprio funcionamento (pedido do usuário,
 * 2026-08-21). Layout do kit (pedido do usuário, 2026-10-01): um card por
 * prazo, número grande e o efeito na prática. */
export default function AdminPointPrazos() {
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
      <CabecalhoPagina titulo="Prazos" contexto="Configurações" />

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && <PrazosForm point={point} onSalvo={(p) => setPoint(p)} />}
    </Layout>
  );
}

function CartaoPrazo({
  icone,
  titulo,
  unidade,
  valor,
  setValor,
  min,
  max,
  explicacao,
}: {
  icone: "clock" | "ticket" | "calendar";
  titulo: string;
  unidade: string;
  valor: string;
  setValor: (v: string) => void;
  min: number;
  max?: number;
  explicacao: string;
}) {
  return (
    <section className="alunos-card config-card prazo-card">
      <span className="prazo-icone">
        <Icon name={icone} size={20} />
      </span>
      <h2 className="chk-secao-titulo">{titulo}</h2>
      <label className="prazo-campo">
        <input
          type="number"
          min={min}
          max={max}
          step="1"
          value={valor}
          onChange={(e) => setValor(e.target.value)}
          required
          aria-label={titulo}
        />
        <span>{unidade}</span>
      </label>
      <p className="alunos-sub">{explicacao}</p>
    </section>
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
        // reenvia o que o Point já tinha.
        dias_semana_funcionamento: point.dias_semana_funcionamento,
        horarios_semana_funcionamento: point.horarios_semana_funcionamento,
        dias_fds_funcionamento: point.dias_fds_funcionamento,
        horarios_fds_funcionamento: point.horarios_fds_funcionamento,
        place_api_key: point.place_api_key ?? null,
        wellhub_gym_id: point.wellhub_gym_id ?? null,
      });
      onSalvo(atualizado);
      setSucesso(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível salvar. Confira os valores.");
    } finally {
      setEnviando(false);
    }
  }

  const horas = Number(prazoCancelamento) || 0;
  const dias = Number(prazoCredito) || 0;
  const vence = Number(diaVencimento) || 0;

  return (
    <form className="config" onSubmit={handleSubmit}>
      <div className="config-grade config-grade-3">
        <CartaoPrazo
          icone="clock"
          titulo="Cancelar aula"
          unidade={horas === 1 ? "hora antes" : "horas antes"}
          valor={prazoCancelamento}
          setValor={setPrazoCancelamento}
          min={0}
          explicacao={`O aluno que cancelar com pelo menos ${horas}h de antecedência ganha um crédito de reposição. Depois disso, a aula não pode mais ser cancelada por ele.`}
        />
        <CartaoPrazo
          icone="ticket"
          titulo="Validade do crédito"
          unidade={dias === 1 ? "dia" : "dias"}
          valor={prazoCredito}
          setValor={setPrazoCredito}
          min={1}
          explicacao={`O crédito de reposição precisa ser usado em até ${dias} ${dias === 1 ? "dia" : "dias"} depois da aula cancelada; depois vence.`}
        />
        <CartaoPrazo
          icone="calendar"
          titulo="Vencimento da mensalidade"
          unidade="todo mês"
          valor={diaVencimento}
          setValor={setDiaVencimento}
          min={1}
          max={28}
          explicacao={`As mensalidades geradas no dia 1 vencem no dia ${vence} do mês. Vai até o dia 28 pra caber em fevereiro.`}
        />
      </div>

      {erro && <p className="form-error">{erro}</p>}
      <div className="config-salvar">
        {sucesso && (
          <span className="meupoint-salvo">
            <Icon name="check" size={14} /> Prazos salvos
          </span>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar prazos"}
        </button>
      </div>
    </form>
  );
}
