import 'package:flutter_test/flutter_test.dart';
import 'package:panstwa_miasta/src/core/multiplayer/desktop_games_protocol.dart';

void main() {
  test('playerHelloMessage matches desktop-games shape', () {
    final message = playerHelloMessage(
      senderId: 'player-1',
      player: const PlayerProfileDto(
        id: 'player-1',
        name: 'Paweł',
        color: '#38bdf8',
        emoji: '🙂',
      ),
    ).toJson();

    expect(message['type'], DesktopGamesMessageTypes.playerHello);
    expect(message['senderId'], 'player-1');
    expect(message['player'], isA<Map<String, Object?>>());
    expect((message['player'] as Map<String, Object?>)['name'], 'Paweł');
    expect(message['sentAt'], isA<int>());
  });

  test('submit message uses countries-cities type and answers payload', () {
    final message = countriesCitiesSubmitMessage(
      senderId: 'player-1',
      player: const PlayerProfileDto(
        id: 'player-1',
        name: 'Paweł',
        color: '#38bdf8',
        emoji: '🙂',
      ),
      answers: {'Państwo': 'Polska'},
    ).toJson();

    expect(message['type'], DesktopGamesMessageTypes.countriesCitiesSubmit);
    expect(message['answers'], {'Państwo': 'Polska'});
  });
}
