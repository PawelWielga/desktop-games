# Adding a new game

This app uses a Windows-like desktop shell. Games are launched from desktop icons and opened in managed windows. To add a game, keep the game code isolated in `src/games/<game-id>/` and register it once in `src/window/registry.ts`.

## Naming conventions

Use one stable game id everywhere:

- folder: `src/games/<game-id>/`
- component file: `PascalCaseGame.tsx`, for example `SnakeGame.tsx`
- stylesheet: `<game-id>.css`, for example `snake.css`
- optional logic module: `<game-id>.logic.ts`
- optional test file: `<game-id>.logic.test.ts`
- registry id: the same kebab-case or lowercase id used in the folder

Prefer short ids without spaces. Existing examples are `snake`, `minesweeper`, and `tictactoe`.

## Folder structure

A typical game folder should look like this:

```text
src/games/my-game/
  MyGame.tsx
  my-game.css
  my-game.logic.ts          # optional, recommended for pure game rules
  my-game.logic.test.ts     # optional, recommended when logic is extracted
```

Keep React rendering and browser APIs in the component. Put deterministic rules, board generation, scoring, win checks, and other pure logic in `*.logic.ts` so they can be tested without mounting React.

## Game component

Export the game as the default React component:

```tsx
import React from "react";
import "./my-game.css";

export default function MyGame(): React.ReactElement {
  return <div className="my-game-root">My game</div>;
}
```

The window manager lazy-loads this default export from the registry. Do not manually import the component into `Desktop.tsx`.

## Registering the game

Add one entry to `AppRegistry` in `src/window/registry.ts`.

For an implemented game:

```ts
{
  id: "my-game",
  title: "My Game",
  icon: "🎮",
  kind: "game",
  implemented: true,
  window: {
    width: 800,
    height: 640,
    minWidth: 520,
    minHeight: 480,
    x: 120,
    y: 80,
    loader: () => import("@/games/my-game/MyGame"),
  },
}
```

For a planned game that should not appear on the desktop yet:

```ts
{
  id: "my-game",
  title: "My Game",
  icon: "🎮",
  kind: "game",
  implemented: false,
}
```

`Desktop.tsx` reads desktop icons from `getDesktopApps()`. `WindowRegistry` is derived from `AppRegistry`, so a game should be added in one place only.

## Registry fields

Required fields:

- `id`: stable game id used by the launcher and window manager.
- `title`: visible desktop/taskbar/window title.
- `icon`: emoji shown on the desktop icon.
- `kind`: use `"game"` for games. `"system"` is reserved for shell/system apps such as settings.
- `implemented`: `true` only when the game has a working component and loader.

Window fields for implemented games:

- `width` and `height`: default window size.
- `minWidth` and `minHeight`: smallest usable size.
- `maxWidth` and `maxHeight`: optional constraints.
- `x` and `y`: optional initial position.
- `loader`: lazy import of the default component.

## Styles

Import the game stylesheet from the component, not from a global entry point:

```tsx
import "./my-game.css";
```

Scope CSS classes with a game-specific prefix, for example `.my-game-root`, `.my-game-board`, and `.my-game-cell`. This avoids collisions with other games and shell styles.

## Assets

For assets that are imported by code, keep them close to the game when possible:

```text
src/games/my-game/assets/
```

For static files that must be loaded by URL, use `public/` and build paths from Vite's base URL:

```ts
const base: string = import.meta.env.BASE_URL ?? "/";
const assetUrl = `${base}my-game/sprite.png`;
```

This matters for GitHub Pages, where the app may be served from a subpath instead of `/`.

Avoid hardcoded absolute paths such as `/sprite.png` unless the file is intentionally hosted from the domain root.

## Tests

When the game has rules that can be tested without the DOM, extract them to `*.logic.ts` and add tests next to the game:

```text
src/games/my-game/my-game.logic.ts
src/games/my-game/my-game.logic.test.ts
```

Recommended baseline test cases:

- initial board/state creation,
- one normal move/action,
- scoring or progress updates,
- win and lose conditions,
- reset behavior,
- edge cases such as collisions, invalid moves, or full boards.

Run tests with:

```sh
npm test
```

## Manual checks

Before opening a pull request, check the game in the browser:

1. Start the app with `npm run dev`.
2. Confirm the desktop icon appears only when `implemented: true`.
3. Open the game from the desktop.
4. Confirm the window title, default size, minimum size, and taskbar entry are correct.
5. Play through a basic win/lose/reset flow.
6. Resize and move the window if the game layout depends on size.
7. Check that assets load correctly when the app is served from a non-root base path.

## Verification checklist

Run the same commands used by CI:

```sh
npm run typecheck
npm run lint
npm test
npm run build
npm run verify
```

`npm run verify` should be the final local check before the PR.

## Pull request checklist

A complete game PR should include:

- game component under `src/games/<game-id>/`,
- scoped stylesheet,
- `AppRegistry` entry,
- logic module and tests where practical,
- assets referenced safely for GitHub Pages/base path,
- passing verification commands,
- short PR description with manual test notes.
