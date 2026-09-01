import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";
import { LogoMark } from "../components/LogoMark";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await login(email, senha);
      navigate("/");
    } catch {
      setErro("E-mail ou senha incorretos.");
    }
  }

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-brand">
          <LogoMark size={28} />
          <span className="auth-brand-name">OPoint</span>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Entrar</h1>
          <p className="auth-subtitle">Use o e-mail do seu cadastro</p>

          <label htmlFor="email">E-mail</label>
          <input
            id="email"
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />

          <label htmlFor="senha">Senha</label>
          <input
            id="senha"
            type="password"
            value={senha}
            onChange={(e) => setSenha(e.target.value)}
            required
          />

          {erro && <p className="auth-error">{erro}</p>}

          <button type="submit" disabled={loading}>
            {loading ? "Entrando..." : "Entrar"}
          </button>
        </form>
      </div>
    </div>
  );
}
