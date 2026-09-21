import { useRef, useState } from "react";
import { api, ApiError } from "../api/client";
import { useAuth } from "../auth/AuthContext";
import { Avatar } from "./Avatar";

/** Foto de perfil do usuário logado (pedido do usuário, 2026-09-21:
 * "colocar para o usuário inserir uma foto") — mesmo componente nas 4
 * telas de Perfil, junto do TemaToggle. Aparece também no cabeçalho, ao
 * lado do nome. */
export function FotoPerfil() {
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

  return (
    <section className="section">
      <h2>Foto de perfil</h2>
      <div className="foto-perfil">
        <Avatar nome={user.nome} foto={user.foto} tamanho={84} />
        <div className="foto-perfil-acoes">
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
          <button
            type="button"
            className="secondary"
            disabled={enviando}
            onClick={() => inputRef.current?.click()}
          >
            {enviando ? "Enviando..." : user.foto ? "Trocar foto" : "Adicionar foto"}
          </button>
          {user.foto && (
            <button type="button" className="link-btn" disabled={enviando} onClick={remover}>
              Remover foto
            </button>
          )}
          <span className="foto-perfil-dica">JPG, PNG ou WebP, até 5 MB.</span>
        </div>
      </div>
      {erro && <p className="form-error">{erro}</p>}
    </section>
  );
}
