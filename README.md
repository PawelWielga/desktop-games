# Desktop Games

React + Vite + TypeScript desktop-style collection of small browser games.

## Play online

https://pawelwielga.github.io/desktop-games/

## Development

Install dependencies:

```sh
npm install
```

Start the local dev server:

```sh
npm run dev
```

Build the app:

```sh
npm run build
```

Preview the production build:

```sh
npm run preview
```

## Project docs

- [Adding a new game](docs/adding-a-game.md)

## Verification

Run TypeScript checks:

```sh
npm run typecheck
```

Run the current lint baseline:

```sh
npm run lint
```

`lint` runs ESLint for JavaScript, TypeScript, TSX and config files. The ESLint setup uses the TypeScript parser for TS/TSX sources and also runs `npm run typecheck`, so linting catches both style/rule issues and TypeScript compilation problems.

Run automated tests:

```sh
npm test
```

The project uses Vitest (`vitest run`) for automated tests. Current coverage includes game logic tests for Snake and Minesweeper, and new reusable game logic should be covered with matching `*.test.ts` files.

Run all merge checks:

```sh
npm run verify
```

`verify` runs TypeScript checks, linting, Vitest tests and a production build. This is the same command used by CI before merging.

## Pull request checks

GitHub Actions runs the `CI / build-and-test` check for pull requests targeting `main`. The workflow installs dependencies with `npm ci` and then runs `npm run verify`.

To block merging broken pull requests, configure branch protection or a repository ruleset for `main` and require the `build-and-test` status check to pass before merging.

### Protecting `main`

Use repository rulesets if they are available in the repository settings:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Rules` -> `Rulesets`.
3. Choose `New ruleset` -> `New branch ruleset`.
4. Set a clear name, for example `Protect main`.
5. Set `Enforcement status` to `Active`.
6. In `Target branches`, add `main`.
7. Enable `Require a pull request before merging`.
8. Enable `Require status checks to pass`.
9. Add the required check named `build-and-test`.
10. Save the ruleset.

If the repository uses the older branch protection screen instead:

1. Open the repository on GitHub.
2. Go to `Settings` -> `Branches`.
3. Under `Branch protection rules`, choose `Add branch protection rule`.
4. Set `Branch name pattern` to `main`.
5. Enable `Require a pull request before merging`.
6. Enable `Require status checks to pass before merging`.
7. Search for and select the required check named `build-and-test`.
8. Save the protection rule.

After this, GitHub will block merging pull requests into `main` until the CI check passes.
