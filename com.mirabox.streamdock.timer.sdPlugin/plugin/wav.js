function beep(sampleRate, freq, ms, volume = 0.62) {
  const count = Math.floor((sampleRate * ms) / 1000);
  const data = new Int16Array(count);
  const fade = Math.min(140, Math.floor(count / 5));
  for (let i = 0; i < count; i++) {
    let env = 1;
    if (i < fade) env = i / fade;
    else if (i > count - fade) env = (count - i) / fade;
    const sample = Math.sin((2 * Math.PI * freq * i) / sampleRate) * volume * env;
    data[i] = Math.max(-32767, Math.min(32767, Math.round(sample * 32767)));
  }
  return data;
}

function silence(sampleRate, ms) {
  return new Int16Array(Math.floor((sampleRate * ms) / 1000));
}

function buildAlarmWav() {
  const sampleRate = 22050;
  const parts = [
    beep(sampleRate, 880, 150),
    silence(sampleRate, 70),
    beep(sampleRate, 880, 150),
    silence(sampleRate, 70),
    beep(sampleRate, 1175, 260),
    silence(sampleRate, 460)
  ];
  let total = 0;
  for (const part of parts) total += part.length;
  const pcm = Buffer.alloc(total * 2);
  let offset = 0;
  for (const part of parts) {
    for (let i = 0; i < part.length; i++) {
      pcm.writeInt16LE(part[i], offset);
      offset += 2;
    }
  }

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

module.exports = { buildAlarmWav };
