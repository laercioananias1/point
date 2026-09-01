import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../api/client";
import { Icon, Layout } from "../components/Layout";

/** Trocar a própria senha (pedido do usuário, 2026-08-31: "pode
 * construir" — até aqui só dava pra trocar direto no banco, ver
 * DEPLOY.md). Tela única, compartilhada pelas 4 áreas (aluno, professor,
 * admin do Point, dono do app) — cada Perfil.tsx tem um botão que leva
 * pra cá; o "X" fecha voltando pra tela anterior (navigate(-1)) em vez de
 * um destino fixo, porque de qual área veio muda. */
export default function TrocarSenha() {
  const navigate = useNavigate();
  const [senhaAtual, setSenhaAtual] = useState("");
  const [senhaNova, setSenhaNova] = useState("");
  const [confirmar, setConfirmar] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);
  const [sucesso, setSucesso] = useState(false);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    if (senhaNova.length < 6) {
      setErro("A nova senha precisa ter pelo menos 6 caracteres.");
      return;
    }
    if (senhaNova !== confirmar) {
      setErro("As senhas não coincidem.");
      return;
    }
    setEnviando(true);
    try {
      await api.patch("/auth/senha", { senha_atual: senhaAtual, senha_nova: senhaNova });
      setSucesso(true);
      setTimeout(() => navigate(-1), 1200);
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível trocar a senha. Tente de novo.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <div className="screen-header">
        <button type="button" className="close-btn" onClick={() => navigate(-1)} aria-label="Voltar">
          <Icon name="chevron-left" />
        </button>
        <h1>Trocar senha</h1>
      </div>

      <form className="form-card" onSubmit={handleSubmit}>
        <label>
          Senha atual
          <input
            type="password"
            value={senhaAtual}
            onChange={(e) => setSenhaAtual(e.target.value)}
            required
          />
        </label>
        <label>
          Nova senha
          <input
            type="password"
            value={senhaNova}
            onChange={(e) => setSenhaNova(e.target.value)}
            required
          />
        </label>
        <label>
          Confirmar nova senha
          <input
            type="password"
            value={confirmar}
            onChange={(e) => setConfirmar(e.target.value)}
            required
          />
        </label>

        {erro && <p className="form-error">{erro}</p>}
        {sucesso && <p className="form-success">Senha alterada.</p>}

        <button type="submit" disabled={enviando || sucesso}>
          {enviando ? "Salvando..." : "Salvar nova senha"}
        </button>
      </form>
    </Layout>
  );
}
