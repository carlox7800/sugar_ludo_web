import { globalLogger } from '@/lib/logger';

class LudoAudio {
  private ctx: AudioContext | null = null;
  
  // Master Gains
  private musicMasterGain: GainNode | null = null;
  private sfxMasterGain: GainNode | null = null;
  
  // Background Music 100% Web Audio API Buffer (Professional In-Game Audio Graph)
  private bgmBuffer: AudioBuffer | null = null;
  private bgmSourceNode: AudioBufferSourceNode | null = null;
  private isBgmLoading: boolean = false;
  private isBgmPlaying: boolean = false;
  
  // State
  private musicVolume: number = 0.15;
  private sfxVolume: number = 1.0;
  private isMuted: boolean = false;
  private turnAlertInterval: number | null = null;

  private init() {
    if (!this.ctx && typeof window !== 'undefined') {
      const AudioCtx = window.AudioContext || (window as any).webkitAudioContext;
      if (AudioCtx) {
        this.ctx = new AudioCtx();
        
        // Initialize Master Gains
        this.musicMasterGain = this.ctx.createGain();
        this.sfxMasterGain = this.ctx.createGain();
        
        this.musicMasterGain.connect(this.ctx.destination);
        this.sfxMasterGain.connect(this.ctx.destination);
        
        this.updateGains();
      }
    }
    if (this.ctx && this.ctx.state === 'suspended') {
      this.ctx.resume();
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }
  }

  public setVolumes(musicVol: number, sfxVol: number, muted: boolean) {
    this.musicVolume = musicVol;
    this.sfxVolume = sfxVol;
    this.isMuted = muted;
    this.updateGains();
  }

  private updateGains() {
    if (!this.ctx || !this.musicMasterGain || !this.sfxMasterGain) return;
    const perceivedMusicVolume = Math.pow(this.musicVolume, 2);
    const perceivedSfxVolume = Math.pow(this.sfxVolume, 2);
    const targetMusicGain = this.isMuted ? 0 : perceivedMusicVolume;
    const targetSfxGain = this.isMuted ? 0 : perceivedSfxVolume;

    const t = this.ctx.currentTime;
    // Smooth transition
    this.musicMasterGain.gain.setTargetAtTime(targetMusicGain, t, 0.05);
    this.sfxMasterGain.gain.setTargetAtTime(targetSfxGain, t, 0.05);
  }

  private async loadBgmBuffer(): Promise<AudioBuffer | null> {
    if (this.bgmBuffer) return this.bgmBuffer;
    if (!this.ctx || this.isBgmLoading) return null;

    this.isBgmLoading = true;
    try {
      const response = await fetch('/tam-lin.audio');
      const arrayBuffer = await response.arrayBuffer();
      this.bgmBuffer = await this.ctx.decodeAudioData(arrayBuffer);
      return this.bgmBuffer;
    } catch (err) {
      console.warn('LudoAudio: Error decoding BGM buffer', err);
      return null;
    } finally {
      this.isBgmLoading = false;
    }
  }

  /**
   * Sound 0: Background Music (Tam Lin)
   * 100% Web Audio API AudioBufferSourceNode - Zero OS MediaSession / Notification widgets
   */
  public async playBackgroundMusic(isPlaying: boolean) {
    this.init();
    if (!this.ctx || !this.musicMasterGain) return;

    if (isPlaying) {
      if (this.isBgmPlaying && this.bgmSourceNode) {
        return;
      }
      this.isBgmPlaying = true;

      const buffer = await this.loadBgmBuffer();
      if (!buffer || !this.isBgmPlaying) return;

      // Stop previous source if any
      if (this.bgmSourceNode) {
        try {
          this.bgmSourceNode.stop();
          this.bgmSourceNode.disconnect();
        } catch {}
      }

      this.bgmSourceNode = this.ctx.createBufferSource();
      this.bgmSourceNode.buffer = buffer;
      this.bgmSourceNode.loop = true;
      this.bgmSourceNode.connect(this.musicMasterGain);

      try {
        this.bgmSourceNode.start(0);
      } catch (err) {
        console.warn('LudoAudio: Failed to start BGM buffer source', err);
      }

      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch {}
      }
    } else {
      this.isBgmPlaying = false;
      if (this.bgmSourceNode) {
        try {
          this.bgmSourceNode.stop();
          this.bgmSourceNode.disconnect();
        } catch {}
        this.bgmSourceNode = null;
      }
      if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
        try {
          navigator.mediaSession.playbackState = 'none';
        } catch {}
      }
    }
  }

  // White noise generator helper
  private createNoiseBuffer(): AudioBuffer {
    if (!this.ctx) throw new Error('AudioContext not initialized');
    const bufferSize = this.ctx.sampleRate * 0.15; // 150ms of noise
    const buffer = this.ctx.createBuffer(1, bufferSize, this.ctx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
      data[i] = Math.random() * 2 - 1;
    }
    return buffer;
  }

  /**
   * Sound 1: Dice Roll (Dice Roll)
   * A short dry thud combining 220Hz and 440Hz sine waves with rapid exponential decay
   * mixed with light white noise to simulate wooden impact.
   * Plays a quick succession of 3 tiny bounces to sound like rolling.
   */
  public playDiceRoll() {
    this.init();
    if (!this.ctx) return;

    const playSingleBounce = (delay: number, volumeFactor: number) => {
      if (!this.ctx) return;
      const t = this.ctx.currentTime + delay;

      // Oscillators: 220Hz and 440Hz
      const osc1 = this.ctx.createOscillator();
      const osc2 = this.ctx.createOscillator();
      const oscGain = this.ctx.createGain();

      osc1.type = 'sine';
      osc1.frequency.setValueAtTime(220, t);
      
      osc2.type = 'sine';
      osc2.frequency.setValueAtTime(440, t);

      // White Noise
      const noise = this.ctx.createBufferSource();
      noise.buffer = this.createNoiseBuffer();
      const noiseFilter = this.ctx.createBiquadFilter();
      noiseFilter.type = 'bandpass';
      noiseFilter.frequency.setValueAtTime(600, t);
      noiseFilter.Q.setValueAtTime(2, t);

      const noiseGain = this.ctx.createGain();

      // Connections
      osc1.connect(oscGain);
      osc2.connect(oscGain);
      noise.connect(noiseFilter);
      noiseFilter.connect(noiseGain);

      const masterGain = this.ctx.createGain();
      oscGain.connect(masterGain);
      noiseGain.connect(masterGain);
      if (this.sfxMasterGain) masterGain.connect(this.sfxMasterGain);

      // Volume Envelopes
      const duration = 0.08 * volumeFactor; // faster for smaller bounces
      masterGain.gain.setValueAtTime(0, t);
      masterGain.gain.linearRampToValueAtTime(0.3 * volumeFactor, t + 0.002);
      masterGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      // Low frequency woodiness
      oscGain.gain.setValueAtTime(0.2, t);
      oscGain.gain.exponentialRampToValueAtTime(0.001, t + duration);

      // Noise high-frequency click/rustle
      noiseGain.gain.setValueAtTime(0.15, t);
      noiseGain.gain.exponentialRampToValueAtTime(0.001, t + duration * 0.5);

      osc1.start(t);
      osc2.start(t);
      noise.start(t);

      osc1.stop(t + duration);
      osc2.stop(t + duration);
      noise.stop(t + duration);
    };

    // Simulate dice rolling with 3-4 consecutive bounces
    playSingleBounce(0, 1.0);
    playSingleBounce(0.08, 0.7);
    playSingleBounce(0.15, 0.45);
    playSingleBounce(0.21, 0.3);
  }

  /**
   * Sound 2: Step Sound (Paso de Fichas)
   * High freq contact click (750Hz, 1150Hz, exponential decay 15ms)
   * + Low frequency woodblock body resonance (190Hz, 340Hz, decay 120ms).
   */
  public playStep() {
    this.init();
    if (!this.ctx) return;

    // Look-ahead buffer to avoid main thread render jitter
    const t = this.ctx.currentTime + 0.015;

    // Contact Click Nodes
    const clickOsc1 = this.ctx.createOscillator();
    const clickOsc2 = this.ctx.createOscillator();
    const clickGain = this.ctx.createGain();

    clickOsc1.type = 'sine';
    clickOsc1.frequency.setValueAtTime(750, t);
    clickOsc2.type = 'sine';
    clickOsc2.frequency.setValueAtTime(1150, t);

    clickOsc1.connect(clickGain);
    clickOsc2.connect(clickGain);

    // Body Resonance Nodes
    const bodyOsc1 = this.ctx.createOscillator();
    const bodyOsc2 = this.ctx.createOscillator();
    const bodyGain = this.ctx.createGain();

    bodyOsc1.type = 'triangle';
    bodyOsc1.frequency.setValueAtTime(190, t);
    bodyOsc2.type = 'sine';
    bodyOsc2.frequency.setValueAtTime(340, t);

    bodyOsc1.connect(bodyGain);
    bodyOsc2.connect(bodyGain);

    // Mixer
    const masterGain = this.ctx.createGain();
    clickGain.connect(masterGain);
    bodyGain.connect(masterGain);
    if (this.sfxMasterGain) masterGain.connect(this.sfxMasterGain);

    // Click envelope: extremely fast decay
    clickGain.gain.setValueAtTime(0, t);
    clickGain.gain.linearRampToValueAtTime(0.25, t + 0.001);
    clickGain.gain.exponentialRampToValueAtTime(0.001, t + 0.015);

    // Body envelope: medium woody decay
    bodyGain.gain.setValueAtTime(0, t);
    bodyGain.gain.linearRampToValueAtTime(0.35, t + 0.003);
    bodyGain.gain.exponentialRampToValueAtTime(0.001, t + 0.12);

    // Master volume
    masterGain.gain.setValueAtTime(0.4, t);

    // Start & Stop
    clickOsc1.start(t);
    clickOsc2.start(t);
    bodyOsc1.start(t);
    bodyOsc2.start(t);

    clickOsc1.stop(t + 0.15);
    clickOsc2.stop(t + 0.15);
    bodyOsc1.stop(t + 0.15);
    bodyOsc2.stop(t + 0.15);
  }

  /**
   * Sound 3: Turn Alert (Alerta de Turno de Jugador)
   * Harmonic double bell (880.00Hz and 1109.73Hz)
   * 1ms attack, 400ms exponential decay.
   */
  public playTurnAlert() {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Frequencies
    const f1 = 880.00; // A5
    const f2 = 1109.73; // C#6

    const osc1 = this.ctx.createOscillator();
    const osc2 = this.ctx.createOscillator();
    const subOsc = this.ctx.createOscillator(); // lower pure tone to add warmth
    
    // Add bright chime harmonics
    const osc1Harmonic = this.ctx.createOscillator();
    
    osc1.frequency.setValueAtTime(f1, t);
    osc2.frequency.setValueAtTime(f2, t);
    subOsc.frequency.setValueAtTime(f1 / 2, t); // 440Hz
    osc1Harmonic.frequency.setValueAtTime(f1 * 2, t); // 1760Hz

    // Gains
    const g1 = this.ctx.createGain();
    const g2 = this.ctx.createGain();
    const gSub = this.ctx.createGain();
    const gHarm = this.ctx.createGain();
    
    osc1.connect(g1);
    osc2.connect(g2);
    subOsc.connect(gSub);
    osc1Harmonic.connect(gHarm);

    const masterGain = this.ctx.createGain();
    g1.connect(masterGain);
    g2.connect(masterGain);
    gSub.connect(masterGain);
    gHarm.connect(masterGain);
    
    if (this.sfxMasterGain) masterGain.connect(this.sfxMasterGain);

    // Setup envelopes: 1ms attack, 400ms exponential decay
    const attack = 0.001;
    const decay = 0.4;

    masterGain.gain.setValueAtTime(0, t);
    masterGain.gain.linearRampToValueAtTime(0.35, t + attack);
    masterGain.gain.exponentialRampToValueAtTime(0.001, t + decay);

    // Set individual oscillator ratios
    g1.gain.setValueAtTime(0.4, t);
    g2.gain.setValueAtTime(0.4, t);
    gSub.gain.setValueAtTime(0.15, t);
    gHarm.gain.setValueAtTime(0.08, t);

    osc1.start(t);
    osc2.start(t);
    subOsc.start(t);
    osc1Harmonic.start(t);

    osc1.stop(t + decay + 0.1);
    osc2.stop(t + decay + 0.1);
    subOsc.stop(t + decay + 0.1);
    osc1Harmonic.stop(t + decay + 0.1);
  }

  public startTurnAlertLoop() {
    if (this.turnAlertInterval !== null) return;
    this.playTurnAlert();
    this.turnAlertInterval = window.setInterval(() => {
      this.playTurnAlert();
    }, 1500);
  }

  public stopTurnAlertLoop() {
    if (this.turnAlertInterval !== null) {
      clearInterval(this.turnAlertInterval);
      this.turnAlertInterval = null;
    }
  }

  public stopAll() {
    this.stopTurnAlertLoop();
    this.isBgmPlaying = false;
    if (this.bgmSourceNode) {
      try {
        this.bgmSourceNode.stop();
        this.bgmSourceNode.disconnect();
      } catch {}
      this.bgmSourceNode = null;
    }
    if (typeof navigator !== 'undefined' && 'mediaSession' in navigator) {
      try {
        navigator.mediaSession.playbackState = 'none';
      } catch {}
    }
  }

  /**
   * Sound 4: Fireworks (Ficha capturada o expulsada)
   * Mystic harmonic chime mixed with high-freq spark crackles.
   */
  public playFireworks() {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;

    // Harmonic Minor Chord for mystic feel
    const freqs = [329.63, 392.00, 493.88, 659.25]; // E4, G4, B4, E5 (E Minor)
    freqs.forEach((freq, idx) => {
      if (!this.ctx) return;
      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      
      const gain = this.ctx.createGain();
      gain.gain.setValueAtTime(0, t);
      gain.gain.linearRampToValueAtTime(0.2, t + 0.05);
      gain.gain.exponentialRampToValueAtTime(0.001, t + 0.8 + idx * 0.1);

      osc.connect(gain);
      if (this.sfxMasterGain) gain.connect(this.sfxMasterGain);
      
      osc.start(t);
      osc.stop(t + 1.5);
    });

    // High frequency sparks (mini crackles)
    for (let i = 0; i < 6; i++) {
      const sparkDelay = i * 0.08 + Math.random() * 0.05;
      const sparkT = t + sparkDelay;

      const spark = this.ctx.createOscillator();
      spark.type = 'square';
      spark.frequency.setValueAtTime(2000 + Math.random() * 3000, sparkT); // 2kHz - 5kHz
      
      const filter = this.ctx.createBiquadFilter();
      filter.type = 'highpass';
      filter.frequency.setValueAtTime(3000, sparkT);

      const sparkGain = this.ctx.createGain();
      sparkGain.gain.setValueAtTime(0, sparkT);
      sparkGain.gain.linearRampToValueAtTime(0.05, sparkT + 0.01);
      sparkGain.gain.exponentialRampToValueAtTime(0.001, sparkT + 0.1);

      spark.connect(filter);
      filter.connect(sparkGain);
      if (this.sfxMasterGain) sparkGain.connect(this.sfxMasterGain);

      spark.start(sparkT);
      spark.stop(sparkT + 0.15);
    }
  }

  /**
   * Sound 5: Goal / Success (Ficha entra a la meta)
   * A beautiful ascending major scale chime arpeggio.
   */
  public playGoal() {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    const notes = [523.25, 659.25, 783.99, 1046.50]; // C5, E5, G5, C6

    notes.forEach((freq, index) => {
      if (!this.ctx) return;
      const noteTime = t + index * 0.08;

      const osc = this.ctx.createOscillator();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      // Add a bright harmonic
      const harm = this.ctx.createOscillator();
      harm.type = 'sine';
      harm.frequency.setValueAtTime(freq * 2, noteTime);

      const oscGain = this.ctx.createGain();
      const harmGain = this.ctx.createGain();
      const noteGain = this.ctx.createGain();

      osc.connect(oscGain);
      harm.connect(harmGain);
      oscGain.connect(noteGain);
      harmGain.connect(noteGain);
      if (this.sfxMasterGain) noteGain.connect(this.sfxMasterGain);

      oscGain.gain.setValueAtTime(0.3, noteTime);
      harmGain.gain.setValueAtTime(0.1, noteTime);

      noteGain.gain.setValueAtTime(0, noteTime);
      noteGain.gain.linearRampToValueAtTime(0.2, noteTime + 0.002);
      noteGain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.25);

      osc.start(noteTime);
      harm.start(noteTime);
      osc.stop(noteTime + 0.3);
      harm.stop(noteTime + 0.3);
    });
  }

  /**
   * Sound 6: Victory Fanfare (Ganador)
   * Triumphant full chord chime and bells.
   */
  public playVictory() {
    this.init();
    if (!this.ctx) return;

    const t = this.ctx.currentTime;
    // C Major Arpeggio with double roots
    const rootNotes = [261.63, 329.63, 392.00, 523.25, 659.25, 783.99, 1046.50];
    
    rootNotes.forEach((freq, index) => {
      if (!this.ctx) return;
      const noteDelay = index * 0.06;
      const noteTime = t + noteDelay;

      const osc = this.ctx.createOscillator();
      osc.type = index % 2 === 0 ? 'triangle' : 'sine';
      osc.frequency.setValueAtTime(freq, noteTime);

      const gain = this.ctx.createGain();
      osc.connect(gain);
      if (this.sfxMasterGain) gain.connect(this.sfxMasterGain);

      gain.gain.setValueAtTime(0, noteTime);
      gain.gain.linearRampToValueAtTime(0.15, noteTime + 0.01);
      gain.gain.exponentialRampToValueAtTime(0.001, noteTime + 0.6);

      osc.start(noteTime);
      osc.stop(noteTime + 0.7);
    });
  }
}

export const audio = new LudoAudio();
