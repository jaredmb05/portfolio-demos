// The training quiz draw (iPad). Required questions are asked in every quiz (production D31), on top of a random draw from
// the bank that shrinks so the quiz stays the same length. The random places are shared out across the bank's categories
// in proportion to their size, then topped up at random; no question is asked twice.
//   Bank entry:     [question, correct, [distractors...], category]            → the correct answer + 3 distractors, shuffled
//   Required entry: [question, correct, [all answers], category, fixedOrder]   → fixedOrder keeps the answers as written
//                   ("All of the above" last; True, then False); otherwise they are shuffled too.

export function shuffle(a, random = Math.random) { const b = a.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(random() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; }

// The quiz: every required question plus (length − required) from the bank, in random order. Items: { q, correct, category, options }
export function drawQuiz(bank, required, length, random = Math.random) {
  const mix = a => shuffle(a, random);
  const requiredQs = new Set(required.map(r => r[0]));
  const pool = bank.filter(b => !requiredQs.has(b[0]));   // a bank copy of a required question would be asked twice
  const draw = Math.max(0, length - required.length);
  // Balanced draw: take from each category proportionally, then top up at random
  const byCat = {}; pool.forEach(q => { (byCat[q[3]] = byCat[q[3]] || []).push(q); });
  let picked = [];
  Object.keys(byCat).forEach(c => { const n = Math.round(draw * byCat[c].length / pool.length); picked = picked.concat(mix(byCat[c]).slice(0, n)); });
  const rest = mix(pool.filter(q => !picked.includes(q)));
  while (picked.length < draw && rest.length) picked.push(rest.pop());
  picked = mix(picked).slice(0, draw);
  const items = picked.map(([q, correct, d, category]) => ({ q, correct, category, options: mix([correct, ...d.slice(0, 3)]) }))
    .concat(required.map(([q, correct, opts, category, fixed]) => ({ q, correct, category, options: fixed ? opts.slice() : mix(opts) })));
  return mix(items);
}
