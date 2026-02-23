# BIT PO Chat Demo

App web estilo WhatsApp para presentar el plan de trabajo de Martín Urtasun para el rol de Product Owner de la Célula BIT.

## Requisitos

- Node.js 18+
- `OPENAI_API_KEY`

## Uso local

```bash
npm run check
OPENAI_API_KEY=tu_api_key npm start
```

Abrir `http://localhost:3000`.

## Variables de entorno

- `OPENAI_API_KEY` (obligatoria para chat)
- `OPENAI_MODEL` (default: `gpt-4o-mini`)
- `ADMIN_TOKEN` para proteger el guardado del plan
- `PLAN_KV_KEY` (opcional, default: `bit_plan_text`)
- `INTERACTIONS_KV_KEY` (opcional, default: `bit_interactions_log`)

## Dónde se guarda el plan

- **Local**: en `data/plan.txt`.
- **Vercel (recomendado)**: en **Vercel KV** si configurás:
  - `KV_REST_API_URL`
  - `KV_REST_API_TOKEN`

> Si no configurás KV en Vercel, escribir en archivo no será persistente entre invocaciones serverless.

## Conectar y desplegar en tu cuenta de Vercel

1. Instalar y loguearte:
   ```bash
   npm i -g vercel
   vercel login
   ```
2. Vincular este repo/proyecto:
   ```bash
   vercel link
   ```
3. Cargar variables:
   ```bash
   vercel env add OPENAI_API_KEY
   vercel env add ADMIN_TOKEN
   vercel env add OPENAI_MODEL
   vercel env add KV_REST_API_URL
   vercel env add KV_REST_API_TOKEN
   vercel env add PLAN_KV_KEY
   ```
4. Deploy:
   ```bash
   vercel --prod
   ```

## Actualización del plan

- Por API: `POST /api/plan` enviando `{ "plan": "..." }`.
- Si configurás `ADMIN_TOKEN`, enviá header `x-admin-token`.

## Registro de consultas

La app puede guardar un registro de interacciones (nombre + pregunta + fecha).

- Vista: `http://localhost:3000/registros.html`
- API: `GET /api/interactions`
- Si definís `ADMIN_TOKEN`, para consultar la tabla tenés que cargar ese token en la pantalla de registros.
- En Vercel, para persistir registros configurá KV (`KV_REST_API_URL`, `KV_REST_API_TOKEN`). Sin KV, el logging no rompe el chat aunque no persista.

