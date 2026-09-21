import { useEffect, useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { Categoria, ExperimentalConfig, Modalidade, Quadra, TipoTurma, Vinculo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";
import { DIAS_SEMANA } from "../../lib/dias";

// Horas cheias disponíveis pra seleção — cobre a janela típica de
// funcionamento de uma arena (manhã cedo até o fim da noite).
const HORAS_DISPONIVEIS = Array.from({ length: 19 }, (_, i) => i + 5); // 5h..23h

function toggleEmLista<T>(lista: T[], item: T): T[] {
  return lista.includes(item) ? lista.filter((i) => i !== item) : [...lista, item];
}

function hoje(): string {
  return new Date().toISOString().slice(0, 10);
}

function daquiA(dias: number): string {
  const data = new Date();
  data.setDate(data.getDate() + dias);
  return data.toISOString().slice(0, 10);
}

/** Tela própria pra criar turma (pedido do usuário, 2026-09-09: "o
 * cadastro de turma precisa seguir o padrão de cadastro. Tem que abrir
 * uma nova tela") — antes vivia embutido no fim de professor/Turmas.tsx,
 * mesmo padrão visual de CadastrarModalidade.tsx/CadastrarCategoria.tsx:
 * um botão "Cadastrar" na listagem abre esta tela, que volta pra lista
 * com a mensagem de sucesso via navigate state. */
export default function ProfessorCadastrarTurma() {
  const navigate = useNavigate();
  const [vinculos, setVinculos] = useState<Vinculo[]>([]);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);

  useEffect(() => {
    api
      .get<Vinculo[]>("/professores/me/vinculos")
      .then((res) => setVinculos(res.filter((v) => v.status === "ativo")))
      .catch(() => setErroCarregar("Não foi possível carregar seus vínculos. Tente novamente."))
      .finally(() => setCarregando(false));
  }, []);

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/professor/turmas")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Criar turma</h1>
      </div>

      {erroCarregar && <p className="form-error">{erroCarregar}</p>}
      {carregando && !erroCarregar && <p className="empty-state">Carregando...</p>}

      {!carregando && !erroCarregar && (
        <>
          {vinculos.length === 0 ? (
            <p className="form-error">
              Você precisa de um vínculo aprovado por um Point antes de criar turmas.
            </p>
          ) : (
            <CriarTurmaForm
              vinculos={vinculos}
              onCriada={(mensagem) => navigate("/professor/turmas", { state: { criada: mensagem } })}
            />
          )}
        </>
      )}
    </Layout>
  );
}

function CriarTurmaForm({
  vinculos,
  onCriada,
}: {
  vinculos: Vinculo[];
  onCriada: (mensagem: string) => void;
}) {
  const [vinculoId, setVinculoId] = useState(vinculos[0]?.id ?? 0);
  const vinculoAtual = vinculos.find((v) => v.id === vinculoId);
  const pointId = vinculoAtual?.point_id ?? 0;

  const [modalidades, setModalidades] = useState<Modalidade[]>([]);
  const [modalidadeId, setModalidadeId] = useState<number | null>(null);
  const [quadras, setQuadras] = useState<Quadra[]>([]);
  const [quadraId, setQuadraId] = useState<number | null>(null);
  const [categorias, setCategorias] = useState<Categoria[]>([]);
  const [categoriaId, setCategoriaId] = useState<number | null>(null);
  const [tiposTurma, setTiposTurma] = useState<TipoTurma[]>([]);
  const [tipoTurmaId, setTipoTurmaId] = useState<number | null>(null);
  const [privada, setPrivada] = useState(false);
  const [aulaExperimental, setAulaExperimental] = useState<ExperimentalConfig>("nao");

  const [capacidade, setCapacidade] = useState("4");
  const [duracaoMinutos, setDuracaoMinutos] = useState("60");
  const [periodoInicio, setPeriodoInicio] = useState(hoje());
  const [periodoFim, setPeriodoFim] = useState(daquiA(90));
  const [recorrente, setRecorrente] = useState(false);
  const [diasSemana, setDiasSemana] = useState<string[]>([]);
  const [horarios, setHorarios] = useState<number[]>([]);

  // Dias/horários que o Point permite (pedido do usuário, 2026-08-21) — só
  // mostra o que dá pra escolher, em vez de deixar tentar e levar erro. Dia
  // de semana e fim de semana têm horários independentes (sábado costuma
  // ter só parte da manhã), então o horário liberado depende de quais dias
  // já estão marcados — mostra a união dos grupos representados.
  const diasPermitidos = [
    ...(vinculoAtual?.point.dias_semana_funcionamento ?? []),
    ...(vinculoAtual?.point.dias_fds_funcionamento ?? []),
  ];
  const temDiaDeSemanaMarcado = diasSemana.some((d) => d !== "sábado" && d !== "domingo");
  const temFdsMarcado = diasSemana.some((d) => d === "sábado" || d === "domingo");
  const horariosPermitidos = Array.from(
    new Set([
      ...(temDiaDeSemanaMarcado || !temFdsMarcado
        ? vinculoAtual?.point.horarios_semana_funcionamento ?? []
        : []),
      ...(temFdsMarcado || !temDiaDeSemanaMarcado
        ? vinculoAtual?.point.horarios_fds_funcionamento ?? []
        : []),
    ]),
  );

  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  useEffect(() => {
    if (!pointId) return;
    api.get<Modalidade[]>(`/modalidades?point_id=${pointId}`).then((res) => {
      setModalidades(res);
      setModalidadeId(res[0]?.id ?? null);
    });
    api.get<Categoria[]>(`/categorias?point_id=${pointId}`).then((res) => {
      setCategorias(res);
      setCategoriaId(res[0]?.id ?? null);
    });
    api.get<TipoTurma[]>(`/tipos-turma?point_id=${pointId}`).then((res) => {
      setTiposTurma(res);
      setTipoTurmaId(res[0]?.id ?? null);
    });
  }, [pointId]);

  useEffect(() => {
    const modalidade = modalidades.find((m) => m.id === modalidadeId);
    if (modalidade) setDuracaoMinutos(String(modalidade.duracao_padrao_minutos));

    if (!pointId || modalidadeId === null) {
      setQuadras([]);
      setQuadraId(null);
      return;
    }
    api.get<Quadra[]>(`/quadras?point_id=${pointId}&modalidade_id=${modalidadeId}`).then((res) => {
      setQuadras(res);
      setQuadraId(res[0]?.id ?? null);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pointId, modalidadeId]);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);

    if (modalidadeId === null || quadraId === null || categoriaId === null || tipoTurmaId === null) return;
    if (diasSemana.length === 0 || horarios.length === 0) {
      setErro("Escolha pelo menos um dia e um horário.");
      return;
    }
    if (!recorrente && periodoInicio > periodoFim) {
      setErro("O início do período precisa ser antes do fim.");
      return;
    }

    setEnviando(true);
    try {
      const turmasCriadas = await api.post<unknown[]>("/turmas", {
        vinculo_id: vinculoId,
        modalidade_id: modalidadeId,
        quadra_id: quadraId,
        categoria_id: categoriaId,
        tipo_turma_id: tipoTurmaId,
        privada,
        aula_experimental: aulaExperimental,
        capacidade: Number(capacidade),
        periodo_inicio: periodoInicio,
        periodo_fim: recorrente ? null : periodoFim,
        dias_semana: diasSemana,
        horarios: horarios.map((h) => `${String(h).padStart(2, "0")}:00`),
        duracao_minutos: Number(duracaoMinutos),
        recorrencia: "semanal",
      });
      onCriada(
        turmasCriadas.length === 1
          ? `1 turma criada (${diasSemana.length} dia(s) por semana).`
          : `${turmasCriadas.length} turmas criadas — uma por horário, cada uma nos ${diasSemana.length} dia(s) marcados.`,
      );
    } catch (e) {
      setErro(
        e instanceof ApiError
          ? e.message
          : "Não foi possível criar a turma. Confira os valores e tente de novo.",
      );
    } finally {
      setEnviando(false);
    }
  }

  if (tiposTurma.length === 0) {
    return (
      <p className="form-error">
        Nenhum tipo de turma cadastrado nesse Point ainda — peça pro admin cadastrar
        pelo menos um tipo (ex.: "Padrão") antes de criar uma turma.
      </p>
    );
  }

  if (modalidades.length === 0) {
    return (
      <p className="form-error">
        Nenhuma modalidade cadastrada nesse Point ainda — peça pro admin cadastrar
        modalidades e quadras antes.
      </p>
    );
  }

  if (categorias.length === 0) {
    return (
      <p className="form-error">
        Nenhuma categoria cadastrada nesse Point ainda — peça pro admin cadastrar
        as categorias (níveis) antes de criar uma turma.
      </p>
    );
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
      {vinculos.length > 1 && (
        <label>
          Point
          <select value={vinculoId} onChange={(e) => setVinculoId(Number(e.target.value))}>
            {vinculos.map((v) => (
              <option key={v.id} value={v.id}>
                {v.point.nome}
              </option>
            ))}
          </select>
        </label>
      )}

      <label>
        Tipo de turma
        <select
          value={tipoTurmaId ?? ""}
          onChange={(e) => setTipoTurmaId(Number(e.target.value))}
        >
          {tiposTurma.map((t) => (
            <option key={t.id} value={t.id}>
              {t.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Modalidade
        <select
          value={modalidadeId ?? ""}
          onChange={(e) => setModalidadeId(Number(e.target.value))}
        >
          {modalidades.map((m) => (
            <option key={m.id} value={m.id}>
              {m.nome}
            </option>
          ))}
        </select>
      </label>

      <label>
        Categoria (nível)
        <select
          value={categoriaId ?? ""}
          onChange={(e) => setCategoriaId(Number(e.target.value))}
        >
          {categorias.map((c) => (
            <option key={c.id} value={c.id}>
              {c.nome}
            </option>
          ))}
        </select>
      </label>

      <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={privada}
          onChange={(e) => setPrivada(e.target.checked)}
          style={{ width: "auto" }}
        />
        Turma privada
      </label>
      <p className="empty-state" style={{ padding: 0 }}>
        Turma privada não aparece pro aluno comprar avulsa ou reagendar crédito sozinho — só o
        professor ou o admin do Point matriculam alguém aqui (ex.: aula individual, dupla, família).
      </p>

      <label>
        Aula experimental
        <select
          value={aulaExperimental}
          onChange={(e) => setAulaExperimental(e.target.value as ExperimentalConfig)}
        >
          <option value="nao">Não participa</option>
          <option value="aceita">Aceita — turma normal, com vaga livre pra visitante experimentar</option>
          <option value="somente">Somente experimental — não recebe matrícula normal</option>
        </select>
      </label>
      <p className="empty-state" style={{ padding: 0 }}>
        Define se essa turma aparece na página pública de aula experimental (Início → Aula
        experimental). "Aceita" compartilha a mesma vaga com quem já é aluno; "somente experimental"
        é dedicada só a visitantes.
      </p>

      {quadras.length === 0 ? (
        <p className="form-error">
          Nenhuma quadra cadastrada pra essa modalidade — peça pro admin associar uma.
        </p>
      ) : (
        <div className="form-row">
          <label>
            Quadra
            <select value={quadraId ?? ""} onChange={(e) => setQuadraId(Number(e.target.value))}>
              {quadras.map((q) => (
                <option key={q.id} value={q.id}>
                  {q.nome}
                </option>
              ))}
            </select>
          </label>
          <label>
            Capacidade
            <input
              type="number"
              min="1"
              value={capacidade}
              onChange={(e) => setCapacidade(e.target.value)}
              required
            />
          </label>
        </div>
      )}

      <label>
        Duração da aula (min)
        <input
          type="number"
          min="15"
          step="15"
          value={duracaoMinutos}
          onChange={(e) => setDuracaoMinutos(e.target.value)}
          required
        />
      </label>

      <div className="form-row">
        <label>
          Início do período
          <input
            type="date"
            value={periodoInicio}
            onChange={(e) => setPeriodoInicio(e.target.value)}
            required
          />
        </label>
        <label>
          Fim do período
          <input
            type="date"
            value={periodoFim}
            onChange={(e) => setPeriodoFim(e.target.value)}
            disabled={recorrente}
            required={!recorrente}
          />
        </label>
      </div>

      <label style={{ flexDirection: "row", alignItems: "center", gap: "8px" }}>
        <input
          type="checkbox"
          checked={recorrente}
          onChange={(e) => setRecorrente(e.target.checked)}
          style={{ width: "auto" }}
        />
        Sem data de término (recorrente)
      </label>

      <label>
        Dias da semana
        {diasPermitidos.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Esse Point ainda não configurou os dias em que funciona.
          </p>
        ) : (
          <div className="toggle-grid">
            {DIAS_SEMANA.filter((d) => diasPermitidos.includes(d.value)).map((d) => (
              <button
                key={d.value}
                type="button"
                className={diasSemana.includes(d.value) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setDiasSemana((atual) => toggleEmLista(atual, d.value))}
              >
                {d.label}
              </button>
            ))}
          </div>
        )}
      </label>

      <label>
        Horários (hora cheia)
        {horariosPermitidos.length === 0 ? (
          <p className="empty-state" style={{ padding: "4px 0 0" }}>
            Esse Point ainda não configurou os horários em que funciona.
          </p>
        ) : (
          <div className="toggle-grid">
            {HORAS_DISPONIVEIS.filter((h) =>
              horariosPermitidos.includes(`${String(h).padStart(2, "0")}:00`),
            ).map((h) => (
              <button
                key={h}
                type="button"
                className={horarios.includes(h) ? "toggle-chip active" : "toggle-chip"}
                onClick={() => setHorarios((atual) => toggleEmLista(atual, h))}
              >
                {h}h
              </button>
            ))}
          </div>
        )}
      </label>

      <p className="empty-state" style={{ padding: 0 }}>
        Cria uma turma pra cada horário marcado acima, cada uma acontecendo em todos os dias
        selecionados.
      </p>

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" disabled={enviando || quadras.length === 0}>
        {enviando ? "Criando..." : "Criar turma(s)"}
      </button>
    </form>
  );
}
