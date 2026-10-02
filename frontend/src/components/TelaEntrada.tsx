import type { ReactNode } from "react";
import { Icon } from "./Layout";
import { MarcaOPoint } from "./LogoMark";

/** Moldura das telas sem login — login, esqueci/redefinir senha e aceite
 * de convite (pedido do usuário, 2026-10-02: login no visual do site e
 * "passe" pras outras). Painel marinho com a marca e o slogan; o conteúdo
 * de cada tela vai do lado. `marca` troca a marca do OPoint pela do Point
 * (convites). */
export function TelaEntrada({ marca, children }: { marca?: ReactNode; children: ReactNode }) {
  return (
    <div className="login">
      <section className="login-painel">
        <div className="login-marca">{marca ?? <MarcaOPoint size={36} />}</div>
        <div className="login-painel-texto">
          <h2>
            Sua arena
            <br />
            no ponto.
          </h2>
          <ul>
            <li>
              <Icon name="check" size={16} /> Agenda das quadras e chamada
            </li>
            <li>
              <Icon name="check" size={16} /> Check-ins do Wellhub conferidos
            </li>
            <li>
              <Icon name="check" size={16} /> Cobrança no WhatsApp
            </li>
          </ul>
        </div>
        <span className="login-bola" aria-hidden="true" />
      </section>

      <main className="login-lado">
        <div className="login-conteudo">{children}</div>
      </main>
    </div>
  );
}
