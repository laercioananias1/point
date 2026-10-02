import { useState, type FormEvent } from "react";
import { Link, useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { TelaEntrada } from "../components/TelaEntrada";

/** Login no visual do site novo (pedido do usuário, 2026-10-02: "da para
 * estilizar melhor esse login?") — painel marinho com a marca e o slogan,
 * formulário ao lado; no celular, um embaixo do outro. */
export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [mostrarSenha, setMostrarSenha] = useState(false);
  // Desmarcado por padrão (pedido do usuário, 2026-10-02: fechou o
  // navegador, desloga — por segurança).
  const [lembrar, setLembrar] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await login(email, senha, lembrar);
      navigate("/");
    } catch {
      setErro("E-mail ou senha incorretos.");
    }
  }

  return (
    <TelaEntrada>
      <form className="login-form" onSubmit={handleSubmit}>
        <div>
          <h1>Entrar</h1>
          <p className="login-sub">Use o e-mail do seu cadastro.</p>
        </div>

        <label className="login-campo">
          E-mail
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="voce@email.com"
            autoComplete="email"
            required
          />
        </label>

        <label className="login-campo">
          <span className="login-campo-topo">
            Senha
            <Link to="/esqueci-senha">Esqueci minha senha</Link>
          </span>
          <span className="login-senha">
            <input
              type={mostrarSenha ? "text" : "password"}
              value={senha}
              onChange={(e) => setSenha(e.target.value)}
              autoComplete="current-password"
              required
            />
            <button
              type="button"
              className="login-mostrar"
              onClick={() => setMostrarSenha((v) => !v)}
              aria-label={mostrarSenha ? "Ocultar senha" : "Mostrar senha"}
            >
              {mostrarSenha ? "ocultar" : "mostrar"}
            </button>
          </span>
        </label>

        <label className="login-lembrar">
          <input type="checkbox" checked={lembrar} onChange={(e) => setLembrar(e.target.checked)} />
          <span>
            Manter conectado neste aparelho
            <small>Só marque no seu próprio celular ou computador.</small>
          </span>
        </label>

        {erro && <p className="auth-error">{erro}</p>}

        <button type="submit" className="login-entrar" disabled={loading}>
          {loading ? "Entrando..." : "Entrar"}
        </button>

        <p className="login-rodape">Aluno ou professor novo? Entre pelo convite que a sua arena enviou.</p>
      </form>
    </TelaEntrada>
  );
}
