import * as fs from 'fs';
import * as path from 'path';

const CHECKPOINT_DIR = path.resolve(__dirname, '../../data/raw');

export function getCheckpointPath(name: string): string {
  if (!fs.existsSync(CHECKPOINT_DIR)) {
    fs.mkdirSync(CHECKPOINT_DIR, { recursive: true });
  }
  return path.join(CHECKPOINT_DIR, `checkpoint_${name}.json`);
}

export function saveCheckpoint(name: string, data: object): void {
  fs.writeFileSync(getCheckpointPath(name), JSON.stringify(data, null, 2));
}

export function loadCheckpoint<T = any>(name: string): T | null {
  const p = getCheckpointPath(name);
  if (fs.existsSync(p)) {
    return JSON.parse(fs.readFileSync(p, 'utf-8')) as T;
  }
  return null;
}

export function clearCheckpoint(name: string): void {
  const p = getCheckpointPath(name);
  if (fs.existsSync(p)) fs.unlinkSync(p);
}
