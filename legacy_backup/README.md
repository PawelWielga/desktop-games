# Legacy backup archive

This folder contains a historical static HTML/CSS/JavaScript version of the project. The active React/Vite application lives in `src`, with current public assets under `public` and active configuration files in the repository root.

Use this folder only as reference material when comparing old game implementations. Do not add new active app code here.

The duplicated nested `legacy_backup/legacy_backup` copy was removed so repository searches return one historical copy instead of duplicate legacy files.

## Original legacy README

# chatgpt_codex_tests

This repository was created to test the ChatGPT Codex tool and contains a small number of example demos: <https://pawelwielga.github.io/chatgpt_codex_tests/index.html>

## Project overview

The site consists of several lightweight browser games written in plain HTML, CSS and vanilla JavaScript. Each game lives in its own folder inside the `games/` directory and includes a dedicated `*.html`, `*.js` and `*.css` file. All pages share styles from `css/common.css` and a simple footer injected by `js/footer.js`. Player preferences such as name, colour and emoji are stored in `localStorage` via `js/player-settings.js` and can be changed on the `settings.html` page.

A helper module provides optional online play:

* `js/codeconnect.js` – uses [PeerJS](https://peerjs.com/) to establish a data channel between players identified by short 5‑character codes.

Bootstrap and Bootstrap Icons (loaded from a CDN) supply the basic layout and icons across all pages. The only additional framework is [three.js](https://threejs.org/) which powers the rotating 3D cube demo.

* **Kółko i Krzyżyk (Tic‑Tac‑Toe)** – classic 3×3 board where you play as ✖ against a simple computer opponent.
* **Memo** – flip cards to find matching emoji pairs while the game counts your moves.
* **Kostka 3D** – interactive rotating cube built with three.js. Drag to rotate and view all sides.
* **Gra w życie** – simulation of simple organisms. Configure a creature with attack, defense and speed stats and try to survive by eating, hunting and reproducing in a tiny ecosystem.
* **Wąż** – traditional Snake. Collect food to grow longer without hitting walls or yourself.
* **Kamień, Papier, Nożyce** – simple duel against the computer. Choose your symbol and see who wins.
* **Saper** – classic Minesweeper. Uncover all safe fields without detonating a mine.
* **Catculator** – basic calculator with pink and purple theme. The digit buttons are styled as cute cat heads using pure CSS so wide buttons keep their round shape. They follow a cleaner layout with AC and = spanning two columns and digits ordered 1–9.
* **Tetris** – classic falling-block puzzle with on‑screen arrow controls.
* **Connect 4** – drop discs to line up four in a row. You can play locally against another person, challenge the computer or set up an online match via PeerJS using short 5-character codes – no local server needed.
* **Pong** – classic paddle and ball game for two players.
* **Gorący Ziemniak** – prosta gra imprezowa dla wielu osób. Jeden z graczy trzyma "ziemniaka" i musi przekazać go dalej nim upłynie czas.
* **Ewolucja** – prezentacja talii z możliwością rozdania kart online między dwoma graczami. Karty gracza leżą pod stołem, a te należące do rywala są widoczne rewersem nad stołem.

Most of the games are meant for local play but **Connect 4**, **Rock Paper Scissors** and **Gorący Ziemniak** also allow remote matches using the connection helpers described above. No external server is required – the games communicate directly between browsers.

The repository is entirely static so it can be hosted on GitHub Pages or any basic web server without a build step. Feel free to browse the source code for each mini-game to see straightforward implementations of classic browser games.

## Angular migration status

As of now the project remains a static HTML/JS collection and has not been converted to Angular. Below is a list of tasks required to migrate properly.

### Tasks to convert to Angular
- Initialize an Angular workspace using the Angular CLI and set up a root module.
- Create a component for each game currently under `games/` and move their HTML, CSS and JS logic into Angular components and services.
- Set up routing so that each game is accessible via its own path.
- Migrate shared utilities such as `player-settings.js` and `codeconnect.js` into Angular services.
- Update build configuration to include assets in `css/` and `js` folders.
- Replace CDN loaded dependencies with package-based installations where possible.
