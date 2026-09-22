let sharedContext: AudioContext | null = null;

export function playAlertBeep() {
  try {
    if (!sharedContext) sharedContext = new AudioContext();
    if (sharedContext.state === "suspended") sharedContext.resume();

    const oscillator = sharedContext.createOscillator();
    const gain = sharedContext.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = 880;
    gain.gain.setValueAtTime(0.001, sharedContext.currentTime);
    gain.gain.exponentialRampToValueAtTime(0.15, sharedContext.currentTime + 0.02);
    gain.gain.exponentialRampToValueAtTime(0.001, sharedContext.currentTime + 0.4);
    oscillator.connect(gain);
    gain.connect(sharedContext.destination);
    oscillator.start();
    oscillator.stop(sharedContext.currentTime + 0.4);
  } catch {
    // navegador bloqueou áudio automático (sem interação do usuário ainda); ignora
  }
}
