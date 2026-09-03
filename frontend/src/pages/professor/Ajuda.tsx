import { useNavigate } from "react-router-dom";
import { AjudaCallout, AjudaPergunta } from "../../components/Ajuda";
import { Icon, Layout } from "../../components/Layout";

/** Ajuda do professor (pedido do usuário, 2026-09-01) — mesmo formato de
 * perguntas frequentes da Ajuda do admin (ver pages/admin-point/Ajuda.tsx),
 * conteúdo mais curto porque o professor mexe em menos telas. */
export default function ProfessorAjuda() {
  const navigate = useNavigate();

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate(-1)}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Ajuda</h1>
      </div>

      <AjudaCallout>
        <b>Antes de tudo:</b> você só cria turma depois de aceitar um convite de vínculo de um
        Point — quem decide o acordo de repasse é o admin, você só confirma.
      </AjudaCallout>

      <section className="section">
        <h2>Turmas</h2>
        <div className="card-list">
          <AjudaPergunta
            icon="grid"
            pergunta="Como criar uma turma?"
            nota="Em dia de feriado (nacional ou local do Point) o sistema nunca gera aula sozinho — não precisa fazer nada, ela some da agenda automaticamente."
          >
            <ol>
              <li>Aba Turmas → "Criar turma".</li>
              <li>Escolha o Point (se tiver mais de um vínculo), a modalidade e a quadra.</li>
              <li>Capacidade e duração da aula.</li>
              <li>
                Dias da semana e horário(s) — marcar mais de um horário cria uma turma por
                horário.
              </li>
              <li>Período: data de início + fim, ou marque "recorrente" pra não ter fim.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="calendar" pergunta="Como prolongar o período de uma turma?">
            <ul>
              <li>Aba Turmas → na turma → "Prolongar período".</li>
              <li>Escolha a nova data, ou marque "sem data de término".</li>
            </ul>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Agenda</h2>
        <div className="card-list">
          <AjudaPergunta
            icon="x"
            pergunta="Como cancelar uma aula (chuva, imprevisto)?"
            nota="Cancela pra todo mundo que tinha aula marcada naquele dia — os ícones ficam diferentes no calendário (bandeira = feriado, X = cancelada), pra não confundir os dois."
          >
            <ol>
              <li>Aba Agenda → toque no dia → "Cancelar aula" na turma.</li>
              <li>Escolha o motivo: Chuva, Ventos fortes ou Outro (nesse caso, descreva).</li>
              <li>
                "Cancelar só este dia" mantém a turma normal nas próximas semanas; "Cancelar este
                dia em diante" encerra a turma ali.
              </li>
              <li>Marque se quer gerar crédito de reposição pra quem já tinha aula marcada.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="x" pergunta="Como cancelar a aula de só um aluno específico?">
            <ol>
              <li>Aba Agenda → toque no dia → na lista de presença, "Cancelar aula dele".</li>
              <li>Escolha o motivo e se gera crédito de reposição pra esse aluno.</li>
            </ol>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Acompanhar</h2>
        <div className="card-list">
          <AjudaPergunta icon="chart" pergunta="Como vejo a ocupação das quadras?">
            <p>Início → Ocupação de quadra: quantas vagas estão ocupadas, por quadra e horário.</p>
          </AjudaPergunta>

          <AjudaPergunta icon="calendar" pergunta="Como vejo minha agenda de aulas?">
            <p>A Início já mostra as próximas 5 aulas; a aba Agenda mostra tudo.</p>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Sua conta</h2>
        <div className="card-list">
          <AjudaPergunta icon="check-circle" pergunta="Esqueci minha senha, e agora?">
            <p>
              Na tela de Login → "Esqueci minha senha" → chega um link por e-mail pra criar uma
              nova. Não tem troca de senha dentro do Perfil.
            </p>
          </AjudaPergunta>

          <AjudaPergunta icon="users" pergunta="Dou aula em mais de um Point. Como troco de área?">
            <p>Aba Perfil → "Trocar de área", no fim da tela.</p>
          </AjudaPergunta>

          <AjudaPergunta icon="settings" pergunta="Como mudo pro modo escuro?">
            <p>
              Aba Perfil → "Aparência": Sistema (acompanha o celular/computador automaticamente),
              Claro ou Escuro.
            </p>
          </AjudaPergunta>
        </div>
      </section>
    </Layout>
  );
}
