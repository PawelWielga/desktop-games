# Game icons

Use this folder for reusable game icons that are safe to ship with the public repository.

Recommended source: Kenney game/board-game icon packs, because they are published as CC0/public domain assets. Own SVG icons created for this project are also fine.

When adding an icon:

1. Prefer SVG for crisp scaling on the desktop.
2. Use a descriptive filename, for example `snake.svg` or `minesweeper.svg`.
3. Note the source and license in this README if the asset is not fully original.
4. Register it through `iconAsset` in `src/window/registry.ts`.

Keep the text `icon` fallback in the registry even when an SVG asset exists.
