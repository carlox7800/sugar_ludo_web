const fs = require('fs');

// Update HexGameEngine.ts
let engine = fs.readFileSync('src/HexGameEngine.ts', 'utf8');

engine = engine.replace(
  /export function getCellIndexForToken\(color: HexPlayerColor, step: number\): number \| string \{[\s\S]*?return 'GOAL';\n\}/,
  `export function getCellIndexForToken(color: HexPlayerColor, step: number): number | string {
  if (step === 0) return 'BASE';
  const startCell = HEX_COLOR_INFO[color].startCell;

  // Main board loop: steps 1 to 78 cover one full circuit minus the final overlap
  // Step 78 lands on the cell just before startCell (e.g. cell 3 for Purple)
  if (step >= 1 && step <= 78) {
    return (startCell + (step - 1)) % 78;
  }
  
  // Steps 79 to 81: walk up to the tip of the arm (cells 4, 5, 6 for Purple)
  if (step >= 79 && step <= 81) {
    return (startCell + (step - 1)) % 78;
  }

  // Steps 82 to 86: Home corridor H1 to H5
  if (step >= 82 && step <= 86) {
    return \`H\${step - 81}\`;
  }

  return 'GOAL';
}`
);

engine = engine.replace(/step === 84/g, 'step === 87');
engine = engine.replace(/newStep <= 84/g, 'newStep <= 87');

fs.writeFileSync('src/HexGameEngine.ts', engine);

// Update HexGameView.ts
let view = fs.readFileSync('src/components/HexGameView.tsx', 'utf8');
view = view.replace(/step === 84/g, 'step === 87');
view = view.replace(/finalStep === 84/g, 'finalStep === 87');
fs.writeFileSync('src/components/HexGameView.tsx', view);

