import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import type { ModeloRepasse, ProfessorResumo } from "../../api/types";
import { Icon, Layout } from "../../components/Layout";

/** Tela própria pra convidar professor (pedido do usuário, 2026-08-30:
 * "essa lista de professores leva pro início da tela, depois embaixo
 * deixa um botão para convidar professor que abre uma nova tela no
 * padrão de convidar alunos") — mesmo tratamento que ConvidarAluno.tsx:
 * antes esse formulário vivia embutido no topo da aba Professores. */
export default function AdminPointConvidarProfessor() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/admin-point/professor")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Convidar professor</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Você decide as condições comerciais inteiras; o professor só aceita — se ainda não tem
        conta, cria a própria senha no aceite; se já tem, só confirma. O vínculo ativa sozinho
        assim que ele aceitar.
      </p>

      <ConvidarProfessorForm />
    </Layout>
  );
}

/** Busca professor já cadastrado em QUALQUER Point da plataforma, pra
 * preencher o convite com o e-mail certo (pedido do usuário, 2026-08-21 —
 * "e se eu já tenho um professor na plataforma e quero convidá-lo?": o
 * convite reconhece pelo e-mail — é o único dado que precisa bater com a
 * conta que a pessoa já tem; celular pode ser diferente). */
function BuscarProfessorInline({
  onSelecionar,
}: {
  onSelecionar: (p: ProfessorResumo) => void;
}) {
  const [termo, setTermo] = useState("");
  const [resultados, setResultados] = useState<ProfessorResumo[]>([]);
  const [buscando, setBuscando] = useState(false);
  const [buscou, setBuscou] = useState(false);

  async function buscar() {
    setBuscando(true);
    try {
      const res = await api.get<ProfessorResumo[]>(`/professores?busca=${encodeURIComponent(termo)}`);
      setResultados(res);
      setBuscou(true);
    } finally {
      setBuscando(false);
    }
  }

  return (
    <div style={{ marginBottom: "4px" }}>
      <div className="form-row">
        <label style={{ flex: 1 }}>
          Nome ou celular
          <input
            value={termo}
            onChange={(e) => setTermo(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === "Enter") {
                e.preventDefault();
                buscar();
              }
            }}
            placeholder="Busque pelo nome ou telefone"
          />
        </label>
        <button
          type="button"
          disabled={buscando}
          onClick={buscar}
          style={{ alignSelf: "flex-end" }}
        >
          {buscando ? "Buscando..." : "Buscar"}
        </button>
      </div>
      {buscou && resultados.length === 0 && (
        <p className="empty-state" style={{ padding: "4px 0" }}>
          Nenhum professor encontrado.
        </p>
      )}
      {resultados.length > 0 && (
        <div className="card-list">
          {resultados.map((p) => (
            <div className="item-card" key={p.id}>
              <div className="item-card-info">
                <span className="item-card-title">{p.nome}</span>
                <span className="item-card-subtitle">
                  {p.contato} · {p.email}
                </span>
              </div>
              <button type="button" onClick={() => onSelecionar(p)}>
                Usar
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

/** O admin decide o acordo de repasse e convida o professor por e-mail
 * (pedido do usuário, 2026-08-21 — mesmo padrão do convite de assinatura
 * do aluno: o professor não solicita mais vínculo). Preço de aula avulsa/
 * plano é tabela do Point por modalidade (Configurações), não entra aqui —
 * com o professor só tem o acordo de repasse. */
function ConvidarProfessorForm() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
  const [modeloRepasse, setModeloRepasse] = useState<ModeloRepasse>("percentual");
  const [valorRepasse, setValorRepasse] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await api.post("/convites-vinculo", {
        nome,
        celular,
        email,
        modelo_repasse: modeloRepasse,
        valor_repasse: Number(valorRepasse),
      });
      // Volta pra lista de professores ao enviar (mesmo padrão de
      // ConvidarAluno.tsx) — leva o nome pra mostrar a confirmação por lá.
      navigate("/admin-point/professor", { state: { convidado: nome } });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar o convite. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
      <label>Professor já cadastrado na plataforma?</label>
      <BuscarProfessorInline
        onSelecionar={(p) => {
          setNome(p.nome);
          setCelular(p.contato);
          setEmail(p.email);
        }}
      />
      <p className="empty-state" style={{ padding: 0 }}>
        Encontrou? Selecionar preenche os dados — o e-mail é o que precisa bater com a conta que
        ele já tem (celular pode ser diferente). Se não encontrar, é só preencher do zero abaixo.
      </p>

      <div className="form-row">
        <label>
          Nome do professor
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Celular
          <input value={celular} onChange={(e) => setCelular(e.target.value)} required />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>

      <div className="form-row">
        <label>
          Modelo de repasse
          <select
            value={modeloRepasse}
            onChange={(e) => setModeloRepasse(e.target.value as ModeloRepasse)}
          >
            <option value="percentual">Percentual por aula/mensalidade</option>
            <option value="valor_fixo_mensal">Valor fixo mensal</option>
            <option value="valor_fixo_por_aula">Valor fixo por aula dada</option>
          </select>
        </label>
        <label>
          {modeloRepasse === "percentual" ? "Percentual (%)" : "Valor (R$)"}
          <input
            type="number"
            min="0"
            step="0.01"
            value={valorRepasse}
            onChange={(e) => setValorRepasse(e.target.value)}
            required
          />
        </label>
      </div>

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar convite"}
      </button>
    </form>
  );
}
