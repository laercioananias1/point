import { useRef, useState } from "react";
import { urlArquivo } from "../api/client";

function SetaEsquerda() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15 18 9 12l6-6" />
    </svg>
  );
}

function SetaDireita() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m9 18 6-6-6-6" />
    </svg>
  );
}

/** Carrossel de fotos (pedido do usuário, 2026-08-30: "as fotos precisa
 * ser um carrossel") — sem lib externa (nenhuma já instalada no projeto),
 * scroll nativo com snap por foto (funciona com swipe no touch de graça)
 * + setas pra desktop + bolinhas indicando a foto atual. `fotos` são
 * caminhos relativos vindos da API (/uploads/...), resolvidos aqui com
 * urlArquivo.
 *
 * `contido` (pedido do usuário, 2026-08-30: banner de torneio virando
 * ilegível, cortado num box 4:3) — banner costuma ser pôster/flyer, com
 * proporção bem diferente de uma foto comum; nesse modo a altura segue a
 * imagem em vez de forçar 4:3, e o object-fit vira "contain" (mostra
 * inteira, sem cortar). Fotos "normais" continuam no modo padrão
 * (cover, grade uniforme). */
export function Carrossel({ fotos, contido = false }: { fotos: string[]; contido?: boolean }) {
  const trilhoRef = useRef<HTMLDivElement>(null);
  const [indice, setIndice] = useState(0);

  if (fotos.length === 0) return null;

  function irPara(i: number) {
    const trilho = trilhoRef.current;
    if (!trilho) return;
    const alvo = Math.max(0, Math.min(i, fotos.length - 1));
    trilho.scrollTo({ left: trilho.clientWidth * alvo, behavior: "smooth" });
    setIndice(alvo);
  }

  function aoRolar() {
    const trilho = trilhoRef.current;
    if (!trilho || trilho.clientWidth === 0) return;
    setIndice(Math.round(trilho.scrollLeft / trilho.clientWidth));
  }

  return (
    <div className="carrossel">
      <div className="carrossel-trilho" ref={trilhoRef} onScroll={aoRolar}>
        {fotos.map((foto, i) => (
          <div className={contido ? "carrossel-item carrossel-item-contido" : "carrossel-item"} key={foto}>
            <img src={urlArquivo(foto)} alt={`Foto ${i + 1} do Point`} loading="lazy" />
          </div>
        ))}
      </div>

      {fotos.length > 1 && (
        <>
          <button
            type="button"
            className="carrossel-seta carrossel-seta-esquerda"
            onClick={() => irPara(indice - 1)}
            disabled={indice === 0}
            aria-label="Foto anterior"
          >
            <SetaEsquerda />
          </button>
          <button
            type="button"
            className="carrossel-seta carrossel-seta-direita"
            onClick={() => irPara(indice + 1)}
            disabled={indice === fotos.length - 1}
            aria-label="Próxima foto"
          >
            <SetaDireita />
          </button>

          <div className="carrossel-dots">
            {fotos.map((foto, i) => (
              <button
                key={foto}
                type="button"
                className={i === indice ? "carrossel-dot active" : "carrossel-dot"}
                onClick={() => irPara(i)}
                aria-label={`Ir pra foto ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}
