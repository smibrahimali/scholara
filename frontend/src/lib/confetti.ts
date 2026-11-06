import confetti from 'canvas-confetti';

export function fireScholaraConfetti() {
  void confetti({
    particleCount: 64,
    spread: 58,
    startVelocity: 28,
    origin: { y: 0.65 },
    colors: ['#0B1F3A', '#C4A35A', '#F7F1E8', '#1F7A4D'],
    disableForReducedMotion: true,
  });
}
