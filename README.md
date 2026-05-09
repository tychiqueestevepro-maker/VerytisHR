# Verytis HR

Frontend de la plateforme Verytis HR, cloné depuis Verytis AGNT.

## Getting Started

```bash
npm install
npm run dev
```

## Base de donnees

Le schema Supabase VerytisHR part d'une base vide et vit dans
`supabase/migrations/001_verytis_hr_schema.sql`.

Les anciennes migrations Verytis AGNT ont ete archivees dans
`supabase/migrations_legacy_agnt/` pour ne pas creer de tables CRM/prospection
sur une nouvelle base HR.

Les liens publics candidats passent par le backend Next, pas par des policies
anon Supabase directes:
- `GET /api/hr/pipeline-sessions/{public_token}`
- `POST /api/hr/pipeline-sessions/{public_token}/responses`
- `POST /api/hr/pipeline-sessions/{public_token}/analyze`

Dans le schema HR, `candidates` est le profil global. La source de verite pour
le rattachement a un poste est `candidate_missions`, et la source de verite
pour un lien candidat est `pipeline_sessions.public_token`.

Une soumission publique candidat ne doit envoyer que le token de session et les
reponses. Les champs internes `company_id`, `candidate_id`, `mission_id` et
`pipeline_id` sont toujours resolus cote backend depuis `pipeline_sessions`.

## Backend Minimal V1

### Qualification Layer

- Missions: `POST/GET /api/hr/missions`, `GET /api/hr/missions/{id}`.
- Candidates: `POST/GET /api/hr/missions/{id}/candidates`,
  `GET /api/hr/candidates/{id}`.
- CV: upload dans le bucket `candidate-cvs`, chemin interne
  `{company_id}/{candidate_id}/{filename}`, puis parsing via
  `POST /api/hr/candidates/{id}/parse-cv`.
- LinkedIn extension: `Authorization: Bearer <token>` sur
  `POST /api/hr/candidates/{id}/linkedin-verification`; le backend verifie que
  le candidat appartient bien a la company du token.
- Analyse: `POST /api/hr/candidates/{id}/analyze`, puis resultats mission via
  `GET /api/hr/missions/{id}/results`.

### Contextual Pipeline Layer

- Pipeline mission: `POST/GET /api/hr/missions/{id}/pipeline`.
- Sessions: `POST /api/hr/pipeline-sessions`.
- Session publique: le candidat recoit seulement le token, le pipeline public,
  les etapes et les questions. Il ne recoit jamais `company_id`,
  `candidate_id`, `mission_id` ou `pipeline_id`.
- Reponses et scoring: `POST /api/hr/pipeline-sessions/{token}/responses`,
  `POST /api/hr/pipeline-sessions/{token}/analyze`,
  `GET /api/hr/missions/{id}/pipeline-results`.

Les tables generees par backend/service-role ne sont pas modifiables directement
par le client Supabase authentifie: `linkedin_verifications`,
`candidate_scores`, `candidate_signals`, `candidate_inconsistencies`,
`candidate_pipeline_responses` et `pipeline_scores`.

## Structure
- `src/app/[locale]`: Pages avec support i18n
- `src/components`: Composants UI et Layout
- `messages/`: Traductions (Français par défaut)
