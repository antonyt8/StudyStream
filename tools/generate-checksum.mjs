import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';

const releaseDir = path.resolve('release');
const artifacts = fs.readdirSync(releaseDir)
  .filter((name) => /\.(exe|blockmap)$/i.test(name))
  .map((name) => path.join(releaseDir, name));

const lines = artifacts.map((filePath) => {
  const hash = crypto.createHash('sha256');
  hash.update(fs.readFileSync(filePath));
  return `${hash.digest('hex')}  ${path.basename(filePath)}`;
});

fs.writeFileSync(path.join(releaseDir, 'SHA256SUMS.txt'), `${lines.join('\n')}\n`, 'utf8');
console.log(`Generated checksums for ${artifacts.length} artifacts.`);
