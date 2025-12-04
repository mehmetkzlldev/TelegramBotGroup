import { Context, Markup } from 'telegraf';
import { InlineKeyboardMarkup } from 'telegraf/types';

// Mesaj şablonları
export const messageTemplates = {
  welcome: (firstName: string) => 
    `**Hoş geldin ${firstName}**\n\n` +
    `TelegramBotGroup'a kaydoldun. Tüm özellikleri kullanabilirsin.`,
  
  botIntroduction: (chatTitle: string, chatType: string) => {
    const chatTypeText = chatType === 'group' ? 'grubuna' : chatType === 'supergroup' ? 'süper grubuna' : 'kanala';
    return (
      `**TelegramBotGroup ${chatTypeText} eklendi**\n\n` +
      `Merhaba ${chatTitle}!\n\n` +
      `**Özellikler:**\n` +
      `• Otomatik kullanıcı kayıt sistemi\n` +
      `• Eğlenceli komutlar ve oyunlar\n` +
      `• İstatistikler ve profil sistemi\n` +
      `• Yardımcı araçlar\n\n` +
      `**Hızlı Başlangıç:**\n` +
      `• /start - Botu başlat\n` +
      `• /help - Tüm komutları gör\n` +
      `• /menu - İnteraktif menü`
    );
  },

  registered: (firstName: string) =>
    `**Kayıt başarılı**\n\n` +
    `Merhaba ${firstName}, botumuza hoş geldin. Artık tüm özellikleri kullanabilirsin.`,

  profile: (user: any, gameStats?: any) => {
    const name = `${user.first_name || ''} ${user.last_name || ''}`.trim() || 'İsimsiz';
    const username = user.username ? `@${user.username}` : 'Yok';
    const registeredDate = new Date(user.registered_at).toLocaleDateString('tr-TR');
    const lastActive = new Date(user.last_active).toLocaleDateString('tr-TR');
    
    // Reputation ve Level bilgileri
    const reputation = user.reputation || 0;
    const level = user.level || 1;
    const experience = user.experience || 0;
    const badges = user.badges || [];
    const requiredExp = 100 * level; // Bir sonraki level için gerekli experience
    
    let profileText = 
      `**PROFİL BİLGİLERİ**\n\n` +
      `**Kişisel Bilgiler**\n` +
      `İsim: ${name}\n` +
      `Kullanıcı Adı: ${username}\n` +
      `ID: \`${user.user_id}\`\n\n` +
      `**Reputation & Level**\n` +
      `Reputation: ${reputation}\n` +
      `Level: ${level}\n` +
      `Experience: ${experience}/${requiredExp}\n\n` +
      `**Kayıt Bilgileri**\n` +
      `Kayıt Tarihi: ${registeredDate}\n` +
      `Son Aktif: ${lastActive}\n` +
      `Durum: ${user.is_active ? 'Aktif' : 'Pasif'}\n\n` +
      `**İstatistikler**\n` +
      `Mesaj Sayısı: ${user.message_count || 0}\n` +
      `Komut Sayısı: ${user.command_count || 0}`;
    
    if (badges.length > 0) {
      profileText += `\n\n**Rozetler (${badges.length})**\n`;
      badges.slice(0, 5).forEach((badge: string) => {
        profileText += `• ${badge}\n`;
      });
      if (badges.length > 5) {
        profileText += `... ve ${badges.length - 5} rozet daha`;
      }
    }
    
    if (gameStats) {
      profileText += 
        `\n\n**Oyun İstatistikleri**\n` +
        `Zar Atışı: ${gameStats.dice_count || 0}\n` +
        `Yazı Tura: ${gameStats.flip_count || 0}\n` +
        `Oynanan Oyun: ${gameStats.games_played || 0}\n` +
        `Kazanılan Oyun: ${gameStats.games_won || 0}`;
      
      if (gameStats.games_played > 0) {
        const winRate = Math.round((gameStats.games_won / gameStats.games_played) * 100);
        profileText += `\nKazanma Oranı: ${winRate}%`;
      }
    }
    
    return profileText;
  },

  stats: (stats: any) =>
    `**BOT İSTATİSTİKLERİ**\n\n` +
    `Toplam Kullanıcı: ${stats.totalUsers}\n` +
    `Aktif Kullanıcı (7 gün): ${stats.activeUsers}\n` +
    `Toplam Mesaj: ${stats.totalMessages || 0}\n` +
    `En Çok Kullanılan Komutlar:\n${stats.popularCommands || 'Henüz veri yok'}`,

  helpMenu: () =>
    `**YARDIM MENÜSÜ**\n\n` +
    `**Temel Komutlar**\n` +
    `/start - Botu başlat\n` +
    `/help - Yardım menüsü\n` +
    `/menu - İnteraktif menü\n` +
    `/profile - Profil bilgileri\n` +
    `/stats - Bot istatistikleri\n` +
    `/info - Bot hakkında bilgi\n\n` +
    `**Eğlenceli Komutlar**\n` +
    `/dice - Zar at (örn: /dice 20)\n` +
    `/flip - Yazı tura\n` +
    `/random - Rastgele sayı (örn: /random 1 100)\n` +
    `/joke - Rastgele şaka (kategoriler: tech, math, general)\n` +
    `/quote - İlham verici söz (kategoriler: motivation, success, life)\n\n` +
    `**Yardımcı Komutlar**\n` +
    `/time - Saat bilgisi (örn: /time NY)\n` +
    `/date - Tarih bilgisi\n` +
    `/calc - Hesap makinesi (örn: /calc 5 + 3)\n\n` +
    `**Oyun Komutları**\n` +
    `/game - Oyun menüsü\n` +
    `/guess - Sayı tahmin oyunu (zorluk: easy, normal, hard, extreme)\n` +
    `/word - Kelime oyunu (zorluk: easy, normal, hard)\n\n` +
    `**Admin Komutları**\n` +
    `/admin - Admin paneli (sadece adminler)\n` +
    `/admin init - İlk admin ol (özel sohbette)`
};

// Inline keyboard oluşturucular
export const keyboards = {
  // Ana menü
  mainMenu(isAdmin: boolean = false): Markup.Markup<InlineKeyboardMarkup> {
    const buttons: any[] = [
      [
        Markup.button.callback('👤 Profilim', 'profile'),
        Markup.button.callback('📊 İstatistikler', 'stats')
      ],
      [
        Markup.button.callback('🎮 Oyunlar', 'game_menu'),
        Markup.button.callback('📚 Yardım', 'help')
      ],
      [
        Markup.button.callback('ℹ️ Bot Bilgisi', 'info'),
        Markup.button.callback('🔄 Yenile', 'refresh')
      ]
    ];
    
    if (isAdmin) {
      buttons.push([
        Markup.button.callback('⚙️ Admin Paneli', 'admin_menu')
      ]);
    }
    
    return Markup.inlineKeyboard(buttons);
  },

  // Admin menüsü
  adminMenu(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('👥 Kullanıcı Yönetimi', 'admin_users'),
        Markup.button.callback('📢 Grup Yönetimi', 'admin_group')
      ],
      [
        Markup.button.callback('📊 İstatistikler', 'admin_stats'),
        Markup.button.callback('💬 Mesajlaşma', 'admin_messaging')
      ],
      [
        Markup.button.callback('🤖 Bot Yönetimi', 'admin_bot'),
        Markup.button.callback('🔙 Ana Menü', 'main_menu')
      ]
    ]);
  },

  // Profil menüsü
  profileMenu(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('📊 İstatistiklerim', 'my_stats'),
        Markup.button.callback('🔙 Ana Menü', 'main_menu')
      ]
    ]);
  },

  // İstatistik menüsü
  statsMenu(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🔄 Yenile', 'refresh_stats'),
        Markup.button.callback('🔙 Ana Menü', 'main_menu')
      ]
    ]);
  },

  // Yardım menüsü
  helpMenu(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.url('📖 Dokümantasyon', 'https://core.telegram.org/bots/api'),
        Markup.button.callback('🔙 Ana Menü', 'main_menu')
      ]
    ]);
  },

  // Oyun menüsü
  gameMenu(): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('🎯 Sayı Tahmin', 'game_guess'),
        Markup.button.callback('📝 Kelime Oyunu', 'game_word')
      ],
      [
        Markup.button.callback('🔙 Ana Menü', 'main_menu')
      ]
    ]);
  },

  // Onay/İptal butonları
  confirmCancel(action: string): Markup.Markup<InlineKeyboardMarkup> {
    return Markup.inlineKeyboard([
      [
        Markup.button.callback('✅ Onayla', `confirm_${action}`),
        Markup.button.callback('❌ İptal', `cancel_${action}`)
      ]
    ]);
  }
};

// Mesaj gönderme yardımcı fonksiyonları
export const messagingHelpers = {
  // Butonlu mesaj gönder
  async sendWithKeyboard(
    ctx: Context,
    text: string,
    keyboard: Markup.Markup<InlineKeyboardMarkup>
  ) {
    return ctx.reply(text, keyboard);
  },

  // Dosya gönder
  async sendFile(
    ctx: Context,
    filePath: string,
    caption?: string
  ) {
    // Dosya tipine göre gönder
    if (filePath.endsWith('.jpg') || filePath.endsWith('.png') || filePath.endsWith('.jpeg')) {
      return ctx.replyWithPhoto({ source: filePath }, { caption });
    } else if (filePath.endsWith('.mp4') || filePath.endsWith('.mov')) {
      return ctx.replyWithVideo({ source: filePath }, { caption });
    } else if (filePath.endsWith('.mp3') || filePath.endsWith('.ogg')) {
      return ctx.replyWithAudio({ source: filePath }, { caption });
    } else {
      return ctx.replyWithDocument({ source: filePath }, { caption });
    }
  },

  // Mesajı düzenle
  async editMessage(
    ctx: Context,
    messageId: number,
    text: string,
    keyboard?: Markup.Markup<InlineKeyboardMarkup>
  ) {
    try {
      return await ctx.telegram.editMessageText(
        ctx.chat?.id,
        messageId,
        undefined,
        text,
        keyboard
      );
    } catch (error) {
      // Mesaj düzenlenemezse (çok eski veya değişmemişse) yeni mesaj gönder
      return ctx.reply(text, keyboard);
    }
  },

  // Mesajı sil
  async deleteMessage(ctx: Context, messageId: number) {
    try {
      return await ctx.telegram.deleteMessage(ctx.chat?.id!, messageId);
    } catch (error) {
      // Mesaj silinemezse sessizce devam et
      return null;
    }
  }
};

