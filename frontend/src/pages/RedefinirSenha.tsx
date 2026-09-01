import { useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth, type User } from "../auth/AuthContext";
import { LogoMark } from "../components/LogoMark";

/** Tela pública (sem login) que abre a partir do link do e-mail de
 * "Esqueci minha senha" (pedido do usuário, 2026-09-01). Não busca nada
 * antes de mostrar o formulário — diferente das telas de convite, não tem
 * nada pra resumir (nome, Point...) antes de decidir; só tenta trocar a
 * senha direto, e o erro do token (expirado/já usado/inexistente) aparece
 * na resposta do POST. */
export default function RedefinirSenha() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { loginComToken } = useAuth();
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senhaNova.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senhaNova !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      const res = await api.post<{ access_token: string; user: User }>("/auth/redefinir-senha", {
        token,
        senha_nova: senhaNova,
      });
      loginComToken(res.access_token, res.user);
      setSucesso(true);
      setTimeout(() => navigate("/"), 1200);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível redefinir a senha. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-brand">
          <LogoMark size={28} />
          <span className="auth-brand-name">OPoint</span>
        </div>

        {sucesso ? (
          <p className="auth-card form-success">Senha alterada! Entrando...</p>
        ) : (
          <form className="auth-card" onSubmit={handleSubmit}>
            <h1>Redefinir senha</h1>
            <p className="auth-subtitle">Escolha uma senha nova pra sua conta.</p>

            <label htmlFor="senha-nova">Nova senha</label>
            <input
              id="senha-nova"
              type="password"
              value={senhaNova}
              onChange={(e) => setSenhaNova(e.target.value)}
              minLength={6}
              required
            />

            <label htmlFor="confirmar">Confirmar nova senha</label>
            <input
              id="confirmar"
              type="password"
              value={confirmar}
              onChange={(e) => setConfirmar(e.target.value)}
              minLength={6}
              required
            />

            {erro && <p className="auth-error">{erro}</p>}

            <button type="submit" disabled={enviando}>
              {enviando ? "Salvando..." : "Redefinir senha"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
