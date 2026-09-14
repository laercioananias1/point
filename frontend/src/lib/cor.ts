/** Personalização de cor por Point (pedido do usuário, 2026-09-14:
 * "personalizar algumas coisas como a Logomarca do point, as cores do
 * portal") — o admin escolhe só UMA cor (--accent), e aqui derivamos as
 * variações escura (hover, --accent-strong) e clara (fundo de badge,
 * --accent-soft) automaticamente, pra não precisar pedir 3 cores.
 *
 * Sobrescreve via CSS custom property direto no <html> — cascka pra tudo
 * que usa var(--accent...) sem precisar tocar em cada componente. Some
 * a cor (Point sem cor_destaque, ou dono do app sem Point) e o app volta
 * pro teal padrão do sistema (:root), que continua definido no CSS. */

function hexParaRgb(hex: string): [number, number, number] | null {
  const m = /^#([0-9a-fA-F]{6})$/.exec(hex);
  if (!m) return null;
  const num = parseInt(m[1], 16);
  return [(num >> 16) & 255, (num >> 8) & 255, num & 255];
}

function paraCor(r: number, g: number, b: number): string {
  return `rgb(${Math.round(r)}, ${Math.round(g)}, ${Math.round(b)})`;
}

function escurecer(hex: string, fator: number): string | null {
  const rgb = hexParaRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return paraCor(r * (1 - fator), g * (1 - fator), b * (1 - fator));
}

function clarear(hex: string, fator: number): string | null {
  const rgb = hexParaRgb(hex);
  if (!rgb) return null;
  const [r, g, b] = rgb;
  return paraCor(r + (255 - r) * fator, g + (255 - g) * fator, b + (255 - b) * fator);
}

const PROPRIEDADES = ["--accent", "--accent-strong", "--accent-soft"] as const;

/** Chama com a cor do Point (ou null pra voltar ao padrão) — seguro
 * chamar de novo a qualquer momento (troca de Point, logout etc.). */
export function aplicarCorDestaque(cor: string | null | undefined): void {
  const raiz = document.documentElement.style;
  if (!cor || !hexParaRgb(cor)) {
    PROPRIEDADES.forEach((p) => raiz.removeProperty(p));
    return;
  }
  raiz.setProperty("--accent", cor);
  raiz.setProperty("--accent-strong", escurecer(cor, 0.18) ?? cor);
  raiz.setProperty("--accent-soft", clarear(cor, 0.85) ?? cor);
}
