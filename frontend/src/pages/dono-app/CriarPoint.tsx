import { useState, type FormEvent } from "react";
import { useNavigate } from "react-router-dom";
import { api, ApiError } from "../../api/client";
import { Icon, Layout } from "../../components/Layout";
import { formatarCelular } from "../../lib/formato";

/** Tela própria pra criar Point (pedido do usuário, 2026-08-31: "pode
 * juntar tudo, e tambem ja aproveita faca no padrao de convidar aluno,
 * abre um pop da criacao do point") — antes eram dois passos separados
 * (criar o Point com só nome/endereço, depois um convite de admin à parte
 * por Point na lista); juntou num formulário só, mesmo padrão visual de
 * ConvidarAluno.tsx (tela cheia, não mais embutido no meio da lista de
 * Points). Dois POSTs em sequência (POST /points, depois POST
 * /convites-admin com o point_id que voltou do primeiro) — o backend
 * continua com os dois endpoints de sempre, não precisou juntar nada lá. */
export default function DonoAppCriarPoint() {
  const navigate = useNavigate();
  const [nome, setNome] = useState("");
  const [endereco, setEndereco] = useState("");
  const [adminNome, setAdminNome] = useState("");
  const [adminCelular, setAdminCelular] = useState("");
  const [adminEmail, setAdminEmail] = useState("");
  const [enviando, setEnviando] = useState(false);
  const [erro, setErro] = useState<string | null>(null);

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErro(null);
    setEnviando(true);
    try {
      const point = await api.post<{ id: number }>("/points", { nome, endereco });
      await api.post("/convites-admin", {
        point_id: point.id,
        nome: adminNome,
        celular: adminCelular,
        email: adminEmail,
      });
      navigate("/dono-app/points", { state: { criado: nome } });
    } catch (e) {
      setErro(e instanceof ApiError ? e.message : "Não foi possível criar. Confira os dados.");
    } finally {
      setEnviando(false);
    }
  }

  return (
    <Layout>
      <div className="screen-header">
        <button
          type="button"
          className="close-btn"
          onClick={() => navigate("/dono-app/points")}
          aria-label="Voltar"
        >
          <Icon name="chevron-left" />
        </button>
        <h1>Criar Point</h1>
      </div>
      <p className="empty-state" style={{ paddingTop: 0 }}>
        Só o essencial pra nascer — prazos, dias/horários de funcionamento e formas de pagamento o
        admin do Point ajusta depois (Configurações). O admin não cria senha por convite seu: manda o
        convite por e-mail, e a pessoa escolhe a própria senha ao aceitar.
      </p>

      <form className="form-card" onSubmit={handleSubmit} style={{ maxWidth: "none" }}>
        <div className="form-row">
          <label>
            Nome do Point
            <input value={nome} onChange={(e) => setNome(e.target.value)} required />
          </label>
          <label>
            Endereço
            <input value={endereco} onChange={(e) => setEndereco(e.target.value)} required />
          </label>
        </div>

        <div className="form-row">
          <label>
            Nome do admin
            <input value={adminNome} onChange={(e) => setAdminNome(e.target.value)} required />
          </label>
          <label>
            Celular do admin
            <input
              type="tel"
              placeholder="(11) 91234-5678"
              value={adminCelular}
              onChange={(e) => setAdminCelular(formatarCelular(e.target.value))}
              required
            />
          </label>
        </div>
        <label>
          E-mail do admin
          <input
            type="email"
            value={adminEmail}
            onChange={(e) => setAdminEmail(e.target.value)}
            required
          />
        </label>

        {erro && <p className="form-error">{erro}</p>}

        <button type="submit" disabled={enviando}>
          {enviando ? "Criando..." : "Criar Point e convidar admin"}
        </button>
      </form>
    </Layout>
  );
}
