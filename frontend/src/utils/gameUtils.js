export function pickTarget(list) {
  return list[Math.floor(Math.random() * list.length)];
}

export function generateShareText(attempts, attributes, gameName, dayNumber, maxAttempts) {
  const isWon = attempts.some(a => a.isCorrect);
  const count = isWon ? attempts.length : 'X';
  const grid = [...attempts].reverse().map(attempt =>
    attributes.map(attr => {
      const fb = attempt.feedback[attr.key];
      if (fb?.type === 'correct') return '🟩';
      if (fb?.type === 'close') return '🟨';
      return '⬛';
    }).join('')
  ).join('\n');
  return `Mangadle - ${gameName} #${dayNumber}\n${count}/${maxAttempts}\n\n${grid}`;
}
