# Kit de design OPoint para o VS Code

1. Descompacte esta pasta dentro do seu projeto, com o nome `design/` (na raiz, ao lado de `src/`).
2. No `CLAUDE.md` do projeto (crie se não existir), adicione:

```
## Design
Siga sempre o guia em design/DESIGN.md. As telas de referência estão em design/telas/.
Ao criar ou alterar telas, reaproveite os componentes existentes e só mude o visual, sem quebrar a lógica.
```

3. Peça ao Claude no VS Code, uma tela de cada vez. Exemplos:

- "Leia design/DESIGN.md e crie os componentes base (menu lateral, botões, card, selo de status, tabela) seguindo o guia."
- "Refaça a tela de Agenda seguindo design/telas/Agenda.dc.html e o DESIGN.md, mantendo as chamadas de API que já existem."
- "Crie a tela de Controle de check-ins conforme design/telas/Checkins.dc.html. O saldo do aluno é check-ins − aulas do mês."

## Telas

| Arquivo | Tela |
|---|---|
| Main.dc.html | Landing page do site |
| Dashboard.dc.html | Início do painel da arena |
| Agenda.dc.html | Agenda por quadra (administrador) |
| AgendaProfessor.dc.html / AgendaAluno.dc.html | Agenda no celular |
| Checkins.dc.html | Controle de check-ins (administrador) |
| CheckinsProfessor.dc.html / CheckinsAluno.dc.html | Check-ins no celular |
| Quadras, Turmas, Alunos, Professores .dc.html | Cadastros |
| Caixa.dc.html / Cobrancas.dc.html | Financeiro |
| Relatorios.dc.html | Relatórios |
| Convite.dc.html | Convite e login (celular) |
| Logo.dc.html / Produtos.dc.html | Marca e produtos |

Os arquivos `.dc.html` são protótipos: o layout está no HTML e os dados de exemplo e o comportamento estão no `<script>` no fim de cada arquivo. Eles não abrem sozinhos no navegador; servem de referência para o Claude.
