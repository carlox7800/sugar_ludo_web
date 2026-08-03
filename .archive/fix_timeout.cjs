const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add noMovesTimeoutRef
code = code.replace(
  /const botTimeoutRef = useRef<number \| null>\(null\);/,
  `const botTimeoutRef = useRef<number | null>(null);\n  const noMovesTimeoutRef = useRef<number | null>(null);`
);

// Update handleRollDice
code = code.replace(
  /botTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*advanceTurn\(false\);\s*\}, 800\);/g,
  `noMovesTimeoutRef.current = window.setTimeout(() => {
            advanceTurn(false);
          }, 800);`
);

// Clear noMovesTimeoutRef in advanceTurn just in case
code = code.replace(
  /const advanceTurn = \(extraTurn: boolean\) => \{/,
  `const advanceTurn = (extraTurn: boolean) => {
    if (noMovesTimeoutRef.current) {
      clearTimeout(noMovesTimeoutRef.current);
      noMovesTimeoutRef.current = null;
    }`
);

fs.writeFileSync('src/App.tsx', code);
