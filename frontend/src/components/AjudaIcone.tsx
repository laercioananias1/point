import { useEffect, useRef, useState } from "react";

/** Ícone de ajuda inline, ao lado de um título/campo (pedido do usuário,
 * 2026-09-29: "esses textos explicativos é bom ficar em um ícone de ajuda
 * do lado do título, polui menos as telas") — troca o parágrafo de
 * explicação sempre visível por um "?" que mostra o texto num popover ao
 * clicar. "?" como texto, não Icon/SVG — mesmo problema já visto no sino
 * e no botão de Ajuda do cabeçalho (o desenho de linha sumia no navegador
 * do usuário mesmo sem cache; texto em negrito sempre renderiza). */
export function AjudaIcone({ texto }: { texto: string }) {
  const [aberto, setAberto] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    if (!aberto) return;
    function aoClicarFora(e: MouseEvent) {
      if (ref.current && !ref.current.contains(e.target as Node)) setAberto(false);
    }
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") setAberto(false);
    }
    document.addEventListener("mousedown", aoClicarFora);
    window.addEventListener("keydown", aoTeclar);
    return () => {
      document.removeEventListener("mousedown", aoClicarFora);
      window.removeEventListener("keydown", aoTeclar);
    };
  }, [aberto]);

  return (
    <span className="ajuda-icone-wrap" ref={ref}>
      <button
        type="button"
        className="ajuda-icone"
        onClick={(e) => {
          e.preventDefault();
          setAberto((atual) => !atual);
        }}
        aria-label="Ajuda"
        aria-expanded={aberto}
      >
        <span aria-hidden="true">?</span>
      </button>
      {aberto && <span className="ajuda-icone-popover">{texto}</span>}
    </span>
  );
}
