import React, { useState, useEffect } from 'react';
import { Player, PlayerColor } from '../types';

interface PlayerCornerProps {
  player: Player;
  position: 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right' | 'mid-left' | 'mid-right';
  isActiveTurn: boolean;
  isHumanTurnToRoll: boolean;
  isRolling: boolean;
  hasRolled: boolean;
  diceValues: [number, number] | null;
  remainingMoves: number[];
  onRollDice: () => void;
  timer: number;
}

export const PlayerCorner: React.FC<PlayerCornerProps> = ({
  player,
  position,
  isActiveTurn,
  isHumanTurnToRoll,
  isRolling,
  hasRolled,
  diceValues,
  remainingMoves,
  onRollDice,
  timer,
}) => {
  const [activeMenu, setActiveMenu] = useState<'emoji' | 'chat' | null>(null);
  const [currentMessage, setCurrentMessage] = useState<string | null>(null);

  useEffect(() => {
    if (currentMessage) {
      const msgTimer = setTimeout(() => {
        setCurrentMessage(null);
      }, 3500);
      return () => clearTimeout(msgTimer);
    }
  }, [currentMessage]);

  const isLeft = position.includes('left');
  const isBottom = position.includes('bottom');
  
  // Mapping
  const bgColors: Record<string, string> = {
    red: 'bg-p-red',
    green: 'bg-[var(--color-p-green)]',
    blue: 'bg-[var(--color-p-blue)]',
    yellow: 'bg-[var(--color-p-yellow)]',
    purple: 'bg-purple-500',
    orange: 'bg-orange-500',
    cyan: 'bg-cyan-400',
    magenta: 'bg-rose-500'
  };

  const ringColors: Record<string, string> = {
    red: 'ring-[#f43f5e] shadow-[0_0_20px_#f43f5e]',
    green: 'ring-[#4ade80] shadow-[0_0_20px_#4ade80]',
    blue: 'ring-[#38bdf8] shadow-[0_0_20px_#38bdf8]',
    yellow: 'ring-[#facc15] shadow-[0_0_20px_#facc15]',
    purple: 'ring-[#d946ef] shadow-[0_0_20px_#d946ef]',
    orange: 'ring-[#f97316] shadow-[0_0_20px_#f97316]',
    cyan: 'ring-[#22d3ee] shadow-[0_0_20px_#22d3ee]',
    magenta: 'ring-[#f43f5e] shadow-[0_0_20px_#f43f5e]',
  };

  const renderDiceDots = (value: number, color: string) => {
    const isDarkDots = color === 'yellow';
    const dotColor = isDarkDots ? 'bg-gray-800' : 'bg-white';

    const dotPositions: Record<number, string[]> = {
      1: ['col-start-2 row-start-2'],
      2: ['col-start-1 row-start-1', 'col-start-3 row-start-3'],
      3: ['col-start-1 row-start-1', 'col-start-2 row-start-2', 'col-start-3 row-start-3'],
      4: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      5: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-2 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
      6: ['col-start-1 row-start-1', 'col-start-3 row-start-1', 'col-start-1 row-start-2', 'col-start-3 row-start-2', 'col-start-1 row-start-3', 'col-start-3 row-start-3'],
    };

    const activeDots = dotPositions[value] || [];

    return (
      <div className="grid grid-cols-3 grid-rows-3 gap-1 md:gap-1.5 w-10 h-10 md:w-14 md:h-14 p-1.5 md:p-2">
        {activeDots.map((pos, idx) => (
          <div key={idx} className={`w-2 h-2 md:w-2.5 md:h-2.5 rounded-full ${dotColor} ${pos} shadow-inner`} />
        ))}
      </div>
    );
  };

  const isWaitingForRoll = isActiveTurn && isHumanTurnToRoll && !isRolling && !hasRolled;
  const turnGlowStyle = isWaitingForRoll ? `ring-2 animate-pulse ${ringColors[player.color] || ringColors['blue']}` : '';

  // Calculate CSS classes for position
  let posClass = '';
  switch(position) {
    case 'top-left': posClass = 'top-4 md:top-6 left-2 md:left-6'; break;
    case 'top-right': posClass = 'top-4 md:top-6 right-2 md:right-6 flex-row-reverse'; break;
    case 'bottom-left': posClass = 'bottom-10 md:bottom-6 left-2 md:left-6'; break;
    case 'bottom-right': posClass = 'bottom-10 md:bottom-6 right-2 md:right-6 flex-row-reverse'; break;
    case 'mid-left': posClass = 'top-[22%] md:top-1/2 -translate-y-1/2 left-2 md:left-6'; break;
    case 'mid-right': posClass = 'top-[22%] md:top-1/2 -translate-y-1/2 right-2 md:right-6 flex-row-reverse'; break;
  }

  return (
    <div className={`absolute z-40 flex items-center gap-4 ${posClass}`}>
      {/* Avatar Wrapper */}
      <div className="relative flex flex-col items-center">
        {/* Floating Comic Speech/Thought Bubble */}
        {currentMessage && (
          <div className="absolute bottom-[100%] mb-2 z-50 pointer-events-none animate-in fade-in zoom-in slide-in-from-bottom-2 duration-300">
            <div className="relative bg-white text-gray-900 font-extrabold text-xs md:text-sm px-3.5 py-1.5 rounded-2xl shadow-[0_10px_25px_rgba(0,0,0,0.5)] border border-gray-200 whitespace-nowrap flex items-center gap-1.5">
              <span>{currentMessage}</span>
              {/* Speech bubble tail */}
              <div className="absolute -bottom-1.5 left-1/2 -translate-x-1/2 w-0 h-0 border-l-[6px] border-l-transparent border-r-[6px] border-r-transparent border-t-[7px] border-t-white" />
            </div>
          </div>
        )}

        {/* Action Buttons for Human Player */}
        {player.type === 'human' && (
          <div className="relative flex gap-2 mb-2">
             <button 
               onClick={() => setActiveMenu(activeMenu === 'emoji' ? null : 'emoji')}
               className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-2 py-0.5 text-[9px] text-white font-bold backdrop-blur-md transition-all active:scale-95 uppercase"
             >
               Emoji
             </button>
             <button 
               onClick={() => setActiveMenu(activeMenu === 'chat' ? null : 'chat')}
               className="bg-white/10 hover:bg-white/20 border border-white/10 rounded-full px-2 py-0.5 text-[9px] text-white font-bold backdrop-blur-md transition-all active:scale-95 uppercase"
             >
               Chat
             </button>

             {/* Popover Menu */}
             {activeMenu && (
               <>
                 <div className="fixed inset-0 z-40 cursor-default" onClick={() => setActiveMenu(null)} />
                 <div className="absolute bottom-[100%] mb-2 left-0 md:left-1/2 md:-translate-x-1/2 origin-bottom-left md:origin-bottom z-50 animate-in fade-in zoom-in slide-in-from-bottom-2 duration-200 bg-[#0f172a]/95 backdrop-blur-xl border border-white/20 rounded-2xl p-2 shadow-2xl min-w-[170px]">
                   {activeMenu === 'emoji' ? (
                     <div className="flex gap-2 justify-center p-1">
                       {['🤣', '😡', '🥺', '😎', '😴'].map((emoji) => (
                         <button
                           key={emoji}
                           onClick={() => {
                             setCurrentMessage(emoji);
                             setActiveMenu(null);
                           }}
                           className="text-xl md:text-2xl hover:scale-125 transition-transform active:scale-95 p-1 hover:bg-white/10 rounded-xl"
                         >
                           {emoji}
                         </button>
                       ))}
                     </div>
                   ) : (
                     <div className="flex flex-col gap-1 p-1">
                       {[
                         '¡Te tengo en la mira! 🎯',
                         '¡Por favor, no me comas! 🏃',
                         '¡Vaya suerte tienes! 🍀',
                         '¡Juega rápido, me duermo! ⏳',
                         '¡Muy buena jugada! 👏',
                       ].map((phrase) => (
                         <button
                           key={phrase}
                           onClick={() => {
                             setCurrentMessage(phrase);
                             setActiveMenu(null);
                           }}
                           className="text-[10px] md:text-[11px] font-semibold text-white/90 hover:text-white hover:bg-white/15 px-2.5 py-1 rounded-xl text-left transition-all active:scale-95 whitespace-nowrap"
                         >
                           {phrase}
                         </button>
                       ))}
                     </div>
                   )}
                 </div>
               </>
             )}
          </div>
        )}
        
        <div className={`w-14 h-14 md:w-20 md:h-20 rounded-full flex items-center justify-center bg-[oklch(0.12_0.02_285/0.8)] backdrop-blur-md border border-[var(--panel-border,oklch(0.7_0.27_350/0.3))] shadow-lg transition-all duration-300 ${isActiveTurn ? `ring-4 ring-offset-2 ring-offset-[oklch(0.08_0.02_285)] ${ringColors[player.color] || ringColors['blue']} animate-pulse scale-110` : 'opacity-70 grayscale-[0.3]'}`}>
           {/* Simple Avatar Placeholder */}
           <svg className="w-7 h-7 md:w-10 md:h-10 text-white opacity-80" viewBox="0 0 24 24" fill="currentColor">
              <path d="M12 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm0 2c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z"/>
           </svg>
           {isActiveTurn && timer > 0 && (
              <div className="absolute -bottom-1 -right-1 md:-bottom-2 md:-right-2 bg-black border border-white/20 text-white text-[9px] md:text-xs font-bold rounded-full w-5 h-5 md:w-7 md:h-7 flex items-center justify-center shadow-lg">
                {timer}
              </div>
           )}
        </div>
        <span className={`text-[10px] md:text-xs mt-2 font-bold font-mono tracking-wider drop-shadow-md ${isActiveTurn ? 'text-white' : 'text-white/60'}`}>
          {player.name}
        </span>
      </div>

      {/* Itinerant Dice */}
      {isActiveTurn && (
        <div className="flex items-center gap-2">
          {[0, 1].map((dieIdx) => {
            const hasBeenUsed = diceValues !== null && !remainingMoves.includes(diceValues[dieIdx]);
            let isUsed = false;
            if (diceValues) {
               const rolledCount = diceValues.filter((v, i) => v === diceValues[dieIdx] && i <= dieIdx).length;
               const remainingCount = remainingMoves.filter(v => v === diceValues[dieIdx]).length;
               isUsed = rolledCount > remainingCount;
            }

            return (
              <div
                key={dieIdx}
                onClick={() => isHumanTurnToRoll && !isRolling && !hasRolled && onRollDice()}
                className={`w-10 h-10 md:w-14 md:h-14 rounded-xl md:rounded-2xl flex items-center justify-center transition-all duration-300 relative ${isUsed ? 'opacity-30 grayscale scale-90' : ''} ${
                  isWaitingForRoll
                    ? `cursor-pointer hover:scale-105 active:scale-95 border border-border ${turnGlowStyle}`
                    : 'shadow-md border border-border'
                } ${isRolling ? 'animate-spin' : ''} ${bgColors[player.color] || bgColors['blue']}`}
              >
                { diceValues !== null ? (
                  renderDiceDots(diceValues[dieIdx], player.color)
                ) : (
                  <span className="text-white/60 font-bold text-lg font-mono">?</span>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
};
