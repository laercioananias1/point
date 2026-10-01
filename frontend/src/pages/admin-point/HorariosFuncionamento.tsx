import { useCallback, useEffect, useState, type FormEvent } from "react";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Point } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA } from "../../lib/dias";

// Mesma janela usada no seletor de horário da turma (5h..23h, hora cheia).
const HORAS_FUNCIONAMENTO = Array.from({ length: 19 }, (_, i) => `${String(i + 5).padStart(2, "0")}:00`);

// Dias úteis e fim de semana ficam separados (pedido do usuário, 2026-08-21
// — sábado costuma ter só parte da manhã, bem diferente do horário de
// semana). Mesma ordem/valores de DIAS_SEMANA, só particionada.
const DIAS_UTEIS = DIAS_SEMANA.slice(0, 5);
const DIAS_FDS = DIAS_SEMANA.slice(5, 7);

const PERIODOS: { rotulo: string; horas: string[] }[] = [
  { rotulo: "Manhã", horas: HORAS_FUNCIONAMENTO.filter((h) => Number(h.slice(0, 2)) < 12) },
  { rotulo: "Tarde", horas: HORAS_FUNCIONAMENTO.filter((h) => Number(h.slice(0, 2)) >= 12 && Number(h.slice(0, 2)) < 18) },
  { rotulo: "Noite", horas: HORAS_FUNCIONAMENTO.filter((h) => Number(h.slice(0, 2)) >= 18) },
];

/** "8h–12h, 18h–21h" — agrupa as horas marcadas em faixas contínuas (cada
 * hora marcada é o início de uma aula de 1h). */
function resumoHoras(horarios: string[]): string {
  const horas = horarios.map((h) => Number(h.slice(0, 2))).sort((a, b) => a - b);
  if (horas.length === 0) return "nenhum horário";
  const faixas: [number, number][] = [];
  for (const h of horas) {
    const ultima = faixas[faixas.length - 1];
    if (ultima && h === ultima[1]) ultima[1] = h + 1;
    else faixas.push([h, h + 1]);
  }
  return faixas.map(([a, b]) => `${a}h–${b}h`).join(", ");
}

function resumoDias(dias: string[], opcoes: { value: string; label: string }[]): string {
  const marcados = opcoes.filter((d) => dias.includes(d.value));
  if (marcados.length === 0) return "fechado";
  if (marcados.length === opcoes.length && opcoes.length > 2) return `${opcoes[0].label} a ${opcoes[opcoes.length - 1].label}`;
  return marcados.map((d) => d.label).join(", ");
}

/** Tela própria pra horário de funcionamento (pedido do usuário,
 * 2026-08-30: "configurações do Point separa em 2: prazos e horários de
 * funcionamento"). Layout do kit (pedido do usuário, 2026-10-01): dias de
 * semana e fim de semana em cards lado a lado, horas por período com
 * atalho de marcar o período inteiro e um resumo em texto. */
export default function AdminPointHorariosFuncionamento() {
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
      <CabecalhoPagina titulo="Horários de funcionamento" contexto="Configurações" />
      <p className="pagina-intro">
        O professor só consegue criar turma dentro desses dias e horários. Cada hora marcada é o início de uma
        aula — dias de semana e fim de semana são independentes.
      </p>

      {!user?.point_id && <p className="empty-state">Não foi possível identificar o seu Point.</p>}
      {erro && <p className="form-error">{erro}</p>}
      {loading && <p className="empty-state">Carregando...</p>}

      {!loading && !erro && point && <HorariosForm point={point} onSalvo={(p) => setPoint(p)} />}
    </Layout>
  );
}

function BlocoHorarios({
  titulo,
  opcoesDias,
  dias,
  setDias,
  horarios,
  setHorarios,
}: {
  titulo: string;
  opcoesDias: { value: string; label: string }[];
  dias: string[];
  setDias: (l: string[]) => void;
  horarios: string[];
  setHorarios: (l: string[]) => void;
}) {
  function alternar(lista: string[], set: (l: string[]) => void, item: string) {
    set(lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item]);
  }

  function alternarPeriodo(horas: string[]) {
    const todas = horas.every((h) => horarios.includes(h));
    setHorarios(todas ? horarios.filter((h) => !horas.includes(h)) : Array.from(new Set([...horarios, ...horas])));
  }

  return (
    <section className="alunos-card config-card horarios-bloco">
      <div className="inicio-exp-topo">
        <h2 className="chk-secao-titulo">{titulo}</h2>
        <span className="horarios-resumo">
          {resumoDias(dias, opcoesDias)} · {resumoHoras(horarios)}
        </span>
      </div>

      <div className="horarios-dias">
        {opcoesDias.map((d) => (
          <button
            key={d.value}
            type="button"
            aria-pressed={dias.includes(d.value)}
            className={dias.includes(d.value) ? "horarios-dia ativo" : "horarios-dia"}
            onClick={() => alternar(dias, setDias, d.value)}
          >
            {d.label}
          </button>
        ))}
      </div>

      {PERIODOS.map((p) => {
        const todas = p.horas.every((h) => horarios.includes(h));
        return (
          <div key={p.rotulo} className="horarios-periodo">
            <div className="horarios-periodo-topo">
              <span className="prof-aulas-titulo">{p.rotulo}</span>
              <button type="button" className="alunos-acao" onClick={() => alternarPeriodo(p.horas)}>
                {todas ? "desmarcar" : "marcar tudo"}
              </button>
            </div>
            <div className="horarios-horas">
              {p.horas.map((h) => (
                <button
                  key={h}
                  type="button"
                  aria-pressed={horarios.includes(h)}
                  className={horarios.includes(h) ? "horarios-hora ativo" : "horarios-hora"}
                  onClick={() => alternar(horarios, setHorarios, h)}
                >
                  {Number(h.slice(0, 2))}h
                </button>
              ))}
            </div>
          </div>
        );
      })}
    </section>
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

  return (
    <form className="config" onSubmit={handleSubmit}>
      <div className="config-grade">
        <BlocoHorarios
          titulo="Dias de semana"
          opcoesDias={DIAS_UTEIS}
          dias={diasSemana}
          setDias={setDiasSemana}
          horarios={horariosSemana}
          setHorarios={setHorariosSemana}
        />
        <BlocoHorarios
          titulo="Fim de semana"
          opcoesDias={DIAS_FDS}
          dias={diasFds}
          setDias={setDiasFds}
          horarios={horariosFds}
          setHorarios={setHorariosFds}
        />
      </div>

      {erro && <p className="form-error">{erro}</p>}
      <div className="config-salvar">
        {sucesso && (
          <span className="meupoint-salvo">
            <Icon name="check" size={14} /> Horários salvos
          </span>
        )}
        <button type="submit" disabled={enviando}>
          {enviando ? "Salvando..." : "Salvar horários"}
        </button>
      </div>
    </form>
  );
}
