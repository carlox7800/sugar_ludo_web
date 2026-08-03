const fs = require('fs');
let code = fs.readFileSync('src/GameEngine.tsx', 'utf-8');

// 1. Update export and props
code = code.replace(
  'export default function App() {',
  'export default function GameEngine({ initialConfig, onExit }: { initialConfig: GameConfig, onExit: () => void }) {'
);

// 2. Remove Navigation State currentView
code = code.replace(/const \[currentView, setCurrentView\] = useState<string>\('lobby'\);/g, '');

// 3. Remove isPlaying (or keep it if it's used to show the modal)
// We need to auto start the game on mount
code = code.replace(
  'const [config, setConfig] = useState<GameConfig | null>(null);',
  `const [config, setConfig] = useState<GameConfig | null>(null);\n  useEffect(() => {\n    if (initialConfig && !isPlaying) {\n      handleStartGame(initialConfig);\n    }\n  }, [initialConfig]);`
);

// 4. Remove Lobby rendering
// The rendering starts at `if (['lobby', ...`
const lobbyRenderRegex = /if \(\['lobby', 'store', 'wallet', 'friends', 'events', 'mail', 'collection'\]\.includes\(currentView\)\) \{[\s\S]*?return \([\s\S]*?className=\{`min-h-screen bg-root/g;

// Wait, the regex is too complex to reliably replace this way. Let's find the exact lines.
fs.writeFileSync('src/GameEngine.tsx', code);
