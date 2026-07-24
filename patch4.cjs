const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

code = code.replace(
  /addLog\(`\$\{activePlayer\.name\} no tiene movimientos válidos\.`, 'warning'\);\s*\/\/ Switch turn automatically after a brief delay\s*botTimeoutRef\.current = window\.setTimeout\(\(\) => \{\s*advanceTurn\(false, diceValue === 6\);\s*\}, 800\);/g,
  `addLog(\`\${activePlayer.name} no tiene movimientos válidos.\`, 'warning');
          
          // Switch turn automatically after a brief delay
          botTimeoutRef.current = window.setTimeout(() => {
            advanceTurn(false, finalRoll === 6);
          }, 800);`
);

fs.writeFileSync('src/App.tsx', code);
