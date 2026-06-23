import 'dart:math';

import 'package:flutter/foundation.dart';

const defaultCategories = [
  'Państwo',
  'Miasto',
  'Roślina',
  'Zwierzę',
  'Rzecz',
];

const countriesCitiesLetters = [
  'A',
  'B',
  'C',
  'D',
  'E',
  'F',
  'G',
  'H',
  'I',
  'J',
  'K',
  'L',
  'Ł',
  'M',
  'N',
  'O',
  'P',
  'R',
  'S',
  'T',
  'U',
  'W',
  'Z',
];

class RoundState {
  const RoundState({
    required this.letter,
    required this.categories,
    required this.answers,
  });

  final String letter;
  final List<String> categories;
  final Map<String, String> answers;
}

class LocalGameController extends ChangeNotifier {
  LocalGameController({Random? random}) : _random = random ?? Random();

  final Random _random;
  final List<String> _availableLetters = List.of(countriesCitiesLetters);

  RoundState? _round;

  RoundState? get round => _round;
  bool get hasRound => _round != null;
  int get remainingLetters => _availableLetters.length;

  void startRound({List<String> categories = defaultCategories}) {
    if (_availableLetters.isEmpty) {
      throw StateError('Wszystkie litery zostały już wykorzystane.');
    }

    final index = _random.nextInt(_availableLetters.length);
    final letter = _availableLetters.removeAt(index);

    _round = RoundState(
      letter: letter,
      categories: List.unmodifiable(categories),
      answers: {for (final category in categories) category: ''},
    );
    notifyListeners();
  }

  void updateAnswer(String category, String value) {
    final current = _round;
    if (current == null || !current.categories.contains(category)) {
      return;
    }

    _round = RoundState(
      letter: current.letter,
      categories: current.categories,
      answers: {...current.answers, category: value.trim()},
    );
    notifyListeners();
  }

  int calculateFilledAnswersScore() {
    final current = _round;
    if (current == null) {
      return 0;
    }

    return current.answers.values.where((answer) => answer.isNotEmpty).length * 10;
  }

  void resetGame() {
    _availableLetters
      ..clear()
      ..addAll(countriesCitiesLetters);
    _round = null;
    notifyListeners();
  }
}
