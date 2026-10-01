## Design
Siga sempre o guia em design/DESIGN.md. As telas de referência estão em design/telas/.
Ao criar ou alterar telas, reaproveite os componentes existentes e só mude o visual, sem quebrar a lógica.

## Verificação do frontend
Typecheck: `cd frontend && npx tsc -p tsconfig.app.json --noEmit` — o `tsc --noEmit` puro não verifica nada neste projeto.
