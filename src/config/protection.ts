// Chat koruma ayarları

export const PROTECTION_CONFIG = {
  // Spam koruması - KAPALI
  spam: {
    enabled: false,
    threshold: 8,
    banThreshold: 15,
    timeWindow: 120000
  },
  
  // Flood koruması - KAPALI
  flood: {
    enabled: false,
    threshold: 15,
    banThreshold: 25,
    timeWindow: 10000
  },
  
  // Bot koruması - Bot ekleme
  bots: {
    enabled: true
  },
  
  // Büyük harf koruması (ÇOK HAFİF)
  caps: {
    enabled: true,
    threshold: 0.95, // %95 büyük harf (neredeyse tamamı büyük harf olmalı)
    minLength: 20 // Minimum 20 karakter (daha uzun mesajlar için)
  },
  
  // Anti-raid - Çok sayıda yeni üye
  antiRaid: {
    enabled: true,
    threshold: 10, // 10 yeni üye (daha yüksek)
    timeWindow: 10000 // 10 saniye
  }
};

