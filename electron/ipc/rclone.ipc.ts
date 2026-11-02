import { ipcMain } from 'electron';
import { RcloneService } from '../services/rclone.service';
import { SettingsRepository } from '../database/repositories/settings.repo';

export function registerRcloneIpc(): void {
  const rcloneService = RcloneService.getInstance();
  const settingsRepo = new SettingsRepository();

  ipcMain.handle('rclone:check-status', async (_, customPath?: string) => {
    const settings = settingsRepo.getAll();
    const execPath = customPath || settings.rclonePath || 'rclone';
    return rcloneService.checkStatus(execPath);
  });

  ipcMain.handle('rclone:list-remotes', async (_, customPath?: string) => {
    const settings = settingsRepo.getAll();
    const execPath = customPath || settings.rclonePath || 'rclone';
    return rcloneService.listRemotes(execPath);
  });

  ipcMain.handle('rclone:test-remote', async (_, remotePath: string) => {
    const settings = settingsRepo.getAll();
    const execPath = settings.rclonePath || 'rclone';
    return rcloneService.testRemoteAccess(execPath, remotePath);
  });

  ipcMain.handle('rclone:list-folders', async (_, remotePath: string) => {
    const settings = settingsRepo.getAll();
    const execPath = settings.rclonePath || 'rclone';
    return rcloneService.listJson(execPath, remotePath, { dirsOnly: true, maxDepth: 1 });
  });
}
