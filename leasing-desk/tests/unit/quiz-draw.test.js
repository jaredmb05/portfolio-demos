// The training quiz draw (production iPad v1.24, D31): three required questions in every quiz, on top of a random draw
// from the bank that shrinks so the quiz stays 30 questions; no repeats; fixed answer order where a question needs it.
import { describe, expect, it } from 'vitest';
import { drawQuiz } from '../../apps/shared/quiz-draw.js';

// A small seeded random source, so the draws are the same on every run
const seeded = (seed = 1) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// A bank shaped like the demo's: 60 questions in six categories
const SIZES = { Application: 9, Buildings: 19, People: 13, Policies: 12, Quoting: 2, Transit: 5 };
const BANK = Object.entries(SIZES).flatMap(([cat, n]) =>
  Array.from({ length: n }, (_, i) => [`${cat} question ${i + 1}?`, `${cat} ${i + 1} right`, [`${cat} ${i + 1} wrong a`, `${cat} ${i + 1} wrong b`, `${cat} ${i + 1} wrong c`, `${cat} ${i + 1} wrong d`], cat]));
const SIGN_IN = ['Are you being referred by a resident?', 'When are you looking to move?', 'What size apartment are you looking for?', 'What price range would you like to stay within?'];
const REQUIRED = [
  ['Who do you direct a renewal or a new occupant to?', 'Their leasing specialist', ['Their building manager', 'Their leasing agent', 'Their property manager', 'Their leasing specialist'], 'People', false],
  ['What do you always ask when signing in a prospect?', 'All of the above', SIGN_IN.concat('All of the above'), 'Sign-in', true],
  ['True or false: they fill in only their email address.', 'True', ['True', 'False'], 'Sign-in', true],
];
const draws = (n = 25, seed = 7) => { const random = seeded(seed); return Array.from({ length: n }, () => drawQuiz(BANK, REQUIRED, 30, random)); };
const find = (quiz, q) => quiz.find(it => it.q === q);

describe('what every quiz asks', () => {
  it('25 draws: every quiz is 30 questions, the 3 required ones plus 27 from the bank', () => {
    for (const quiz of draws()) {
      expect(quiz).toHaveLength(30);
      expect(REQUIRED.every(([q]) => find(quiz, q))).toBe(true);
      expect(quiz.filter(it => BANK.some(b => b[0] === it.q))).toHaveLength(27);
    }
  });
  it('25 draws: no question is asked twice in a quiz', () => {
    for (const quiz of draws()) expect(new Set(quiz.map(it => it.q)).size).toBe(quiz.length);
  });
  it('a required question that is also in the bank is still asked once, and the quiz is still 30', () => {
    const bank = BANK.concat([REQUIRED[0].slice(0, 4)]);
    for (let s = 1; s <= 25; s++) {
      const quiz = drawQuiz(bank, REQUIRED, 30, seeded(s));
      expect(quiz.filter(it => it.q === REQUIRED[0][0])).toHaveLength(1);
      expect(quiz).toHaveLength(30);
    }
  });
  it('the random questions differ from quiz to quiz', () => {
    const [a, b] = draws(2).map(quiz => quiz.map(it => it.q).sort().join('|'));
    expect(a).not.toBe(b);
  });
  it('the required questions land anywhere in the quiz, not always at the end', () => {
    const lastThree = draws().map(quiz => quiz.slice(-3).map(it => it.q).sort().join('|'));
    const required = REQUIRED.map(r => r[0]).sort().join('|');
    expect(lastThree.every(x => x === required)).toBe(false);
  });
});

describe('answer order', () => {
  it('"All of the above" stays last, after the four sign-in questions in their written order, in every draw', () => {
    for (const quiz of draws()) expect(find(quiz, REQUIRED[1][0]).options).toEqual(SIGN_IN.concat('All of the above'));
  });
  it('true or false is always True, then False', () => {
    for (const quiz of draws()) expect(find(quiz, REQUIRED[2][0]).options).toEqual(['True', 'False']);
  });
  it('a required question without the fixed-order flag has its answers shuffled (more than one order in 25 draws)', () => {
    const orders = new Set(draws().map(quiz => find(quiz, REQUIRED[0][0]).options.join('|')));
    expect(orders.size).toBeGreaterThan(1);
    for (const quiz of draws()) expect([...find(quiz, REQUIRED[0][0]).options].sort()).toEqual([...REQUIRED[0][2]].sort());
  });
  it('a bank question offers its correct answer and its first three distractors, in random order', () => {
    const quiz = draws(1)[0], it0 = quiz.find(it => BANK.some(b => b[0] === it.q)), entry = BANK.find(b => b[0] === it0.q);
    expect([...it0.options].sort()).toEqual([entry[1], ...entry[2].slice(0, 3)].sort());
    const orders = new Set(draws().flatMap(quiz => quiz.filter(it => it.q === entry[0]).map(it => it.options.join('|'))));
    expect(orders.size).toBeGreaterThan(1);
  });
  it('every item carries the right answer and its category (the Desk shows the category of a miss, e.g. "Sign-in")', () => {
    const quiz = draws(1)[0];
    expect(find(quiz, REQUIRED[1][0])).toMatchObject({ correct: 'All of the above', category: 'Sign-in' });
    expect(find(quiz, REQUIRED[2][0])).toMatchObject({ correct: 'True', category: 'Sign-in' });
    for (const it of quiz) expect(it.options).toContain(it.correct);
  });
});

describe('the random places are shared across the bank', () => {
  it('27 places from a 60-question bank: each category gets its share (4 Application, 9 Buildings, 6 People, 5 Policies, 1 Quoting, 2 Transit)', () => {
    for (const quiz of draws()) {
      const counts = {};
      quiz.filter(it => !REQUIRED.some(r => r[0] === it.q)).forEach(it => { counts[it.category] = (counts[it.category] || 0) + 1; });
      expect(counts).toEqual({ Application: 4, Buildings: 9, People: 6, Policies: 5, Quoting: 1, Transit: 2 });
    }
  });
  it('places that rounding leaves empty are filled from the rest of the bank', () => {
    const bank = ['A', 'B', 'C'].flatMap(cat => Array.from({ length: 5 }, (_, i) => [`${cat}${i}?`, 'yes', ['no', 'maybe', 'never'], cat]));
    const quiz = drawQuiz(bank, REQUIRED, 7, seeded(3));   // 4 places; each category's share rounds to 1
    expect(quiz).toHaveLength(7);
    expect(new Set(quiz.map(it => it.q)).size).toBe(7);
  });
  it('a bank smaller than the places left: every bank question once, plus the required ones', () => {
    const quiz = drawQuiz(BANK.slice(0, 10), REQUIRED, 30, seeded(5));
    expect(quiz).toHaveLength(13);
    expect(new Set(quiz.map(it => it.q)).size).toBe(13);
  });
  it('no required questions: the whole quiz comes from the bank (the draw before v1.24)', () => {
    const quiz = drawQuiz(BANK, [], 30, seeded(9));
    expect(quiz).toHaveLength(30);
    expect(quiz.every(it => BANK.some(b => b[0] === it.q))).toBe(true);
  });
});
