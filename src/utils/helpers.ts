// Yardımcı fonksiyonlar

/**
 * Mesajı güvenli bir şekilde parse et
 */
export function parseMessage(text: string): { command: string; args: string[] } {
  const parts = text.trim().split(/\s+/);
  const command = parts[0]?.replace('/', '').toLowerCase() || '';
  const args = parts.slice(1);
  return { command, args };
}

/**
 * Sayıyı formatla (binlik ayırıcı ile)
 */
export function formatNumber(num: number): string {
  return num.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
}

/**
 * Tarihi formatla
 */
export function formatDate(date: Date, locale: string = 'tr-TR'): string {
  return date.toLocaleDateString(locale, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric'
  });
}

/**
 * Zamanı formatla
 */
export function formatTime(date: Date, locale: string = 'tr-TR', timezone: string = 'Europe/Istanbul'): string {
  return date.toLocaleTimeString(locale, {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    timeZone: timezone
  });
}

/**
 * Güvenli matematik ifadesi hesapla
 */
export function safeEval(expr: string): number | null {
  try {
    // Sadece güvenli karakterlere izin ver
    const safeExpr = expr.replace(/[^0-9+\-*/().\sMath.sqrtpowincostanPI]/g, '');
    
    // Gelişmiş fonksiyonları dönüştür
    const processed = safeExpr
      .replace(/sqrt\(/g, 'Math.sqrt(')
      .replace(/pow\(/g, 'Math.pow(')
      .replace(/sin\(/g, 'Math.sin(')
      .replace(/cos\(/g, 'Math.cos(')
      .replace(/tan\(/g, 'Math.tan(')
      .replace(/pi/g, 'Math.PI')
      .replace(/e\b/g, 'Math.E');

    const result = Function(`"use strict"; return (${processed})`)();
    
    if (isNaN(result) || !isFinite(result)) {
      return null;
    }
    
    return result;
  } catch {
    return null;
  }
}

/**
 * Rate limiting kontrolü (basit)
 */
const rateLimits: { [key: string]: { count: number; resetTime: number } } = {};

export function checkRateLimit(userId: number, command: string, limit: number = 10, windowMs: number = 60000): boolean {
  const key = `${userId}_${command}`;
  const now = Date.now();
  
  if (!rateLimits[key] || rateLimits[key].resetTime < now) {
    rateLimits[key] = { count: 1, resetTime: now + windowMs };
    return true;
  }
  
  if (rateLimits[key].count >= limit) {
    return false;
  }
  
  rateLimits[key].count++;
  return true;
}

/**
 * Mesajı temizle ve formatla
 */
export function sanitizeText(text: string): string {
  return text
    .replace(/[<>]/g, '') // HTML tag'lerini temizle
    .trim()
    .substring(0, 4096); // Telegram limiti
}

/**
 * Progress bar oluştur
 */
export function createProgressBar(current: number, total: number, length: number = 10): string {
  const percentage = Math.min(100, Math.max(0, (current / total) * 100));
  const filled = Math.round((percentage / 100) * length);
  const empty = length - filled;
  
  return '█'.repeat(filled) + '░'.repeat(empty) + ` ${Math.round(percentage)}%`;
}

