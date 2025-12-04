// Bot sabitleri ve yapılandırma

export const BOT_CONFIG = {
  name: 'TelegramBotGroup',
  version: '1.0.0',
  description: 'Güvenlik ve koruma odaklı Telegram botu. Kullanıcılarınızı korur ve güvenli bir deneyim sunar.',
  about: 'TelegramBotGroup - Güvenliğiniz için buradayız! 🛡️',
  support: '@TelegramBotGroupSupport', // Destek kanalı (isteğe bağlı)
  website: 'https://example.com' // Website (isteğe bağlı)
};

export const RATE_LIMITS = {
  command: 30, // Dakikada maksimum komut sayısı (artırıldı)
  message: 60, // Dakikada maksimum mesaj sayısı (artırıldı)
  game: 10 // Dakikada maksimum oyun başlatma (artırıldı)
};

// Küfür filtresi ayarları
export const PROFANITY_FILTER = {
  enabled: false // Küfür filtresi açık/kapalı (false = kapalı)
};

export const GAME_CONFIG = {
  guess: {
    easy: { min: 1, max: 50, attempts: 10, multiplier: 0.5 },
    normal: { min: 1, max: 100, attempts: 7, multiplier: 1 },
    hard: { min: 1, max: 200, attempts: 5, multiplier: 2 },
    extreme: { min: 1, max: 1000, attempts: 10, multiplier: 5 }
  },
  word: {
    easy: { attempts: 8, multiplier: 0.5 },
    normal: { attempts: 6, multiplier: 1 },
    hard: { attempts: 5, multiplier: 3 }
  }
};

export const TIMEZONES: { [key: string]: { name: string; tz: string; offset: string } } = {
  'IST': { name: 'İstanbul', tz: 'Europe/Istanbul', offset: 'GMT+3' },
  'UTC': { name: 'UTC', tz: 'UTC', offset: 'GMT+0' },
  'NY': { name: 'New York', tz: 'America/New_York', offset: 'GMT-5' },
  'LA': { name: 'Los Angeles', tz: 'America/Los_Angeles', offset: 'GMT-8' },
  'LON': { name: 'Londra', tz: 'Europe/London', offset: 'GMT+0' },
  'TOK': { name: 'Tokyo', tz: 'Asia/Tokyo', offset: 'GMT+9' },
  'BER': { name: 'Berlin', tz: 'Europe/Berlin', offset: 'GMT+1' },
  'MOS': { name: 'Moskova', tz: 'Europe/Moscow', offset: 'GMT+3' }
};

