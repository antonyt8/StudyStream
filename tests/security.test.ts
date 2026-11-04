import { describe, it, expect } from 'vitest';
import { PathSecurity } from '../electron/security/path-validation';
import { parsePlaybackRange } from '../electron/services/playback.service';

describe('PathSecurity Tests', () => {
  it('should accept valid safe paths', () => {
    expect(PathSecurity.isSafePath('C:\\Cursos\\React\\Aula01.mp4')).toBe(true);
    expect(PathSecurity.isSafePath('D:/Estudos/Javascript/intro.mp4')).toBe(true);
  });

  it('should reject path traversal attempts', () => {
    expect(PathSecurity.isSafePath('../secret/passwords.txt')).toBe(false);
    expect(PathSecurity.isSafePath('..\\..\\Windows\\System32')).toBe(false);
    expect(PathSecurity.isSafePath('valid/path\0withnull')).toBe(false);
  });

  it('should correctly verify paths within authorized library roots', () => {
    const allowedRoots = ['C:\\Cursos', 'D:\\Estudos'];

    expect(PathSecurity.isPathWithinRoots('C:\\Cursos\\WebDev\\Aula01.mp4', allowedRoots)).toBe(true);
    expect(PathSecurity.isPathWithinRoots('D:\\Estudos\\Python\\intro.mp4', allowedRoots)).toBe(true);
    expect(PathSecurity.isPathWithinRoots('C:\\Windows\\System32\\cmd.exe', allowedRoots)).toBe(false);
    expect(PathSecurity.isPathWithinRoots('E:\\OutraPasta\\video.mp4', allowedRoots)).toBe(false);
  });

  it('should sanitize invalid filename characters for Windows', () => {
    const sanitized = PathSecurity.sanitizeFilename('Curso: "Avançado" <Módulo 1> / teste? *');
    expect(sanitized).not.toContain(':');
    expect(sanitized).not.toContain('"');
    expect(sanitized).not.toContain('<');
    expect(sanitized).not.toContain('>');
    expect(sanitized).not.toContain('/');
    expect(sanitized).not.toContain('?');
    expect(sanitized).not.toContain('*');
  });

  it('should validate playback ranges', () => {
    expect(parsePlaybackRange('bytes=10-19', 100)).toEqual({ start: 10, end: 19 });
    expect(parsePlaybackRange('bytes=90-', 100)).toEqual({ start: 90, end: 99 });
    expect(parsePlaybackRange('bytes=-10', 100)).toEqual({ start: 90, end: 99 });
    expect(parsePlaybackRange('bytes=100-110', 100)).toBeNull();
    expect(parsePlaybackRange('bytes=abc-10', 100)).toBeNull();
  });
});
