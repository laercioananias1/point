/** Modo escuro (pedido do usuário, 2026-09-01: "já aproveita e faz o modo
 * dark também") — 3 opções: Sistema (padrão, segue o SO sem precisar de
 * JS pra reagir a mudança — é só CSS @media), Claro e Escuro (força,
 * grava em localStorage, sobrepõe o SO). A troca em si é só um atributo
 * `data-theme` na tag <html>; quem decide as cores é o CSS
 * (frontend/src/index.css, tokens redefinidos sob esse atributo).
 *
 * Aplicado o mais cedo possível (ver script inline em frontend/index.html,
 * antes do React montar) pra não ter flash de tela clara antes de escurecer. */
export type Tema = "sistema" | "claro" | "escuro";

const CHAVE = "opoint-tema";

export function lerTemaSalvo(): Tema {
  try {
    const valor = localStorage.getItem(CHAVE);
    if (valor === "claro" || valor === "escuro" || valor === "sistema") return valor;
  } catch {
    /* localStorage indisponível (modo privado, etc.) — cai no padrão */
  }
  return "sistema";
}

export function aplicarTema(tema: Tema) {
  const root = document.documentElement;
  if (tema === "sistema") {
    root.removeAttribute("data-theme");
  } else {
    root.setAttribute("data-theme", tema === "escuro" ? "dark" : "light");
  }
}

export function salvarTema(tema: Tema) {
  try {
    localStorage.setItem(CHAVE, tema);
  } catch {
    /* sem localStorage, só aplica pra essa sessão */
  }
  aplicarTema(tema);
}
