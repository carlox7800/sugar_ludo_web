const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

code = code.replace(
  /export const COLOR_HEX: Record<PlayerColor, string> = \{[\s\S]*?\};/,
  `export const COLOR_HEX: Record<PlayerColor, string> = {
  red: 'var(--color-p-red)',
  green: 'var(--color-p-green)',
  blue: 'var(--color-p-blue)',
  yellow: 'var(--color-p-yellow)',
};`
);

code = code.replace(
  /export const COLOR_HEX_LIGHT: Record<PlayerColor, string> = \{[\s\S]*?\};/,
  `export const COLOR_HEX_LIGHT: Record<PlayerColor, string> = {
  red: 'var(--color-red-light)',
  green: 'var(--color-green-light)',
  blue: 'var(--color-blue-light)',
  yellow: 'var(--color-yellow-light)',
};`
);

fs.writeFileSync('src/components/GameBoard.tsx', code);
