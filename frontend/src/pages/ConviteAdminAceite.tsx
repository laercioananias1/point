import { useEffect, useState, type FormEvent } from "react";
import { useNavigate, useParams } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { useAuth, type User } from "../auth/AuthContext";
import type { ConviteAdmin } from "../api/types";

/** Tela pública (sem login) que quem foi convidado abre a partir do link
 * do e-mail de convite de admin (pedido do usuário, 2026-08-26: "não
 * quero criar senha de admin, faça o mesmo padrão de aluno e professor").
 * Se ainda não tem conta, cria a senha na hora; se já tem (com qualquer
 * papel), só faz login e confirma — a conta GANHA o papel admin_point sem
 * perder o que já tinha. */
export default function ConviteAdminAceite() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const { loginComToken } = useAuth();
  const [convite, setConvite] = useState<ConviteAdmin | null>(null);
  const [carregando, setCarregando] = useState(true);
  const [erroCarregar, setErroCarregar] = useState<string | null>(null);
  const [aceito, setAceito] = useState(false);

  useEffect(() => {
    if (!token) return;
    api
      .get<ConviteAdmin>(`/convites-admin/${token}`)
      .then(setConvite)
      .catch(() => setErroCarregar("Convite não encontrado — confira o link."))
      .finally(() => setCarregando(false));
  }, [token]);

  return (
    <div className="auth-screen">
      <div>
        <div className="auth-brand">
          <span className="auth-brand-mark" />
          <span className="auth-brand-name">Point</span>
        </div>

        {carregando && <p className="auth-card">Carregando convite...</p>}

        {!carregando && (erroCarregar || !convite) && (
          <p className="auth-card auth-error">{erroCarregar ?? "Convite não encontrado."}</p>
        )}

        {!carregando && convite && (
          <>
            <ResumoConvite convite={convite} />

            {aceito ? (
              <p className="auth-card form-success">Conta ativada! Redirecionando...</p>
            ) : convite.status === "aceito" ? (
              <p className="auth-card form-success">Esse convite já foi aceito.</p>
            ) : convite.status === "cancelado" ? (
              <p className="auth-card auth-error">Esse convite foi cancelado.</p>
            ) : convite.expirado ? (
              <p className="auth-card auth-error">Esse convite expirou — peça um novo.</p>
            ) : convite.admin_ja_cadastrado ? (
              <AceitarComLogin
                token={token!}
                onAceito={() => {
                  setAceito(true);
                  setTimeout(() => navigate("/admin-point"), 1200);
                }}
              />
            ) : (
              <AceitarNovo
                token={token!}
                onAceito={(accessToken, user) => {
                  loginComToken(accessToken, user);
                  setAceito(true);
                  setTimeout(() => navigate("/admin-point"), 1200);
                }}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

function ResumoConvite({ convite }: { convite: ConviteAdmin }) {
  return (
    <div className="auth-card">
      <h1>Convite — administrar {convite.point.nome}</h1>
      <p className="auth-subtitle">Olá, {convite.nome}!</p>
    </div>
  );
}

function AceitarNovo({
  token,
  onAceito,
}: {
  token: string;
  onAceito: (accessToken: string, user: User) => void;
}) {
  const [senha, setSenha] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    if (senha.length < 6) {
      setErro("A senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senha !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setErro(null);
    setEnviando(true);
    try {
      const res = await api.post<{ access_token: string; user: User }>(
        `/convites-admin/${token}/aceitar-novo`,
        { senha },
      );
      onAceito(res.access_token, res.user);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível aceitar. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h2>Criar sua senha</h2>
      <p className="auth-subtitle">Primeira vez por aqui? Escolha uma senha pra acessar sua conta.</p>

      <label htmlFor="senha">Senha</label>
      <input
        id="senha"
        type="password"
        value={senha}
        onChange={(e) => setSenha(e.target.value)}
        minLength={6}
        required
      />

      <label htmlFor="confirmar">Confirmar senha</label>
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
        {enviando ? "Ativando..." : "Aceitar e criar conta"}
      </button>
    </form>
  );
}

function AceitarComLogin({ token, onAceito }: { token: string; onAceito: () => void }) {
  const { login } = useAuth();
  const [email, setEmail] = useState("");
  const [senha, setSenha] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      await login(email, senha);
      await api.post(`/convites-admin/${token}/aceitar`);
      onAceito();
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível entrar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <form className="auth-card" onSubmit={handleSubmit}>
      <h2>Entrar pra aceitar</h2>
      <p className="auth-subtitle">
        Você já tem conta — entre com seu e-mail pra confirmar (mesmo que seja como aluno ou
        professor: sua conta ganha o acesso de admin, sem perder o que já tinha).
      </p>

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

      <button type="submit" disabled={enviando}>
        {enviando ? "Entrando..." : "Entrar e aceitar"}
      </button>
    </form>
  );
}
