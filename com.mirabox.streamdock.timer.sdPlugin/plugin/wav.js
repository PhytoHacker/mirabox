function buildBellWav() {
  const sampleRate = 22050;
  const seconds = 3.2;
  const count = Math.floor(sampleRate * seconds);
  const data = new Int16Array(count);
  const strikes = [
    { at: 0, freq: 523.25 },
    { at: 0.72, freq: 392 }
  ];
  const partials = [
    { ratio: 0.5, amp: 0.28, decay: 1.7 },
    { ratio: 1, amp: 0.5, decay: 1.25 },
    { ratio: 1.19, amp: 0.22, decay: 0.85 },
    { ratio: 1.5, amp: 0.16, decay: 0.65 },
    { ratio: 2, amp: 0.34, decay: 0.5 },
    { ratio: 2.55, amp: 0.08, decay: 0.32 },
    { ratio: 3.01, amp: 0.05, decay: 0.22 }
  ];

  for (let i = 0; i < count; i++) {
    const time = i / sampleRate;
    let sample = 0;
    for (const strike of strikes) {
      const local = time - strike.at;
      if (local < 0) continue;
      for (const partial of partials) {
        const env = Math.exp(-local / partial.decay);
        sample += Math.sin(2 * Math.PI * strike.freq * partial.ratio * local) * partial.amp * env;
      }
      sample += Math.sin(2 * Math.PI * strike.freq * 4.2 * local) * Math.exp(-local / 0.03) * 0.2;
    }
    sample = Math.max(-1, Math.min(1, sample));
    data[i] = Math.round(sample * 26000);
  }

  const pcm = Buffer.alloc(data.length * 2);
  for (let i = 0; i < data.length; i++) pcm.writeInt16LE(data[i], i * 2);

  const header = Buffer.alloc(44);
  header.write('RIFF', 0);
  header.writeUInt32LE(36 + pcm.length, 4);
  header.write('WAVE', 8);
  header.write('fmt ', 12);
  header.writeUInt32LE(16, 16);
  header.writeUInt16LE(1, 20);
  header.writeUInt16LE(1, 22);
  header.writeUInt32LE(sampleRate, 24);
  header.writeUInt32LE(sampleRate * 2, 28);
  header.writeUInt16LE(2, 32);
  header.writeUInt16LE(16, 34);
  header.write('data', 36);
  header.writeUInt32LE(pcm.length, 40);
  return Buffer.concat([header, pcm]);
}

module.exports = { buildBellWav };
