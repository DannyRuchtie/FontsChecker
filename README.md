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

For **Inter**, requests now include four reference images rendered from Rasmus Andersson’s official [Inter 4.1 files](https://rsms.me/inter/). They cover weights 100–900 in upright and italic at optical sizes 14 and 32. The target image comes first; the prompt explicitly separates it from reference specimens so the presence of Inter in a reference must not count as a target match. Original font files, the SIL Open Font License, source URLs, and SHA-256 hashes are included under `references/inter/`.

This is reference-assisted recognition, not model training. The model receives the specimens on each relevant request; it does not permanently learn from them. Intermediate variable weights, every OpenType alternate, older Inter versions, and every language are not exhaustively represented. Extra reference images also add input tokens.

Other font families still rely on the model’s existing knowledge. The app does not fetch their font files or validate names against Google Fonts. OpenAI does not document which font training examples support an answer, and probabilities are model estimates rather than measured glyph similarity.

### Measuring Inter detection

`eval/` contains 36 synthetic Inter examples (nine weights × two styles × two optical sizes) plus eight negative examples rendered in Arial, Helvetica, Verdana, and Times New Roman. Evaluation text differs from the reference specimens and includes no font names. These are starter test cases, not evidence of production accuracy; add real screenshots, close lookalikes such as Roboto and SF Pro, blur, small text, mixed fonts, alternate glyphs, and misleading labels.

Run a baseline-versus-reference comparison after configuring a key:

```sh
node --env-file-if-exists=.env scripts/evaluate-inter.mjs
```

This makes 88 API requests and reports positive, negative, inconclusive, and refused decisions separately. Results are saved locally under ignored `eval/results/`. The initial run did not establish reliable detection; use an independent held-out set before choosing thresholds or claiming reliability.

To regenerate specimens and fixtures, install Pillow, fonttools, and brotli in a Python environment, then run `python scripts/render-inter.py`. Negative fixture regeneration currently uses macOS system fonts; their font files are not distributed. Reference assets use the included SIL Open Font License.

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

### Initial evaluation (9 October 2026)

At the provisional 80% / 20% thresholds:

| Outcome | Names only | With Inter references |
| --- | ---: | ---: |
| Inter confidently identified (36 cases) | 0 | 0 |
| Inter incorrectly rejected | 10 | 3 |
| Non-Inter correctly rejected (8 cases) | 2 | 2 |
| Non-Inter incorrectly accepted | 0 | 0 |
| Inconclusive (all 44 cases) | 32 | 39 |

References reduced confident false negatives in this small synthetic test, but did not produce confident positive identification. **This prototype is not yet a reliable Inter detector.** Results are from one run, with a limited negative set and shared test phrasing; they do not measure real-world accuracy or establish statistical improvement. Model behavior can vary between runs.
