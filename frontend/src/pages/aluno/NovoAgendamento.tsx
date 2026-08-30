import { useNavigate } from "react-router-dom";
import { Icon, Layout } from "../../components/Layout";

/** Pedido do usuário, 2026-08-26: "o botão de agendar tem que abrir uma
 * tela parecida com essa de novo agendamento, se não tiver crédito deixa
 * um botão de comprar aula avulsa" — referência de app de academia. Só
 * chega aqui quem NÃO tem nenhum crédito disponível (Início já resolve
 * sozinho: 1 crédito pula direto pro reagendamento dele; mais de um manda
 * pra Meus créditos escolher) — essa tela é especificamente o "e agora,
 * como eu agendo do zero" pra quem tá zerado. */
export default function AlunoNovoAgendamento() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/aluno")}
          aria-label="Fechar"
        >
          <Icon name="x" />
        </button>
        <h1>Novo agendamento</h1>
      </div>

      <div className="empty-hero">
        <span className="empty-hero-icon">
          <Icon name="ticket" />
        </span>
        <h2>Sem créditos de aula</h2>
        <p>Você ainda não possui créditos de aula. Compre uma aula avulsa pra começar a agendar.</p>
        <button onClick={() => navigate("/aluno/creditos/comprar")}>Comprar aula avulsa</button>
      </div>
    </Layout>
  );
}
