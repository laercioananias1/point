/** Logomarca do Point (pedido do usuário, 2026-08-30) — rede de quadra de
 * praia (beach tennis/futevôlei) com a bola cruzando por cima, o "ponto"
 * sendo feito. Mesmo desenho do favicon (frontend/public/favicon.svg),
 * só sem o fundo quadrado — aqui já sobra em cima do header/tela de login,
 * que já são --navy. Cores fixas (não var(--...)) de propósito: SVG não
 * herda custom property por padrão sem currentColor, e a marca não muda
 * com o tema. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <path d="M13 15v18M35 15v18" stroke="#EAF1F4" strokeWidth="3.2" strokeLinecap="round" />
      <path d="M13 20h22" stroke="#EAF1F4" strokeWidth="3.6" strokeLinecap="round" />
      <path
        d="M17 20v11M21.5 20v11M26 20v11M30.5 20v11"
        stroke="#EAF1F4"
        strokeWidth="1.7"
        strokeLinecap="round"
        opacity="0.55"
      />
      <circle cx="32" cy="14" r="6.5" fill="#F2542D" />
    </svg>
  );
}
