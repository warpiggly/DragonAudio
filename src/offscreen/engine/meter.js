// Picos L/R de la salida (0..1). Solo se leen mientras el popup está abierto.
export function createMeter(ctx) {
  const input = ctx.createGain();
  input.channelCount = 2;
  input.channelCountMode = 'explicit';
  input.channelInterpretation = 'speakers';

  const splitter = ctx.createChannelSplitter(2);
  input.connect(splitter);

  const analysers = [0, 1].map((ch) => {
    const a = ctx.createAnalyser();
    a.fftSize = 1024;
    splitter.connect(a, ch);
    return a;
  });
  const buf = new Float32Array(1024);

  return {
    input,
    read() {
      return analysers.map((a) => {
        a.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i++) {
          const v = Math.abs(buf[i]);
          if (v > peak) peak = v;
        }
        return peak;
      });
    },
  };
}
