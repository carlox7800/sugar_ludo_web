const fs = require('fs');
let code = fs.readFileSync('components/ai-training.tsx', 'utf-8');

code = code.replace(
  "import { cn } from '@/lib/utils'",
  "import { cn } from '@/lib/utils'\nimport { GameConfig } from '@/src/types'"
);

code = code.replace(
  "export function AiTraining({ onBack }: { onBack: () => void }) {",
  "export function AiTraining({ onBack, onStartGame }: { onBack: () => void, onStartGame: (config: GameConfig) => void }) {"
);

code = code.replace(
  "const [muted, setMuted] = useState(false)",
  `const [muted, setMuted] = useState(false)

  const handleStart = () => {
    onStartGame({
      playerCount: players,
      botDifficulty: difficulty === 'facil' ? 'easy' : difficulty === 'medio' ? 'medium' : 'hard',
      humanColor: 'yellow',
      mode: 'ai'
    })
  }`
);

code = code.replace(
  "<button className=\"btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.78_0.2_150),oklch(0.72_0.18_160))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.18_0.03_285)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_14px_26px_oklch(0.5_0.14_155/0.55)]\">",
  "<button onClick={handleStart} className=\"btn-3d flex w-full items-center justify-center gap-3 rounded-2xl bg-[linear-gradient(145deg,oklch(0.78_0.2_150),oklch(0.72_0.18_160))] py-4 font-display text-lg font-extrabold uppercase tracking-wide text-[oklch(0.18_0.03_285)] shadow-[inset_0_2px_0_oklch(1_0_0/0.5),0_7px_0_oklch(0.5_0.14_155),0_14px_26px_oklch(0.5_0.14_155/0.55)]\">"
);

fs.writeFileSync('components/ai-training.tsx', code);
