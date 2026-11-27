import { VesselType } from '../types/virtualLab';
import { soundFx } from './audio';

export interface SpatialCoords {
  /** Normalized horizontal stereo position from -1 (far left) to +1 (far right) */
  pan: number;
  /** Normalized vertical offset from -0.5 (bottom) to +0.5 (top) */
  elevation: number;
  /** Normalized distance factor from center (0 = center, 1 = far edge) */
  distance: number;
}

interface VesselAcousticProfile {
  baseFreq: number;
  overtoneRatio: number;
  decaySec: number;
  qFactor: number;
  material: 'borosilicate' | 'porcelain';
  bodyWarmth: number;
}

const VESSEL_ACOUSTICS: Record<VesselType, VesselAcousticProfile> = {
  beaker_250_open: {
    baseFreq: 540,
    overtoneRatio: 2.34,
    decaySec: 0.13,
    qFactor: 14,
    material: 'borosilicate',
    bodyWarmth: 0.35,
  },
  beaker_250: {
    baseFreq: 540,
    overtoneRatio: 2.34,
    decaySec: 0.13,
    qFactor: 14,
    material: 'borosilicate',
    bodyWarmth: 0.35,
  },
  beaker_250_closed: {
    baseFreq: 485,
    overtoneRatio: 2.15,
    decaySec: 0.095,
    qFactor: 10,
    material: 'borosilicate',
    bodyWarmth: 0.45,
  },
  beaker_500: {
    baseFreq: 410,
    overtoneRatio: 2.28,
    decaySec: 0.16,
    qFactor: 15,
    material: 'borosilicate',
    bodyWarmth: 0.45,
  },
  erlenmeyer_250: {
    baseFreq: 435,
    overtoneRatio: 2.48,
    decaySec: 0.15,
    qFactor: 16,
    material: 'borosilicate',
    bodyWarmth: 0.5,
  },
  round_bottom_250: {
    baseFreq: 395,
    overtoneRatio: 2.52,
    decaySec: 0.165,
    qFactor: 17,
    material: 'borosilicate',
    bodyWarmth: 0.52,
  },
  volumetric_250: {
    baseFreq: 460,
    overtoneRatio: 2.55,
    decaySec: 0.14,
    qFactor: 16,
    material: 'borosilicate',
    bodyWarmth: 0.46,
  },
  florence_500: {
    baseFreq: 350,
    overtoneRatio: 2.45,
    decaySec: 0.175,
    qFactor: 16,
    material: 'borosilicate',
    bodyWarmth: 0.58,
  },
  test_tube_50: {
    baseFreq: 1180,
    overtoneRatio: 2.58,
    decaySec: 0.11,
    qFactor: 18,
    material: 'borosilicate',
    bodyWarmth: 0.15,
  },
  graduated_100: {
    baseFreq: 810,
    overtoneRatio: 2.42,
    decaySec: 0.125,
    qFactor: 15,
    material: 'borosilicate',
    bodyWarmth: 0.25,
  },
  burette_50: {
    baseFreq: 1320,
    overtoneRatio: 2.65,
    decaySec: 0.095,
    qFactor: 19,
    material: 'borosilicate',
    bodyWarmth: 0.12,
  },
  separatory_250: {
    baseFreq: 515,
    overtoneRatio: 2.44,
    decaySec: 0.135,
    qFactor: 15,
    material: 'borosilicate',
    bodyWarmth: 0.4,
  },
  evaporating_dish: {
    baseFreq: 365,
    overtoneRatio: 1.62,
    decaySec: 0.065,
    qFactor: 7,
    material: 'porcelain',
    bodyWarmth: 0.65,
  },
  crucible_50: {
    baseFreq: 690,
    overtoneRatio: 1.54,
    decaySec: 0.055,
    qFactor: 6,
    material: 'porcelain',
    bodyWarmth: 0.55,
  },
  petri_dish_50: {
    baseFreq: 620,
    overtoneRatio: 2.18,
    decaySec: 0.09,
    qFactor: 12,
    material: 'borosilicate',
    bodyWarmth: 0.3,
  },
};

export function computeVesselSpatialCoords(
  vesselEl: HTMLElement | null | undefined,
  benchEl: HTMLElement | null | undefined,
  index: number,
  total: number
): SpatialCoords {
  if (vesselEl && benchEl) {
    const vRect = vesselEl.getBoundingClientRect();
    const bRect = benchEl.getBoundingClientRect();
    if (bRect.width > 40 && vRect.width > 0) {
      const vCenterX = vRect.left + vRect.width * 0.5;
      const bCenterX = bRect.left + bRect.width * 0.5;
      const rawPan = (vCenterX - bCenterX) / Math.max(120, bRect.width * 0.44);
      const pan = Math.max(-0.88, Math.min(0.88, rawPan));

      const vCenterY = vRect.top + vRect.height * 0.5;
      const bCenterY = bRect.top + bRect.height * 0.5;
      const rawEl = (bCenterY - vCenterY) / Math.max(120, bRect.height * 0.5);
      const elevation = Math.max(-0.45, Math.min(0.45, rawEl));
      const distance = Math.min(1, Math.hypot(pan, elevation * 0.6));
      return { pan, elevation, distance };
    }
  }

  if (total <= 1) {
    return { pan: 0, elevation: 0, distance: 0 };
  }
  const normalized = (index + 0.5) / total;
  const pan = Math.max(-0.78, Math.min(0.78, (normalized * 2 - 1) * 0.85));
  return { pan, elevation: 0, distance: Math.abs(pan) * 0.65 };
}

class SpatialLabAudioEngine {
  private masterGain: GainNode | null = null;
  private dryBus: GainNode | null = null;
  private roomBus: GainNode | null = null;
  private noiseBuffer: AudioBuffer | null = null;
  private connectedCtx: AudioContext | null = null;
  private lastHoverAt: Map<string, number> = new Map();

  public spatialEnabled: boolean = true;
  public hapticsEnabled: boolean = true;

  private isAudioActive(): boolean {
    return soundFx.enabled && this.spatialEnabled;
  }

  public triggerHaptic(pattern: number | number[]) {
    if (!this.hapticsEnabled) return;
    if (typeof navigator !== 'undefined' && typeof navigator.vibrate === 'function') {
      try {
        navigator.vibrate(pattern);
      } catch {
        // Ignore on platforms restricting vibration
      }
    }
  }

  private ensureGraph(): AudioContext | null {
    if (!this.isAudioActive()) return null;
    const ctx = soundFx.getAudioContext();
    if (!ctx) return null;

    if (this.connectedCtx !== ctx || !this.masterGain || !this.dryBus || !this.roomBus) {
      this.connectedCtx = ctx;

      const compressor = ctx.createDynamicsCompressor();
      compressor.threshold.setValueAtTime(-18, ctx.currentTime);
      compressor.knee.setValueAtTime(14, ctx.currentTime);
      compressor.ratio.setValueAtTime(4, ctx.currentTime);
      compressor.attack.setValueAtTime(0.004, ctx.currentTime);
      compressor.release.setValueAtTime(0.15, ctx.currentTime);

      const master = ctx.createGain();
      master.gain.setValueAtTime(0.72, ctx.currentTime);
      master.connect(compressor);
      compressor.connect(ctx.destination);

      const dry = ctx.createGain();
      dry.gain.setValueAtTime(1.0, ctx.currentTime);
      dry.connect(master);

      // Subtle short lab-room early reflections for glass & slate depth
      const room = ctx.createGain();
      room.gain.setValueAtTime(0.11, ctx.currentTime);

      const delayL = ctx.createDelay(0.1);
      delayL.delayTime.setValueAtTime(0.019, ctx.currentTime);
      const delayR = ctx.createDelay(0.1);
      delayR.delayTime.setValueAtTime(0.031, ctx.currentTime);

      const roomLp = ctx.createBiquadFilter();
      roomLp.type = 'lowpass';
      roomLp.frequency.setValueAtTime(2400, ctx.currentTime);

      room.connect(roomLp);
      roomLp.connect(delayL);
      roomLp.connect(delayR);
      delayL.connect(master);
      delayR.connect(master);

      this.masterGain = master;
      this.dryBus = dry;
      this.roomBus = room;
      this.noiseBuffer = this.buildNoiseBuffer(ctx);
    }

    return ctx;
  }

  private buildNoiseBuffer(ctx: AudioContext): AudioBuffer {
    const length = Math.floor(ctx.sampleRate * 1.5);
    const buffer = ctx.createBuffer(1, length, ctx.sampleRate);
    const data = buffer.getChannelData(0);
    let b0 = 0;
    let b1 = 0;
    let b2 = 0;
    for (let i = 0; i < length; i++) {
      const white = Math.random() * 2 - 1;
      // Smooth pink-ish noise approximation for warm liquid & air textures
      b0 = 0.997 * b0 + white * 0.029;
      b1 = 0.985 * b1 + white * 0.032;
      b2 = 0.95 * b2 + white * 0.048;
      data[i] = Math.max(-1, Math.min(1, (b0 + b1 + b2 + white * 0.18) * 1.6));
    }
    return buffer;
  }

  private createSpatialOut(
    ctx: AudioContext,
    coords: SpatialCoords,
    roomSend = 0.25
  ): { input: AudioNode; panner: StereoPannerNode | null } {
    const dry = this.dryBus!;
    const room = this.roomBus!;

    // Subtle distance attenuation & air-absorption filter for off-center containers
    const airFilter = ctx.createBiquadFilter();
    airFilter.type = 'lowpass';
    airFilter.frequency.setValueAtTime(6800 - coords.distance * 1800, ctx.currentTime);

    const distGain = ctx.createGain();
    distGain.gain.setValueAtTime(1.0 - coords.distance * 0.14, ctx.currentTime);

    const roomTap = ctx.createGain();
    roomTap.gain.setValueAtTime(roomSend, ctx.currentTime);

    airFilter.connect(distGain);

    if (typeof ctx.createStereoPanner === 'function') {
      const panner = ctx.createStereoPanner();
      panner.pan.setValueAtTime(Math.max(-0.92, Math.min(0.92, coords.pan)), ctx.currentTime);
      distGain.connect(panner);
      panner.connect(dry);
      panner.connect(roomTap);
      roomTap.connect(room);
      return { input: airFilter, panner };
    }

    distGain.connect(dry);
    distGain.connect(roomTap);
    roomTap.connect(room);
    return { input: airFilter, panner: null };
  }

  private scheduleVesselResonance(
    ctx: AudioContext,
    out: AudioNode,
    vesselType: VesselType,
    fillRatio: number,
    volume: number,
    startTime: number,
    pitchOffset = 1.0
  ) {
    const profile = VESSEL_ACOUSTICS[vesselType] || VESSEL_ACOUSTICS.beaker_250_open;
    const clampedFill = Math.max(0, Math.min(1, fillRatio));
    // Liquid mass damps and lowers the container's natural resonant pitch
    const pitchScale = (1 - 0.28 * clampedFill) * pitchOffset;
    const decay = profile.decaySec * (1 - 0.25 * clampedFill);
    const fundamental = profile.baseFreq * pitchScale;

    // Primary resonant mode
    const osc1 = ctx.createOscillator();
    const g1 = ctx.createGain();
    osc1.type = profile.material === 'porcelain' ? 'triangle' : 'sine';
    osc1.frequency.setValueAtTime(fundamental, startTime);
    g1.gain.setValueAtTime(0.0001, startTime);
    g1.gain.linearRampToValueAtTime(volume, startTime + 0.004);
    g1.gain.exponentialRampToValueAtTime(0.0001, startTime + decay);
    osc1.connect(g1);
    g1.connect(out);
    osc1.start(startTime);
    osc1.stop(startTime + decay + 0.02);

    // Secondary glass/ceramic partial
    const osc2 = ctx.createOscillator();
    const g2 = ctx.createGain();
    osc2.type = 'sine';
    osc2.frequency.setValueAtTime(fundamental * profile.overtoneRatio, startTime);
    const partialGain = volume * (profile.material === 'porcelain' ? 0.22 : 0.34);
    g2.gain.setValueAtTime(0.0001, startTime);
    g2.gain.linearRampToValueAtTime(partialGain, startTime + 0.003);
    g2.gain.exponentialRampToValueAtTime(0.0001, startTime + decay * 0.58);
    osc2.connect(g2);
    g2.connect(out);
    osc2.start(startTime);
    osc2.stop(startTime + decay * 0.62);

    // Subtle bench-contact body thump for tactile weight
    if (profile.bodyWarmth > 0.1) {
      const thud = ctx.createOscillator();
      const gThud = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(140 * (1 - 0.15 * clampedFill), startTime);
      thud.frequency.exponentialRampToValueAtTime(68, startTime + 0.035);
      gThud.gain.setValueAtTime(volume * 0.35 * profile.bodyWarmth, startTime);
      gThud.gain.exponentialRampToValueAtTime(0.0001, startTime + 0.045);
      thud.connect(gThud);
      gThud.connect(out);
      thud.start(startTime);
      thud.stop(startTime + 0.05);
    }
  }

  /** Ultra-subtle proximity tap when hovering over a container on the bench */
  public playContainerHover(
    vesselId: string,
    vesselType: VesselType,
    fillRatio: number,
    coords: SpatialCoords
  ) {
    const nowMs = performance.now();
    const prev = this.lastHoverAt.get(vesselId) || 0;
    if (nowMs - prev < 160) return;
    this.lastHoverAt.set(vesselId, nowMs);

    const ctx = this.ensureGraph();
    if (!ctx) return;
    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.12);
      const t = ctx.currentTime;
      const profile = VESSEL_ACOUSTICS[vesselType] || VESSEL_ACOUSTICS.beaker_250_open;
      const freq = profile.baseFreq * (1 - 0.22 * Math.max(0, Math.min(1, fillRatio))) * 1.12;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      osc.frequency.setValueAtTime(freq, t);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.012, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.048);
      osc.connect(g);
      g.connect(input);
      osc.start(t);
      osc.stop(t + 0.055);
    } catch {
      // Ignore pre-gesture errors
    }
  }

  /** Tactile select/focus feedback when clicking a chemical container */
  public playContainerSelect(
    vesselType: VesselType,
    fillRatio: number,
    coords: SpatialCoords
  ) {
    this.triggerHaptic(10);
    const ctx = this.ensureGraph();
    if (!ctx) return;
    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.24);
      this.scheduleVesselResonance(ctx, input, vesselType, fillRatio, 0.052, ctx.currentTime);
    } catch {}
  }

  /** Placing glassware onto the workbench surface */
  public playContainerPlace(vesselType: VesselType, coords: SpatialCoords) {
    this.triggerHaptic([14, 18, 8]);
    const ctx = this.ensureGraph();
    if (!ctx) return;
    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.3);
      const t = ctx.currentTime;
      // Soft slate benchtop contact
      const thud = ctx.createOscillator();
      const g = ctx.createGain();
      thud.type = 'sine';
      thud.frequency.setValueAtTime(165, t);
      thud.frequency.exponentialRampToValueAtTime(62, t + 0.055);
      g.gain.setValueAtTime(0.055, t);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);
      thud.connect(g);
      g.connect(input);
      thud.start(t);
      thud.stop(t + 0.07);

      // Glassware chime settle
      this.scheduleVesselResonance(ctx, input, vesselType, 0, 0.048, t + 0.012);
    } catch {}
  }

  /** Removing container from the bench */
  public playContainerRemove(vesselType: VesselType, fillRatio: number, coords: SpatialCoords) {
    this.triggerHaptic(8);
    const ctx = this.ensureGraph();
    if (!ctx) return;
    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.18);
      this.scheduleVesselResonance(ctx, input, vesselType, fillRatio, 0.028, ctx.currentTime, 0.92);
    } catch {}
  }

  /** Dispensing solid or liquid chemical into an active container */
  public playChemicalDispense(
    vesselType: VesselType,
    physicalState: 'liquid' | 'solid_powder' | 'solid_strip' | 'gas',
    amountMl: number,
    newFillRatio: number,
    coords: SpatialCoords
  ) {
    this.triggerHaptic(physicalState === 'liquid' ? [12, 22, 10] : [14, 16, 12]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.28);
      const t = ctx.currentTime;
      const profile = VESSEL_ACOUSTICS[vesselType] || VESSEL_ACOUSTICS.beaker_250_open;

      if (physicalState === 'gas') {
        // Gentle pressurized gas cylinder valve hiss & diffusion sweep into vessel headspace
        const hissDur = Math.min(0.42, 0.18 + amountMl * 0.0045);
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const bp = ctx.createBiquadFilter();
          bp.type = 'bandpass';
          bp.Q.setValueAtTime(1.8, t);
          bp.frequency.setValueAtTime(2800, t);
          bp.frequency.exponentialRampToValueAtTime(1650 + newFillRatio * 420, t + hissDur);

          const gGas = ctx.createGain();
          gGas.gain.setValueAtTime(0.0001, t);
          gGas.gain.linearRampToValueAtTime(0.044, t + 0.025);
          gGas.gain.exponentialRampToValueAtTime(0.0001, t + hissDur);

          src.connect(bp);
          bp.connect(gGas);
          gGas.connect(input);
          src.start(t);
          src.stop(t + hissDur + 0.02);
        }

        // Subtle glass neck air-column shimmer
        this.scheduleVesselResonance(
          ctx,
          input,
          vesselType,
          Math.max(0, newFillRatio * 0.2),
          0.02,
          t + 0.03,
          1.28
        );
        return;
      }

      if (physicalState === 'solid_powder' || physicalState === 'solid_strip') {
        // Metallic strip clink or granular crystal rattle inside vessel
        const hits = physicalState === 'solid_strip' ? 2 : 4;
        for (let i = 0; i < hits; i++) {
          const offset = i * 0.036;
          this.scheduleVesselResonance(
            ctx,
            input,
            vesselType,
            newFillRatio,
            physicalState === 'solid_strip' ? 0.042 : 0.024,
            t + offset,
            1.15 + i * 0.08
          );
        }
        return;
      }

      // Filtered liquid pour stream scaled gently by dose volume
      const pourDur = Math.min(0.36, 0.14 + amountMl * 0.004);
      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(3.2, t);
        const startFreq = 720 + newFillRatio * 340;
        bp.frequency.setValueAtTime(startFreq, t);
        bp.frequency.exponentialRampToValueAtTime(startFreq * 1.45, t + pourDur);

        const gNoise = ctx.createGain();
        gNoise.gain.setValueAtTime(0.0001, t);
        gNoise.gain.linearRampToValueAtTime(0.045, t + 0.03);
        gNoise.gain.exponentialRampToValueAtTime(0.0001, t + pourDur);

        src.connect(bp);
        bp.connect(gNoise);
        gNoise.connect(input);
        src.start(t);
        src.stop(t + pourDur + 0.02);
      }

      // Soft liquid meniscus droplet bloop
      const drop = ctx.createOscillator();
      const gDrop = ctx.createGain();
      drop.type = 'sine';
      const baseDrop = (profile.baseFreq * 0.58) * (1 + newFillRatio * 0.35);
      drop.frequency.setValueAtTime(baseDrop, t + pourDur * 0.55);
      drop.frequency.exponentialRampToValueAtTime(baseDrop * 1.42, t + pourDur * 0.55 + 0.055);
      gDrop.gain.setValueAtTime(0.0001, t + pourDur * 0.55);
      gDrop.gain.linearRampToValueAtTime(0.042, t + pourDur * 0.55 + 0.008);
      gDrop.gain.exponentialRampToValueAtTime(0.0001, t + pourDur * 0.55 + 0.075);
      drop.connect(gDrop);
      gDrop.connect(input);
      drop.start(t + pourDur * 0.55);
      drop.stop(t + pourDur * 0.55 + 0.085);
    } catch {}
  }

  /** Spatial liquid transfer sweep from source container to target container */
  public playContainerTransfer(
    sourceCoords: SpatialCoords,
    targetCoords: SpatialCoords,
    targetType: VesselType,
    targetFillRatio: number,
    volumeMl: number
  ) {
    this.triggerHaptic([14, 24, 14, 18, 12]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const t = ctx.currentTime;
      const sweepDur = Math.min(0.48, 0.24 + volumeMl * 0.003);
      const { input, panner } = this.createSpatialOut(ctx, sourceCoords, 0.3);

      if (panner) {
        panner.pan.setValueAtTime(Math.max(-0.9, Math.min(0.9, sourceCoords.pan)), t);
        panner.pan.linearRampToValueAtTime(
          Math.max(-0.9, Math.min(0.9, targetCoords.pan)),
          t + sweepDur
        );
      }

      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.Q.setValueAtTime(2.6, t);
        bp.frequency.setValueAtTime(640, t);
        bp.frequency.exponentialRampToValueAtTime(1180 + targetFillRatio * 320, t + sweepDur);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.055, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + sweepDur);

        src.connect(bp);
        bp.connect(g);
        g.connect(input);
        src.start(t);
        src.stop(t + sweepDur + 0.02);
      }

      // Target container settle ring at destination pan
      const targetOut = this.createSpatialOut(ctx, targetCoords, 0.28);
      this.scheduleVesselResonance(ctx, targetOut.input, targetType, targetFillRatio, 0.044, t + sweepDur * 0.72);
    } catch {}
  }

  /** Sealing or unsealing airtight watch-glass lid */
  public playVesselSeal(
    isClosing: boolean,
    trappedGasMassG: number,
    coords: SpatialCoords
  ) {
    this.triggerHaptic(isClosing ? [15, 16, 22] : [18, 12]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.22);
      const t = ctx.currentTime;

      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';

      if (isClosing) {
        // Elastomer gasket compression thud + seal lock
        osc.frequency.setValueAtTime(260, t);
        osc.frequency.exponentialRampToValueAtTime(115, t + 0.065);
        g.gain.setValueAtTime(0.055, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.08);
      } else {
        // Crisp suction release pop
        osc.frequency.setValueAtTime(190, t);
        osc.frequency.exponentialRampToValueAtTime(440, t + 0.05);
        g.gain.setValueAtTime(0.052, t);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.065);

        // Pressurized trapped gas hiss when unsealing gas-filled vessel
        if (trappedGasMassG > 0.01 && this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const hp = ctx.createBiquadFilter();
          hp.type = 'highpass';
          hp.frequency.setValueAtTime(2200, t);
          const gHiss = ctx.createGain();
          const hissLevel = Math.min(0.065, 0.024 + trappedGasMassG * 0.025);
          gHiss.gain.setValueAtTime(0.0001, t);
          gHiss.gain.linearRampToValueAtTime(hissLevel, t + 0.02);
          gHiss.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
          src.connect(hp);
          hp.connect(gHiss);
          gHiss.connect(input);
          src.start(t);
          src.stop(t + 0.3);
        }
      }

      osc.connect(g);
      g.connect(input);
      osc.start(t);
      osc.stop(t + 0.09);
    } catch {}
  }

  /** Bunsen burner piezo spark ignite or valve shutoff */
  public playBurnerToggle(isIgniting: boolean, coords: SpatialCoords) {
    this.triggerHaptic(isIgniting ? [20, 14, 12] : 10);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.24);
      const t = ctx.currentTime;

      if (isIgniting) {
        // Piezo click transient
        const spark = ctx.createOscillator();
        const gSpark = ctx.createGain();
        spark.type = 'triangle';
        spark.frequency.setValueAtTime(2100, t);
        spark.frequency.exponentialRampToValueAtTime(480, t + 0.022);
        gSpark.gain.setValueAtTime(0.045, t);
        gSpark.gain.exponentialRampToValueAtTime(0.0001, t + 0.028);
        spark.connect(gSpark);
        gSpark.connect(input);
        spark.start(t);
        spark.stop(t + 0.032);

        // Soft roaring blue flame bloom
        if (this.noiseBuffer) {
          const src = ctx.createBufferSource();
          src.buffer = this.noiseBuffer;
          const lp = ctx.createBiquadFilter();
          lp.type = 'bandpass';
          lp.frequency.setValueAtTime(340, t + 0.02);
          lp.Q.setValueAtTime(1.1, t + 0.02);
          const gFlame = ctx.createGain();
          gFlame.gain.setValueAtTime(0.0001, t + 0.015);
          gFlame.gain.linearRampToValueAtTime(0.06, t + 0.06);
          gFlame.gain.exponentialRampToValueAtTime(0.0001, t + 0.36);
          src.connect(lp);
          lp.connect(gFlame);
          gFlame.connect(input);
          src.start(t + 0.015);
          src.stop(t + 0.38);
        }
      } else {
        // Valve shutoff thump
        const valve = ctx.createOscillator();
        const gValve = ctx.createGain();
        valve.type = 'sine';
        valve.frequency.setValueAtTime(180, t);
        valve.frequency.exponentialRampToValueAtTime(70, t + 0.05);
        gValve.gain.setValueAtTime(0.042, t);
        gValve.gain.exponentialRampToValueAtTime(0.0001, t + 0.058);
        valve.connect(gValve);
        gValve.connect(input);
        valve.start(t);
        valve.stop(t + 0.065);
      }
    } catch {}
  }

  /** Glass stirring rod clinks & gentle liquid swirl */
  public playGlassStir(vesselType: VesselType, fillRatio: number, coords: SpatialCoords) {
    this.triggerHaptic([8, 120, 8, 120, 8]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.28);
      const t = ctx.currentTime;

      // Subtle rhythmic glass-wall clinks as rod orbits inside vessel
      [0, 0.24, 0.49, 0.75].forEach((offset, idx) => {
        this.scheduleVesselResonance(
          ctx,
          input,
          vesselType,
          fillRatio,
          0.024,
          t + offset,
          1.18 + (idx % 2) * 0.06
        );
      });

      // Gentle liquid swirl
      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(520, t);
        bp.frequency.linearRampToValueAtTime(760, t + 0.45);
        bp.frequency.linearRampToValueAtTime(480, t + 0.92);
        bp.Q.setValueAtTime(2.0, t);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.028, t + 0.14);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.96);

        src.connect(bp);
        bp.connect(g);
        g.connect(input);
        src.start(t);
        src.stop(t + 1.0);
      }
    } catch {}
  }

  /** Washing / rinsing & emptying a container */
  public playVesselRinse(vesselType: VesselType, coords: SpatialCoords) {
    this.triggerHaptic([12, 22]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.25);
      const t = ctx.currentTime;

      if (this.noiseBuffer) {
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const bp = ctx.createBiquadFilter();
        bp.type = 'bandpass';
        bp.frequency.setValueAtTime(1100, t);
        bp.frequency.exponentialRampToValueAtTime(420, t + 0.26);
        bp.Q.setValueAtTime(1.6, t);

        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.04, t + 0.03);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);

        src.connect(bp);
        bp.connect(g);
        g.connect(input);
        src.start(t);
        src.stop(t + 0.3);
      }

      // Hollow emptied glass tap
      this.scheduleVesselResonance(ctx, input, vesselType, 0, 0.036, t + 0.18);
    } catch {}
  }

  /** Reaction sensory signature (effervescence fizz, precipitation shimmer, thermal bloom) */
  public playReactionSignature(
    options: {
      hasGas: boolean;
      hasPrecipitate: boolean;
      tempDeltaC: number;
    },
    coords: SpatialCoords
  ) {
    this.triggerHaptic([12, 28, 16]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.32);
      const t = ctx.currentTime;

      if (options.hasGas && this.noiseBuffer) {
        // Gentle effervescent bubble sparkle
        const src = ctx.createBufferSource();
        src.buffer = this.noiseBuffer;
        const hp = ctx.createBiquadFilter();
        hp.type = 'highpass';
        hp.frequency.setValueAtTime(2800, t);
        const g = ctx.createGain();
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.032, t + 0.04);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.46);
        src.connect(hp);
        hp.connect(g);
        g.connect(input);
        src.start(t);
        src.stop(t + 0.48);
      }

      if (options.hasPrecipitate) {
        // Subtle crystalline nucleation harmonic shimmer
        [784, 1046.5, 1318.5].forEach((freq, idx) => {
          const osc = ctx.createOscillator();
          const g = ctx.createGain();
          osc.type = 'sine';
          const s = t + idx * 0.045;
          osc.frequency.setValueAtTime(freq, s);
          g.gain.setValueAtTime(0.0001, s);
          g.gain.linearRampToValueAtTime(0.022, s + 0.01);
          g.gain.exponentialRampToValueAtTime(0.0001, s + 0.24);
          osc.connect(g);
          g.connect(input);
          osc.start(s);
          osc.stop(s + 0.26);
        });
      }

      if (Math.abs(options.tempDeltaC) >= 1.5 || (!options.hasGas && !options.hasPrecipitate)) {
        // Warm harmonic bloom
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(options.tempDeltaC >= 0 ? 330 : 293.66, t);
        osc.frequency.exponentialRampToValueAtTime(options.tempDeltaC >= 0 ? 495 : 246.94, t + 0.2);
        g.gain.setValueAtTime(0.0001, t);
        g.gain.linearRampToValueAtTime(0.034, t + 0.025);
        g.gain.exponentialRampToValueAtTime(0.0001, t + 0.28);
        osc.connect(g);
        g.connect(input);
        osc.start(t);
        osc.stop(t + 0.3);
      }
    } catch {}
  }

  /** Subtle single spatial micro-bubble pop during active gas-evolving reactions */
  public playMicroBubblePop(coords: SpatialCoords) {
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.2);
      const t = ctx.currentTime;
      const osc = ctx.createOscillator();
      const g = ctx.createGain();
      osc.type = 'sine';
      const base = 620 + Math.random() * 480;
      osc.frequency.setValueAtTime(base, t);
      osc.frequency.exponentialRampToValueAtTime(base * 1.65, t + 0.028);
      g.gain.setValueAtTime(0.0001, t);
      g.gain.linearRampToValueAtTime(0.014, t + 0.004);
      g.gain.exponentialRampToValueAtTime(0.0001, t + 0.036);
      osc.connect(g);
      g.connect(input);
      osc.start(t);
      osc.stop(t + 0.04);
    } catch {}
  }

  /** Gentle double-knock warning on overflow or invalid transfer */
  public playOverflowWarning(coords: SpatialCoords) {
    this.triggerHaptic([28, 36, 28]);
    const ctx = this.ensureGraph();
    if (!ctx) return;

    try {
      const { input } = this.createSpatialOut(ctx, coords, 0.2);
      const t = ctx.currentTime;
      [0, 0.11].forEach((offset) => {
        const osc = ctx.createOscillator();
        const g = ctx.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(210, t + offset);
        osc.frequency.exponentialRampToValueAtTime(135, t + offset + 0.075);
        g.gain.setValueAtTime(0.042, t + offset);
        g.gain.exponentialRampToValueAtTime(0.0001, t + offset + 0.085);
        osc.connect(g);
        g.connect(input);
        osc.start(t + offset);
        osc.stop(t + offset + 0.095);
      });
    } catch {}
  }
}

export const spatialLabAudio = new SpatialLabAudioEngine();
