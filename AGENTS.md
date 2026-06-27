# Pinboard Pin — Agent Guide

Pinboard Pin is a **Firefox web extension** (WebExtensions / Manifest **V2**) for
pinning pages on [Pinboard](https://pinboard.in). It is unusual in that the whole
extension is built as a single **Angular** application (Angular CLI with the
`@angular/build` esbuild `application` builder). See [README.md](README.md) for
the user-facing description and [DEVELOP.md](DEVELOP.md) for build details.

## Architecture

One Angular app renders several extension surfaces, selected at runtime via a
`?page=` query parameter on `index.html`:

| Surface    | Entry                         | Component                         |
| ---------- | ----------------------------- | --------------------------------- |
| Popup      | `/index.html` (default)       | [pinpage](src/app/pinpage/)       |
| Options    | `/index.html?page=options`    | [options](src/app/options/)       |
| Background | `/index.html?page=background` | [background](src/app/background/) |
| Login      | (within popup)                | [login](src/app/login/)           |

- Manifest: [src/manifest.json](src/manifest.json) — MV2, `browser_action`,
  background **page** (not a service worker), content script
  [src/js/content.js](src/js/content.js).
- Services: [pinboard.service.ts](src/app/pinboard.service.ts) (Pinboard API),
  [storage.service.ts](src/app/storage.service.ts) (extension storage),
  [icon.service.ts](src/app/icon.service.ts) (toolbar icon state).
- The popup's tag input — completion dropdown plus suggested/popular/keyword
  chips — is a child component of pinpage:
  [tagging.component.ts](src/app/pinpage/tagging.component.ts).
- WebExtensions API is accessed through the `browser.*` namespace (Firefox),
  typed via `@types/firefox-webext-browser`. **Not** the `chrome.*` namespace.
- Build config: [angular.json](angular.json) copies `src/img`, `src/js`, and
  `src/manifest.json` as assets into `dist/browser`.

## Commands

```bash
npm install          # install deps
npm run build        # dev build  -> dist/browser
npm run build:prod   # production build (minified, no source maps)
npm run build:zip    # build:prod + package as .zip (web-ext build)
npm run lint         # eslint over .ts/.html
npm run lint:ext     # build:prod + web-ext lint (validates the packaged extension)
npm run test         # run the built extension in Firefox via web-ext (manual QA)
```

> Note: `npm run test` launches Firefox with the extension via `web-ext run` —
> it is **manual/interactive QA, not an automated unit-test suite**. There is no
> Karma/Jest/Vitest setup in this project. Verify changes by building and
> exercising the extension in Firefox.

## Conventions

- **Angular 22**, standalone components, SCSS for styles. Drive Angular
  ecosystem upgrades with `ng update`, not by hand-editing `package.json`.
- **TypeScript strict mode** is on. Components use `inject()` (not constructor
  DI) and hold state in **signals** (`signal`/`computed`/`model`/`input`). The
  app is **zoneless**, so let signals schedule change detection automatically —
  do **not** call `cdr.detectChanges()` (there is none left in the codebase).
  For DOM work that must run after a signal-driven render (e.g. focusing an
  input), use `afterNextRender`.
- `OnPush` is the **default** in Angular 22 — do **not** set `changeDetection`
  explicitly (the `@angular-eslint/prefer-on-push-component-change-detection`
  rule flags components that opt out). Singleton services use the `@Service()`
  decorator (v22), not `@Injectable({ providedIn: 'root' })`.
- Forms are **template-driven** (`FormsModule` / `ngModel`) bound to signals via
  `[ngModel]="x()"` + `(ngModelChange)="x.set($event)"`. Signal Forms
  (`@angular/forms/signals`) are intentionally not adopted yet — don't migrate
  the forms without being asked.
- The `browser.*` WebExtensions global is typed via `src/typings.d.ts`
  (`/// <reference types="firefox-webext-browser" />`).
- ESLint config in [eslint.config.js](eslint.config.js) (flat config,
  `@angular-eslint`). Run `npm run lint` before finishing changes.
- Keep `version` in [src/manifest.json](src/manifest.json) and
  [package.json](package.json) in sync when releasing.
- Stay compatible with **Manifest V2 / Firefox**. Don't introduce `chrome.*`
  calls or MV3-only APIs unless a cross-browser port is explicitly requested
  (it's listed as a future idea in DEVELOP.md).

## Skills & MCP available to agents

- **`angular-developer` skill** (official `angular/skills`, installed) — use it
  for Angular code generation and architectural guidance: signals, forms,
  dependency injection, routing, testing, CLI tooling. It is version-aware and
  targets Angular v21+. Prefer it for any non-trivial Angular work here.
- **Angular CLI MCP server** (`angular-cli`, configured in
  [.mcp.json](.mcp.json) for Claude Code and [.vscode/mcp.json](.vscode/mcp.json)
  for Copilot) — provides live `get_best_practices`, `search_documentation`, and
  project introspection straight from the installed Angular CLI. Reach for it to
  confirm current, version-correct Angular APIs instead of relying on memory.
  (Requires reloading the session after first configuration.)
- **Firefox / WebExtensions**: no high-quality skill exists for this domain, so
  none is installed. Rely on the [`web-ext`](https://extensionworkshop.com/documentation/develop/web-ext-command-reference/)
  CLI (already a dev dependency) and the
  [MDN WebExtensions docs](https://developer.mozilla.org/docs/Mozilla/Add-ons/WebExtensions)
  for extension-specific work.
