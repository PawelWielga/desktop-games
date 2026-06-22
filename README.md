# Desktop Games

Desktop Games to przeglądarkowa kolekcja małych gier uruchamianych z ekranu przypominającego pulpit komputera. Projekt działa jak lekka, zabawna parodia klasycznego systemu operacyjnego: są ikony, okna, pasek zadań i gry otwierane tak, jakby były osobnymi programami.

Aplikacja jest przeznaczona dla osób, które chcą po prostu wejść na stronę i pograć w krótkie, proste gry bez instalowania czegokolwiek na komputerze. Wystarczy przeglądarka internetowa.

## Zagraj online

https://pawelwielga.github.io/desktop-games/

## Co można tu znaleźć?

Na pulpicie dostępne są obecnie między innymi:

- **Kółko i Krzyżyk** - klasyczna gra dla dwóch osób.
- **Wąż** - sterowanie wężem, zbieranie punktów i unikanie zderzeń.
- **Saper** - odkrywanie pól i omijanie min.

Projekt jest rozwijany stopniowo. W planach są kolejne gry i funkcje, np. Memo, Tetris, Pong, Connect 4 czy inne miniaplikacje pasujące do pulpitu.

## Jak działa aplikacja?

Po wejściu na stronę użytkownik widzi pulpit z ikonami. Kliknięcie ikony otwiera wybraną grę w osobnym oknie. Okna można przesuwać, minimalizować, maksymalizować i zamykać, podobnie jak w zwykłym systemie operacyjnym.

Całość działa w przeglądarce, więc nie trzeba nic pobierać ani instalować. Projekt ma być prosty w użyciu, lekki i przyjemny wizualnie.

## Dla kogo jest ten projekt?

Ten projekt może być ciekawy dla:

- osób, które chcą szybko pograć w proste gry w przeglądarce,
- dzieci i dorosłych lubiących klasyczne mini gry,
- osób zainteresowanych wyglądem starego pulpitu komputerowego,
- programistów, którzy chcą zobaczyć przykład aplikacji z wieloma grami we wspólnym interfejsie.

## Rozwój projektu

Desktop Games jest projektem hobbystycznym i rozwojowym. Każda gra jest traktowana jak osobna aplikacja uruchamiana we wspólnym środowisku pulpitu. Dzięki temu można dodawać kolejne gry bez przebudowywania całej aplikacji od zera.

Dokumentacja dla osób dodających nowe gry znajduje się tutaj:

- [Adding a new game](docs/adding-a-game.md)
- [Multiplayer architecture](docs/multiplayer.md)
- [Icons and visual assets](docs/icons.md)
- [Production error debugging](docs/production-error-debugging.md)

## Ikony i zasoby graficzne

Projekt jest publiczny i niekomercyjny, dlatego ikony powinny pochodzić ze źródeł z jasną licencją. Dla prawdziwych usług, takich jak YouTube, używamy lokalnych plików SVG i trzymamy się zasad właściciela marki. Dla własnych gier preferowane są ikony tworzone w projekcie albo zestawy z permissive license, np. Kenney CC0.

W rejestrze aplikacji `icon` pozostaje tekstowym fallbackiem, a prawdziwy plik SVG można dodać przez `iconAsset`.

## Informacje techniczne dla programistów

Projekt jest zbudowany jako aplikacja React uruchamiana przez Vite. Do sprawdzania jakości kodu używane są TypeScript, ESLint i testy automatyczne.

Instalacja zależności:

```sh
npm install
```

Uruchomienie lokalnej wersji deweloperskiej:

```sh
npm run dev
```

Zbudowanie aplikacji:

```sh
npm run build
```

Podgląd wersji produkcyjnej:

```sh
npm run preview
```

Sprawdzenie typów TypeScript:

```sh
npm run typecheck
```

Uruchomienie lintowania:

```sh
npm run lint
```

Uruchomienie testów:

```sh
npm test
```

Pełna weryfikacja przed połączeniem zmian:

```sh
npm run verify
```

`npm run verify` uruchamia sprawdzanie TypeScript, lintowanie, testy oraz produkcyjny build aplikacji.

## Pull requesty i kontrola jakości

Dla pull requestów kierowanych do `main` GitHub Actions uruchamia check `CI / build-and-test`. Workflow instaluje zależności przez `npm ci`, a następnie wykonuje `npm run verify`.

Aby zablokować mergowanie zmian, które nie przechodzą testów, można skonfigurować ochronę brancha `main` w ustawieniach repozytorium i wymagać przejścia checka `build-and-test` przed merge.
