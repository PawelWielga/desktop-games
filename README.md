# Desktop Games

React + Vite + TypeScript desktop-style collection of small browser games.

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

## Verification

Run TypeScript checks:

```sh
npm run typecheck
```

Run the current lint baseline:

```sh
npm run lint
```

`lint` runs ESLint for JavaScript/config files and TypeScript checking for TS/TSX sources. A fuller type-aware ESLint setup can be added separately when the ESLint TypeScript parser is introduced.

Run automated tests:

```sh
npm test
```

The project currently uses Node's built-in test runner. With no test files present, this command exits successfully and reports zero tests instead of failing as a placeholder.

Run all merge checks:

```sh
npm run verify
```

## Pull request checks

GitHub Actions runs the `CI / build-and-test` check for pull requests targeting `main`. The workflow installs dependencies with `npm ci` and then runs `npm run verify`.

To block merging broken pull requests, configure branch protection or a repository ruleset for `main` and require the `build-and-test` status check to pass before merging.
