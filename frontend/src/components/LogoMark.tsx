/** Símbolo do OPoint — anel + bola limão (design/logo/opoint-simbolo-*.svg,
 * kit de design de 2026-10-01). Versão "negativo" (anel e traço areia),
 * porque só aparece sobre fundo escuro: menu lateral, cabeçalho e telas de
 * login. Cores fixas de propósito: a marca não muda com o tema.
 * viewBox recortado no desenho (o SVG do kit tem margem em volta). */
export function LogoMark({ size = 22 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="26 26 180 180" aria-hidden="true">
      <path
        d="M129.05 197.33 A83.33 83.33 0 1 1 194.37 126.08 A48.33 48.33 0 0 1 165.78 113.51 A54.17 54.17 0 1 0 114.05 169.95 A48.33 48.33 0 0 1 129.05 197.33 Z"
        fill="#F6F1E7"
      />
      <circle cx="161.67" cy="161.67" r="41.67" fill="#D4F04A" />
      <path
        d="M133.33 147.5 c14.17 -7.92 32.92 -3.33 41.67 10.83 5.83 9.58 5.42 22.08 -0.42 30.42"
        fill="none"
        stroke="#F6F1E7"
        strokeWidth="9.17"
        strokeLinecap="round"
      />
    </svg>
  );
}

/** Marca completa: o símbolo faz o "O" e vem colado no "Point", como no
 * kit (o símbolo seguido de "OPoint" leria "O-OPoint"). */
export function MarcaOPoint({ size = 30 }: { size?: number }) {
  return (
    <span className="marca-opoint" aria-label="OPoint" style={{ fontSize: size * 0.83 }}>
      <LogoMark size={size} />
      <span aria-hidden="true">Point</span>
    </span>
  );
}
