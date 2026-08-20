import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../auth/AuthContext";

export default function Login() {
  const { login, loading } = useAuth();
  const navigate = useNavigate();
  const [identificador, setIdentificador] = useState("");
  const [senha, setSenha] = useState("");
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    try {
      await login(identificador, senha);
      navigate("/");
    } catch {
      setErro("Celular/e-mail ou senha incorretos.");
    }
  }

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-brand">
          <span className="auth-brand-mark" />
          <span className="auth-brand-name">Point</span>
        </div>

        <form className="auth-card" onSubmit={handleSubmit}>
          <h1>Entrar</h1>
          <p className="auth-subtitle">Use o celular ou e-mail do seu cadastro</p>

          <label htmlFor="identificador">Celular ou e-mail</label>
          <input
            id="identificador"
            value={identificador}
            onChange={(e) => setIdentificador(e.target.value)}
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
