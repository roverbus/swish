const REACTIONS = [
  'For real?',
  'What?',
  'Thank you, next',
  'Whatever',
  'Excuse me?',
  'I can\'t even',
  'Seriously?',
  'Okay then',
];

export class AudioReactor {
  private audioContext: AudioContext | null = null;
  private enabled = true;
  private lastPlayTime = 0;
  private minInterval = 500; // Minimum ms between plays

  setEnabled(enabled: boolean): void {
    this.enabled = enabled;
  }

  async playReaction(): Promise<void> {
    if (!this.enabled) return;

    const now = Date.now();
    if (now - this.lastPlayTime < this.minInterval) return;
    this.lastPlayTime = now;

    const phrase = REACTIONS[Math.floor(Math.random() * REACTIONS.length)];

    // Use Web Speech API for synthesis
    if ('speechSynthesis' in window) {
      const utterance = new SpeechSynthesisUtterance(phrase);
      utterance.rate = 1.1;
      utterance.pitch = 1.0;
      utterance.volume = 0.7;

      // Try to find a good voice
      const voices = speechSynthesis.getVoices();
      const preferredVoice = voices.find(v =>
        v.name.includes('Samantha') ||
        v.name.includes('Google US English') ||
        v.name.includes('Microsoft Zira') ||
        v.lang.startsWith('en')
      );

      if (preferredVoice) {
        utterance.voice = preferredVoice;
      }

      speechSynthesis.speak(utterance);
    } else {
      // Fallback: simple beep using Web Audio API
      await this.playBeep();
    }
  }

  private async playBeep(): Promise<void> {
    if (!this.audioContext) {
      this.audioContext = new AudioContext();
    }

    const oscillator = this.audioContext.createOscillator();
    const gainNode = this.audioContext.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(this.audioContext.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, this.audioContext.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, this.audioContext.currentTime + 0.2);

    oscillator.start(this.audioContext.currentTime);
    oscillator.stop(this.audioContext.currentTime + 0.2);
  }

  destroy(): void {
    if (this.audioContext) {
      this.audioContext.close();
      this.audioContext = null;
    }
  }
}
