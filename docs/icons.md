# Icons and visual assets

This project is public and non-commercial, so icons should be easy to verify and safe to keep in the repository.

## Current icon setup

Every app registered in `src/window/registry.ts` should have:

- `icon` - a small emoji/text fallback,
- `iconAsset` - the real SVG used on the desktop.

The current game and system icons are original SVG assets created directly for this project. The YouTube icon is a brand icon used only to represent the YouTube app shortcut.

## App and brand icons

For real external apps or services, prefer official brand resources first. If an official download is inconvenient, Simple Icons can be used for popular brand SVGs, but always check the brand owner's usage guidelines too.

Recommended approach:

1. Add the SVG under `src/assets/brand-icons/`.
2. Add a short note in `src/assets/brand-icons/README.md` with the source.
3. Register the icon in `src/window/registry.ts` with `iconAsset`.
4. Keep the old `icon` emoji/text value as a fallback.

Example:

```ts
import youtubeIcon from "@/assets/brand-icons/youtube.svg";

{
  id: "youtube",
  title: "YouTube",
  icon: "▶️",
  iconAsset: youtubeIcon,
  kind: "app",
  implemented: true,
}
```

## Game icons

For our own games, avoid brand-like logos and random images from search results. Prefer assets with clear permissive licenses.

Good sources:

- Original SVG icons created directly in this repo.
- Kenney assets - many game icon packs are CC0/public domain and work well for hobby games.
- Small custom pixel-art or vector icons made for this project.

If a source requires attribution, add it next to the asset and mention it in this document or in the relevant asset folder README.

## What to avoid

- Emoji as the final icon for polished apps.
- Random PNG/SVG files from image search without license information.
- Copying icons from installed desktop apps unless the license explicitly allows it.
- Modified brand icons that may look like unofficial copies.
