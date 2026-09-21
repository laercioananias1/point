import { useState } from "react";
import { salvarTema, temaEfetivo } from "../theme";

/** Alterna claro/escuro direto do cabeçalho (pedido do usuário,
 * 2026-09-20: "coloque o ícone sol e lua na lateral direita superior para
 * trocar") — mostra a lua no tema claro e o sol no escuro (o que vai
 * acontecer ao clicar). Grava a escolha explícita, então sai do modo
 * "Sistema" da tela de Perfil; lá dá pra voltar.
 *
 * Emoji como texto, não Icon/SVG (pedido do usuário, 2026-09-20: "o ícone
 * de sol e lua também deu problema da mesma forma" — o SVG da lua saiu
 * como um pontinho) — mesmo problema e mesma saída do sino de notificações
 * ao lado (ver Layout.tsx). */
export function BotaoTema() {
  const [tema, setTema] = useState(() => temaEfetivo());

  function alternar() {
    const proximo = tema === "escuro" ? "claro" : "escuro";
    salvarTema(proximo);
    setTema(proximo);
  }

  return (
    <button
      type="button"
      className="app-header-icon-btn app-tema-btn"
      onClick={alternar}
      aria-label={tema === "escuro" ? "Mudar para o tema claro" : "Mudar para o tema escuro"}
      title={tema === "escuro" ? "Tema claro" : "Tema escuro"}
    >
      <span aria-hidden="true" style={{ fontSize: 16, lineHeight: 1 }}>
        {tema === "escuro" ? "☀️" : "🌙"}
      </span>
    </button>
  );
}
