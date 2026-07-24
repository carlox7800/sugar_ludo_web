const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /const \[diceValues, setDiceValues\] = useState<\[number, number\] \| null>\(null\);/,
  `const [diceValues, setDiceValues] = useState<[number, number] | null>(null);
  const [remainingMoves, setRemainingMoves] = useState<number[]>([]);
  const [moveSelectorTokenId, setMoveSelectorTokenId] = useState<number | null>(null);`
);

fs.writeFileSync('src/App.tsx', code);
