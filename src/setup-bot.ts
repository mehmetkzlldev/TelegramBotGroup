import { Telegraf } from 'telegraf';
import * as dotenv from 'dotenv';

// Ortam değişkenlerini yükle
dotenv.config();

const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  console.error('❌ HATA: BOT_TOKEN bulunamadı!');
  process.exit(1);
}

const bot = new Telegraf(BOT_TOKEN);

// Bot bilgileri
const BOT_INFO = {
  description: 'Güvenlik ve koruma odaklı Telegram botu. Kullanıcılarınızı korur ve güvenli bir deneyim sunar.',
  about: 'TelegramBotGroup - Güvenliğiniz için buradayız! 🛡️'
};

async function setupBot() {
  try {
    console.log('🤖 Bot ayarları yapılıyor...\n');

    // Bot açıklamasını ayarla
    await bot.telegram.setMyShortDescription(BOT_INFO.description);
    console.log('✅ Bot açıklaması ayarlandı');

    // Bot hakkında metni ayarla
    await bot.telegram.setMyDescription(BOT_INFO.about);
    console.log('✅ Bot hakkında metni ayarlandı');

    // Not: Profil fotoğrafı sadece BotFather üzerinden ayarlanabilir
    console.log('ℹ️  Profil fotoğrafı için:');
    console.log('   Telegram\'da @BotFather ile konuşun');
    console.log('   /setuserpic komutunu gönderin');
    console.log('   Botunuzu seçin ve fotoğrafı gönderin');

    console.log('\n✅ Bot ayarları tamamlandı!');
    process.exit(0);
  } catch (error: any) {
    console.error('\n❌ Hata:', error.message);
    if (error.response) {
      console.error('Telegram API yanıtı:', error.response);
    }
    process.exit(1);
  }
}

setupBot();

