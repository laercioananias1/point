import { Link } from "react-router-dom";
import { Icon, Layout } from "../../components/Layout";

/** Hub "Ver mais" (pedido do usuário, 2026-08-30: "esse botão de
 * configurações vamos transformar em um botão também no rodapé chamado
 * Ver Mais e lá coloca botões pra abrir cada configuração. Assim fica um
 * espaço pra criar mais funcionalidades organizado") — substitui o ícone
 * de engrenagem solto no cabeçalho por uma aba própria, com um botão por
 * seção de configuração (cada uma é uma tela própria). Botões de 2 em 2
 * (pedido do usuário, 2026-08-30), mesmo padrão .quick-actions já usado
 * na Início. Faturamento também saiu da barra de abas do rodapé e virou
 * botão aqui (pedido do usuário, 2026-08-30: "faturamento vai também pra
 * dentro de Ver mais") — novas funcionalidades que não cabem nas abas
 * principais entram aqui daqui pra frente, sempre em pares.
 *
 * "Meu Point" (pedido do usuário, 2026-08-30) — Sobre, informações
 * importantes e até 5 fotos, que aparecem na Início do aluno (ver
 * pages/admin-point/MeuPoint.tsx e pages/aluno/Inicio.tsx). */
export default function AdminPointVerMais() {
  return (
    <Layout>
      <h1>Ver mais</h1>

      <section className="section">
        <div className="quick-actions">
          <Link to="/admin-point/meu-point" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="home" />
            </span>
            <span className="quick-action-label">Meu Point</span>
          </Link>
          <Link to="/admin-point/configuracoes/feriados" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="calendar" />
            </span>
            <span className="quick-action-label">Feriados</span>
          </Link>
        
          <Link to="/admin-point/configuracoes/prazos" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="clock" />
            </span>
            <span className="quick-action-label">Prazos</span>
          </Link>
          <Link to="/admin-point/configuracoes/horarios" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="calendar" />
            </span>
            <span className="quick-action-label">Horários</span>
          </Link>
        
          <Link to="/admin-point/configuracoes/modalidades" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="grid" />
            </span>
            <span className="quick-action-label">Modalidades</span>
          </Link>
          <Link to="/admin-point/configuracoes/quadras" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="pin" />
            </span>
            <span className="quick-action-label">Quadras</span>
          </Link>
        
          <Link to="/admin-point/configuracoes/planos" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="ticket" />
            </span>
            <span className="quick-action-label">Planos</span>
          </Link>
          <Link to="/admin-point/faturamento" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="chart" />
            </span>
            <span className="quick-action-label">Faturamento</span>
          </Link>
        
          <Link to="/admin-point/configuracoes/categorias" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="list" />
            </span>
            <span className="quick-action-label">Categorias</span>
          </Link>
          <Link to="/admin-point/configuracoes/tipos-turma" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="repeat" />
            </span>
            <span className="quick-action-label">Tipos de turma</span>
          </Link>
        
          <Link to="/admin-point/experimental" className="quick-action">
            <span className="quick-action-icon">
              <Icon name="user-plus" />
            </span>
            <span className="quick-action-label">Aula experimental</span>
          </Link>
        </div>
      </section>
    </Layout>
  );
}
