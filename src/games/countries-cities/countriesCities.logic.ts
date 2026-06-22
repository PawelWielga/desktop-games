export type AnswerMatchGroup = {
  key: string;
  answers: string[];
};

export const COUNTRIES_CITIES_LETTERS = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
  "H",
  "I",
  "J",
  "K",
  "L",
  "Ł",
  "M",
  "N",
  "O",
  "P",
  "R",
  "S",
  "T",
  "U",
  "W",
  "Z",
] as const;

const POLISH_CHARS: Record<string, string> = {
  ą: "a",
  ć: "c",
  ę: "e",
  ł: "l",
  ń: "n",
  ó: "o",
  ś: "s",
  ź: "z",
  ż: "z",
};

export function normalizeAnswer(value: string): string {
  return value
    .trim()
    .toLowerCase()
    .replace(/[ąćęłńóśźż]/g, (letter) => POLISH_CHARS[letter] ?? letter)
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/[-\s]+/g, " ")
    .trim();
}

export function areAnswersProbablySame(first: string, second: string): boolean {
  const left = normalizeAnswer(first);
  const right = normalizeAnswer(second);

  if (!left || !right) return false;
  if (left === right) return true;
  if (left.length <= 2 || right.length <= 2) return false;

  const shorter = left.length <= right.length ? left : right;
  const longer = left.length > right.length ? left : right;

  if (longer.includes(shorter) && shorter.length >= 4) return true;

  const distance = levenshteinDistance(left, right);
  const ratio = distance / Math.max(left.length, right.length);

  return distance <= 1 || (Math.max(left.length, right.length) >= 7 && ratio <= 0.24);
}

export function groupSimilarAnswers(answers: string[]): AnswerMatchGroup[] {
  return answers.reduce<AnswerMatchGroup[]>((groups, answer) => {
    const normalized = normalizeAnswer(answer);
    if (!normalized) return groups;

    const existing = groups.find((group) => areAnswersProbablySame(group.key, normalized));
    if (existing) {
      if (!existing.answers.includes(answer)) existing.answers.push(answer);
      return groups;
    }

    groups.push({ key: normalized, answers: [answer] });
    return groups;
  }, []);
}

export function drawRoundLetter(
  usedLetters: readonly string[],
  random: () => number = Math.random
): { letter: string; usedLetters: string[] } | null {
  const knownLetters = new Set<string>(COUNTRIES_CITIES_LETTERS);
  const usedSet = new Set(usedLetters.map((letter) => letter.trim().toUpperCase()).filter((letter) => knownLetters.has(letter)));
  const availableLetters = COUNTRIES_CITIES_LETTERS.filter((letter) => !usedSet.has(letter));

  if (availableLetters.length === 0) return null;

  const letter = availableLetters[Math.floor(random() * availableLetters.length)] ?? availableLetters[0];

  return {
    letter,
    usedLetters: [...usedSet, letter],
  };
}

export function getRequiredApprovalCount(playerCount: number): number {
  return Math.floor(playerCount / 2) + 1;
}

export function calculateAnswerScore(options: { answer: string; accepted: boolean; duplicateCount: number }): number {
  if (!options.answer.trim() || !options.accepted) return 0;
  return options.duplicateCount > 1 ? 10 : 15;
}

function levenshteinDistance(first: string, second: string): number {
  const rows = first.length + 1;
  const columns = second.length + 1;
  const matrix = Array.from({ length: rows }, () => Array<number>(columns).fill(0));

  for (let row = 0; row < rows; row += 1) matrix[row][0] = row;
  for (let column = 0; column < columns; column += 1) matrix[0][column] = column;

  for (let row = 1; row < rows; row += 1) {
    for (let column = 1; column < columns; column += 1) {
      const cost = first[row - 1] === second[column - 1] ? 0 : 1;
      matrix[row][column] = Math.min(
        matrix[row - 1][column] + 1,
        matrix[row][column - 1] + 1,
        matrix[row - 1][column - 1] + cost
      );
    }
  }

  return matrix[first.length][second.length];
}
