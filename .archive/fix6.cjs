const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /addLog\(`\$\{activePlayer\.name\} no tiene movimientos válidos\.`, 'warning'\);\s*advanceTurn\(false, isDouble\);\s*botTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*advanceTurn\(false, diceValues \? diceValues\[0\] === diceValues\[1\] : false\);\s*\}, 800\);/,
  `addLog(\`\${activePlayer.name} no tiene movimientos válidos.\`, 'warning');
          // Switch turn automatically after a brief delay
          botTimeoutRef.current = window.setTimeout(() => {
            advanceTurn(false, isDouble);
          }, 800);`
);

fs.writeFileSync('src/App.tsx', code);
