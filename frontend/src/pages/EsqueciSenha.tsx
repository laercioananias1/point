import { useState, type FormEvent } from "react";
import { Link } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { LogoMark } from "../components/LogoMark";

/** Pedir o link de redefinição de senha por e-mail (pedido do usuário,
 * 2026-09-01: "a troca de senha precisa ser por email" — substitui a tela
 * de trocar senha logado, que exigia saber a senha atual e saiu do
 * Perfil). Sempre mostra a mesma mensagem de sucesso, exista ou não o
 * e-mail — o backend responde 204 nos dois casos, pra não dar pra
 * descobrir por aqui quais e-mails têm conta na plataforma. */
export default function EsqueciSenha() {
  const [email, setEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [enviado, setEnviado] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      // E-mail que não existe no cadastro também responde 204 (ver
      // backend) — só network/servidor caindo passa pelo catch, nunca
      // "esse e-mail não existe" (evita dar pra descobrir por aqui quais
      // e-mails têm conta).
      await api.post("/auth/esqueci-senha", { email });
      setEnviado(true);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível enviar. Tente de novo.");
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

        {enviado ? (
          <div className="auth-card form-success">
            <p>
              Se <strong>{email}</strong> tiver uma conta, mandamos um e-mail com o link pra
              redefinir a senha. O link vale por 1 hora.
            </p>
          </div>
        ) : (
          <form className="auth-card" onSubmit={handleSubmit}>
            <h1>Esqueci minha senha</h1>
            <p className="auth-subtitle">
              Digite o e-mail do seu cadastro — mandamos um link pra você escolher uma senha nova.
            </p>

            <label htmlFor="email">E-mail</label>
            <input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />

            {erro && <p className="auth-error">{erro}</p>}

            <button type="submit" disabled={enviando}>
              {enviando ? "Enviando..." : "Enviar link"}
            </button>
          </form>
        )}

        <p className="auth-subtitle" style={{ textAlign: "center", marginTop: 16 }}>
          <Link to="/login">Voltar pro login</Link>
        </p>
      </div>
    </div>
  );
}
