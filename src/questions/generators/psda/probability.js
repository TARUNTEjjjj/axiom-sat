import { fmtFrac, plural } from '../../format.js';
import { makeChoices } from '../../choices.js';
import { answerText } from '../../schema.js';

// A two-way frequency table whose four cells are chosen first, so its Total row
// and column are consistent by construction. The question asks for a marginal,
// joint or conditional probability as a fraction in lowest terms.

// A category as it appears in the table, as a predicate for one member ("the
// student is in grade 11") and as a plural predicate ("students who are in grade 11").
const cat = (label, is, who) => ({ label, is, who });

const CONTEXTS = [
  {
    unit: ['student', 'students'],
    rel: 'who',
    about: 'grade level and sport participation',
    where: 'surveyed at a school',
    caption: 'Grade Level and Sport Participation of Students Surveyed',
    corner: 'Grade',
    rows: [cat('Grade 11', 'is in grade 11', 'are in grade 11'), cat('Grade 12', 'is in grade 12', 'are in grade 12')],
    cols: [
      cat('Plays a sport', 'plays a sport', 'play a sport'),
      cat('Does not play a sport', 'does not play a sport', 'do not play a sport'),
    ],
  },
  {
    unit: ['adult', 'adults'],
    rel: 'who',
    about: 'age group and voting status',
    where: 'surveyed in a town',
    caption: 'Voting in a Local Election by Age Group',
    corner: 'Age group',
    rows: [
      cat('18 to 39', 'is 18 to 39 years old', 'are 18 to 39 years old'),
      cat('40 or older', 'is 40 years old or older', 'are 40 years old or older'),
    ],
    cols: [cat('Voted', 'voted', 'voted'), cat('Did not vote', 'did not vote', 'did not vote')],
  },
  {
    unit: ['vehicle', 'vehicles'],
    rel: 'that',
    about: 'type and condition',
    where: 'at a dealership',
    caption: 'Vehicles at a Dealership by Type and Condition',
    corner: 'Type',
    rows: [cat('Sedan', 'is a sedan', 'are sedans'), cat('SUV', 'is an SUV', 'are SUVs')],
    cols: [cat('New', 'is new', 'are new'), cat('Used', 'is used', 'are used')],
  },
  {
    unit: ['animal', 'animals'],
    rel: 'that',
    about: 'type and adoption status',
    where: 'at an animal shelter',
    caption: 'Animals at a Shelter by Type and Adoption Status',
    corner: 'Type',
    rows: [cat('Dog', 'is a dog', 'are dogs'), cat('Cat', 'is a cat', 'are cats')],
    cols: [
      cat('Adopted', 'has been adopted', 'have been adopted'),
      cat('Not yet adopted', 'has not yet been adopted', 'have not yet been adopted'),
    ],
  },
  {
    unit: ['employee', 'employees'],
    rel: 'who',
    about: 'work schedule and commute',
    where: 'at a company',
    caption: 'Employees of a Company by Schedule and Commute',
    corner: 'Schedule',
    rows: [cat('Full-time', 'works full-time', 'work full-time'), cat('Part-time', 'works part-time', 'work part-time')],
    cols: [
      cat('Drives to work', 'drives to work', 'drive to work'),
      cat('Does not drive to work', 'does not drive to work', 'do not drive to work'),
    ],
  },
  {
    unit: ['book', 'books'],
    rel: 'that',
    about: 'genre and binding',
    where: 'in a classroom library',
    caption: 'Books in a Classroom Library by Genre and Binding',
    corner: 'Genre',
    rows: [cat('Fiction', 'is fiction', 'are fiction'), cat('Nonfiction', 'is nonfiction', 'are nonfiction')],
    cols: [cat('Hardcover', 'is a hardcover', 'are hardcovers'), cat('Paperback', 'is a paperback', 'are paperbacks')],
  },
  {
    unit: ['tree', 'trees'],
    rel: 'that',
    about: 'species and height',
    where: 'in a park',
    caption: 'Trees in a Park by Species and Height',
    corner: 'Species',
    rows: [cat('Oak', 'is an oak', 'are oaks'), cat('Maple', 'is a maple', 'are maples')],
    cols: [
      cat('Taller than 20 feet', 'is taller than 20 feet', 'are taller than 20 feet'),
      cat('20 feet or shorter', 'is 20 feet tall or shorter', 'are 20 feet tall or shorter'),
    ],
  },
];

// A count over a total, followed by its lowest terms when they differ.
function ratio(num, den) {
  const reduced = fmtFrac(num, den);
  return reduced === `${num}/${den}` ? reduced : `${num}/${den} = ${reduced}`;
}

// Three distractor fractions, each strictly between 0 and 1 and different in value
// from the answer and from each other. Equal values reduce to equal text, so the
// text is what is compared. Gaps are filled by nudging the unreduced numerator.
function pickFractions(num, den, candidates) {
  const seen = new Set([fmtFrac(num, den)]);
  const out = [];
  const take = ([n, d]) => {
    if (n <= 0 || n >= d) return;
    const text = fmtFrac(n, d);
    if (seen.has(text)) return;
    seen.add(text);
    out.push(text);
  };
  for (const pair of candidates) {
    if (out.length === 3) break;
    take(pair);
  }
  for (let k = 1; out.length < 3; k++) {
    take([num + k, den]);
    if (out.length < 3) take([num - k, den]);
  }
  return out;
}

export default {
  id: 'psda.probability',
  domain: 'psda',
  skill: 'Probability and conditional probability',
  // contexts · question phrasings (2 rows + 2 columns marginal, 4 cells each for
  // joint, row-conditional and column-conditional) · grand totals 20–240 in the stem
  space: 7 * 16 * 221,

  generate(rng) {
    const c = rng.pick(CONTEXTS);
    const cells = [
      [rng.int(5, 60), rng.int(5, 60)],
      [rng.int(5, 60), rng.int(5, 60)],
    ];
    const kind = rng.pick(['row', 'col', 'joint', 'givenRow', 'givenCol']);
    const i = rng.int(0, 1);
    const j = rng.int(0, 1);

    const rowT = [cells[0][0] + cells[0][1], cells[1][0] + cells[1][1]];
    const colT = [cells[0][0] + cells[1][0], cells[0][1] + cells[1][1]];
    const total = rowT[0] + rowT[1];
    const cell = cells[i][j];
    const row = c.rows[i];
    const col = c.cols[j];
    const units = c.unit[1];

    let num;
    let den;
    let selection = `one of the ${units}`;
    let outcome;
    let candidates;
    let explanation;
    if (kind === 'row') {
      [num, den] = [rowT[i], total];
      outcome = row.is;
      // The other row, one cell only, the two rows compared, and the column.
      candidates = [[rowT[1 - i], total], [cell, total], [rowT[i], rowT[1 - i]], [colT[j], total]];
      explanation =
        `There are ${total} ${units} in all, and the Total column shows that ${rowT[i]} of them ${row.who}. ` +
        `The probability is ${ratio(num, den)}.`;
    } else if (kind === 'col') {
      [num, den] = [colT[j], total];
      outcome = col.is;
      candidates = [[colT[1 - j], total], [cell, total], [colT[j], colT[1 - j]], [rowT[i], total]];
      explanation =
        `There are ${total} ${units} in all, and the Total row shows that ${colT[j]} of them ${col.who}. ` +
        `The probability is ${ratio(num, den)}.`;
    } else if (kind === 'joint') {
      [num, den] = [cell, total];
      outcome = `${row.is} and ${col.is}`;
      // Conditioning on either category, taking the union, and the row alone.
      candidates = [[cell, rowT[i]], [cell, colT[j]], [rowT[i] + colT[j] - cell, total], [rowT[i], total]];
      explanation =
        `Of the ${total} ${units} in all, ${cell} ${row.who} and ${col.who}. ` +
        `The probability is ${ratio(num, den)}.`;
    } else if (kind === 'givenRow') {
      [num, den] = [cell, rowT[i]];
      selection = `one of the ${units} ${c.rel} ${row.who}`;
      outcome = col.is;
      // Dividing by the grand total, conditioning the other way, the complement,
      // and the probability of the condition itself.
      candidates = [[cell, total], [cell, colT[j]], [rowT[i] - cell, rowT[i]], [rowT[i], total]];
      explanation =
        `The selection is restricted to the ${units} ${c.rel} ${row.who}: the ${row.label} row, whose total is ` +
        `${rowT[i]}. Of those, ${cell} ${col.who}, so the probability is ${ratio(num, den)}.`;
    } else {
      [num, den] = [cell, colT[j]];
      selection = `one of the ${units} ${c.rel} ${col.who}`;
      outcome = row.is;
      candidates = [[cell, total], [cell, rowT[i]], [colT[j] - cell, colT[j]], [colT[j], total]];
      explanation =
        `The selection is restricted to the ${units} ${c.rel} ${col.who}: the ${col.label} column, whose total is ` +
        `${colT[j]}. Of those, ${cell} ${row.who}, so the probability is ${ratio(num, den)}.`;
    }

    const stem =
      `The table shows the ${c.about} of the ${plural(total, ...c.unit)} ${c.where}. ` +
      `If ${selection} is selected at random, what is the probability that the ${c.unit[0]} ${outcome}?`;
    const table = {
      caption: c.caption,
      headers: [c.corner, c.cols[0].label, c.cols[1].label, 'Total'],
      rows: [
        [c.rows[0].label, cells[0][0], cells[0][1], rowT[0]],
        [c.rows[1].label, cells[1][0], cells[1][1], rowT[1]],
        ['Total', colT[0], colT[1], total],
      ],
    };
    const { choices, answer } = makeChoices(rng, fmtFrac(num, den), pickFractions(num, den, candidates));

    // A marginal probability reads one total; a joint probability reads one cell
    // against the grand total; a conditional probability changes the denominator.
    const difficulty = kind === 'row' || kind === 'col' ? 1 : kind === 'joint' ? 2 : 3;

    return {
      item: { type: 'mc', difficulty, stem, table, choices, answer, explanation },
      params: { cells, kind, i, j, num, den },
    };
  },

  // The table's totals are re-added from the cells, and each probability is
  // re-derived through its complement rather than read off the same count.
  verify({ item, params: { cells, kind, i, j, num, den } }) {
    const [[a, b], [c, d]] = cells;
    const total = a + b + c + d;
    const rowT = [a + b, c + d];
    const colT = [a + c, b + d];
    const { rows } = item.table;
    const tableOk =
      rows[0][3] === rowT[0] &&
      rows[1][3] === rowT[1] &&
      rows[2][1] === colT[0] &&
      rows[2][2] === colT[1] &&
      rows[2][3] === total &&
      rows[i][j + 1] === cells[i][j];
    const rowRest = rowT[i] - cells[i][1 - j];
    const colRest = colT[j] - cells[1 - i][j];
    const identity = {
      row: num * total === (total - rowT[1 - i]) * den,
      col: num * total === (total - colT[1 - j]) * den,
      joint: num * total === rowRest * den,
      givenRow: num * rowT[i] === rowRest * den,
      givenCol: num * colT[j] === colRest * den,
    }[kind];
    return tableOk && num > 0 && num < den && identity && answerText(item) === fmtFrac(num, den);
  },
};
