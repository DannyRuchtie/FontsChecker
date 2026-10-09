# Fonts Checker

Drop an image to find a likely font match or check a font you have in mind. A small prototype powered by OpenAI’s Decisions API.

![Fonts Checker checking a type specimen against Roboto](docs/fonts-checker.png)

## What it does

- **Find a match:** compare text against an editable shortlist of Google Fonts, with an “unknown” option.
- **Check a font:** estimate whether readable text uses a specific font family.
- Resize images locally before upload, then show probabilities, response time, and token usage.

Font matches are visual estimates. Similar fonts can be hard to distinguish, and an image cannot establish font origin or licensing. Shortlist mode does not search the entire Google Fonts catalog.

## How it works

1. The browser decodes your image, scales it to the selected maximum edge length (1,024 px by default), and encodes it as JPEG. This reduces dimensions before the API request; it does not extract text or identify fonts locally.
2. When you click **Analyze image**, the local server sends the resized image as an inline base64 data URL, plus a question, to OpenAI’s Decisions API.
3. In **Find a match**, the question supplies your font names as fixed choices, plus “unknown.” In **Check a font**, it asks whether readable text uses the named family and receives an estimated probability.
4. The interface displays that result, request time, and token usage. Specific-font checks use provisional thresholds: 80% or more is “likely,” 20% or less is “unlikely,” and the middle is “inconclusive.” These thresholds have not been calibrated against a labeled dataset.

### Where does the font comparison come from?

This prototype does not download Google Fonts, load font files, render reference specimens, or search a font database. The shortlist is a set of names in the interface; custom names are not checked against the Google Fonts catalog. The API receives names and instructions, not reference glyph images.

The working assumption is that the model can associate font names with visual patterns learned during training. We ask it to judge distinctive letterforms and allow different weights, while ignoring font names printed inside the uploaded image. That instruction does not guarantee it will ignore a label or distinguish close lookalikes.

OpenAI’s [Decisions documentation](https://developers.openai.com/api/docs/guides/decisions) describes image input and classification outputs, but does not specify a font reference dataset, a font recognition algorithm, or verified recognition accuracy. We cannot identify which training examples support a particular answer. The returned percentage is the model’s estimate, not a measured glyph similarity score or proof of identity.

For a comparison with an explicit source, a future version could obtain actual font files, render the same text in candidate fonts, and supply those specimens alongside the uploaded image. That would give the model concrete references, though accuracy would still need testing.

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
