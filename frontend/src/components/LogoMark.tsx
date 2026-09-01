/** Logomarca do OPoint (pedido do usuário, 2026-09-01 — rebrand de "Point"
 * pra "OPoint"; refeita 2026-09-01: "ta incomodando a rede... tem que ser
 * algo que imprima bem em bonés, camisetas, chaveiros" — a rede de malha
 * fina não sobrevive a bordado/impressão pequena, então saiu. Ficou só
 * duas formas sólidas e grossas: o anel (o "O" de OPoint) e a bola
 * cruzando a borda dele, fazendo o ponto — sem nenhuma linha fina.
 * Mesmo desenho do favicon (frontend/public/favicon.svg), só sem o fundo
 * quadrado — aqui já sobra em cima do header/tela de login, que já são
 * --navy. Cores fixas (não var(--...)) de propósito: SVG não herda custom
 * property por padrão sem currentColor, e a marca não muda com o tema. */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" aria-hidden="true">
      <circle cx="23" cy="24" r="14" fill="none" stroke="#EAF1F4" strokeWidth="7.5" />
      <circle cx="35" cy="12" r="8" fill="#F2542D" />
    </svg>
  );
}
