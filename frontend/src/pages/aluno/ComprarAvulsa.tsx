import { useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { TurmaResumo } from "../../api/types";
import { CabecalhoPagina } from "../../components/CabecalhoPagina";
import { Icon, Layout } from "../../components/Layout";
import { diaSemanaDeData, somarDias, toISODate } from "../../components/Calendar";
import { horarioFim } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

const DIAS_NA_TIRA = 21;
const DIAS_ABREV = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

type Etapa = "escolha" | "confirmar";

function sessoesDoDia(turmas: TurmaResumo[], data: Date): TurmaResumo[] {
  const iso = toISODate(data);
  const diaSemana = diaSemanaDeData(data);
  return turmas
    .filter((t) => {
      if (!t.dias_semana.includes(diaSemana)) return false;
      if (iso < t.periodo_inicio) return false;
      if (t.periodo_fim !== null && iso > t.periodo_fim) return false;
      if (t.excecoes.includes(iso)) return false;
      return true;
    })
    .sort((a, b) => a.horario.localeCompare(b.horario));
}

/** "quinta, 1/10 às 08:00 · Beach Tennis (Iniciante) · Quadra 1 · com Ana" */
function resumo(t: TurmaResumo, data: Date): string {
  const semana = data.toLocaleDateString("pt-BR", { weekday: "long" }).replace("-feira", "");
  return `${semana}, ${data.getDate()}/${data.getMonth() + 1} às ${t.horario} · ${t.modalidade.nome} (${t.categoria.nome}) · ${t.quadra.nome} · com ${t.vinculo.professor.nome}`;
}

/** Comprar aula avulsa (pedido do usuário, 2026-08-26: "o fluxo da compra
 * pode ser parecido com a utilização dos créditos — abre o calendário de
 * dias, seleciona o horário e confirma a compra"). Visual e passos da
 * página de aula experimental (pedido do usuário, 2026-10-01: "acho q da
 * para seguir o mesmo padrao de aula experimental") — modalidade → dia →
 * horário → confirmar com o preço. Sem restrição de professor: é uma
 * compra nova, não o uso de um crédito ligado a um professor. */
export default function AlunoComprarAvulsa() {
  const navigate = useNavigate();
  const [turmas, setTurmas] = useState<TurmaResumo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [modalidade, setModalidade] = useState<string | null>(null);
  const [dia, setDia] = useState<string | null>(null);
  const [escolhida, setEscolhida] = useState<TurmaResumo | null>(null);
  const [etapa, setEtapa] = useState<Etapa>("escolha");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  const carregar = useCallback(async () => {
    setCarregando(true);
    setErroCarregar(null);
    try {
      setTurmas(await api.get<TurmaResumo[]>("/turmas"));
    } catch {
      setErroCarregar("Não foi possível carregar as turmas. Tente novamente.");
    } finally {
      setCarregando(false);
    }
  }, []);

  useEffect(() => {
    carregar();
  }, [carregar]);

  // Modalidades com o preço avulso — viram o filtro (pílulas) e a tabela de
  // preços da apresentação.
  const modalidades = useMemo(
    () =>
      Array.from(new Map(turmas.map((t) => [t.modalidade.nome, t.modalidade])).values()).sort((a, b) =>
        a.nome.localeCompare(b.nome),
      ),
    [turmas],
  );
  const turmasFiltradas = useMemo(
    () => (modalidade ? turmas.filter((t) => t.modalidade.nome === modalidade) : turmas),
    [turmas, modalidade],
  );

  // Só os dias que têm alguma turma (igual à aula experimental).
  const dias = useMemo(
    () =>
      Array.from({ length: DIAS_NA_TIRA }, (_, i) => somarDias(new Date(), i)).filter(
        (d) => sessoesDoDia(turmasFiltradas, d).length > 0,
      ),
    [turmasFiltradas],
  );
  const diaAtual = dias.find((d) => toISODate(d) === dia) ?? dias[0] ?? null;
  const sessoes = diaAtual ? sessoesDoDia(turmasFiltradas, diaAtual) : [];

  function escolherModalidade(nome: string | null) {
    setModalidade(nome);
    setDia(null);
    setEscolhida(null);
  }

  function escolherDia(d: Date) {
    setDia(toISODate(d));
    setEscolhida(null);
  }

  async function confirmar() {
    if (!escolhida || !diaAtual) return;
    setEnviando(true);
    setErro(null);
    try {
      await api.post("/matriculas", {
        turma_id: escolhida.id,
        tipo: "avulsa",
        fonte_pagamento: "pix",
        data_aula: toISODate(diaAtual),
      });
      navigate("/aluno/creditos");
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível comprar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <CabecalhoPagina titulo="Comprar aula avulsa" contexto="Créditos" />

      <div className="exp-conteudo avulsa-conteudo">
        <div className="exp-intro">
          <span className="exp-tag">Aula avulsa</span>
          <h2 className="avulsa-titulo">Treine no dia que quiser</h2>
          <p>
            Escolha o dia e o horário, confira o resumo e confirme. O pagamento é pelo Pix e a aula
            entra na sua agenda.
          </p>
          <ul className="exp-checks">
            <li>
              <Icon name="check-circle" size={18} /> Qualquer turma com aula nos próximos 21 dias
            </li>
            <li>
              <Icon name="check-circle" size={18} /> Pagamento via Pix
            </li>
          </ul>
          {modalidades.length > 0 && (
            <div className="avulsa-precos">
              {modalidades.map((m) => (
                <div key={m.id} className="avulsa-preco">
                  <span>{m.nome}</span>
                  <strong>{formatarReais(m.preco_avulso)}</strong>
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="exp-card">
          {carregando && <p className="empty-state">Carregando horários...</p>}
          {!carregando && erroCarregar && <p className="form-error">{erroCarregar}</p>}
          {!carregando && !erroCarregar && turmas.length === 0 && (
            <p className="empty-state">Nenhuma turma disponível agora — volte mais tarde.</p>
          )}

          {!carregando && !erroCarregar && turmas.length > 0 && (
            <>
              <div className="exp-card-topo">
                <span className="exp-card-sub">Pagamento via Pix</span>
                <span className="exp-card-titulo">Escolha sua aula</span>
              </div>

              {etapa === "escolha" && (
                <>
                  {modalidades.length > 1 && (
                    <div className="exp-passo">
                      <span className="exp-passo-rotulo">Modalidade</span>
                      <div className="avulsa-modalidades">
                        {[null, ...modalidades.map((m) => m.nome)].map((nome) => (
                          <button
                            key={nome ?? "todas"}
                            type="button"
                            className={modalidade === nome ? "exp-horario ativo" : "exp-horario"}
                            onClick={() => escolherModalidade(nome)}
                          >
                            {nome ?? "Todas"}
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="exp-passo">
                    <span className="exp-passo-rotulo">1. Escolha o dia</span>
                    {dias.length === 0 ? (
                      <span className="exp-dica">Nenhuma aula dessa modalidade nos próximos 21 dias.</span>
                    ) : (
                      <div className="exp-dias">
                        {dias.map((d) => {
                          const iso = toISODate(d);
                          return (
                            <button
                              key={iso}
                              type="button"
                              className={diaAtual && iso === toISODate(diaAtual) ? "exp-dia ativo" : "exp-dia"}
                              onClick={() => escolherDia(d)}
                            >
                              <span className="exp-dia-semana">{DIAS_ABREV[d.getDay()]}</span>
                              <span className="exp-dia-numero">{d.getDate()}</span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {sessoes.length > 0 && (
                    <div className="exp-passo">
                      <span className="exp-passo-rotulo">2. Escolha o horário</span>
                      <div className="exp-horarios">
                        {sessoes.map((t) => (
                          <button
                            key={t.id}
                            type="button"
                            className={escolhida?.id === t.id ? "exp-horario ativo" : "exp-horario"}
                            onClick={() => setEscolhida(t)}
                            title={`${t.modalidade.nome} · ${t.quadra.nome} · com ${t.vinculo.professor.nome}`}
                          >
                            <span>{t.horario}</span>
                            <span className="exp-horario-sub">
                              {modalidade || modalidades.length === 1
                                ? t.categoria.nome
                                : `${t.modalidade.nome} · ${t.categoria.nome}`}
                            </span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}

                  {escolhida && diaAtual && (
                    <div className="exp-resumo">
                      <Icon name="calendar" size={22} />
                      <span>{resumo(escolhida, diaAtual)}</span>
                    </div>
                  )}

                  <button
                    type="button"
                    className="exp-cta"
                    disabled={!escolhida}
                    onClick={() => setEtapa("confirmar")}
                  >
                    Continuar
                  </button>
                </>
              )}

              {etapa === "confirmar" && escolhida && diaAtual && (
                <div className="exp-form">
                  <div className="exp-resumo exp-resumo-trocar">
                    <span>{resumo(escolhida, diaAtual)}</span>
                    <button type="button" className="link-btn" onClick={() => setEtapa("escolha")}>
                      Trocar horário
                    </button>
                  </div>

                  <div className="avulsa-total">
                    <span>
                      Aula avulsa · {escolhida.horario} – {horarioFim(escolhida.horario, escolhida.duracao_minutos)}
                      <br />
                      <span className="alunos-sub">{escolhida.vinculo.point.nome}</span>
                    </span>
                    <strong>{formatarReais(escolhida.modalidade.preco_avulso)}</strong>
                  </div>
                  <span className="exp-dica">
                    Pagamento via Pix. A aula fica reservada na sua agenda depois de confirmar.
                  </span>

                  {erro && <p className="form-error">{erro}</p>}

                  <button
                    type="button"
                    className="exp-cta exp-cta-destaque"
                    disabled={enviando}
                    onClick={confirmar}
                  >
                    {enviando ? "Comprando..." : "Confirmar compra"}
                  </button>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </Layout>
  );
}
