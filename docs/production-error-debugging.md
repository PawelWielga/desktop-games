# Debugowanie bledow produkcyjnych

Publiczna wersja aplikacji nie publikuje sourcemap. Produkcyjny build Vite ma `build.sourcemap` ustawione na `false`, chyba ze lokalnie albo w prywatnym srodowisku ustawisz `VITE_DEBUG_SOURCEMAP=true`.

## Co znajduje sie w logu bledu

Bledy aplikacji i gier uruchamianych przez rejestr okien sa opakowane w `AppErrorBoundary`. Gdy komponent wyrzuci blad, uzytkownik widzi tylko bezpieczny komunikat w oknie. Stack trace nie jest pokazywany w produkcyjnym UI.

W konsoli przegladarki pojawia sie log:

```txt
[desktop-games] Application error
```

Payload zawiera ograniczony kontekst diagnostyczny:

- `app.id` - identyfikator aplikacji lub gry, np. `connect4`,
- `app.title` i `app.titleKey` - nazwa oraz klucz tlumaczenia,
- `app.kind` - `game`, `app`, `system` albo `unknown`,
- `app.launchMode` - `desktop-window` albo `direct-route`,
- `location.path` - sama sciezka bez query stringa i hasha,
- `build.mode` i `build.production`,
- `error.name`, `error.message`, skrocony `error.stack`,
- `react.componentStack`, czyli stos komponentow Reacta.

Log celowo nie serializuje dowolnych wlasciwosci rzuconego obiektu. Dzieki temu w konsoli zostaje kontekst potrzebny do namierzenia bledu, ale bez przypadkowego dopisywania danych z formularzy albo ustawien uzytkownika.

## Jak namierzyc zrodlo bledu

1. Z produkcyjnego logu skopiuj `app.id`, `app.launchMode`, `react.componentStack`, `error.message` oraz pierwsza linie `error.stack`.
2. Otworz kod gry lub aplikacji wskazanej przez `app.id` w `src/games/...` albo `src/apps/...`.
3. Zacznij od komponentu z `react.componentStack`, np. `Connect4Game`, bo zwykle szybciej prowadzi do zrodla niz zminifikowany chunk typu `Connect4Game-DVYzCGrb.js:1:2052`.
4. Jezeli blad jest trudny do znalezienia, zbuduj te sama rewizje prywatnie z mapami zrodel:

```sh
VITE_DEBUG_SOURCEMAP=true npm run build
```

W Windows PowerShell:

```powershell
$env:VITE_DEBUG_SOURCEMAP="true"; npm run build
```

5. Uzyj wygenerowanych plikow `.map` lokalnie albo w prywatnym narzedziu diagnostycznym. Nie publikuj ich razem z publicznym `dist`.

## Zasady bezpieczenstwa

- Nie wlaczaj `VITE_DEBUG_SOURCEMAP=true` w publicznym deployu GitHub Pages.
- Nie wklejaj do issue pelnych logow, jezeli zawieraja dane wpisane przez uzytkownika w grze lub aplikacji.
- Do zgloszenia zwykle wystarczy `app.id`, `app.launchMode`, `error.message`, `react.componentStack` i ewentualnie skrocony stack z chunka.
