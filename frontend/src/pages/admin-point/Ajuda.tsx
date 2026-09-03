import { useNavigate } from "react-router-dom";
import { AjudaCallout, AjudaGlossario, AjudaPergunta } from "../../components/Ajuda";
import { Icon, Layout } from "../../components/Layout";

/** Ajuda do admin (pedido do usuário, 2026-09-01) — formato de perguntas
 * frequentes, cada uma fechada por padrão. Aberta pelo botão de Ajuda no
 * cabeçalho (Layout.tsx), então "Voltar" volta pra tela em que a pessoa
 * estava, não pra um destino fixo. */
export default function AdminPointAjuda() {
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
        <b>A lógica por trás de quase tudo:</b> você monta o convite inteiro — dados da pessoa,
        plano ou acordo de repasse, turmas — e manda por e-mail. Quem recebe só aceita (cria a
        própria senha, se ainda não tiver conta). Ninguém cria senha por outra pessoa: o
        vínculo/assinatura ativa sozinho no aceite.
      </AjudaCallout>

      <section className="section">
        <h2>Glossário rápido</h2>
        <AjudaGlossario
          itens={[
            { termo: "Point", def: "a arena/unidade cadastrada no sistema." },
            { termo: "Modalidade", def: "o esporte — beach tennis, futevôlei etc." },
            { termo: "Quadra", def: "onde a aula acontece; atende certas modalidades." },
            { termo: "Plano", def: "pacote de frequência semanal + preço mensal." },
            { termo: "Turma", def: "a agenda fixa de um professor: dia, horário, quadra." },
            { termo: "Matrícula", def: "1 aluno numa turma — avulsa (por aula) ou mensal." },
            { termo: "Assinatura", def: "as matrículas mensais de um aluno, agrupadas." },
            { termo: "Crédito de reposição", def: "saldo de 1 aula pra reagendar depois." },
          ]}
        />
      </section>

      <section className="section">
        <h2>Configurar o Point</h2>
        <div className="card-list">
          <AjudaPergunta
            icon="grid"
            pergunta="Como cadastrar, editar ou remover uma modalidade e uma quadra?"
            nota="Cadastre isso antes de convidar professor ou aluno — turma depende disso. Remover só é permitido se não tiver turma cadastrada com aquela modalidade/quadra."
          >
            <ol>
              <li>Ver mais → Modalidades → Cadastrar modalidade (nome, duração padrão, preço avulso).</li>
              <li>Ver mais → Quadras → Cadastrar quadra, associando às modalidades que ela atende.</li>
              <li>Em cada item da lista, "Editar" muda o nome e os outros dados; "Remover" apaga.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta
            icon="ticket"
            pergunta="Como cadastrar, editar ou remover um plano?"
            nota="Só o preço é editável — a frequência semanal é a identidade do plano. Remover só é permitido se o plano nunca foi usado numa assinatura/convite."
          >
            <ol>
              <li>Ver mais → Planos → Cadastrar plano.</li>
              <li>Defina a frequência semanal (ex.: 2x) e o preço mensal.</li>
              <li>Em cada plano da lista, "Editar" muda o preço; "Remover" apaga.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta
            icon="calendar"
            pergunta="Como cadastrar um feriado?"
            nota="O sistema nunca gera aula em dia de feriado — nacional ou local — automaticamente, não precisa cancelar na mão."
          >
            <ol>
              <li>Ver mais → Feriados.</li>
              <li>Os nacionais já vêm prontos (inclusive os que mudam de data todo ano, como Sexta-feira Santa).</li>
              <li>"Cadastrar feriado local" adiciona um só desse Point (ex.: aniversário da cidade).</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="calendar" pergunta="Como configurar os horários de funcionamento?">
            <ul>
              <li>Ver mais → Horários.</li>
              <li>
                Dia de semana e fim de semana são configurados separadamente (sábado costuma ter só
                manhã, por exemplo).
              </li>
            </ul>
          </AjudaPergunta>

          <AjudaPergunta icon="clock" pergunta="Como configurar os prazos?">
            <ul>
              <li>Ver mais → Prazos.</li>
              <li>
                Prazo de cancelamento: quantas horas de antecedência o aluno precisa avisar pra
                ganhar crédito de reposição.
              </li>
              <li>Dia de vencimento: dia do mês (1 a 28) em que a mensalidade fecha.</li>
            </ul>
          </AjudaPergunta>

          <AjudaPergunta icon="home" pergunta="Como editar o perfil do Point (Meu Point)?">
            <ul>
              <li>Ver mais → Meu Point: sobre, informações importantes, fotos e banners.</li>
              <li>Aparece na Início do aluno e do professor.</li>
            </ul>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Professores</h2>
        <div className="card-list">
          <AjudaPergunta icon="user-plus" pergunta="Como convidar um professor?">
            <ol>
              <li>Aba Professores → Convidar professor.</li>
              <li>Preencha nome, celular, e-mail.</li>
              <li>
                Escolha o modelo de repasse: percentual por aula/mensalidade, valor fixo mensal, ou
                valor fixo por aula dada.
              </li>
              <li>Enviar convite — ele recebe por e-mail, aceita, o vínculo ativa sozinho.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="grid" pergunta="Quem cria as turmas dos professores?">
            <ul>
              <li>Quem cria e prolonga a turma é o próprio professor, depois de aceitar o vínculo.</li>
              <li>Você só acompanha: Início → Turmas, com filtro por professor e por quadra.</li>
            </ul>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Alunos</h2>
        <div className="card-list">
          <AjudaPergunta
            icon="user-plus"
            pergunta="Como convidar um aluno?"
            nota="Wellhub e TotalPass não geram cobrança por Pix — é só o registro de que o benefício cobre esse aluno."
          >
            <ol>
              <li>Aba Alunos → Convidar aluno.</li>
              <li>Nome, e-mail, modalidade e plano.</li>
              <li>
                Turma(s) e, dentro de cada uma, os dias da semana que esse aluno vai (até bater com
                a frequência do plano).
              </li>
              <li>Data de início e forma de pagamento: Pix, Wellhub ou TotalPass.</li>
              <li>Enviar convite — ele aceita por e-mail e a assinatura ativa sozinha.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="mail" pergunta="Como cobrar uma mensalidade em aberto?">
            <ul>
              <li>Aba Alunos → "Mensalidades em aberto" — "Em atraso" já deve o mês anterior.</li>
              <li>Botão "Lembrar por e-mail" manda um aviso pro aluno.</li>
            </ul>
          </AjudaPergunta>

          <AjudaPergunta icon="link" pergunta="Como reenviar ou cancelar um convite pendente?">
            <ul>
              <li>Aba Alunos → "Convites pendentes".</li>
              <li>"Copiar link" reenvia o mesmo convite por outro canal (WhatsApp, por exemplo).</li>
            </ul>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Agenda geral (turmas)</h2>
        <div className="card-list">
          <AjudaPergunta
            icon="x"
            pergunta="Como cancelar uma aula pra turma inteira (chuva, imprevisto)?"
            nota="Os ícones do calendário ficam diferentes: bandeira = feriado, X vermelho = aula cancelada por você — pra não confundir os dois."
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

          <AjudaPergunta
            icon="x"
            pergunta="Dá pra cancelar a aula de só um aluno, sem mexer na turma inteira?"
          >
            <p>
              Dá, de dois jeitos: aba Agenda → dia → na lista de presença, "Cancelar aula dele"; ou
              pela agenda individual do aluno (ver abaixo). Os dois pedem motivo.
            </p>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Agenda de um aluno</h2>
        <div className="card-list">
          <AjudaPergunta icon="x" pergunta="Como cancelar 1 aula específica de um aluno?">
            <ul>
              <li>Aba Alunos → clique no aluno → toque na data no calendário.</li>
              <li>Escolha o motivo do cancelamento (Saúde, Motivo pessoal ou Outro).</li>
              <li>
                Escolha se gera crédito de reposição ou não (opcional — útil se o cadastro da aula
                estava errado).
              </li>
              <li>Você não precisa respeitar o prazo mínimo de cancelamento — o aluno, sim.</li>
            </ul>
          </AjudaPergunta>

          <AjudaPergunta icon="pause" pergunta="Como pausar um período pro aluno (ex.: viagem)?">
            <ol>
              <li>Na agenda do aluno → "Pausar um período".</li>
              <li>Escolha a data inicial e final.</li>
              <li>A assinatura continua ativa — o aluno volta normal depois do período.</li>
            </ol>
          </AjudaPergunta>

          <AjudaPergunta icon="refresh" pergunta="Como reagendar um crédito do aluno?">
            <ul>
              <li>Na agenda do aluno → "Créditos disponíveis" → Reagendar.</li>
              <li>Fica restrito ao mesmo professor da aula original.</li>
            </ul>
          </AjudaPergunta>

          <AjudaPergunta
            icon="x"
            pergunta="Como cancelar a assinatura de um aluno?"
            nota="Todo cancelamento (aula, pausa, assinatura) fica em Histórico, com quem fez e a data/hora."
          >
            <p>
              Na agenda do aluno → "Cancelar assinatura". Encerra tudo: apaga as aulas futuras,
              expira os créditos em aberto e cancela junto qualquer matrícula avulsa do mesmo
              aluno nesse Point. Não tem volta — use com cuidado.
            </p>
          </AjudaPergunta>
        </div>
      </section>

      <section className="section">
        <h2>Faturamento</h2>
        <div className="card-list">
          <AjudaPergunta icon="chart" pergunta="Como gerar o fechamento de faturamento?">
            <ul>
              <li>Ver mais → Faturamento.</li>
              <li>Gera o fechamento de um período com o total de taxa e o repasse por professor.</li>
            </ul>
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

          <AjudaPergunta icon="users" pergunta="Tenho mais de um papel (ex.: dono e professor). Como troco de área?">
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
