const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

code = code.replace(
  /<stop offset="0%" stopColor="#ffffff" \/>\s*<stop offset="60%" stopColor="#ca8a04" \/>/,
  `<stop offset="0%" stopColor="#fde047" />
            <stop offset="60%" stopColor="#ca8a04" />`
);

fs.writeFileSync('src/components/GameBoard.tsx', code);
