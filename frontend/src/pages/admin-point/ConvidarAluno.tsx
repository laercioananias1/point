import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { useAuth } from "../../auth/AuthContext";
import type { Modalidade, PeriodoDia, Plano, TurmaResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA, rotuloTurma } from "../../lib/dias";
import { formatarReais } from "../../lib/formato";

/** A partir de que horário cada período do dia começa (pedido do usuário,
 * 2026-08-26: tirou o seletor de "período preferido" do cadastro — o
 * admin já escolhe a turma exata, então o período vira só um detalhe
 * derivado do horário escolhido, não precisa perguntar de novo). Mesmos
 * limites do backend (app/routers/turmas.py::PERIODO_DIA_HORAS). */
function periodoDaHora(horario: string): PeriodoDia {
  const hora = Number(horario.slice(0, 2));
  if (hora < 12) return "manha";
  if (hora < 18) return "tarde";
  return "noite";
}

/** Tela própria pra convidar aluno (pedido do usuário, 2026-08-26: "quero
 * que tenha um botão 'convidar aluno' e abre a tela de cadastro. Não deixe
 * tudo em uma tela") — antes esse formulário vivia embutido no meio da
 * aba Alunos, junto com mais 6 outras seções. Piloto: se aprovar o
 * padrão, o mesmo tratamento (caixinha visual na lista → tela própria)
 * vai pro resto do app. */
export default function AdminPointConvidarAluno() {
  const { user } = useAuth();
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/aluno")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Convidar aluno</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Você decide a assinatura inteira; o aluno só aceita — se ainda não tem conta, cria a própria
        senha no aceite; se já tem, só confirma. Ativa sozinha assim que ele aceitar. Pagamento é só
        via Pix.
      </p>

      {user?.point_id ? (
        <ConvidarForm pointId={user.point_id} />
      ) : (
        <p className="empty-state">Não foi possível identificar o seu Point.</p>
      )}
    </Layout>
  );
}

/** O admin decide a assinatura inteira e convida por e-mail (pedido do
 * usuário, 2026-08-20 — o aluno cadastra a própria conta, o admin não cria
 * senha por ele). Se o aluno já tiver conta, só confirma o aceite; se não
 * tiver, cria a senha na hora — nos dois casos a assinatura ativa sozinha. */
function ConvidarForm({ pointId }: { pointId: number }) {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [email, setEmail] = useState("");
  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeId, setModalidadeId] = useState<number | null>(null);
  const [planos, setPlanos] = useState<Plano[]>([]);
  const [planoId, setPlanoId] = useState<number | null>(null);
  const [turmasDisponiveis, setTurmasDisponiveis] = useState<TurmaResumo[]>([]);
  // A turma é a agenda inteira do professor — cada aluno usa só um
  // SUBCONJUNTO dos dias dela (pedido do usuário, 2026-08-21). Por turma
  // escolhida, guarda quais dias esse aluno vai frequentar.
  const [diasPorTurma, setDiasPorTurma] = useState<Record<number, string[]>>({});
  const [dataInicio, setDataInicio] = useState(new Date().toISOString().slice(0, 10));
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    api.get<Modalidade[]>(`/modalidades?point_id=${pointId}`).then((res) => {
      setModalidades(res);
      setModalidadeId(res[0]?.id ?? null);
    });
    api.get<Plano[]>(`/planos?point_id=${pointId}`).then((res) => {
      setPlanos(res);
      setPlanoId(res[0]?.id ?? null);
    });
  }, [pointId]);

  useEffect(() => {
    if (modalidadeId === null) {
      setTurmasDisponiveis([]);
      return;
    }
    // Sem filtro de período (pedido do usuário, 2026-08-26) — mostra todas
    // as turmas dessa modalidade, o admin escolhe direto qual/quais.
    api.get<TurmaResumo[]>(`/turmas?point_id=${pointId}&modalidade_id=${modalidadeId}`).then((res) => {
      setTurmasDisponiveis(res);
      setDiasPorTurma({});
    });
  }, [pointId, modalidadeId]);

  const frequenciaAlvo = planos.find((p) => p.id === planoId)?.frequencia_semanal ?? 0;
  // O que precisa bater com a frequência do plano é a soma de dias
  // escolhidos entre as turmas, não a quantidade de turmas nem a agenda
  // inteira delas (pedido do usuário, 2026-08-21: cada aluno usa só um
  // subconjunto dos dias da turma).
  const diasEscolhidos = Object.values(diasPorTurma).reduce((soma, dias) => soma + dias.length, 0);

  function alternarTurma(id: number) {
    setDiasPorTurma((atual) => {
      if (id in atual) {
        const { [id]: _omitido, ...resto } = atual;
        return resto;
      }
      return { ...atual, [id]: [] };
    });
  }

  function alternarDia(turmaId: number, dia: string) {
    setDiasPorTurma((atual) => {
      const diasAtuais = atual[turmaId] ?? [];
      const novosDias = diasAtuais.includes(dia)
        ? diasAtuais.filter((d) => d !== dia)
        : [...diasAtuais, dia];
      return { ...atual, [turmaId]: novosDias };
    });
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (modalidadeId === null || planoId === null) return;
    setErro(null);
    setEnviando(true);
    try {
      const turmas = Object.entries(diasPorTurma)
        .filter(([, dias]) => dias.length > 0)
        .map(([turmaId, dias]) => ({ turma_id: Number(turmaId), dias_semana: dias }));
      // O backend ainda guarda um período preferido (é o que aparece no
      // perfil do aluno) — deriva da primeira turma escolhida em vez de
      // perguntar de novo pro admin, que já escolheu o horário exato logo
      // abaixo (pedido do usuário, 2026-08-26).
      const primeiraTurmaId = Number(Object.keys(diasPorTurma).find((id) => diasPorTurma[Number(id)].length > 0));
      const primeiraTurma = turmasDisponiveis.find((t) => t.id === primeiraTurmaId);
      await api.post("/convites", {
        nome,
        email,
        modalidade_id: modalidadeId,
        periodo_dia_desejado: primeiraTurma ? periodoDaHora(primeiraTurma.horario) : "noite",
        fonte_pagamento: "pix",
        plano_id: planoId,
        turmas,
        data_inicio: dataInicio,
      });
      // Volta pra lista de alunos ao enviar (pedido do usuário, 2026-08-26)
      // — leva o nome pra Alunos mostrar a confirmação por lá.
      navigate("/admin-point/aluno", { state: { convidado: nome } });
      return;
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o convite. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  if (modalidades.length === 0) {
    return <p className="empty-state">Cadastre uma modalidade (Configurações) antes.</p>;
  }
  if (planos.length === 0) {
    return <p className="empty-state">Cadastre um plano (Configurações) antes.</p>;
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
      <div className="form-row">
        <label>
          Nome do aluno
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>

      <div className="form-row">
        <label>
          Modalidade
          <select value={modalidadeId ?? ""} onChange={(e) => setModalidadeId(Number(e.target.value))}>
            {modalidades.map((m) => (
              <option key={m.id} value={m.id}>
                {m.nome}
              </option>
            ))}
          </select>
        </label>
        <label>
          Plano
          <select
            value={planoId ?? ""}
            onChange={(e) => {
              setPlanoId(Number(e.target.value));
              setDiasPorTurma({});
            }}
          >
            {planos.map((p) => (
              <option key={p.id} value={p.id}>
                {p.frequencia_semanal}x por semana — {formatarReais(p.preco)}
              </option>
            ))}
          </select>
        </label>
      </div>

      <label>
        Data de início
        <input
          type="date"
          value={dataInicio}
          onChange={(e) => setDataInicio(e.target.value)}
          required
        />
      </label>

      <label>
        Turmas ({diasEscolhidos} de {frequenciaAlvo} dia(s) por semana escolhidos)
        {turmasDisponiveis.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Nenhuma turma dessa modalidade ainda — crie uma turma antes, ou peça pro professor.
          </p>
        ) : (
          <div className="turma-escolha-lista">
            {turmasDisponiveis.map((t) => {
              const selecionada = t.id in diasPorTurma;
              const diasDaTurma = diasPorTurma[t.id] ?? [];
              return (
                <div key={t.id} className="turma-escolha-item">
                  <button
                    type="button"
                    className={selecionada ? "toggle-chip active" : "toggle-chip"}
                    onClick={() => alternarTurma(t.id)}
                  >
                    {rotuloTurma(t.dias_semana, t.horario)}
                  </button>
                  {selecionada && (
                    <div className="toggle-grid" style={{ marginTop: 6, marginLeft: 12 }}>
                      {t.dias_semana.map((dia) => (
                        <button
                          key={dia}
                          type="button"
                          className={diasDaTurma.includes(dia) ? "toggle-chip active" : "toggle-chip"}
                          onClick={() => alternarDia(t.id, dia)}
                        >
                          {DIAS_SEMANA.find((d) => d.value === dia)?.label ?? dia}
                        </button>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </label>

      {erro && <p className="form-error">{erro}</p>}

      <button
        type="submit"
        disabled={enviando || !nome || !email || diasEscolhidos !== frequenciaAlvo}
      >
        {enviando ? "Enviando..." : "Enviar convite"}
      </button>
    </form>
  );
}
