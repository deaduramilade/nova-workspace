export type BinauralPreset = 'alpha' | 'theta' | 'delta';

const PRESETS: Record<BinauralPreset, { base: number; beat: number; label: string }> = {
  alpha: { base: 200, beat: 10, label: 'Alpha — relaxed focus (10 Hz)' },
  theta: { base: 200, beat: 6, label: 'Theta — deep calm (6 Hz)' },
  delta: { base: 200, beat: 2, label: 'Delta — rest & recovery (2 Hz)' },
};

export class BinauralEngine {
  private ctx: AudioContext | null = null;
  private oscillators: OscillatorNode[] = [];
  private gainNode: GainNode | null = null;
  private preset: BinauralPreset = 'alpha';

  getPresetLabel() {
    return PRESETS[this.preset].label;
  }

  setPreset(preset: BinauralPreset) {
    this.preset = preset;
    if (this.isPlaying()) {
      this.stop();
      this.start(this.gainNode?.gain.value ?? 0.04);
    }
  }

  isPlaying() {
    return this.oscillators.length > 0;
  }

  async start(volume = 0.04) {
    this.stop();
    try {
      const ctx = new AudioContext();
      await ctx.resume();
      this.ctx = ctx;

      const { base, beat } = PRESETS[this.preset];
      const leftFreq = base;
      const rightFreq = base + beat;

      const masterGain = ctx.createGain();
      masterGain.gain.value = volume;
      masterGain.connect(ctx.destination);
      this.gainNode = masterGain;

      const merger = ctx.createChannelMerger(2);

      const oscLeft = ctx.createOscillator();
      oscLeft.type = 'sine';
      oscLeft.frequency.value = leftFreq;
      const gainLeft = ctx.createGain();
      gainLeft.gain.value = 0.5;
      oscLeft.connect(gainLeft);
      gainLeft.connect(merger, 0, 0);

      const oscRight = ctx.createOscillator();
      oscRight.type = 'sine';
      oscRight.frequency.value = rightFreq;
      const gainRight = ctx.createGain();
      gainRight.gain.value = 0.5;
      oscRight.connect(gainRight);
      gainRight.connect(merger, 0, 1);

      merger.connect(masterGain);

      oscLeft.start();
      oscRight.start();
      this.oscillators = [oscLeft, oscRight];
    } catch {
      this.stop();
    }
  }

  setVolume(volume: number) {
    if (this.gainNode) {
      this.gainNode.gain.value = volume;
    }
  }

  stop() {
    this.oscillators.forEach((osc) => {
      try { osc.stop(); } catch { /* already stopped */ }
    });
    this.oscillators = [];
    this.gainNode = null;
    if (this.ctx) {
      this.ctx.close().catch(() => {});
      this.ctx = null;
    }
  }
}

export { PRESETS as BINAURAL_PRESETS };