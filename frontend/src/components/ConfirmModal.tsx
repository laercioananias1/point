import { useCallback, useEffect, useState } from "react";

interface PedidoConfirmacao {
  mensagem: string;
  resolver: (ok: boolean) => void;
}

/** Confirmação com a cara do resto do app, em vez do popup nativo do
 * navegador (pedido do usuário, 2026-09-01: "esse popup tá diferente de
 * layout") — troca direta pro `confirm()` nativo: onde tinha
 * `if (!confirm("...")) return;`, fica `if (!(await confirmar("...")))
 * return;`. Renderize `{modal}` uma vez em qualquer lugar do componente
 * que chama o hook (é um overlay fixo, a posição no JSX não importa). */
export function useConfirm() {
  const [pedido, setPedido] = useState<PedidoConfirmacao | null>(null);

  const confirmar = useCallback((mensagem: string) => {
    return new Promise<boolean>((resolve) => {
      setPedido({ mensagem, resolver: resolve });
    });
  }, []);

  const responder = useCallback(
    (ok: boolean) => {
      pedido?.resolver(ok);
      setPedido(null);
    },
    [pedido],
  );

  useEffect(() => {
    if (!pedido) return;
    function aoTeclar(e: KeyboardEvent) {
      if (e.key === "Escape") responder(false);
    }
    window.addEventListener("keydown", aoTeclar);
    return () => window.removeEventListener("keydown", aoTeclar);
  }, [pedido, responder]);

  const modal = pedido ? (
    <div className="modal-backdrop" onClick={() => responder(false)}>
      <div className="modal-card" onClick={(e) => e.stopPropagation()}>
        <p style={{ margin: 0 }}>{pedido.mensagem}</p>
        <div className="modal-actions">
          <button onClick={() => responder(true)}>Confirmar</button>
          <button className="secondary" onClick={() => responder(false)}>
            Cancelar
          </button>
        </div>
      </div>
    </div>
  ) : null;

  return { confirmar, modal };
}
