import confetti from 'canvas-confetti';

// Fires a one-shot burst from below the viewport shooting straight up.
// Non-blocking: returns immediately while the animation plays.
export function fireEpicDoneConfetti(): void {
  confetti({
    particleCount: 120,
    spread: 70,
    startVelocity: 55,
    origin: { x: 0.5, y: 1.05 },
    angle: 90,
    ticks: 250,
    disableForReducedMotion: true,
  });
}
