import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./Avatar";
import { Icon } from "./Layout";
import { formatarCelular } from "../lib/formato";

/** Topo das telas de Perfil no layout do kit (pedido do usuário,
 * 2026-10-01: "dê uma restilizada agora na tela de perfil") — cartão
 * escuro com a foto grande, nome, papel e contato. A troca de foto
 * (pedido do usuário, 2026-09-21: "colocar para o usuário inserir uma
 * foto") mora aqui: botão de câmera sobre a foto e "Remover foto". */
export function PerfilTopo({ papel, detalhes }: { papel: string; detalhes?: (string | null | undefined)[] }) {
  const { user, atualizarUser } = useAuth();
  const inputRef = useRef<HTMLInputElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  if (!user) return null;

  async function enviar(arquivo: File) {
    setErro(null);
    setEnviando(true);
    try {
      const formData = new FormData();
      formData.append("arquivo", arquivo);
      await api.upload("/auth/me/foto", formData);
      await atualizarUser();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar a foto. Tente de novo.");
    } finally {
      setEnviando(false);
      if (inputRef.current) inputRef.current.value = "";
    }
  }

  async function remover() {
    setErro(null);
    setEnviando(true);
    try {
      await api.delete("/auth/me/foto");
      await atualizarUser();
    } catch {
      setErro("Não foi possível remover a foto. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  // Sem detalhes próprios da tela, mostra o contato da conta (pedido do
  // usuário, 2026-10-02: ver o e-mail do admin no perfil dele).
  const linhas = (detalhes ?? [user.email, user.celular ? formatarCelular(user.celular) : null]).filter(
    (d): d is string => Boolean(d),
  );

  return (
    <section className="perfil-topo">
      <div className="perfil-foto">
        <Avatar nome={user.nome} foto={user.foto} tamanho={104} />
        <button
          type="button"
          className="perfil-foto-botao"
          disabled={enviando}
          onClick={() => inputRef.current?.click()}
          aria-label={user.foto ? "Trocar foto" : "Adicionar foto"}
          title={user.foto ? "Trocar foto" : "Adicionar foto"}
        >
          <Icon name="edit" size={16} />
        </button>
        <input
          ref={inputRef}
          type="file"
          accept="image/jpeg,image/png,image/webp"
          hidden
          onChange={(e) => {
            const arquivo = e.target.files?.[0];
            if (arquivo) enviar(arquivo);
          }}
        />
      </div>
      <div className="perfil-topo-texto">
        <span className="perfil-papel">{papel}</span>
        <h2 className="perfil-nome">{user.nome}</h2>
        {linhas.map((l) => (
          <span key={l} className="perfil-detalhe">
            {l}
          </span>
        ))}
        <div className="perfil-foto-acoes">
          <button type="button" className="perfil-link" disabled={enviando} onClick={() => inputRef.current?.click()}>
            {enviando ? "Enviando..." : user.foto ? "Trocar foto" : "Adicionar foto"}
          </button>
          {user.foto && (
            <button type="button" className="perfil-link" disabled={enviando} onClick={remover}>
              Remover foto
            </button>
          )}
          <span className="perfil-foto-dica">JPG, PNG ou WebP, até 5 MB.</span>
        </div>
        {erro && <p className="form-error">{erro}</p>}
      </div>
    </section>
  );
}
