import { useEffect, useMemo, useState } from "react";
import { diaSemanaDeData, inicioDaSemana, somarDias, toISODate } from "./Calendar";
import { DIAS_SEMANA } from "../lib/dias";
import { Icon } from "./Layout";

type Modo = "mes" | "semana";

/** Grade de calendário com um pontinho por dia (mês inteiro ou só a
 * semana), sem hora-a-hora — pedido do usuário, 2026-08-26: "a agenda do
 * aluno pode ser diferente, pq é algo individual só dele" (referência de
 * app de academia), depois "faça agenda do professor igual agenda do
 * aluno". Peça compartilhada entre as duas: só navega mês/semana e marca
 * o dia selecionado — quem chama decide o que mostrar embaixo pro dia
 * selecionado (a lista de ocorrências é bem diferente pra aluno — cancelar
 * com crédito — e pra professor — remover a aula da turma). */
export function MiniCalendario({
  temOcorrencia,
  diaSelecionado,
  onSelecionarDia,
  onDiasVisiveisChange,
}: {
  temOcorrencia: (data: Date) => boolean;
  diaSelecionado: Date;
  onSelecionarDia: (data: Date) => void;
  // Avisa quem chama exatamente quais datas a grade tá mostrando agora
  // (pedido implícito: a lista de ocorrências do dia selecionado precisa
  // ser calculada certinha pra QUALQUER mês/semana navegado, não só pra
  // uma janela fixa em volta de hoje) — dispara de novo a cada troca de
  // mês/semana/modo.
  onDiasVisiveisChange?: (dias: Date[]) => void;
}) {
  const [modo, setModo] = useState<Modo>("mes");
  const [referencia, setReferencia] = useState(new Date());

  const diasGrade = useMemo(() => {
    if (modo === "semana") {
      const inicio = inicioDaSemana(referencia);
      return Array.from({ length: 7 }, (_, i) => somarDias(inicio, i));
    }
    const primeiroDoMes = new Date(referencia.getFullYear(), referencia.getMonth(), 1);
    const inicio = inicioDaSemana(primeiroDoMes);
    return Array.from({ length: 42 }, (_, i) => somarDias(inicio, i));
  }, [modo, referencia]);

  useEffect(() => {
    onDiasVisiveisChange?.(diasGrade);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [diasGrade]);

  function navegar(direcao: 1 | -1) {
    if (modo === "semana") {
      setReferencia((r) => somarDias(r, direcao * 7));
    } else {
      setReferencia((r) => new Date(r.getFullYear(), r.getMonth() + direcao, 1));
    }
  }

  const tituloMes = referencia
    .toLocaleDateString("pt-BR", { month: "long", year: "numeric" })
    .replace(/^\w/, (c) => c.toUpperCase());

  return (
    <div>
      <div className="mini-calendar-toolbar">
        <div className="mini-calendar-nav">
          <button type="button" className="secondary" onClick={() => navegar(-1)} aria-label="Anterior">
            ‹
          </button>
          {modo === "mes" && <span className="mini-calendar-titulo">{tituloMes}</span>}
          <button type="button" className="secondary" onClick={() => navegar(1)} aria-label="Próximo">
            ›
          </button>
        </div>
        <button
          type="button"
          className="link-btn"
          style={{ display: "inline-flex", alignItems: "center", gap: 6 }}
          onClick={() => setModo((m) => (m === "mes" ? "semana" : "mes"))}
        >
          <Icon name="calendar" /> Visualizar {modo === "mes" ? "semana" : "mês"}
        </button>
      </div>

      <div className="mini-calendar-grid">
        {modo === "mes" &&
          DIAS_SEMANA.map((d) => (
            <div className="mini-calendar-weekday" key={d.value}>
              {d.label.slice(0, 3).toUpperCase()}
            </div>
          ))}
        {diasGrade.map((data) => {
          const iso = toISODate(data);
          const foraDoMes = modo === "mes" && data.getMonth() !== referencia.getMonth();
          const selecionado = iso === toISODate(diaSelecionado);
          return (
            <button
              type="button"
              key={iso}
              className={
                "mini-calendar-day" + (selecionado ? " selected" : "") + (foraDoMes ? " outside" : "")
              }
              onClick={() => onSelecionarDia(data)}
            >
              {modo === "semana" && (
                <span className="mini-calendar-weekday-inline">
                  {DIAS_SEMANA.find((d) => d.value === diaSemanaDeData(data))?.label.slice(0, 3).toUpperCase()}
                </span>
              )}
              <span className={"mini-calendar-dot" + (temOcorrencia(data) ? " ativo" : "")} />
              <span>{data.getDate()}</span>
            </button>
          );
        })}
      </div>

      <h3 className="mini-calendar-dia-titulo">
        {diaSelecionado.toLocaleDateString("pt-BR", { day: "2-digit", month: "long", year: "numeric" })}
      </h3>
    </div>
  );
}
