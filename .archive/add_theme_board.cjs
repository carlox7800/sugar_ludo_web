const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

code = code.replace(/interface GameBoardProps \{/, `import { AppTheme } from '../types';\ninterface GameBoardProps {\n  appTheme?: AppTheme;`);
code = code.replace(/humanPlayerId,\n}: GameBoardProps\) => \{/, `humanPlayerId,\n  appTheme,\n}: GameBoardProps) => {`);

fs.writeFileSync('src/components/GameBoard.tsx', code);
