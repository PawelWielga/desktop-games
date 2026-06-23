# Kompatybilność z desktop-games

Celem projektu `panstwa-miasta` jest zgodność protokołu gry z webową grą Countries/Cities z repozytorium `desktop-games`.

## Jak działa online w desktop-games

`desktop-games` używa modelu PeerJS/WebRTC:

1. Host tworzy pokój.
2. Kod pokoju jest identyfikatorem peera hosta.
3. Gość wpisuje kod pokoju i łączy się z hostem.
4. Dane gry są wysyłane jako JSON string przez WebRTC DataConnection.
5. Gra nie trzyma logiki połączenia w komponencie gry. Używa wspólnego lobby i wysyła tylko wiadomości domenowe.

## Wymagana kompatybilność

Aplikacja mobilna musi zachować zgodność z następującymi elementami:

- format kodu pokoju: `^[A-Z0-9_-]{3,32}$`, domyślnie 5 znaków,
- wspólne pola wiadomości: `type`, `requestId`, `senderId`, `sentAt`,
- wiadomość powitalna `player:hello`,
- profil gracza: `id`, `name`, `color`, `emoji`,
- wiadomości gry Countries/Cities z prefiksem `countries-cities:`.

## Wiadomości Countries/Cities

Mobilna aplikacja powinna obsługiwać te same typy wiadomości:

- `countries-cities:settings`,
- `countries-cities:start-round`,
- `countries-cities:submit`,
- `countries-cities:deadline`,
- `countries-cities:review`,
- `countries-cities:vote`,
- `countries-cities:duplicate`,
- `countries-cities:review-ready`,
- `countries-cities:reveal`,
- `countries-cities:results`,
- `game:reset`.

## Host-authoritative

Tak jak w `desktop-games`, host ma być źródłem prawdy:

- host losuje literę,
- host pilnuje użytych liter,
- host kończy rundę,
- host zbiera odpowiedzi,
- host zbiera głosy,
- host wylicza wyniki,
- host wysyła wyniki klientom.

Klienci wysyłają akcje gracza i renderują stan otrzymany od hosta.

## Online i LAN

Docelowo będą dwa transporty z tym samym protokołem wiadomości:

1. `PeerJsCompatibleTransport` dla gry online z webowym `desktop-games`.
2. `LocalLanTransport` dla gry przez hotspot lub lokalne Wi-Fi.

Oba transporty muszą wysyłać takie same obiekty JSON. Dzięki temu logika gry nie będzie zależna od tego, czy połączenie działa przez internet, czy lokalnie.

## Ważna uwaga techniczna

Pełna kompatybilność z webowym `desktop-games` wymaga po stronie Fluttera transportu zgodnego z WebRTC DataChannel i sposobem sygnalizacji PeerJS. Zwykły WebSocket nie wystarczy do połączenia bezpośrednio z istniejącym pokojem PeerJS.
