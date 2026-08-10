const formattedPlayers = [
  { id: 0, color: 'purple', isActive: true },
  { id: 1, color: 'red', isActive: true },
  { id: 2, color: 'yellow', isActive: true },
  { id: 3, color: 'orange', isActive: true },
  { id: 4, color: 'blue', isActive: true }
];
const currentIndex = 3;
const visualSequence = ['purple', 'red', 'yellow', 'orange', 'blue', 'green'];
const currentColor = formattedPlayers[currentIndex].color;
const startSeqIndex = visualSequence.indexOf(currentColor);

for (let i = 1; i <= visualSequence.length; i++) {
  const checkSeqIdx = (startSeqIndex + i) % visualSequence.length;
  const targetColor = visualSequence[checkSeqIdx];
  const targetPlayer = formattedPlayers.find((p) => p.color === targetColor);

  if (targetPlayer && targetPlayer.isActive !== false) {
    console.log('Returned ID:', targetPlayer.id);
    break;
  }
}
