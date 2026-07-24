const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

code = code.replace(
  /export const START_OFFSETS: Record<PlayerColor, number> = \{\s*blue: 2,\s*green: 15,\s*red: 28,\s*yellow: 41,\s*\};/,
  `export const START_OFFSETS: Record<PlayerColor, number> = {
  blue: 1,
  green: 14,
  red: 27,
  yellow: 40,
};`
);

code = code.replace(
  /export function getStartColorFromIndex\(index: number\): PlayerColor \| null \{\s*if \(index === 2\) return 'blue';\s*if \(index === 15\) return 'green';\s*if \(index === 28\) return 'red';\s*if \(index === 41\) return 'yellow';\s*return null;\s*\}/,
  `export function getStartColorFromIndex(index: number): PlayerColor | null {
  if (index === 1) return 'blue';
  if (index === 14) return 'green';
  if (index === 27) return 'red';
  if (index === 40) return 'yellow';
  return null;
}`
);

// Safe cells need to be updated. The old safe cells were: 2, 8, 15, 21, 28, 34, 41, 47.
// I will keep the non-start safe cells exactly where they were, so they remain 8, 21, 34, 47.
// So new safe cells: 1, 8, 14, 21, 27, 34, 40, 47
code = code.replace(
  /return \[2, 8, 15, 21, 28, 34, 41, 47\]\.includes\(index\);/,
  `return [1, 8, 14, 21, 27, 34, 40, 47].includes(index);`
);

fs.writeFileSync('src/components/GameBoard.tsx', code);
