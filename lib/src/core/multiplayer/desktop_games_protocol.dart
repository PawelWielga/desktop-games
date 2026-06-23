typedef JsonMap = Map<String, Object?>;

class DesktopGamesMessageTypes {
  const DesktopGamesMessageTypes._();

  static const playerHello = 'player:hello';
  static const roomPlayers = 'room:players';
  static const gameReset = 'game:reset';

  static const countriesCitiesSettings = 'countries-cities:settings';
  static const countriesCitiesStartRound = 'countries-cities:start-round';
  static const countriesCitiesSubmit = 'countries-cities:submit';
  static const countriesCitiesDeadline = 'countries-cities:deadline';
  static const countriesCitiesReview = 'countries-cities:review';
  static const countriesCitiesVote = 'countries-cities:vote';
  static const countriesCitiesDuplicate = 'countries-cities:duplicate';
  static const countriesCitiesReviewReady = 'countries-cities:review-ready';
  static const countriesCitiesReveal = 'countries-cities:reveal';
  static const countriesCitiesResults = 'countries-cities:results';
}

class PlayerProfileDto {
  const PlayerProfileDto({
    required this.id,
    required this.name,
    required this.color,
    required this.emoji,
  });

  final String id;
  final String name;
  final String color;
  final String emoji;

  JsonMap toJson() => {
        'id': id,
        'name': name,
        'color': color,
        'emoji': emoji,
      };

  static PlayerProfileDto fromJson(JsonMap json) {
    return PlayerProfileDto(
      id: json['id'] as String,
      name: json['name'] as String,
      color: json['color'] as String,
      emoji: json['emoji'] as String,
    );
  }
}

class DesktopGamesMessage {
  const DesktopGamesMessage({
    required this.type,
    this.requestId,
    this.senderId,
    this.sentAt,
    this.payload = const {},
  });

  final String type;
  final String? requestId;
  final String? senderId;
  final int? sentAt;
  final JsonMap payload;

  JsonMap toJson() => {
        ...payload,
        'type': type,
        if (requestId != null) 'requestId': requestId,
        if (senderId != null) 'senderId': senderId,
        'sentAt': sentAt ?? DateTime.now().millisecondsSinceEpoch,
      };

  static DesktopGamesMessage fromJson(JsonMap json) {
    return DesktopGamesMessage(
      type: json['type'] as String,
      requestId: json['requestId'] as String?,
      senderId: json['senderId'] as String?,
      sentAt: json['sentAt'] as int?,
      payload: Map<String, Object?>.from(json)..removeWhere(_isMetadataKey),
    );
  }

  static bool _isMetadataKey(String key, Object? value) {
    return key == 'type' || key == 'requestId' || key == 'senderId' || key == 'sentAt';
  }
}

DesktopGamesMessage playerHelloMessage({
  required String senderId,
  required PlayerProfileDto player,
}) {
  return DesktopGamesMessage(
    type: DesktopGamesMessageTypes.playerHello,
    senderId: senderId,
    payload: {'player': player.toJson()},
  );
}

DesktopGamesMessage countriesCitiesStartRoundMessage({
  required String senderId,
  required String letter,
  required List<String> usedLetters,
}) {
  return DesktopGamesMessage(
    type: DesktopGamesMessageTypes.countriesCitiesStartRound,
    senderId: senderId,
    payload: {
      'letter': letter,
      'usedLetters': usedLetters,
    },
  );
}

DesktopGamesMessage countriesCitiesSubmitMessage({
  required String senderId,
  required PlayerProfileDto player,
  required Map<String, String> answers,
}) {
  return DesktopGamesMessage(
    type: DesktopGamesMessageTypes.countriesCitiesSubmit,
    senderId: senderId,
    payload: {
      'player': player.toJson(),
      'answers': answers,
    },
  );
}
