# Fonts Checker

Drop an image to find a likely font match or check a font you have in mind. A small prototype powered by OpenAI’s Decisions API.

![Fonts Checker checking a type specimen against Roboto](docs/fonts-checker.png)

## What it does

- **Find a match:** compare text against an editable shortlist of Google Fonts, with an “unknown” option.
- **Check a font:** estimate whether readable text uses a specific font family.
- Resize images locally before upload, then show probabilities, response time, and token usage.

Font matches are visual estimates. Similar fonts can be hard to distinguish, and an image cannot establish font origin or licensing. Shortlist mode does not search the entire Google Fonts catalog.

## Run locally

Requires Node.js 22+ and an OpenAI API key with access to the Decisions API.

```sh
cp .env.example .env
```

Add your key as `OPENAI_API_KEY` in `.env`, then start:

```sh
npm start
```

Open [localhost:3000](http://localhost:3000). The key stays on the server, and `.env` is excluded from Git. Images are sent to OpenAI only when you click **Analyze image**; the app does not save uploaded images.

## Development

No dependencies. Run `npm test` to check request validation and API payloads.

Uses `POST /v1/decisions` with `gpt-6-luna`. See the [Decisions API documentation](https://developers.openai.com/api/docs/guides/decisions).
