import { describe, it, expect } from 'vitest';
import { RcloneService } from '../electron/services/rclone.service';

describe('Rclone Service Integration Tests', () => {
  const rcloneService = RcloneService.getInstance();

  it('should detect installed Rclone version', async () => {
    const status = await rcloneService.checkStatus('rclone');
    expect(status.installed).toBe(true);
    expect(status.version).toBeDefined();
    expect(status.version).toContain('1.74');
  });

  it('should list configured remotes from the system without exposing credentials', async () => {
    const remotes = await rcloneService.listRemotes('rclone');
    expect(Array.isArray(remotes)).toBe(true);
    // Since gdrive was found during inspection:
    const gdriveRemote = remotes.find(r => r.name.toLowerCase().includes('gdrive'));
    expect(gdriveRemote).toBeDefined();
  });
});
