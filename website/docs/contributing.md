---
id: contributing
title: Contributing
sidebar_position: 99
---

# Contributing

## Add a plugin

The repo has four branch tiers — `dev → qa → uat → main` — and all work lands on `dev`.

1. Read the [authoring guide](/authoring/overview).
2. Clone the repo and `git checkout dev && git pull`.
3. Scaffold under `plugins/<your-plugin>/`.
4. Add an entry to `.claude-plugin/marketplace.json` (optionally with store [`branding` and `listing`](/authoring/validate-and-ship#store-branding-and-listing-optional)).
5. Run the validator locally — it must pass:
   ```bash
   npx tsx scripts/validate.ts
   ```
6. Push to `dev` (or open a PR into `dev`). CI runs the same validator.
7. In the mySMB.com Admin Center → **AI Studio → Extensions**, **Pull** then **Publish** the extension to QA; promote it to UAT and production from there. AI Studio sets the version — don't bump it yourself.

Full rules, including versioning: [`CONTRIBUTING.md`](https://github.com/mySMB-AI-Studio/mysmb-marketplace/blob/dev/CONTRIBUTING.md#branch-tiers).

## Improve these docs

The docs site lives in [`website/`](https://github.com/mySMB-AI-Studio/mysmb-marketplace/tree/main/website). To run it locally:

```bash
cd website
npm install
npm run start
```

`http://localhost:3000` opens with hot reload.

To check the production build before pushing:

```bash
npm run build
npm run serve
```

A push to `main` that touches `website/`, `.claude-plugin/marketplace.json`, or `CREATING_PLUGINS.md` triggers the [`deploy-docs`](https://github.com/mySMB-AI-Studio/mysmb-marketplace/actions) workflow, which rebuilds and publishes to GitHub Pages.

## Issues and discussions

- **Bug in a plugin** — open an [issue](https://github.com/mySMB-AI-Studio/mysmb-marketplace/issues/new) tagged with the plugin slug.
- **Want a new connector** — open an issue with the tag `connector-request` and a one-paragraph use case.
- **Question about the format** — open a [discussion](https://github.com/mySMB-AI-Studio/mysmb-marketplace/discussions).

## License

MIT — see [LICENSE](https://github.com/mySMB-AI-Studio/mysmb-marketplace/blob/main/LICENSE).
