const fs = require('fs');
let code = fs.readFileSync('src/components/GameBoard.tsx', 'utf8');

const tokenRenderRegex = /\{\/\* Token Main Body Ring \*\/\}[\s\S]*?fill="rgba\(255, 255, 255, 0\.8\)"\s*\/>/;

const newTokenRender = `
              {appTheme === 'sugar' ? (
                <>
                  {/* Wrapper tails */}
                  <path d="M -15 0 L -24 -10 L -24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  <path d="M 15 0 L 24 -10 L 24 10 Z" fill={COLOR_HEX[token.color]} opacity="0.9" />
                  {/* Candy Body */}
                  <circle
                    cx={0}
                    cy={0}
                    r={16}
                    fill={COLOR_HEX[token.color]}
                    stroke="rgba(255,255,255,0.9)"
                    strokeWidth="3"
                    filter="drop-shadow(0px 3px 4px var(--shadow-color))"
                  />
                  {/* Swirl/Stripes */}
                  <circle cx={0} cy={0} r={8} fill="rgba(255,255,255,0.45)" />
                  <circle cx={-4} cy={-4} r={3} fill="rgba(255,255,255,0.8)" />
                </>
              ) : (
                <>
                  {/* Token Main Body Ring */}
                  <circle
                    cx={0}
                    cy={0}
                    r={16}
                    fill={\`url(#token-\${token.color}-grad)\`}
                    stroke="var(--color-border)"
                    strokeWidth="2"
                    filter="drop-shadow(0px 2px 3px rgba(0,0,0,0.4))"
                  />
                  <circle
                    cx={0}
                    cy={0}
                    r={10}
                    fill="var(--bg-panel)"
                    stroke="rgba(255, 255, 255, 0.3)"
                    strokeWidth="1.5"
                  />
                  {/* Inner Dot */}
                  <circle
                    cx={0}
                    cy={0}
                    r={5}
                    fill={\`url(#token-\${token.color}-grad)\`}
                  />
                  {/* Glare */}
                  <circle
                    cx={-5}
                    cy={-5}
                    r={2.5}
                    fill="rgba(255, 255, 255, 0.8)"
                  />
                </>
              )}
`;

code = code.replace(tokenRenderRegex, newTokenRender.trim());
fs.writeFileSync('src/components/GameBoard.tsx', code);
