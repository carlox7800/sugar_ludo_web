const fs = require('fs');
let code = fs.readFileSync('src/components/GameControls.tsx', 'utf8');

// Add theme props
code = code.replace(/interface GameControlsProps {/, `import { AppTheme } from '../types';\ninterface GameControlsProps {\n  appTheme?: AppTheme;\n  setAppTheme?: (theme: AppTheme) => void;`);

// Add them to destructured props
code = code.replace(/isGlowActive,\n}: GameControlsProps\) => {/, `isGlowActive,\n  appTheme,\n  setAppTheme,\n}: GameControlsProps) => {`);

// Add theme selector in the setup screen
const themeSelectorHTML = `
        {/* Theme Selection */}
        <div className="flex flex-col gap-2">
          <label className="text-xs font-bold uppercase tracking-wider text-t-muted">Apariencia Visual (Tema)</label>
          <div className="grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => setAppTheme?.('dark')}
              className={\`py-2 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 \${
                appTheme === 'dark'
                  ? 'border-p-blue bg-[#00f2ff]/10 text-p-blue shadow-[0_0_15px_rgba(0,242,255,0.15)]'
                  : 'border-border text-t-muted hover:bg-panel hover:text-t-primary'
              }\`}
            >
              <div className="w-4 h-4 rounded-full bg-[#0a0a0f] border border-[#2d2d35]" />
              Dark (Clásico)
            </button>
            <button
              type="button"
              onClick={() => setAppTheme?.('sugar')}
              className={\`py-2 px-4 rounded-xl border-2 font-bold text-sm transition-all duration-200 cursor-pointer flex items-center justify-center gap-2 \${
                appTheme === 'sugar'
                  ? 'border-pink-400 bg-pink-400/10 text-pink-500 shadow-[0_0_15px_rgba(244,114,182,0.15)]'
                  : 'border-border text-t-muted hover:bg-panel hover:text-t-primary'
              }\`}
            >
              <div className="w-4 h-4 rounded-full bg-gradient-to-br from-pink-300 to-purple-400" />
              Sugar (Dulce)
            </button>
          </div>
        </div>
`;

code = code.replace(/\{\/\* 2\. Human Color Selection \*\/\}/, themeSelectorHTML + '\n        {/* 2. Human Color Selection */}');

// Adjust the subtitle
code = code.replace(/Edición Clásica Premium \/\/ Elegant Dark/, 'Edición Clásica Premium');

fs.writeFileSync('src/components/GameControls.tsx', code);
