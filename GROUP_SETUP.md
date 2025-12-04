# 🔧 Grupta Komutların Çalışması İçin Ayarlar

Grupta komutların çalışması için botun bazı izinlere ihtiyacı vardır.

## ✅ Gerekli İzinler

### 1. Mesajları Okuma (ZORUNLU)
Botun grup içindeki mesajları okuyabilmesi için:

1. Grubun ayarlarına gidin
2. **"Yöneticiler"** veya **"Katılımcılar"** bölümüne gidin
3. Botunuzu bulun
4. **"Mesajları Okuma"** izninin **AÇIK** olduğundan emin olun

### 2. Mesaj Gönderme (ZORUNLU)
Botun komutlara yanıt verebilmesi için:

1. Grubun ayarlarına gidin
2. Botunuzu bulun
3. **"Mesaj Gönderme"** izninin **AÇIK** olduğundan emin olun

## 🎯 Hızlı Çözüm

### Yöntem 1: Botu Yönetici Yap (Önerilen)

1. Grubun ayarlarına gidin
2. **"Yöneticiler"** → **"Yönetici Ekle"**
3. Botunuzu seçin
4. Şu izinleri verin:
   - ✅ **Mesaj Gönderme**
   - ✅ **Mesajları Okuma**
   - ✅ **Mesajları Düzenleme** (isteğe bağlı)
5. **"Kaydet"** butonuna tıklayın

### Yöntem 2: Bot İzinlerini Kontrol Et

1. Grubun ayarlarına gidin
2. **"Katılımcılar"** bölümüne gidin
3. Botunuzu bulun ve üzerine tıklayın
4. İzinleri kontrol edin ve gerekirse düzenleyin

## 🔍 Sorun Giderme

### Komutlar Çalışmıyor

**Kontrol Listesi:**
- [ ] Bot çalışıyor mu? (`npm run dev` komutu çalışıyor olmalı)
- [ ] Botun "Mesajları Okuma" izni var mı?
- [ ] Botun "Mesaj Gönderme" izni var mı?
- [ ] Bot grup içinde mi? (Özel sohbette değil)
- [ ] Komutu doğru yazdınız mı? (örn: `/start`)

### Bot Mesaj Göndermiyor

1. Botun **"Mesaj Gönderme"** iznini kontrol edin
2. Botu **yönetici** yapmayı deneyin
3. Botun çalıştığından emin olun
4. Log dosyalarını kontrol edin (`logs/` klasörü)

### Bot Komutları Algılamıyor

1. Botun **"Mesajları Okuma"** iznini kontrol edin
2. Botu **yönetici** yapmayı deneyin
3. Komutu **@bot_username** ile deneyin (örn: `/start@TelegramBotGroup`)

## 💡 İpuçları

1. **Botu Yönetici Yapın:** En kolay çözüm botu yönetici yapmaktır
2. **İzinleri Kontrol Edin:** Her zaman izinleri kontrol edin
3. **Botu Yeniden Başlatın:** Sorun devam ederse botu yeniden başlatın
4. **Logları İnceleyin:** Sorun yaşarsanız log dosyalarını kontrol edin

## 📱 Test

Botu ayarladıktan sonra şu komutları test edin:

- `/start` - Botu başlatır
- `/help` - Yardım menüsü
- `/dice` - Zar at
- `/joke` - Şaka

Komutlar çalışıyorsa her şey hazır! 🎉

---

**Not:** Bazı gruplarda botun komutları algılaması için botun mention edilmesi gerekebilir. Bu durumda komutu şu şekilde kullanın: `/start@TelegramBotGroup`

