import { sanitizeSettings } from '../../shared/settings.js';
import { createEqualizer } from './effects/equalizer.js';
import { createMaster } from './effects/master.js';
import { createPan } from './effects/pan.js';
import { createPitch, PITCH_WORKLET_URL } from './effects/pitch.js';
import { createReverb } from './effects/reverb.js';
import { createMeter } from './meter.js';

// Un solo motor para todas las pestañas capturadas:
//   pestañas → bus → EQ → pitch → paneo → reverb → master → altavoces
//                                                        └→ medidor
export class AudioEngine {
  constructor({ onTabEnded } = {}) {
    this.ctx = null;
    this.chain = [];
    this.tabs = new Map();
    this.settings = sanitizeSettings();
    this.onTabEnded = onTabEnded;
    this.ready = null;
  }

  init() {
    this.ready ??= this.#build();
    return this.ready;
  }

  async #build() {
    const ctx = new AudioContext({ latencyHint: 'interactive' });
    let workletReady = true;
    try {
      await ctx.audioWorklet.addModule(PITCH_WORKLET_URL);
    } catch (e) {
      workletReady = false;
      console.warn('[DragonAudio] pitch no disponible', e);
    }

    this.ctx = ctx;
    this.bus = ctx.createGain();
    this.chain = [
      createEqualizer(ctx),
      createPitch(ctx, workletReady),
      createPan(ctx),
      createReverb(ctx, this.settings.reverb.decay),
      createMaster(ctx),
    ];
    this.meter = createMeter(ctx);

    this.chain.reduce((prev, fx) => (prev.connect(fx.input), fx.output), this.bus);
    const out = this.chain[this.chain.length - 1].output;
    out.connect(ctx.destination);
    out.connect(this.meter.input);
    this.#apply();
  }

  async addTab(tabId, streamId) {
    await this.init();
    if (this.tabs.has(tabId)) return;

    const stream = await navigator.mediaDevices.getUserMedia({
      audio: { mandatory: { chromeMediaSource: 'tab', chromeMediaSourceId: streamId } },
      video: false,
    });
    const source = this.ctx.createMediaStreamSource(stream);
    source.connect(this.bus);
    this.tabs.set(tabId, { stream, source });

    stream.getAudioTracks().forEach((track) => {
      track.addEventListener('ended', () => {
        this.removeTab(tabId);
        this.onTabEnded?.(tabId);
      });
    });
    if (this.ctx.state === 'suspended') await this.ctx.resume();
  }

  removeTab(tabId) {
    const tab = this.tabs.get(tabId);
    if (!tab) return;
    tab.source.disconnect();
    tab.stream.getTracks().forEach((t) => t.stop());
    this.tabs.delete(tabId);
  }

  setSettings(settings) {
    this.settings = sanitizeSettings(settings);
    this.#apply();
  }

  #apply() {
    if (!this.ctx) return;
    const { bypass } = this.settings;
    this.chain.forEach((fx) => fx.update(this.settings, bypass));
  }

  get tabIds() {
    return [...this.tabs.keys()];
  }

  readLevels() {
    return this.meter ? this.meter.read() : [0, 0];
  }

  async dispose() {
    this.tabIds.forEach((id) => this.removeTab(id));
    await this.ctx?.close().catch(() => {});
    this.ctx = null;
    this.ready = null;
  }
}
