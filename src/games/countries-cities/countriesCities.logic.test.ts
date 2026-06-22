import { describe, expect, it } from "vitest";
import {
  COUNTRIES_CITIES_LETTERS,
  areAnswersProbablySame,
  calculateAnswerScore,
  drawRoundLetter,
  getRequiredApprovalCount,
  groupSimilarAnswers,
  normalizeAnswer,
} from "./countriesCities.logic";

describe("countriesCities.logic", () => {
  it("normalizes Polish characters and punctuation", () => {
    expect(normalizeAnswer("  Łódź!!! ")).toBe("lodz");
  });

  it("matches answers that are probably the same", () => {
    expect(areAnswersProbablySame("Warszawa", "warszawa")).toBe(true);
    expect(areAnswersProbablySame("Kraków", "Krakow")).toBe(true);
    expect(areAnswersProbablySame("Nowy Jork", "Nowy-Jork")).toBe(true);
  });

  it("does not match clearly different answers", () => {
    expect(areAnswersProbablySame("Polska", "Portugalia")).toBe(false);
  });

  it("groups similar answers for scoring", () => {
    expect(groupSimilarAnswers(["Kraków", "Krakow", "Warszawa"])).toEqual([
      { key: "krakow", answers: ["Kraków", "Krakow"] },
      { key: "warszawa", answers: ["Warszawa"] },
    ]);
  });

  it("draws a letter that was not used earlier in the game", () => {
    const usedLetters = COUNTRIES_CITIES_LETTERS.slice(0, 3);
    const result = drawRoundLetter(usedLetters, () => 0);

    expect(result.letter).toBe(COUNTRIES_CITIES_LETTERS[3]);
    expect(result.usedLetters).toEqual([...usedLetters, COUNTRIES_CITIES_LETTERS[3]]);
  });

  it("does not draw a letter after all letters were used", () => {
    expect(drawRoundLetter(COUNTRIES_CITIES_LETTERS, () => 0)).toBeNull();
  });

  it("requires more than half of players to approve", () => {
    expect(getRequiredApprovalCount(2)).toBe(2);
    expect(getRequiredApprovalCount(3)).toBe(2);
    expect(getRequiredApprovalCount(4)).toBe(3);
  });

  it("scores unique and duplicate accepted answers", () => {
    expect(calculateAnswerScore({ answer: "Polska", accepted: true, duplicateCount: 1 })).toBe(15);
    expect(calculateAnswerScore({ answer: "Polska", accepted: true, duplicateCount: 2 })).toBe(10);
    expect(calculateAnswerScore({ answer: "Polska", accepted: false, duplicateCount: 1 })).toBe(0);
  });
});
