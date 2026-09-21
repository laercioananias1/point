import { Link } from "react-router-dom";
import { Icon } from "./Layout";

/** Botão de "novo X" flutuante (pedido do usuário, 2026-09-20: "o botão
 * para inserir seja assim [flutuante]... porque da forma que está, quando
 * tiver muitos alunos o botão vai sumir e ficar no fim da tela") — fica
 * fixo no canto da tela, acima da barra de abas no celular, em vez de um
 * action-card no fim da lista que some quando a lista cresce. */
export function BotaoFlutuante({ to, rotulo }: { to: string; rotulo: string }) {
  return (
    <Link to={to} className="fab">
      <Icon name="plus" />
      {rotulo}
    </Link>
  );
}
