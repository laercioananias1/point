/** Logomarca do OPoint (pedido do usuário, 2026-09-01 — rebrand de "Point"
 * pra "OPoint"). Mesma ideia visual de antes (rede de quadra de praia com a
 * bola cruzando por cima, o "ponto" sendo feito), agora encaixada dentro de
 * um círculo — o círculo faz o "O" de OPoint, e a bola cruza a borda dele
 * junto com a rede, então os dois "pontos" (o do nome e o do jogo) acontecem
 * no mesmo lugar. Mesmo desenho do favicon (frontend/public/favicon.svg), só
 * sem o fundo quadrado — aqui já sobra em cima do header/tela de login, que
 * já são --navy. Cores fixas (não var(--...)) de propósito: SVG não herda
 * custom property por padrão sem currentColor, e a marca não muda com o
 * tema. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="23" cy="25" r="15" fill="none" stroke="#EAF1F4" strokeWidth="3" />
      <path d="M11 18h24" stroke="#EAF1F4" strokeWidth="3.4" strokeLinecap="round" />
      <path
        d="M15 18v14M19 18v14M23 18v14M27 18v14M31 18v14"
        stroke="#EAF1F4"
        strokeWidth="1.4"
        strokeLinecap="round"
        opacity="0.5"
      />
      <circle cx="35" cy="13" r="6.3" fill="#F2542D" />
    </svg>
  );
}
