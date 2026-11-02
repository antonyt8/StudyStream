import path from 'node:path';
import fs from 'node:fs';

export class PathSecurity {
  /**
   * Checks if a target path is safe and does not contain directory traversal attempts
   */
  public static isSafePath(targetPath: string): boolean {
    if (!targetPath || typeof targetPath !== 'string') return false;
    if (targetPath.includes('\0')) return false;

    try {
      const normalized = path.normalize(targetPath);
      return !normalized.startsWith('..');
    } catch {
      return false;
    }
  }

  /**
   * Verifies if a given local file is within any of the authorized source roots
   */
  public static isPathWithinRoots(filePath: string, allowedRoots: string[]): boolean {
    if (!this.isSafePath(filePath)) return false;

    const resolvedFile = path.resolve(filePath).toLowerCase();
    return allowedRoots.some(root => {
      if (!this.isSafePath(root)) return false;
      const resolvedRoot = path.resolve(root).toLowerCase();
      return resolvedFile.startsWith(resolvedRoot);
    });
  }

  /**
   * Sanitizes filenames to avoid invalid filesystem characters on Windows
   */
  public static sanitizeFilename(name: string): string {
    return name.replace(/[<>:"/\\|?*\x00-\x1F]/g, '_').trim();
  }
}
