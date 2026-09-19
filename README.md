# HTML as a Format (HaF)

HaF is an internal tool that converts PowerPoints, PDFs, and meeting transcripts into interactive, self-contained HTML pages for consultants. I built it during my internship to replace one-off, hand-formatted decks with something generated on demand.

## Features

- Three renderer formats: Timeline, Gallery, and Bubble Map, each suited to a different kind of source content.
- Shared interactive chrome across generated pages: dark/light mode.
- Skills-based architecture: each renderer lives in its own drop-in `skills/render-<name>/` folder (template plus design rationale), so adding a format doesn't touch the core app.
- VLM image captioning: extracted images are captioned via the Anthropic API and fed back into generation as context.

## Tech Stack

- React 19 + Vite
- Express
- Anthropic API (claude-sonnet-4-6)

## Getting Started

See `docs/DEPLOYMENT.md` for full setup instructions.

## Documentation

- [Project overview](docs/PROJECT.md)
- [Architecture](docs/ARCHITECTURE.md)
- [Deployment](docs/DEPLOYMENT.md)

## License

MIT. See [LICENSE](LICENSE).
