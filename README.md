# 🤖 TelegramBotGroup - Gelişmiş Telegram Botu

Modern, özellik dolu ve profesyonel bir Telegram grup yönetim botu. TypeScript ile geliştirilmiş, JSON tabanlı veritabanı kullanan ve kapsamlı özellikler sunan bir bot çözümü.

## ✨ Özellikler

### 🎯 Temel Özellikler
- ✅ **Otomatik Kullanıcı Kayıt Sistemi** - Kullanıcılar otomatik olarak kaydedilir
- ✅ **Gelişmiş İstatistikler** - Detaylı bot ve kullanıcı istatistikleri
- ✅ **Reputation & Level Sistemi** - Kullanıcılar mesaj ve komut kullanarak seviye atlar
- ✅ **Günlük Ödül Sistemi** - Her gün ödül al, streak tut
- ✅ **Rozet/Başarı Sistemi** - Başarılarını topla ve göster
- ✅ **Liderlik Tablosu** - En aktif kullanıcıları gör
- ✅ **Gelişmiş Raporlama** - Detaylı aktivite ve performans raporları

### 🎮 Eğlence Özellikleri
- 🎲 **Zar Atma** - Özelleştirilebilir zar atma
- 🪙 **Yazı Tura** - Rastgele yazı tura
- 🎯 **Sayı Tahmin Oyunu** - Zorluk seviyeli tahmin oyunu
- 📝 **Kelime Oyunu** - Kelime tahmin oyunu
- 🎪 **Rastgele Şakalar** - Kategori bazlı şakalar
- 💬 **İlham Verici Sözler** - Motivasyonel sözler

### 🛡️ Güvenlik ve Koruma
- 🚫 **Anti-Raid Koruması** - Toplu kullanıcı ekleme koruması
- 🤖 **Bot Koruması** - Otomatik bot tespiti
- 📢 **Caps Lock Koruması** - Aşırı büyük harf koruması
- ⚠️ **Uyarı Sistemi** - Kullanıcı uyarı takibi
- 🔇 **Mute/Unmute** - Kullanıcı susturma sistemi
- 🚨 **Ban/Unban** - Kullanıcı yasaklama sistemi

### 📊 Yönetim Özellikleri
- 👥 **Kullanıcı Yönetimi** - Ban, warn, mute, kick
- 📌 **Mesaj Yönetimi** - Pin, unpin, delete, clear
- 📈 **Detaylı İstatistikler** - Bot ve kullanıcı analizi
- 📝 **Log Sistemi** - Kategorize edilmiş loglar
- ⚙️ **Ayarlar** - Grup ayarları yönetimi

## 🚀 Kurulum

### Gereksinimler
- Node.js 16+ 
- npm veya yarn
- Telegram Bot Token ([@BotFather](https://t.me/BotFather) üzerinden alın)

### Adımlar

1. **Projeyi klonlayın**
```bash
git clone https://github.com/mehmetkzlldev/TelegramBotGroup.git
cd TelegramBotGroup
```

2. **Bağımlılıkları yükleyin**
```bash
npm install
```

3. **Ortam değişkenlerini ayarlayın**

`.env` dosyası oluşturun:
```env
BOT_TOKEN=your_bot_token_here
```

4. **Botu çalıştırın**

Geliştirme modu (otomatik yeniden başlatma):
```bash
npm run dev
```

Üretim modu:
```bash
npm run build
npm start
```

## 📝 Komutlar

### Temel Komutlar
| Komut | Açıklama |
|-------|----------|
| `/start` | Botu başlatır |
| `/help` | Yardım menüsünü gösterir |
| `/menu` | İnteraktif menü |
| `/profile` | Kullanıcı profil bilgileri (reputation, level, rozetler) |
| `/stats` | Bot istatistikleri |
| `/info` | Bot hakkında bilgi |
| `/setup` | Bot ayarları hakkında bilgi |

### Eğlence Komutları
| Komut | Açıklama | Örnek |
|-------|----------|-------|
| `/dice` veya `/zar` | Zar at | `/dice` veya `/dice 20` |
| `/flip` veya `/yazitura` | Yazı tura | `/flip` |
| `/random` veya `/rastgele` | Rastgele sayı | `/random 1 100` |
| `/joke` veya `/saka` | Rastgele şaka | `/joke` veya `/joke tech` |
| `/quote` veya `/soz` | İlham verici söz | `/quote` veya `/quote motivation` |

### Oyun Komutları
| Komut | Açıklama | Kullanım |
|-------|----------|----------|
| `/game` veya `/oyun` | Oyun menüsü | `/game` |
| `/guess` veya `/tahmin` | Sayı tahmin oyunu | `/guess` ile başlat, sonra `/guess 50` |
| `/word` veya `/kelime` | Kelime tahmin oyunu | `/word` ile başlat, sonra `/word BOT` |

### Yeni Özellikler
| Komut | Açıklama | Kullanım |
|-------|----------|----------|
| `/daily` | Günlük ödül al | `/daily` |
| `/leaderboard` | Liderlik tablosu | `/leaderboard` |
| `/report` | Detaylı raporlar | `/report` |
| `/activity` | Aktivite analizi | `/activity` |
| `/spam` | Mesaj spam (max 20) | `/spam mesaj 5` |

### Yönetim Komutları
| Komut | Açıklama | Kullanım |
|-------|----------|----------|
| `/ban` | Kullanıcıyı yasakla | `/ban @kullanıcı [sebep]` veya yanıt vererek |
| `/unban` | Yasaklamayı kaldır | `/unban @kullanıcı` |
| `/warn` | Kullanıcıyı uyar | `/warn @kullanıcı [sebep]` |
| `/warns` | Uyarıları görüntüle | `/warns @kullanıcı` |
| `/clearwarns` | Uyarıları temizle | `/clearwarns @kullanıcı` |
| `/mute` | Kullanıcıyı sustur | `/mute @kullanıcı [süre]` |
| `/unmute` | Susturmayı kaldır | `/unmute @kullanıcı` |
| `/kick` | Kullanıcıyı gruptan at | `/kick @kullanıcı` |
| `/pin` | Mesajı sabitle | Yanıt vererek `/pin` |
| `/unpin` | Sabitlenmiş mesajı kaldır | `/unpin` |
| `/delete` | Mesajı sil | Yanıt vererek `/delete` |
| `/clear` | Son N mesajı sil | `/clear 10` |

## 🏗️ Proje Yapısı

```
TelegramBotGroup/
├── src/
│   ├── index.ts              # Ana bot dosyası
│   ├── database.ts            # Veritabanı işlemleri
│   ├── logger.ts              # Loglama sistemi
│   ├── messaging.ts           # Mesaj şablonları ve klavyeler
│   ├── setup-bot.ts           # Bot ayarları scripti
│   ├── config/
│   │   ├── constants.ts       # Bot sabitleri
│   │   └── protection.ts       # Koruma ayarları
│   └── utils/
│       ├── helpers.ts          # Yardımcı fonksiyonlar
│       ├── profanity.ts        # Küfür filtresi
│       └── protection.ts       # Koruma fonksiyonları
├── data/
│   └── bot.json               # Veritabanı dosyası (otomatik oluşturulur)
├── logs/                      # Log dosyaları (otomatik oluşturulur)
├── .env                       # Ortam değişkenleri (oluşturulmalı)
├── .gitignore
├── package.json
├── tsconfig.json
└── README.md
```

## 🔧 Yapılandırma

### Ortam Değişkenleri
- `BOT_TOKEN`: Telegram bot token'ınız (zorunlu)

### Veritabanı
Bot, JSON tabanlı bir veritabanı kullanır. Veriler `data/bot.json` dosyasında saklanır. Bu dosya otomatik olarak oluşturulur.

### Loglar
Log dosyaları `logs/` klasöründe saklanır. Her kategori için günlük log dosyaları oluşturulur:
- `general-YYYY-MM-DD.log` - Genel loglar
- `USER-YYYY-MM-DD.log` - Kullanıcı işlemleri
- `COMMAND-YYYY-MM-DD.log` - Komut kullanımları
- `MESSAGE-YYYY-MM-DD.log` - Mesaj logları
- `ERROR-YYYY-MM-DD.log` - Hata logları
- `ADMIN-YYYY-MM-DD.log` - Admin işlemleri
- `BOT-YYYY-MM-DD.log` - Bot olayları

## 🛠️ Teknolojiler

- **Node.js** - JavaScript runtime
- **TypeScript** - Tip güvenli JavaScript
- **Telegraf** - Telegram Bot API framework
- **dotenv** - Ortam değişkenleri yönetimi
- **JSON Database** - Dosya tabanlı veritabanı

## 📚 Geliştirme

### Yeni Komut Ekleme
1. `src/index.ts` dosyasına komut handler'ı ekleyin
2. `src/messaging.ts` dosyasına mesaj şablonu ekleyin (gerekirse)
3. `COMMANDS.md` dosyasını güncelleyin

### Yeni Özellik Ekleme
1. İlgili dosyayı düzenleyin (`src/database.ts`, `src/utils/`, vb.)
2. Test edin
3. Dokümantasyonu güncelleyin

## 🤝 Katkıda Bulunma

1. Fork yapın
2. Feature branch oluşturun (`git checkout -b feature/amazing-feature`)
3. Değişikliklerinizi commit edin (`git commit -m 'Add amazing feature'`)
4. Branch'inizi push edin (`git push origin feature/amazing-feature`)
5. Pull Request oluşturun

## 📄 Lisans

Bu proje ISC lisansı altında lisanslanmıştır.

## 👤 Yazar

**Mehmet Ali Kızıloğlu**
- Email: mehmetalikizoglu188@gmail.com
- GitHub: [@mehmetkzlldev](https://github.com/mehmetkzlldev)

## 🙏 Teşekkürler

Bu botu kullandığınız için teşekkür ederiz! Sorularınız için issue açabilir veya katkıda bulunabilirsiniz.

---

⭐ Bu projeyi beğendiyseniz yıldız vermeyi unutmayın!
