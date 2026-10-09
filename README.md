# Fonts Checker

A local image-drop prototype using OpenAI’s Decisions API (`POST /v1/decisions`, `gpt-6-luna`). No dependencies; Node 22+.

## Run

Copy `.env.example` to `.env`, set `OPENAI_API_KEY`, then run `npm start`. Open http://localhost:3000. The key stays on the server; never paste it into the browser or commit it.

- **Find a match:** classify predominant readable text against an editable shortlist of common Google Fonts, with an unknown option. This is not a search of the entire Google Fonts catalog. Custom entries are not validated for catalog membership.
- **Check a font:** estimate whether any readable text uses a named family.
- JPEG/PNG/WebP up to 20 MB. Resize locally to 768, 1024 (default), or 1600 px on the longest edge, encode as JPEG, and send only when Analyze is clicked. JPEG byte reduction does not itself guarantee proportional token savings; dimensions and image processing matter.
- Returns probabilities, elapsed time, actual API input tokens, and raw response. Images are not stored by this application. OpenAI data handling applies to uploaded images.

A raster image cannot establish font provenance or licensing. Lookalikes, small text, weight differences, and mixed typography limit accuracy. Thresholds of 80% / 20% are provisional UI heuristics, not calibrated accuracy. Evaluate labeled examples before relying on results. Decisions supports fixed choices and predicates, not arbitrary font-name generation; open-ended identification would require a separate Responses API step.

Docs: https://developers.openai.com/api/docs/guides/decisions

## Check

`npm test` exercises request validation and the API payload. A real API call requires a configured key and account access to Decisions. Server binds to localhost and is intended for a local prototype, not a public deployment.
