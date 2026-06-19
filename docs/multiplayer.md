# Multiplayer architecture

All multiplayer games in this project must use a **host-authoritative** model.

This means that the host is the single source of truth for game state, scoring, validation, random choices, tie-breaks, and final results. Clients send player actions to the host and render the state/results returned by the host.

## Host responsibilities

The host must be responsible for:

- validating player actions,
- accepting or rejecting moves,
- calculating points,
- resolving ties,
- running all random choices and RNG,
- detecting win, loss, draw, and round-end conditions,
- building the authoritative game state,
- sending state updates and final results to all clients.

## Client responsibilities

Clients must only:

- collect local player input,
- send player actions, votes, or choices to the host,
- display state received from the host,
- display final results received from the host.

Clients must not independently calculate results that affect gameplay.

## Not allowed

Do not implement multiplayer logic where each client independently:

- calculates points,
- resolves ties,
- runs random selection,
- determines winners,
- determines whether a move is valid,
- decides when a round or game is finished.

This can cause state divergence between players.

## Required pattern

Good multiplayer flow:

1. Client sends an action to the host.
2. Host validates the action.
3. Host updates the authoritative game state.
4. Host broadcasts the new state/result to all players.
5. Clients render the received state without recalculating outcome-critical logic.

Bad multiplayer flow:

1. Host and clients all receive raw data.
2. Every client calculates score or result locally.
3. Clients may disagree because of timing, RNG, tie-breaks, or implementation differences.

## Scoring and tie-breaks

Scoring must happen on the host.

If a game uses votes, the host collects all votes and decides the final result. The host then sends the final result to clients. Clients should not decide locally which vote option won.

If a game uses random tie-breaks, the host performs the random choice once and sends the chosen result to all clients.

For example, in a vote-based game:

1. Players send votes to the host.
2. Host counts votes.
3. Host resolves ties.
4. Host calculates points.
5. Host sends `finalResults` or another game-specific result message.
6. Clients display the received result.

## Checklist for new multiplayer games

Before opening a PR for a multiplayer game, verify that:

- all gameplay decisions are made by the host,
- all scoring is calculated by the host,
- all RNG is performed by the host,
- all tie-breaks are resolved by the host,
- clients only send actions and render host state,
- the final result is sent from host to clients as an explicit game message,
- tests cover pure scoring and tie-break logic where practical.
