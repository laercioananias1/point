import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Icon, Layout } from "../../components/Layout";
import { formatarCelular } from "../../lib/formato";

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

/** O admin convida o professor por e-mail (pedido do usuário, 2026-08-21 —
 * mesmo padrão do convite de assinatura do aluno: o professor não solicita
 * mais vínculo). Preço de aula avulsa/plano é tabela do Point por
 * modalidade, não entra aqui; repasse saiu do sistema (2026-09-20). */
function ConvidarProfessorForm() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [celular, setCelular] = useState("");
  const [email, setEmail] = useState("");
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
      <div className="form-row">
        <label>
          Nome do professor
          <input value={nome} onChange={(e) => setNome(e.target.value)} required />
        </label>
        <label>
          Celular
          <input
            type="tel"
            placeholder="(11) 91234-5678"
            value={celular}
            onChange={(e) => setCelular(formatarCelular(e.target.value))}
            required
          />
        </label>
        <label>
          E-mail
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>
      </div>

      {erro && <p className="form-error">{erro}</p>}

      <button type="submit" disabled={enviando}>
        {enviando ? "Enviando..." : "Enviar convite"}
      </button>
    </form>
  );
}
