import { useCallback, useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA } from "../../lib/dias";

// Mesma janela usada no seletor de horário da turma (5h..23h, hora cheia).
const HORAS_FUNCIONAMENTO = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);

// Dias úteis e fim de semana ficam separados (pedido do usuário, 2026-08-21
// — sábado costuma ter só parte da manhã, bem diferente do horário de
// semana). Mesma ordem/valores de DIAS_SEMANA, só particionada.
const DIAS_UTEIS = DIAS_SEMANA.slice(0, 5);
const DIAS_FDS = DIAS_SEMANA.slice(5, 7);

/** Tela própria pra horário de funcionamento (pedido do usuário,
 * 2026-08-30: "configurações do Point separa em 2: prazos e horários de
 * funcionamento") — a outra metade do que antes era
 * ConfiguracoesPoint.tsx. */
export default function AdminPointHorariosFuncionamento() {
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
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Horários de funcionamento</h1>
      </div>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && (
        <section className="section">
          <HorariosForm point={point} onSalvo={(p) => setPoint(p)} />
        </section>
      )}
    </Layout>
  );
}

function HorariosForm({ point, onSalvo }: { point: Point; onSalvo: (p: Point) => void }) {
  const [diasSemana, setDiasSemana] = useState<string[]>(point.dias_semana_funcionamento);
  const [horariosSemana, setHorariosSemana] = useState<string[]>(point.horarios_semana_funcionamento);
  const [diasFds, setDiasFds] = useState<string[]>(point.dias_fds_funcionamento);
  const [horariosFds, setHorariosFds] = useState<string[]>(point.horarios_fds_funcionamento);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  function alternar(lista: string[], set: (l: string[]) => void, item: string) {
    set(lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item]);
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (diasSemana.length === 0 || horariosSemana.length === 0) {
      setErro("Escolha pelo menos um dia e um horário nos dias de semana.");
      return;
    }
    if (diasFds.length === 0 || horariosFds.length === 0) {
      setErro("Escolha pelo menos um dia e um horário no fim de semana.");
      return;
    }
    setErro(null);
    setSucesso(false);
    setEnviando(true);
    try {
      const atualizado = await api.patch<Point>("/points/me/configuracoes", {
        // Editados na tela de Prazos, não aqui — só reenvia o que o Point
        // já tinha.
        prazo_cancelamento_horas: point.prazo_cancelamento_horas,
        prazo_credito_dias: point.prazo_credito_dias,
        dia_vencimento_mensalidade: point.dia_vencimento_mensalidade,
        dias_semana_funcionamento: diasSemana,
        horarios_semana_funcionamento: horariosSemana,
        dias_fds_funcionamento: diasFds,
        horarios_fds_funcionamento: horariosFds,
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
      <p className="empty-state" style={{ padding: 0 }}>
        O professor só consegue criar turma dentro desses dias e horários. Dias de semana e fim de
        semana têm horários independentes — dá pra deixar o sábado só de manhã, por exemplo.
      </p>

      <label>Dias de semana</label>
      <div className="toggle-grid">
        {DIAS_UTEIS.map((d) => (
          <button
            key={d.value}
            type="button"
            className={diasSemana.includes(d.value) ? "toggle-chip active" : "toggle-chip"}
            onClick={() => alternar(diasSemana, setDiasSemana, d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="toggle-grid">
        {HORAS_FUNCIONAMENTO.map((h) => (
          <button
            key={h}
            type="button"
            className={horariosSemana.includes(h) ? "toggle-chip active" : "toggle-chip"}
            onClick={() => alternar(horariosSemana, setHorariosSemana, h)}
          >
            {Number(h.slice(0, 2))}h
          </button>
        ))}
      </div>

      <label>Fim de semana</label>
      <div className="toggle-grid">
        {DIAS_FDS.map((d) => (
          <button
            key={d.value}
            type="button"
            className={diasFds.includes(d.value) ? "toggle-chip active" : "toggle-chip"}
            onClick={() => alternar(diasFds, setDiasFds, d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>
      <div className="toggle-grid">
        {HORAS_FUNCIONAMENTO.map((h) => (
          <button
            key={h}
            type="button"
            className={horariosFds.includes(h) ? "toggle-chip active" : "toggle-chip"}
            onClick={() => alternar(horariosFds, setHorariosFds, h)}
          >
            {Number(h.slice(0, 2))}h
          </button>
        ))}
      </div>

      {erro && <p className="form-error">{erro}</p>}
      {sucesso && <p className="form-success">Horários salvos.</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Salvando..." : "Salvar horários"}
      </button>
    </form>
  );
}
