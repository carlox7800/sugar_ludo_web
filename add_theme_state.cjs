const fs = require('fs');
let code = fs.readFileSync('src/App.tsx', 'utf8');

// Add import
code = code.replace(/import { Player, Token, GameLog, GameConfig, PlayerColor } from '\.\/types';/, "import { Player, Token, GameLog, GameConfig, PlayerColor, AppTheme } from './types';");

// Add state
code = code.replace(/const \[isPlaying, setIsPlaying\] = useState<boolean>\(false\);/, "const [isPlaying, setIsPlaying] = useState<boolean>(false);\n  const [appTheme, setAppTheme] = useState<AppTheme>('dark');");

// Update top-level div class
code = code.replace(/className="bg-root text-t-primary min-h-screen font-sans overflow-hidden flex flex-col"/, 'className={`bg-root text-t-primary min-h-screen font-sans overflow-hidden flex flex-col ${appTheme === \'sugar\' ? \'theme-sugar\' : \'\'}`}');

fs.writeFileSync('src/App.tsx', code);
