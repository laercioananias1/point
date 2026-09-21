import { urlArquivo } from "../api/client";

function iniciais(nome: string): string {
  const partes = nome.trim().split(/\s+/).filter(Boolean);
  if (partes.length === 0) return "?";
  const primeira = partes[0].charAt(0);
  const ultima = partes.length > 1 ? partes[partes.length - 1].charAt(0) : "";
  return (primeira + ultima).toUpperCase();
}

/** Foto de perfil redonda, ou as iniciais do nome quando não tem foto
 * (pedido do usuário, 2026-09-21: "colocar para o usuário inserir uma
 * foto"). */
export function Avatar({
  nome,
  foto,
  tamanho = 36,
}: {
  nome: string;
  foto?: string | null;
  tamanho?: number;
}) {
  return (
    <span
      className="avatar"
      style={{ width: tamanho, height: tamanho, fontSize: Math.round(tamanho * 0.4) }}
    >
      {foto ? <img src={urlArquivo(foto)} alt={nome} /> : iniciais(nome)}
    </span>
  );
}
