// Auto-discovers built-in sounds from MP3/WAV files in media/sounds/.
// Just drop audio files in that folder — no registry to maintain.
// Optional: create media/sounds/config.json to set emojis and custom labels.

import * as fs from 'fs';
import * as path from 'path';

const AUDIO_EXTENSIONS = ['.mp3', '.wav', '.ogg'];

interface SoundConfig {
  [name: string]: { emoji?: string; label?: string };
}

export interface SoundEntry {
  name: string;
  label: string;
  file: string;
  emoji: string;
}

let cachedSounds: SoundEntry[] | null = null;
let cachedDir: string | null = null;

function loadConfig(soundsDir: string): SoundConfig {
  const configPath = path.join(soundsDir, 'config.json');
  try {
    if (fs.existsSync(configPath)) {
      return JSON.parse(fs.readFileSync(configPath, 'utf-8'));
    }
  } catch { /* ignore malformed config */ }
  return {};
}

function scanSoundsDir(soundsDir: string): SoundEntry[] {
  if (cachedDir === soundsDir && cachedSounds) return cachedSounds;

  if (!fs.existsSync(soundsDir)) {
    cachedSounds = [];
    cachedDir = soundsDir;
    return cachedSounds;
  }

  const config = loadConfig(soundsDir);
  const files = fs.readdirSync(soundsDir);
  cachedSounds = files
    .filter((f) => AUDIO_EXTENSIONS.includes(path.extname(f).toLowerCase()))
    .map((f) => {
      const name = path.basename(f, path.extname(f));
      const entry = config[name];
      const label = entry?.label ?? name
        .replace(/[-_]/g, ' ')
        .replace(/\b\w/g, (c) => c.toUpperCase());
      const emoji = entry?.emoji ?? '\u{1F3B5}';
      return { name, label, file: f, emoji };
    })
    .sort((a, b) => a.label.localeCompare(b.label));

  cachedDir = soundsDir;
  return cachedSounds;
}

export function refreshCache(): void {
  cachedSounds = null;
  cachedDir = null;
}

export function getBuiltInSounds(soundsDir: string): SoundEntry[] {
  return scanSoundsDir(soundsDir);
}

export function getBuiltInSoundEmoji(soundsDir: string, name: string): string {
  return scanSoundsDir(soundsDir).find((s) => s.name === name)?.emoji ?? '\u{1F3B5}';
}

export function getBuiltInSoundNames(soundsDir: string): string[] {
  return scanSoundsDir(soundsDir).map((s) => s.name);
}

export function getBuiltInSoundLabel(soundsDir: string, name: string): string {
  return scanSoundsDir(soundsDir).find((s) => s.name === name)?.label ?? name;
}

export function getBuiltInSoundFile(soundsDir: string, name: string): string | undefined {
  return scanSoundsDir(soundsDir).find((s) => s.name === name)?.file;
}
