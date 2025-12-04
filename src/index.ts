import { Telegraf, Context } from 'telegraf';
import * as dotenv from 'dotenv';

// Modüller
import { userDB, messageDB, commandDB, gameDB, adminDB, banDB, warnDB, muteDB, reputationDB, dailyRewardDB, achievementDB } from './database';
import db from './database';
import logger from './logger';
import { messageTemplates, keyboards, messagingHelpers } from './messaging';
import { checkRateLimit, sanitizeText, formatNumber } from './utils/helpers';
import { BOT_CONFIG, RATE_LIMITS, TIMEZONES, PROFANITY_FILTER } from './config/constants';
import { detectProfanity, getProfanityResponse } from './utils/profanity';
import { checkSpam, checkFlood, checkBot, checkCaps, checkAntiRaid } from './utils/protection';

// Ortam değişkenlerini yükle
dotenv.config();

// Bot token'ını kontrol et
const BOT_TOKEN = process.env.BOT_TOKEN;

if (!BOT_TOKEN) {
  logger.error('INIT', 'BOT_TOKEN bulunamadı!');
  console.error('❌ HATA: BOT_TOKEN ortam değişkeni bulunamadı!');
  console.error('\n📝 Yapmanız gerekenler:');
  console.error('1. Proje klasöründe .env dosyası oluşturun');
  console.error('2. Dosyaya şu satırı ekleyin: BOT_TOKEN=your_bot_token_here');
  process.exit(1);
}

// Token formatını kontrol et
if (BOT_TOKEN.length < 40 || !BOT_TOKEN.includes(':')) {
  logger.warn('INIT', 'Bot token formatı geçersiz görünüyor');
  console.error('⚠️  UYARI: Bot token formatı geçersiz görünüyor!');
}

// Bot instance'ını oluştur
const bot = new Telegraf(BOT_TOKEN);

// Bot bilgileri - constants'tan al
const BOT_INFO = BOT_CONFIG;

// Bot başlangıç zamanı - eski mesajları görmezden gelmek için
let botStartTime = 0;

// Kullanıcı kayıt fonksiyonu
function registerUser(ctx: Context) {
  if (!ctx.from) return;

  try {
    userDB.saveUser({
      id: ctx.from.id,
      username: ctx.from.username,
      first_name: ctx.from.first_name,
      last_name: ctx.from.last_name,
      is_bot: ctx.from.is_bot || false,
      language_code: ctx.from.language_code
    });

    logger.user(ctx.from.id, 'Kayıt edildi/güncellendi', {
      username: ctx.from.username,
      name: ctx.from.first_name
    });
  } catch (error) {
    logger.errorHandler(error, 'registerUser');
  }
}

// Admin kontrolü
async function isAdmin(ctx: Context): Promise<boolean> {
  if (!ctx.from) return false;
  
  // Telegram grup admin kontrolü
  if (ctx.chat && 'id' in ctx.chat && ctx.chat.id < 0) {
    try {
      const chatMember = await ctx.telegram.getChatMember(ctx.chat.id, ctx.from.id);
      if (chatMember.status === 'administrator' || chatMember.status === 'creator') {
        return true;
      }
    } catch (error) {
      logger.errorHandler(error, 'isAdmin - getChatMember');
    }
  }
  
  // Bot admin kontrolü
  return adminDB.isAdmin(ctx.from.id);
}

// Admin kontrolü middleware
async function requireAdmin(ctx: Context, next: () => Promise<void>) {
  if (await isAdmin(ctx)) {
    return next();
  } else {
    await ctx.reply('❌ Bu komutu kullanmak için admin yetkisine ihtiyacın var!');
    return;
  }
}

// Admin komut handler fonksiyonları
async function handlePinCommand(ctx: Context, userId: number) {
  if (!ctx.message || !('reply_to_message' in ctx.message)) {
    await ctx.reply('**Hata:** Sabitlemek için bir mesaja yanıt verin.');
    return;
  }

  try {
    if (!ctx.message.reply_to_message) {
      await ctx.reply('**Hata:** Yanıt verilen mesaj bulunamadı.');
      return;
    }
    await ctx.telegram.pinChatMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
    await ctx.reply('**Mesaj sabitlendi**');
    logger.admin(userId, 'Pinned message');
  } catch (error) {
    logger.errorHandler(error, 'pin command');
    await ctx.reply('**Hata:** Mesaj sabitlenemedi.');
  }
}

async function handleUnpinCommand(ctx: Context, userId: number) {
  try {
    await ctx.telegram.unpinChatMessage(ctx.chat!.id);
    await ctx.reply('**Sabitlenmiş mesaj kaldırıldı**');
    logger.admin(userId, 'Unpinned message');
  } catch (error) {
    logger.errorHandler(error, 'unpin command');
    await ctx.reply('**Hata:** Sabitlenmiş mesaj kaldırılamadı.');
  }
}

async function handleDeleteCommand(ctx: Context, userId: number) {
  if (!ctx.message || !('reply_to_message' in ctx.message)) {
    await ctx.reply('**Hata:** Silmek için bir mesaja yanıt verin.');
    return;
  }

  try {
    if (!ctx.message.reply_to_message) {
      await ctx.reply('**Hata:** Yanıt verilen mesaj bulunamadı.');
      return;
    }
    await ctx.telegram.deleteMessage(ctx.chat!.id, ctx.message.reply_to_message.message_id);
    await ctx.reply('**Mesaj silindi**');
    logger.admin(userId, 'Deleted message');
  } catch (error) {
    logger.errorHandler(error, 'delete command');
    await ctx.reply('**Hata:** Mesaj silinemedi.');
  }
}

async function handleClearCommand(ctx: Context, userId: number, args: string[]) {
  const count = parseInt(args[1]) || 10;
  
  if (count > 100) {
    await ctx.reply('**Hata:** Maksimum 100 mesaj silinebilir.');
    return;
  }

  try {
    await ctx.reply('**Uyarı:** Toplu mesaj silme özelliği şu an için sınırlıdır. Lütfen mesajları tek tek silin veya Telegram\'ın kendi özelliklerini kullanın.');
    logger.admin(userId, `Clear command attempted (${count} messages)`);
  } catch (error) {
    logger.errorHandler(error, 'clear command');
    await ctx.reply('**Hata:** Mesajlar silinemedi.');
  }
}

async function handleStatsCommand(ctx: Context, userId: number) {
  const totalUsers = userDB.getTotalUsers();
  const activeUsers = userDB.getActiveUsers();
  const totalMessages = messageDB.getTotalMessages();
  const popularCommands = commandDB.getPopularCommands(5);
  
  let statsText = 
    `**DETAYLI İSTATİSTİKLER**\n\n` +
    `**Kullanıcılar**\n` +
    `Toplam: ${totalUsers}\n` +
    `Aktif (7 gün): ${activeUsers}\n\n` +
    `**Mesajlar**\n` +
    `Toplam: ${totalMessages}\n\n` +
    `**En Çok Kullanılan Komutlar**\n`;
  
  popularCommands.forEach((cmd, index) => {
    statsText += `${index + 1}. /${cmd.command_name} - ${cmd.count} kez\n`;
  });

  statsText += `\nTarih: ${new Date().toLocaleString('tr-TR')}`;

  await ctx.reply(statsText);
}

async function handleUsersCommand(ctx: Context, userId: number) {
  const users = db.users.slice(0, 50);
  let usersText = `**Kullanıcı Listesi** (İlk 50)\n\n`;
  
  users.forEach((user: any, index: number) => {
    usersText += `${index + 1}. ${user.first_name || 'İsimsiz'} (@${user.username || 'yok'}) - ID: ${user.user_id}\n`;
  });

  await ctx.reply(usersText);
}

async function handleTopUsersCommand(ctx: Context, userId: number) {
  const users = db.users
    .sort((a: any, b: any) => (b.message_count || 0) - (a.message_count || 0))
    .slice(0, 10);
  
  let topText = `**En Aktif Kullanıcılar**\n\n`;
  
  users.forEach((user: any, index: number) => {
    topText += `${index + 1}. ${user.first_name || 'İsimsiz'} - ${user.message_count || 0} mesaj\n`;
  });

  await ctx.reply(topText);
}

async function handleBroadcastCommand(ctx: Context, userId: number, args: string[]) {
  const message = args.slice(1).join(' ');
  
  if (!message) {
    await ctx.reply('**Hata:** Kullanım: /broadcast [mesaj]');
    return;
  }

  try {
    const users = db.users;
    let sent = 0;
    let failed = 0;

    for (const user of users) {
      try {
        await bot.telegram.sendMessage(user.user_id, `**Duyuru**\n\n${message}`, { parse_mode: 'Markdown' });
        sent++;
      } catch (error) {
        failed++;
      }
    }

    await ctx.reply(`**Broadcast tamamlandı**\n\nGönderilen: ${sent}\nBaşarısız: ${failed}`);
    logger.admin(userId, `Broadcast sent`, { sent, failed });
  } catch (error) {
    logger.errorHandler(error, 'broadcast command');
    await ctx.reply('**Hata:** Broadcast gönderilemedi.');
  }
}

async function handleAnnounceCommand(ctx: Context, userId: number, args: string[]) {
  const message = args.slice(1).join(' ');
  
  if (!message) {
    await ctx.reply('**Hata:** Kullanım: /announce [mesaj]');
    return;
  }

  try {
    await ctx.reply(`**Duyuru**\n\n${message}`, { parse_mode: 'Markdown' });
    logger.admin(userId, 'Announcement sent');
  } catch (error) {
    logger.errorHandler(error, 'announce command');
    await ctx.reply('**Hata:** Duyuru gönderilemedi.');
  }
}

async function handleStatusCommand(ctx: Context, userId: number) {
  const uptime = process.uptime();
  const hours = Math.floor(uptime / 3600);
  const minutes = Math.floor((uptime % 3600) / 60);
  const seconds = Math.floor(uptime % 60);

  const statusText = 
    `**BOT DURUMU**\n\n` +
    `Durum: Aktif\n` +
    `Çalışma Süresi: ${hours}s ${minutes}d ${seconds}s\n` +
    `Kullanıcılar: ${userDB.getTotalUsers()}\n` +
    `Mesajlar: ${messageDB.getTotalMessages()}\n` +
    `Tarih: ${new Date().toLocaleString('tr-TR')}`;

  await ctx.reply(statusText);
}

async function handleAddAdminCommand(ctx: Context, userId: number, args: string[]) {
  const targetUserId = parseInt(args[1]);
  
  if (!targetUserId) {
    await ctx.reply('**Hata:** Kullanım: /addadmin [user_id]');
    return;
  }

  try {
    adminDB.addAdmin(targetUserId, userId);
    await ctx.reply(`**Admin eklendi**\n\nID: ${targetUserId}`);
    logger.admin(userId, `Added admin ${targetUserId}`);
  } catch (error) {
    logger.errorHandler(error, 'addadmin command');
    await ctx.reply('**Hata:** Admin eklenemedi.');
  }
}

async function handleRemoveAdminCommand(ctx: Context, userId: number, args: string[]) {
  const targetUserId = parseInt(args[1]);
  
  if (!targetUserId) {
    await ctx.reply('**Hata:** Kullanım: /removeadmin [user_id]');
    return;
  }

  try {
    adminDB.removeAdmin(targetUserId);
    await ctx.reply(`**Admin kaldırıldı**\n\nID: ${targetUserId}`);
    logger.admin(userId, `Removed admin ${targetUserId}`);
  } catch (error) {
    logger.errorHandler(error, 'removeadmin command');
    await ctx.reply('**Hata:** Admin kaldırılamadı.');
  }
}

// Kullanıcı etiketinden veya mention'dan ID alma fonksiyonu
async function getUserFromMention(ctx: Context, mention?: string): Promise<number | null> {
  try {
    // 1. Reply varsa ondan al (ÖNCE BUNU KONTROL ET - EN ÖNCELİKLİ)
    if (ctx.message && 'reply_to_message' in ctx.message && ctx.message.reply_to_message?.from) {
      const replyUserId = ctx.message.reply_to_message.from.id;
      // Reply'daki kullanıcıyı veritabanına kaydet
      if (ctx.message.reply_to_message.from) {
        const replyUser = ctx.message.reply_to_message.from;
        userDB.saveUser({
          id: replyUser.id,
          username: replyUser.username,
          first_name: replyUser.first_name,
          last_name: replyUser.last_name,
          is_bot: replyUser.is_bot || false,
          language_code: replyUser.language_code
        });
      }
      return replyUserId;
    }

    // 2. Mention'dan ID çıkar (entities varsa)
    if (ctx.message && 'entities' in ctx.message) {
      const entities = ctx.message.entities || [];
      for (const entity of entities) {
        if (entity.type === 'text_mention' && entity.user) {
          return entity.user.id;
        }
      }
    }

    // 3. @username'den kullanıcı bul (veritabanında)
    if (mention && mention.startsWith('@')) {
      const username = mention.substring(1).toLowerCase();
      const user = db.users.find(u => u.username?.toLowerCase() === username);
      if (user) {
        return user.user_id;
      }
      // Veritabanında bulunamazsa null döner
    }

    // 4. ID olarak parse et
    if (mention) {
      const userIdMatch = mention.match(/\d+/);
      if (userIdMatch) {
        return parseInt(userIdMatch[0]);
      }
    }

    return null;
  } catch (error) {
    logger.errorHandler(error, 'getUserFromMention');
    return null;
  }
}

// Küfür yanıtı için rate limiting (aynı kullanıcıya kısa süre içinde tekrar yanıt verme)
const profanityResponseLimits: { [key: number]: number } = {};
const PROFANITY_RESPONSE_COOLDOWN = 30000; // 30 saniye

// Otomatik kullanıcı kayıt - Yeni üye eklendiğinde
bot.on('new_chat_members', async (ctx: Context) => {
  // Eski mesaj kontrolü
  if (botStartTime > 0 && ctx.message && 'date' in ctx.message) {
    const messageDate = ctx.message.date * 1000;
    if (messageDate < botStartTime) {
      return; // Eski mesaj, görmezden gel
    }
  }

  const newMembers = (ctx.message as any).new_chat_members;
  const chatId = ctx.chat?.id;
  const chatType = ctx.chat?.type;
  
  if (!newMembers || !Array.isArray(newMembers) || !chatId) return;
  
  // Anti-raid kontrolü (önce kontrol et)
  await checkAntiRaid(ctx);
  
  // Bot kontrolü (önce kontrol et)
  await checkBot(ctx);
  
  let botAdded = false;
  
  for (const member of newMembers) {
    // Bot kendisi eklendi mi kontrol et
    if (member.is_bot && member.id === ctx.botInfo?.id) {
      botAdded = true;
      continue;
    }
    
    // Normal kullanıcıları kaydet (hoş geldin mesajı gönderme)
    if (!member.is_bot) {
      try {
        userDB.saveUser({
          id: member.id,
          username: member.username,
          first_name: member.first_name,
          last_name: member.last_name,
          is_bot: member.is_bot || false,
          language_code: member.language_code
        });

        logger.user(member.id, 'Otomatik kayıt (gruba eklendi)', {
          chatId: chatId,
          username: member.username,
          chatType: chatType
        });
      } catch (error) {
        logger.errorHandler(error, 'new_chat_members');
      }
    }
  }
  
  // Bot kendisi eklendiyse sadece bir kez tanıtım mesajı gönder
  if (botAdded && chatId) {
    try {
      const chatTitle = (ctx.chat as any)?.title || 'Grup';
      const chatTypeText = chatType === 'group' ? 'grubuna' : chatType === 'supergroup' ? 'süper grubuna' : 'kanala';
      
      await ctx.reply(
        `**TelegramBotGroup ${chatTypeText} eklendi**\n\n` +
        `Merhaba ${chatTitle}!\n\n` +
        `**Özellikler:**\n` +
        `• Otomatik kullanıcı kayıt sistemi\n` +
        `• Eğlenceli komutlar ve oyunlar\n` +
        `• İstatistikler ve profil sistemi\n` +
        `• Yardımcı araçlar\n` +
        `• Chat koruma sistemleri\n\n` +
        `**Hızlı Başlangıç:**\n` +
        `/start - Botu başlat\n` +
        `/help - Tüm komutları gör\n` +
        `/menu - İnteraktif menü`,
        { parse_mode: 'Markdown' }
      );
      
      logger.info('BOT', `Bot ${chatTypeText} eklendi`, { chatId, chatType, chatTitle });
    } catch (error) {
      logger.errorHandler(error, 'bot_introduction');
    }
  }
});

// Middleware: Eski mesajları filtrele (bot kapandıktan sonra açıldığında önceki mesajları görmezden gel)
bot.use(async (ctx, next) => {
  // Bot başlangıç zamanı ayarlanmamışsa veya mesaj bot başlatıldıktan önce gönderilmişse atla
  if (botStartTime > 0 && ctx.message && 'date' in ctx.message) {
    const messageDate = ctx.message.date * 1000; // Unix timestamp'i milisaniyeye çevir
    if (messageDate < botStartTime) {
      // Eski mesaj, görmezden gel
      return;
    }
  }
  return next();
});

// Middleware: Her mesajda kullanıcıyı kaydet/güncelle
bot.use(async (ctx, next) => {
  if (ctx.from) {
    registerUser(ctx);
  }
  return next();
});

// Middleware: Rate limiting kontrolü (sadece spam önleme için, gevşetildi)
bot.use(async (ctx, next) => {
  const userId = ctx.from?.id;
  const message = (ctx.message as any)?.text;
  const chatType = ctx.chat?.type;
  
  // Admin komutları için rate limiting'i atla
  if (message && message.startsWith('/admin')) {
    return next();
  }
  
  // Sadece aşırı spam durumunda engelle
  if (userId && message && (chatType === 'private' || chatType === 'group' || chatType === 'supergroup')) {
    if (message.startsWith('/')) {
      const command = message.split(' ')[0].replace('/', '');
      
      // Rate limiting kontrolü (çok gevşek - sadece aşırı spam için)
      const limit = (chatType === 'group' || chatType === 'supergroup') ? RATE_LIMITS.command * 3 : RATE_LIMITS.command * 2;
      
      if (!checkRateLimit(userId, command, limit)) {
        // Sessizce devam et, rate limit mesajı gönderme (kullanıcı deneyimini bozmasın)
        return;
      }
    }
    // Mesaj rate limiting'i kaldırdık - komutlar için yeterli
  }
  
  return next();
});

// /start komutu
bot.start(async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'start');
  logger.command(userId, 'start');
  
  // Reputation ekle (komut başına 1 puan)
  const user = userDB.getUser(userId);
  if (user) {
    const commandCount = db.commands.filter(c => c.user_id === userId).length;
    reputationDB.addReputation(userId, 1);
    
    // Achievement kontrolü
    if (commandCount === 1 && !achievementDB.hasAchievement(userId, 'first_command')) {
      achievementDB.unlockAchievement(userId, 'first_command');
      reputationDB.addReputation(userId, 5);
    } else if (commandCount === 10 && !achievementDB.hasAchievement(userId, 'command_10')) {
      achievementDB.unlockAchievement(userId, 'command_10');
      reputationDB.addReputation(userId, 10);
    } else if (commandCount === 100 && !achievementDB.hasAchievement(userId, 'command_100')) {
      achievementDB.unlockAchievement(userId, 'command_100');
      reputationDB.addReputation(userId, 50);
    }
  }

  const chatType = ctx.chat?.type;
  const isGroup = chatType === 'group' || chatType === 'supergroup';

  if (isGroup) {
    // Grup içinde kısa mesaj
    try {
      await ctx.reply(
        `**Merhaba ${ctx.from.first_name || 'Kullanıcı'}**\n\n` +
        `TelegramBotGroup aktif. Komutlar için /help yazabilirsin.`
      );
    } catch (error: any) {
      // Bot gruptan atılmışsa sessizce devam et
      if (error.message?.includes('kicked') || error.message?.includes('Forbidden')) {
        logger.info('BOT', 'Bot gruptan atılmış, mesaj gönderilemedi', { chatId: ctx.chat?.id });
        return;
      }
      throw error;
    }
  } else {
    // Özel sohbette tam menü
    const isAdminUser = await isAdmin(ctx);
    await messagingHelpers.sendWithKeyboard(
      ctx,
      messageTemplates.welcome(ctx.from.first_name || 'Kullanıcı'),
      keyboards.mainMenu(isAdminUser)
    );
  }
});

// /help komutu - Geliştirilmiş yardım menüsü
bot.help(async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'help');
  logger.command(userId, 'help');

  const isAdminUser = await isAdmin(ctx);
  const userStats = userDB.getUserStats(userId);
  const totalCommands = userStats?.command_count || 0;

  let helpText = messageTemplates.helpMenu();
  
  if (isAdminUser) {
    helpText += `\n\n**Sen bir adminsin**\nAdmin komutlarını kullanabilirsin.`;
  }
  
  helpText += `\n\n**Senin İstatistiklerin**\n` +
    `Toplam Komut: ${totalCommands}\n` +
    `Daha fazla bilgi için: /profile`;

  await messagingHelpers.sendWithKeyboard(
    ctx,
    helpText,
    keyboards.helpMenu()
  );
});

// /menu komutu - İnteraktif menü (Profesyonel Embed)
bot.command('menu', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'menu');
  logger.command(userId, 'menu');

  const user = userDB.getUser(userId);
  const isAdminUser = await isAdmin(ctx);
  const userStats = userDB.getUserStats(userId);
  const gameStats = gameDB.getUserStat(userId);
  const totalUsers = userDB.getTotalUsers();
  const totalMessages = messageDB.getTotalMessages();
  
  const menuText = 
    `**TELEGRAMBOTGROUP v${BOT_CONFIG.version}**\n\n` +
    `**Kullanıcı Bilgileri**\n` +
    `İsim: ${ctx.from.first_name || 'Kullanıcı'} ${ctx.from.last_name || ''}\n` +
    `Kullanıcı Adı: ${ctx.from.username ? '@' + ctx.from.username : 'Yok'}\n` +
    `ID: \`${userId}\`\n` +
    `Mesaj Sayısı: ${user?.message_count || 0}` +
    `${gameStats?.games_played ? `\nOynanan Oyun: ${gameStats.games_played}` : ''}` +
    `${gameStats?.games_won ? `\nKazanılan Oyun: ${gameStats.games_won}` : ''}` +
    `${isAdminUser ? `\nYetki: Admin` : ''}\n\n` +
    `**Bot İstatistikleri**\n` +
    `Toplam Kullanıcı: ${totalUsers}\n` +
    `Toplam Mesaj: ${totalMessages}\n\n` +
    `**Kategoriler**\n` +
    `Eğlenceli Komutlar - /help yazıp kategoriden bak\n` +
    `Yardımcı Komutlar - /help yazıp kategoriden bak\n` +
    `Oyun Komutları - /help yazıp kategoriden bak` +
    `${isAdminUser ? `\nAdmin Komutları - /admin yaz` : ''}\n\n` +
    `Tüm komutlar için: /help`;

  await messagingHelpers.sendWithKeyboard(
    ctx,
    menuText,
    keyboards.mainMenu(isAdminUser)
  );
});

// /profile komutu
bot.command('profile', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'profile');
  logger.command(userId, 'profile');

  try {
    registerUser(ctx);
    const userStats = userDB.getUserStats(userId);
    const gameStats = gameDB.getUserStat(userId);
    
    if (userStats) {
      // Reputation ve level bilgilerini ekle
      const user = userDB.getUser(userId);
      if (user) {
        userStats.reputation = user.reputation || 0;
        userStats.level = user.level || 1;
        userStats.experience = user.experience || 0;
        userStats.badges = user.badges || [];
      }
      
      await messagingHelpers.sendWithKeyboard(
        ctx,
        messageTemplates.profile(userStats, gameStats),
        keyboards.profileMenu()
      );
    } else {
      await ctx.reply('**Hata:** Profil bilgisi bulunamadı. Lütfen /start komutunu kullanın.');
    }
  } catch (error) {
    logger.errorHandler(error, 'profile command');
    await ctx.reply('**Hata:** Profil bilgisi alınırken bir hata oluştu.');
  }
});

// /stats komutu
bot.command('stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'stats');
  logger.command(userId, 'stats');

  try {
    registerUser(ctx);
    const totalUsers = userDB.getTotalUsers();
    const activeUsers = userDB.getActiveUsers();
    const totalMessages = messageDB.getTotalMessages();
    const popularCommands = commandDB.getPopularCommands(5);
    const totalCommands = db.commands.length;
    const gameStats = gameDB.getUserStat(userId);

    let statsText = 
      `╔═══════════════════════════════════════╗\n` +
      `**BOT İSTATİSTİKLERİ**\n\n` +
      `**Kullanıcılar:**\n` +
      `• Toplam: ${totalUsers}\n` +
      `• Aktif (7 gün): ${activeUsers}\n` +
      `• Aktiflik Oranı: ${totalUsers > 0 ? Math.round((activeUsers / totalUsers) * 100) : 0}%\n\n` +
      `💬 **Mesajlar:**\n` +
      `• Toplam: ${totalMessages}\n` +
      `• Ortalama: ${totalUsers > 0 ? Math.round(totalMessages / totalUsers) : 0} mesaj/kullanıcı\n\n` +
      `⚡ **Komutlar:**\n` +
      `• Toplam Komut: ${totalCommands}\n` +
      `• En Çok Kullanılan:\n`;
    
    if (popularCommands.length > 0) {
      popularCommands.forEach((cmd: any, index: number) => {
        statsText += `  ${index + 1}. /${cmd.command_name} - ${cmd.count} kez\n`;
      });
    } else {
      statsText += `  Henüz veri yok\n`;
    }

    if (gameStats) {
      statsText += 
        `\n**Oyun İstatistikleri:**\n` +
        `• Toplam Zar: ${gameStats.dice_count || 0}\n` +
        `• Toplam Yazı Tura: ${gameStats.flip_count || 0}\n` +
        `• Oynanan Oyun: ${gameStats.games_played || 0}\n`;
    }

    statsText += `\n📅 **Tarih:** ${new Date().toLocaleString('tr-TR')}`;

    await messagingHelpers.sendWithKeyboard(
      ctx,
      statsText,
      keyboards.statsMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'stats command');
    ctx.reply('❌ İstatistikler alınırken bir hata oluştu.');
  }
});

// /info komutu
bot.command('info', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'info');
  logger.command(userId, 'info');

  try {
    const botInfo = await ctx.telegram.getMe();
    const totalUsers = userDB.getTotalUsers();
    const activeUsers = userDB.getActiveUsers();
    
    ctx.reply(
      `**BOT BİLGİLERİ**\n\n` +
      `Bot Adı: ${botInfo.first_name}\n` +
      `Kullanıcı Adı: @${botInfo.username}\n` +
      `Versiyon: ${BOT_INFO.version}\n` +
      `Durum: Aktif\n\n` +
      `**İstatistikler**\n` +
      `Toplam Kullanıcı: ${formatNumber(totalUsers)}\n` +
      `Aktif Kullanıcı (7 gün): ${formatNumber(activeUsers)}\n\n` +
      `${BOT_INFO.about}\n\n` +
      `Teknoloji: Node.js + TypeScript + Telegraf\n` +
      `Dokümantasyon: /help komutu ile tüm komutları görebilirsiniz.`
    );
  } catch (error) {
    logger.errorHandler(error, 'info command');
    ctx.reply('**Hata:** Bot bilgileri alınırken bir hata oluştu.');
  }
});

// /setup komutu
bot.command('setup', (ctx: Context) => {
  const userId = ctx.from?.id;
  if (userId) {
    commandDB.saveCommand(userId, 'setup');
    logger.command(userId, 'setup');
  }

  ctx.reply(
    `**Bot Ayarları**\n\n` +
    `Bot açıklaması ve profil fotoğrafı eklemek için:\n\n` +
    `1. Telegram'da @BotFather ile konuşun\n` +
    `2. Şu komutları kullanın:\n\n` +
    `Bot açıklaması için:\n` +
    `/setdescription\n` +
    `Açıklama: "${BOT_INFO.description}"\n\n` +
    `Hakkında metni için:\n` +
    `/setabouttext\n` +
    `Metin: "${BOT_INFO.about}"\n\n` +
    `Profil fotoğrafı için:\n` +
    `/setuserpic\n` +
    `(Fotoğrafı gönderin)\n\n` +
    `İpucu: Bot açıklaması bot arama sonuçlarında görünür!`
  );
});

// ========== EĞLENCELİ KOMUTLAR ==========

// /dice veya /zar - Basit zar atma
bot.command(['dice', 'zar'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    commandDB.saveCommand(userId, 'dice');
    logger.command(userId, 'dice');

    const args = (ctx.message as any)?.text?.split(' ') || [];
    let sides = 6; // Varsayılan 6 yüzlü zar

    // Basit kullanım: /dice veya /dice 20
    if (args.length >= 2) {
      const arg = args[1];
      if (arg.startsWith('d')) {
        sides = parseInt(arg.substring(1)) || 6;
      } else {
        sides = parseInt(arg) || 6;
      }
    }

    // Limitler
    if (sides < 2) sides = 2;
    if (sides > 100) sides = 100;

    const result = Math.floor(Math.random() * sides) + 1;
    gameDB.incrementDice(userId);

    await ctx.reply(`**Zar:** ${result} (1-${sides})`, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.errorHandler(error, 'dice command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /flip veya /yazitura - Basit yazı tura
bot.command(['flip', 'yazitura'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    commandDB.saveCommand(userId, 'flip');
    logger.command(userId, 'flip');

    const result = Math.random() < 0.5 ? 'Yazı' : 'Tura';
    
    gameDB.incrementFlip(userId, result === 'Yazı' ? 'yazi' : 'tura');

    await ctx.reply(`**${result}**`);
  } catch (error) {
    logger.errorHandler(error, 'flip command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /random veya /rastgele - Basit rastgele sayı
bot.command(['random', 'rastgele'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    commandDB.saveCommand(userId, 'random');
    logger.command(userId, 'random');

    const args = (ctx.message as any)?.text?.split(' ') || [];
    let min = 1;
    let max = 100;

    // Basit kullanım: /random veya /random 50 veya /random 1 100
    if (args.length >= 2) {
      min = parseInt(args[1]) || 1;
    }
    if (args.length >= 3) {
      max = parseInt(args[2]) || 100;
    } else if (args.length === 2) {
      max = min;
      min = 1;
    }

    if (min > max) [min, max] = [max, min];
    if (max > 10000) max = 10000;

    const randomNum = Math.floor(Math.random() * (max - min + 1)) + min;
    await ctx.reply(`**${randomNum}** (${min}-${max})`, { parse_mode: 'Markdown' });
  } catch (error) {
    logger.errorHandler(error, 'random command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /joke veya /saka - Gelişmiş şaka sistemi
bot.command(['joke', 'saka'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'joke');
  logger.command(userId, 'joke');

  const args = (ctx.message as any)?.text?.split(' ') || [];
  const category = args[1]?.toLowerCase();

  const jokesByCategory: { [key: string]: string[] } = {
    tech: [
      'Neden programcılar karanlıkta çalışır? Çünkü bug\'lar ışıktan korkar! 🐛',
      'Bir bilgisayar neden soğuk? Windows açık kalmış! ❄️',
      'İki programcı bir araya gelince ne olur? Bir bug, iki fix! 🐛➡️✅',
      'Neden botlar asla yorulmaz? Çünkü onların pil\'i var! 🔋',
      'Telegram\'da en hızlı kim? Tabii ki botlar! ⚡',
      'Neden botlar asla üşümez? Çünkü her zaman sıcak çalışırlar! 🔥',
      'Bir programcı neden asla aç kalmaz? Çünkü her zaman kod yazar! 💻',
      'Neden JavaScript geliştiricileri karanlıkta çalışır? Çünkü null ve undefined\'ı ayırt edemezler! 😄'
    ],
    math: [
      'Neden matematikçiler doğum günlerini unutmaz? Çünkü her yıl bir yıl daha yaşlanırlar! 😄',
      'Matematikçi neden asla yüzme havuzuna girmez? Çünkü integral almak istemez! 🏊',
      'Neden matematikçiler doğum günü partilerini sevmez? Çünkü sadece bir tane kek var! 🎂',
      'Matematikçi neden asla kaybolmaz? Çünkü her zaman bir çözümü vardır! 🗺️'
    ],
    general: [
      'Bir bot neden mutlu? Çünkü her zaman çalışıyor! 🤖',
      'Neden botlar asla yorulmaz? Çünkü onların pil\'i var! 🔋',
      'Telegram\'da en hızlı kim? Tabii ki botlar! ⚡',
      'Bir bot neden asla üşümez? Çünkü her zaman sıcak çalışır! 🔥',
      'Neden botlar asla aç kalmaz? Çünkü her zaman çalışır! ⚡',
      'Bir bot neden asla yalnız değildir? Çünkü her zaman kullanıcıları vardır! 👥'
    ]
  };

  let jokes: string[] = [];
  if (category && jokesByCategory[category]) {
    jokes = jokesByCategory[category];
  } else {
    // Tüm kategorilerden rastgele
    Object.values(jokesByCategory).forEach(catJokes => {
      jokes.push(...catJokes);
    });
  }

  const randomJoke = jokes[Math.floor(Math.random() * jokes.length)];
  let response = `**Rastgele Şaka**\n\n${randomJoke}`;
  
  if (!category) {
    response += `\n\nKategoriler: /joke tech, /joke math, /joke general`;
  }

  await ctx.reply(response);
});

// /quote veya /soz - Gelişmiş söz sistemi
bot.command(['quote', 'soz'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'quote');
  logger.command(userId, 'quote');

  const args = (ctx.message as any)?.text?.split(' ') || [];
  const category = args[1]?.toLowerCase();

  const quotesByCategory: { [key: string]: Array<{ text: string; author: string }> } = {
    success: [
      { text: 'Başarı, hazırlık ve fırsatın buluşmasıdır.', author: 'Seneca' },
      { text: 'Başarısızlık, başarının anahtarıdır.', author: 'Morihei Ueshiba' },
      { text: 'Bugün yapabileceğin en iyi şey, dün yaptığından daha iyisini yapmaktır.', author: 'Dale Carnegie' },
      { text: 'Başarı, küçük hataların toplamıdır.', author: 'Winston Churchill' },
      { text: 'Başarılı olmak için önce başarısız olmayı kabul etmelisin.', author: 'Michael Jordan' }
    ],
    motivation: [
      { text: 'Hayallerin peşinden git, asla vazgeçme.', author: 'Walt Disney' },
      { text: 'Gelecek, bugün yaptıklarımızın sonucudur.', author: 'Mahatma Gandhi' },
      { text: 'İmkansız sadece bir kelimedir, cesaret edenler için.', author: 'Napoleon Bonaparte' },
      { text: 'Hayatınızı değiştirmek istiyorsanız, düşüncelerinizi değiştirin.', author: 'Norman Vincent Peale' },
      { text: 'En büyük zafer, hiç düşmemek değil, her düştüğünde ayağa kalkmaktır.', author: 'Nelson Mandela' }
    ],
    tech: [
      { text: 'Kod yazmak bir sanattır, her satır bir fırça darbesidir.', author: 'Bilinmeyen Programcı' },
      { text: 'Teknoloji, insanların hayatını kolaylaştırmak içindir.', author: 'Steve Jobs' },
      { text: 'Yazılım, dünyayı değiştirebileceğiniz en güçlü araçtır.', author: 'Bill Gates' },
      { text: 'Programlama, problem çözme sanatıdır.', author: 'Edsger Dijkstra' },
      { text: 'Kod, bugünün ihtiyaçlarını karşılamalı, yarının değişikliklerine açık olmalıdır.', author: 'Martin Fowler' }
    ],
    wisdom: [
      { text: 'Öğrenmek asla bitmez, sadece derinleşir.', author: 'Leonardo da Vinci' },
      { text: 'Bilgi güçtür, ama paylaşılan bilgi daha güçlüdür.', author: 'Bilinmeyen' },
      { text: 'En iyi öğretmen, kendi hatalarından öğrenendir.', author: 'Confucius' },
      { text: 'Bilgelik, deneyimden gelir, deneyim hatalardan.', author: 'Albert Einstein' },
      { text: 'Öğrenmek için öğret, öğretmek için öğren.', author: 'Aristotle' }
    ]
  };

  let quotes: Array<{ text: string; author: string }> = [];
  if (category && quotesByCategory[category]) {
    quotes = quotesByCategory[category];
  } else {
    // Tüm kategorilerden rastgele
    Object.values(quotesByCategory).forEach(catQuotes => {
      quotes.push(...catQuotes);
    });
  }

  const randomQuote = quotes[Math.floor(Math.random() * quotes.length)];
  let response = `**İlham Verici Söz**\n\n"${randomQuote.text}"\n\n— ${randomQuote.author}`;
  
  if (!category) {
    response += `\n\nKategoriler: /quote success, /quote motivation, /quote tech, /quote wisdom`;
  }

  await ctx.reply(response);
});

// ========== YARDIMCI KOMUTLAR ==========

// /time veya /saat - Gelişmiş saat bilgisi
bot.command(['time', 'saat'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'time');
  logger.command(userId, 'time');

  const args = (ctx.message as any)?.text?.split(' ') || [];
  const timezone = args[1]?.toUpperCase() || 'IST';

  const timezones: { [key: string]: { name: string; tz: string; offset: string } } = {
    'IST': { name: 'İstanbul', tz: 'Europe/Istanbul', offset: 'GMT+3' },
    'UTC': { name: 'UTC', tz: 'UTC', offset: 'GMT+0' },
    'NY': { name: 'New York', tz: 'America/New_York', offset: 'GMT-5' },
    'LA': { name: 'Los Angeles', tz: 'America/Los_Angeles', offset: 'GMT-8' },
    'LON': { name: 'Londra', tz: 'Europe/London', offset: 'GMT+0' },
    'TOK': { name: 'Tokyo', tz: 'Asia/Tokyo', offset: 'GMT+9' }
  };

  const tzInfo = timezones[timezone] || timezones['IST'];
  const now = new Date();
  
  const timeString = now.toLocaleTimeString('tr-TR', { 
    hour: '2-digit', 
    minute: '2-digit', 
    second: '2-digit',
    timeZone: tzInfo.tz
  });
  const dateString = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: tzInfo.tz
  });

  let response = `**Saat Bilgisi**\n\n`;
  response += `Konum: ${tzInfo.name}\n`;
  response += `Saat: **${timeString}**\n`;
  response += `Tarih: ${dateString}\n`;
  response += `Saat Dilimi: ${tzInfo.offset}`;

  if (timezone === 'IST' || !args[1]) {
    response += `\n\nDiğer saat dilimleri: /time UTC, /time NY, /time LA, /time LON, /time TOK`;
  }

  await ctx.reply(response, { parse_mode: 'Markdown' });
});

// /date veya /tarih - Gelişmiş tarih bilgisi
bot.command(['date', 'tarih'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'date');
  logger.command(userId, 'date');

  const now = new Date();
  const dateString = now.toLocaleDateString('tr-TR', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    timeZone: 'Europe/Istanbul'
  });

  // Haftanın günü
  const dayOfWeek = now.toLocaleDateString('tr-TR', { weekday: 'long', timeZone: 'Europe/Istanbul' });
  
  // Yılın kaçıncı günü
  const startOfYear = new Date(now.getFullYear(), 0, 1);
  const dayOfYear = Math.floor((now.getTime() - startOfYear.getTime()) / (1000 * 60 * 60 * 24)) + 1;
  const daysInYear = ((now.getFullYear() % 4 === 0 && now.getFullYear() % 100 !== 0) || now.getFullYear() % 400 === 0) ? 366 : 365;
  
  // Haftanın kaçıncı günü
  const weekDay = now.getDay();
  const weekDayNames = ['Pazar', 'Pazartesi', 'Salı', 'Çarşamba', 'Perşembe', 'Cuma', 'Cumartesi'];

  let response = `**Tarih Bilgisi**\n\n`;
  response += `Tarih: **${dateString}**\n`;
  response += `Gün: ${weekDayNames[weekDay]}\n`;
  response += `Yılın ${dayOfYear}. günü (${daysInYear} günden)\n`;
  response += `İlerleme: ${Math.round((dayOfYear / daysInYear) * 100)}%`;

  await ctx.reply(response, { parse_mode: 'Markdown' });
});

// /calc veya /hesap - Gelişmiş hesap makinesi
bot.command(['calc', 'hesap'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'calc');
  logger.command(userId, 'calc');

  const args = (ctx.message as any)?.text?.split(' ').slice(1).join(' ') || '';
  
  if (!args) {
    await ctx.reply(
      `**Hesap Makinesi**\n\n` +
      `**Temel İşlemler**\n` +
      `/calc 5 + 3\n` +
      `/calc 10 * 2\n` +
      `/calc 20 / 4\n` +
      `/calc 15 - 7\n\n` +
      `**Gelişmiş**\n` +
      `/calc sqrt(16) - Karekök\n` +
      `/calc pow(2, 3) - Üs alma\n` +
      `/calc sin(30) - Trigonometri\n` +
      `/calc (5 + 3) * 2 - Parantez\n\n` +
      `**Birim Dönüşümleri**\n` +
      `/calc 100 km to mile\n` +
      `/calc 32 f to c (Fahrenheit to Celsius)\n` +
      `/calc 1000 m to km`,
      { parse_mode: 'Markdown' }
    );
    return;
  }

  try {
    // Birim dönüşümleri
    if (args.toLowerCase().includes(' to ')) {
      const parts = args.toLowerCase().split(' to ');
      if (parts.length === 2) {
        const value = parseFloat(parts[0].match(/[\d.]+/)?.[0] || '0');
        const fromUnit = parts[0].replace(/[\d.\s]/g, '').trim();
        const toUnit = parts[1].trim();

        let result = value;
        let resultText = '';

        // Uzunluk dönüşümleri
        if ((fromUnit === 'km' && toUnit === 'mile') || (fromUnit === 'kilometer' && toUnit === 'mile')) {
          result = value * 0.621371;
          resultText = `${value} km = ${result.toFixed(2)} mil`;
        } else if ((fromUnit === 'mile' && toUnit === 'km') || (fromUnit === 'mile' && toUnit === 'kilometer')) {
          result = value * 1.60934;
          resultText = `${value} mil = ${result.toFixed(2)} km`;
        } else if ((fromUnit === 'm' && toUnit === 'km') || (fromUnit === 'meter' && toUnit === 'kilometer')) {
          result = value / 1000;
          resultText = `${value} m = ${result.toFixed(2)} km`;
        } else if ((fromUnit === 'km' && toUnit === 'm') || (fromUnit === 'kilometer' && toUnit === 'meter')) {
          result = value * 1000;
          resultText = `${value} km = ${result.toFixed(2)} m`;
        }
        // Sıcaklık dönüşümleri
        else if ((fromUnit === 'f' || fromUnit === 'fahrenheit') && (toUnit === 'c' || toUnit === 'celsius')) {
          result = (value - 32) * 5/9;
          resultText = `${value}°F = ${result.toFixed(2)}°C`;
        } else if ((fromUnit === 'c' || fromUnit === 'celsius') && (toUnit === 'f' || toUnit === 'fahrenheit')) {
          result = (value * 9/5) + 32;
          resultText = `${value}°C = ${result.toFixed(2)}°F`;
        }

        if (resultText) {
          await ctx.reply(`**Birim Dönüşümü**\n\n${resultText}`, { parse_mode: 'Markdown' });
          return;
        }
      }
    }

    // Güvenlik: Sadece sayılar, operatörler ve güvenli fonksiyonlara izin ver
    let safeExpr = args.replace(/[^0-9+\-*/().\s]/g, '');
    
    // Gelişmiş fonksiyonlar için özel işlem
    if (args.includes('sqrt') || args.includes('pow') || args.includes('sin') || args.includes('cos') || args.includes('tan')) {
      safeExpr = args
        .replace(/sqrt\(/g, 'Math.sqrt(')
        .replace(/pow\(/g, 'Math.pow(')
        .replace(/sin\(/g, 'Math.sin(')
        .replace(/cos\(/g, 'Math.cos(')
        .replace(/tan\(/g, 'Math.tan(')
        .replace(/pi/g, 'Math.PI')
        .replace(/e/g, 'Math.E');
      
      // Sadece güvenli karakterlere izin ver
      safeExpr = safeExpr.replace(/[^0-9+\-*/().\sMath.sqrtpowincostanPI]/g, '');
    }

    const result = Function(`"use strict"; return (${safeExpr})`)();
    
    if (isNaN(result) || !isFinite(result)) {
      throw new Error('Geçersiz işlem');
    }

    await ctx.reply(
      `🔢 Hesap Sonucu\n\n` +
      `${args} = **${result}**`,
      { parse_mode: 'Markdown' }
    );
  } catch (error) {
    await ctx.reply('❌ Geçersiz işlem! Lütfen doğru formatta girin.\n\nÖrnek: /calc 5 + 3');
  }
});

// ========== OYUN KOMUTLARI ==========

// /game veya /oyun - Oyun menüsü
bot.command(['game', 'oyun'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'game');
  logger.command(userId, 'game');

  await messagingHelpers.sendWithKeyboard(
    ctx,
    `**Oyun Menüsü**\n\n` +
    `Hangi oyunu oynamak istersin?\n\n` +
    `/guess - Sayı tahmin oyunu\n` +
    `/word - Kelime oyunu`,
    keyboards.gameMenu()
  );
});

// /guess veya /tahmin - Gelişmiş sayı tahmin oyunu
const guessGames: { [key: number]: { number: number; attempts: number; maxAttempts: number; level: string; min: number; max: number } } = {};

bot.command(['guess', 'tahmin'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'guess');
  logger.command(userId, 'guess');

  const args = (ctx.message as any)?.text?.split(' ') || [];
  const level = args[1]?.toLowerCase() || 'normal';

  let min = 1, max = 100, maxAttempts = 7;
  let levelName = 'Normal';
  let levelEmoji = '⭐';

  if (level === 'easy' || level === 'kolay') {
    min = 1; max = 50; maxAttempts = 10;
    levelName = 'Kolay';
    levelEmoji = '🟢';
  } else if (level === 'hard' || level === 'zor') {
    min = 1; max = 200; maxAttempts = 5;
    levelName = 'Zor';
    levelEmoji = '🔴';
  } else if (level === 'extreme' || level === 'ekstrem') {
    min = 1; max = 1000; maxAttempts = 10;
    levelName = 'Ekstrem';
    levelEmoji = '💀';
  }

  const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
  guessGames[userId] = { number: randomNumber, attempts: 0, maxAttempts, level: levelName, min, max };

  const bestScore = gameDB.getUserBestScore(userId, 'guess');
  let bestScoreText = '';
  if (bestScore) {
    bestScoreText = `\nEn İyi Skorun: ${bestScore.score} puan (${bestScore.level || 'Normal'})`;
  }

  await ctx.reply(
    `**Sayı Tahmin Oyunu**\n\n` +
    `Zorluk: **${levelName}**\n` +
    `Aralık: ${min} - ${max}\n` +
    `Maksimum Tahmin: ${maxAttempts}\n\n` +
    `Tahmin etmek için: /guess <sayı>\n` +
    `Örnek: /guess ${Math.floor((min + max) / 2)}${bestScoreText ? `\n${bestScoreText.replace('🏆 ', 'En İyi Skorun: ')}` : ''}`
  );
});

// /guess komutuna sayı argümanı ile tahmin
bot.hears(/^\/guess\s+(\d+)$/i, async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const guess = parseInt((ctx.message as any)?.text?.match(/\d+/)?.[0] || '0');
  const game = guessGames[userId];

  if (!game) {
    await ctx.reply('**Hata:** Önce /guess komutu ile oyunu başlat.\n\nZorluk seviyeleri: /guess easy, /guess normal, /guess hard, /guess extreme');
    return;
  }

  if (guess < game.min || guess > game.max) {
    await ctx.reply(`**Hata:** Lütfen ${game.min} ile ${game.max} arasında bir sayı girin.`);
    return;
  }

  game.attempts++;

  if (guess === game.number) {
    // Skor hesapla: Daha az tahmin = daha yüksek skor
    const baseScore = 1000;
    const attemptBonus = (game.maxAttempts - game.attempts + 1) * 100;
    const levelMultiplier = game.level === 'Kolay' ? 0.5 : game.level === 'Zor' ? 2 : game.level === 'Ekstrem' ? 5 : 1;
    const score = Math.floor((baseScore + attemptBonus) * levelMultiplier);

    gameDB.saveGameScore(userId, 'guess', score, game.level);
    
    // Reputation ekle (oyun kazanma başına 10 puan)
    reputationDB.addReputation(userId, 10);
    
    // Achievement kontrolü
    const gameStats = gameDB.getUserStat(userId);
    if (gameStats.games_won === 1 && !achievementDB.hasAchievement(userId, 'game_win')) {
      achievementDB.unlockAchievement(userId, 'game_win');
      reputationDB.addReputation(userId, 15);
    } else if (gameStats.games_won === 10 && !achievementDB.hasAchievement(userId, 'game_10_wins')) {
      achievementDB.unlockAchievement(userId, 'game_10_wins');
      reputationDB.addReputation(userId, 100);
    }

    const bestScore = gameDB.getUserBestScore(userId, 'guess');
    let bestScoreText = '';
    if (bestScore && bestScore.score > score) {
      bestScoreText = `\nEn İyi Skorun: ${bestScore.score} puan`;
    } else {
      bestScoreText = `\nYeni Rekor!`;
    }

    await ctx.reply(
      `**Tebrikler! Doğru tahmin**\n\n` +
      `Sayı: **${game.number}**\n` +
      `Tahmin sayısı: ${game.attempts}/${game.maxAttempts}\n` +
      `Zorluk: ${game.level}\n` +
      `Skor: **${score}** puan${bestScoreText}`,
      { parse_mode: 'Markdown' }
    );
    delete guessGames[userId];
  } else if (game.attempts >= game.maxAttempts) {
    await ctx.reply(
      `**Oyun Bitti**\n\n` +
      `Doğru sayı: **${game.number}**\n` +
      `Tahmin sayısı: ${game.attempts}/${game.maxAttempts}\n\n` +
      `Tekrar denemek için: /guess ${game.level.toLowerCase()}`
    );
    delete guessGames[userId];
  } else if (guess < game.number) {
    const remaining = game.maxAttempts - game.attempts;
    await ctx.reply(`**Daha yüksek bir sayı dene**\n\nTahmin: ${game.attempts}/${game.maxAttempts} | Kalan: ${remaining}`);
  } else {
    const remaining = game.maxAttempts - game.attempts;
    await ctx.reply(`**Daha düşük bir sayı dene**\n\nTahmin: ${game.attempts}/${game.maxAttempts} | Kalan: ${remaining}`);
  }
});

// /word veya /kelime - Gelişmiş kelime oyunu
const wordGames: { [key: number]: { word: string; attempts: number; maxAttempts: number; level: string; hints: string[] } } = {};

const wordsByLevel: { [key: string]: string[] } = {
  easy: ['BOT', 'KOD', 'GÜN', 'GÜNEŞ', 'SU', 'HAVA', 'TOP', 'KALEM', 'KİTAP', 'MASA'],
  normal: ['YAZILIM', 'TELEGRAM', 'PROGRAM', 'TEKNOLOJİ', 'BİLGİSAYAR', 'GELİŞTİRME', 'ALGORİTMA', 'VERİTABANI', 'AĞ', 'SİSTEM'],
  hard: ['PROGRAMLAMA', 'YAPAYZEKA', 'MAKİNEÖĞRENMESİ', 'BLOKZİNCİR', 'KRİPTOGRAFİ', 'SİBERGÜVENLİK', 'BULUTBİLİŞİM', 'BÜYÜKVERİ', 'NÖRALAĞ', 'KANTUMBİLGİSAYAR']
};

bot.command(['word', 'kelime'], async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'word');
  logger.command(userId, 'word');

  const args = (ctx.message as any)?.text?.split(' ') || [];
  const level = args[1]?.toLowerCase() || 'normal';

  let words: string[] = wordsByLevel.normal;
  let levelName = 'Normal';
  let levelEmoji = '⭐';
  let maxAttempts = 6;

  if (level === 'easy' || level === 'kolay') {
    words = wordsByLevel.easy;
    levelName = 'Kolay';
    levelEmoji = '🟢';
    maxAttempts = 8;
  } else if (level === 'hard' || level === 'zor') {
    words = wordsByLevel.hard;
    levelName = 'Zor';
    levelEmoji = '🔴';
    maxAttempts = 5;
  }

  const randomWord = words[Math.floor(Math.random() * words.length)];
  const hints = [
    `Kelime ${randomWord.length} harfli`,
    `İlk harf: ${randomWord[0]}`,
    `Son harf: ${randomWord[randomWord.length - 1]}`
  ];

  wordGames[userId] = { word: randomWord, attempts: 0, maxAttempts, level: levelName, hints };

  const hiddenWord = randomWord.split('').map(() => '⬜').join(' ');

  const bestScore = gameDB.getUserBestScore(userId, 'word');
  let bestScoreText = '';
  if (bestScore) {
    bestScoreText = `\nEn İyi Skorun: ${bestScore.score} puan (${bestScore.level || 'Normal'})`;
  }

  await ctx.reply(
    `**Kelime Oyunu**\n\n` +
    `Zorluk: **${levelName}**\n` +
    `Kelimeyi tahmin et!\n\n` +
    `${hiddenWord}\n\n` +
    `Maksimum Tahmin: ${maxAttempts}\n` +
    `Tahmin etmek için: /word <kelime>\n` +
    `Örnek: /word ${randomWord[0]}${'?'.repeat(randomWord.length - 1)}${bestScoreText}`
  );
});

// /word komutuna kelime argümanı ile tahmin
bot.hears(/^\/word\s+([A-ZĞÜŞİÖÇ]+)$/i, async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  const guess = ((ctx.message as any)?.text?.match(/[A-ZĞÜŞİÖÇ]+/i)?.[0] || '').toUpperCase();
  const game = wordGames[userId];

  if (!game) {
    await ctx.reply('❌ Önce /word komutu ile oyunu başlat!\n\nZorluk seviyeleri: /word easy, /word normal, /word hard');
    return;
  }

  if (guess.length !== game.word.length) {
    await ctx.reply(`**Hata:** Kelime ${game.word.length} harfli olmalı. Sen ${guess.length} harf girdin.`);
    return;
  }

  game.attempts++;

  if (guess === game.word) {
    // Skor hesapla
    const baseScore = 500;
    const attemptBonus = (game.maxAttempts - game.attempts + 1) * 50;
    const levelMultiplier = game.level === 'Kolay' ? 0.5 : game.level === 'Zor' ? 3 : 1;
    const lengthBonus = game.word.length * 10;
    const score = Math.floor((baseScore + attemptBonus + lengthBonus) * levelMultiplier);

    gameDB.saveGameScore(userId, 'word', score, game.level);

    const bestScore = gameDB.getUserBestScore(userId, 'word');
    let bestScoreText = '';
    if (bestScore && bestScore.score > score) {
      bestScoreText = `\nEn İyi Skorun: ${bestScore.score} puan`;
    } else {
      bestScoreText = `\nYeni Rekor!`;
    }

    await ctx.reply(
      `**Tebrikler! Doğru kelime**\n\n` +
      `Kelime: **${game.word}**\n` +
      `Tahmin sayısı: ${game.attempts}/${game.maxAttempts}\n` +
      `Zorluk: ${game.level}\n` +
      `Skor: **${score}** puan${bestScoreText}`,
      { parse_mode: 'Markdown' }
    );
    delete wordGames[userId];
  } else if (game.attempts >= game.maxAttempts) {
    await ctx.reply(
      `😔 Oyun Bitti!\n\n` +
      `Doğru kelime: **${game.word}**\n` +
      `Tahmin sayısı: ${game.attempts}/${game.maxAttempts}\n\n` +
      `Tekrar denemek için: /word ${game.level.toLowerCase()}`
    );
    delete wordGames[userId];
  } else {
    // Harf bazlı ipucu ver
    let hint = '';
    for (let i = 0; i < game.word.length; i++) {
      if (guess[i] === game.word[i]) {
        hint += '🟩';
      } else if (game.word.includes(guess[i] || '')) {
        hint += '🟨';
      } else {
        hint += '⬜';
      }
    }

    const remaining = game.maxAttempts - game.attempts;
    let hintText = '';
    if (game.attempts === 2 && game.hints.length > 0) {
      hintText = `\nİpucu: ${game.hints[0]}`;
    } else if (game.attempts === 4 && game.hints.length > 1) {
      hintText = `\nİpucu: ${game.hints[1]}`;
    } else if (game.attempts === game.maxAttempts - 1 && game.hints.length > 2) {
      hintText = `\nSon İpucu: ${game.hints[2]}`;
    }

    await ctx.reply(
      `❌ Yanlış! İpucu:\n\n${hint}\n\n` +
      `Tahmin: ${game.attempts}/${game.maxAttempts} | Kalan: ${remaining}${hintText}\n` +
      `Tekrar dene!`
    );
  }
});

// Callback query handler (buton tıklamaları)
bot.action('profile', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const userStats = userDB.getUserStats(userId);
    if (userStats) {
      const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
        ? ctx.callbackQuery.message.message_id 
        : 0;
      await messagingHelpers.editMessage(
        ctx,
        messageId,
        messageTemplates.profile(userStats),
        keyboards.profileMenu()
      );
    }
  } catch (error) {
    logger.errorHandler(error, 'profile callback');
  }
});

bot.action('stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const totalUsers = userDB.getTotalUsers();
    const activeUsers = userDB.getActiveUsers();
    const popularCommands = commandDB.getPopularCommands(5);
    
    const commandsText = popularCommands.length > 0
      ? popularCommands.map((cmd: any, index: number) => 
          `${index + 1}. /${cmd.command_name} (${cmd.count} kez)`
        ).join('\n')
      : 'Henüz veri yok';

    const stats = {
      totalUsers,
      activeUsers,
      totalMessages: 0,
      popularCommands: commandsText
    };

    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      messageTemplates.stats(stats),
      keyboards.statsMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'stats callback');
  }
});

bot.action('info', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const botInfo = await ctx.telegram.getMe();
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      `ℹ️ Bot Bilgileri\n\n` +
      `Bot Adı: ${botInfo.first_name}\n` +
      `Kullanıcı Adı: @${botInfo.username}\n` +
      `Versiyon: ${BOT_INFO.version}\n` +
      `Durum: Aktif ✅\n\n` +
      `${BOT_INFO.about}`,
      keyboards.mainMenu(await isAdmin(ctx))
    );
  } catch (error) {
    logger.errorHandler(error, 'info callback');
  }
});

bot.action('help', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      messageTemplates.helpMenu(),
      keyboards.helpMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'help callback');
  }
});

bot.action('main_menu', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    await ctx.answerCbQuery();
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    
    const user = userDB.getUser(userId);
    const isAdminUser = await isAdmin(ctx);
    
    const menuText = 
      `╔═══════════════════════════════╗\n` +
      `║   🛡️ TELEGRAMBOTGROUP        ║\n` +
      `║      Ana Kontrol Paneli      ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `👤 Kullanıcı: ${ctx.from.first_name || 'Kullanıcı'}\n` +
      `🆔 ID: \`${userId}\`\n` +
      `📊 Mesaj Sayısı: ${user?.message_count || 0}\n` +
      `${isAdminUser ? '👑 Yetki: Admin\n' : ''}` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 **Hızlı Erişim:**\n` +
      `• Profil bilgilerinizi görüntüleyin\n` +
      `• Bot istatistiklerini inceleyin\n` +
      `• Eğlenceli oyunlar oynayın\n` +
      `• Yardım menüsüne erişin\n` +
      `${isAdminUser ? '• Admin paneline giriş yapın\n' : ''}` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 İpucu: Butonları kullanarak hızlıca gezin!`;

    await messagingHelpers.editMessage(
      ctx,
      messageId,
      menuText,
      keyboards.mainMenu(isAdminUser)
    );
  } catch (error) {
    logger.errorHandler(error, 'main_menu callback');
  }
});

bot.action('refresh', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    await ctx.answerCbQuery('🔄 Yenilendi!');
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    
    const user = userDB.getUser(userId);
    const isAdminUser = await isAdmin(ctx);
    
    const menuText = 
      `╔═══════════════════════════════╗\n` +
      `║   🛡️ TELEGRAMBOTGROUP        ║\n` +
      `║      Ana Kontrol Paneli      ║\n` +
      `╚═══════════════════════════════╝\n\n` +
      `👤 Kullanıcı: ${ctx.from.first_name || 'Kullanıcı'}\n` +
      `🆔 ID: \`${userId}\`\n` +
      `📊 Mesaj Sayısı: ${user?.message_count || 0}\n` +
      `${isAdminUser ? '👑 Yetki: Admin\n' : ''}` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `📋 **Hızlı Erişim:**\n` +
      `• Profil bilgilerinizi görüntüleyin\n` +
      `• Bot istatistiklerini inceleyin\n` +
      `• Eğlenceli oyunlar oynayın\n` +
      `• Yardım menüsüne erişin\n` +
      `${isAdminUser ? '• Admin paneline giriş yapın\n' : ''}` +
      `\n━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `💡 İpucu: Butonları kullanarak hızlıca gezin!`;

    await messagingHelpers.editMessage(
      ctx,
      messageId,
      menuText,
      keyboards.mainMenu(isAdminUser)
    );
  } catch (error) {
    logger.errorHandler(error, 'refresh callback');
  }
});

bot.action('refresh_stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery('🔄 İstatistikler yenilendi!');
    const totalUsers = userDB.getTotalUsers();
    const activeUsers = userDB.getActiveUsers();
    const popularCommands = commandDB.getPopularCommands(5);
    
    const commandsText = popularCommands.length > 0
      ? popularCommands.map((cmd: any, index: number) => 
          `${index + 1}. /${cmd.command_name} (${cmd.count} kez)`
        ).join('\n')
      : 'Henüz veri yok';

    const stats = {
      totalUsers,
      activeUsers,
      totalMessages: 0,
      popularCommands: commandsText
    };

    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      messageTemplates.stats(stats),
      keyboards.statsMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'refresh_stats callback');
  }
});

bot.action('my_stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const userStats = userDB.getUserStats(userId);
    if (userStats) {
      const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
        ? ctx.callbackQuery.message.message_id 
        : 0;
      await messagingHelpers.editMessage(
        ctx,
        messageId,
        messageTemplates.profile(userStats),
        keyboards.profileMenu()
      );
    }
  } catch (error) {
    logger.errorHandler(error, 'my_stats callback');
  }
});

// Oyun menüsü callback
bot.action('game_menu', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      `🎮 Oyun Menüsü\n\n` +
      `Hangi oyunu oynamak istersin?\n\n` +
      `🎯 /guess - Sayı tahmin oyunu\n` +
      `📝 /word - Kelime oyunu`,
      keyboards.gameMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'game_menu callback');
  }
});

// Oyun menüsü callback handler'ları
bot.action('game_guess', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const min = 1, max = 100, maxAttempts = 7;
    const levelName = 'Normal';
    const randomNumber = Math.floor(Math.random() * (max - min + 1)) + min;
    guessGames[userId] = { number: randomNumber, attempts: 0, maxAttempts, level: levelName, min, max };

    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      `🎯 Sayı Tahmin Oyunu ⭐\n\n` +
      `Zorluk: **Normal**\n` +
      `Aralık: ${min} - ${max}\n` +
      `Maksimum Tahmin: ${maxAttempts}\n\n` +
      `Tahmin etmek için: /guess <sayı>\n` +
      `Örnek: /guess 50\n\n` +
      `💡 Zorluk seviyeleri: /guess easy, /guess normal, /guess hard, /guess extreme`,
      keyboards.gameMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'game_guess callback');
  }
});

bot.action('game_word', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId || !('callbackQuery' in ctx) || !ctx.callbackQuery) return;

  try {
    await ctx.answerCbQuery();
    const words = wordsByLevel.normal;
    const levelName = 'Normal';
    const maxAttempts = 6;
    const randomWord = words[Math.floor(Math.random() * words.length)];
    const hints = [
      `Kelime ${randomWord.length} harfli`,
      `İlk harf: ${randomWord[0]}`,
      `Son harf: ${randomWord[randomWord.length - 1]}`
    ];
    wordGames[userId] = { word: randomWord, attempts: 0, maxAttempts, level: levelName, hints };

    const hiddenWord = randomWord.split('').map(() => '⬜').join(' ');

    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    await messagingHelpers.editMessage(
      ctx,
      messageId,
      `📝 Kelime Oyunu ⭐\n\n` +
      `Zorluk: **Normal**\n` +
      `Kelimeyi tahmin et!\n\n` +
      `${hiddenWord}\n\n` +
      `Maksimum Tahmin: ${maxAttempts}\n` +
      `Tahmin etmek için: /word <kelime>\n` +
      `Örnek: /word ${randomWord[0]}${'?'.repeat(randomWord.length - 1)}\n\n` +
      `💡 Zorluk seviyeleri: /word easy, /word normal, /word hard`,
      keyboards.gameMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'game_word callback');
  }
});

// Mesaj dinleyicisi - Mesajları logla, küfür kontrolü ve koruma sistemleri
bot.on('text', async (ctx: Context, next) => {
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const message = (ctx.message as any)?.text;

  if (!userId || !chatId || !message) {
    return next();
  }

  // Mute kontrolü
  if (muteDB.isMuted(userId, chatId)) {
    try {
      await ctx.deleteMessage();
      return; // Mesaj silindi, devam etme
    } catch (error) {
      // Sessizce devam et
    }
  }

  // Komut değilse
  if (!message.startsWith('/')) {
    try {
      // Koruma sistemleri (öncelikli)
      const isGroup = ctx.chat?.type === 'group' || ctx.chat?.type === 'supergroup';
      
      if (isGroup) {
        // Spam ve Flood koruması KAPALI - kullanıcılar rahatça mesaj yazabilir
        
        // Büyük harf kontrolü (sadece çok aşırı durumlar için)
        if (await checkCaps(ctx)) {
          return; // Mesaj silindi veya ban yapıldı
        }
      }

      // Küfür kontrolü (sadece aktifse)
      if (PROFANITY_FILTER.enabled && detectProfanity(message)) {
        const now = Date.now();
        const lastResponseTime = profanityResponseLimits[userId] || 0;
        
        if (now - lastResponseTime >= PROFANITY_RESPONSE_COOLDOWN) {
          const profanityResponse = getProfanityResponse();
          await ctx.reply(profanityResponse);
          profanityResponseLimits[userId] = now;
          
          logger.user(userId, 'Küfür tespit edildi ve yanıt verildi', {
            message: sanitizeText(message),
            chatId: chatId
          });
        }
      }

      // Mesajı veritabanına kaydet
      messageDB.saveMessage({
        userId,
        chatId,
        text: message,
        type: 'text'
      });

      // Mesaj sayısını artır
      userDB.incrementMessageCount(userId);
      
      // Reputation ekle (mesaj başına 1 puan)
      const user = userDB.getUser(userId);
      if (user) {
        const messageCount = user.message_count || 0;
        reputationDB.addReputation(userId, 1);
        
        // Achievement kontrolü
        if (messageCount === 1 && !achievementDB.hasAchievement(userId, 'first_message')) {
          achievementDB.unlockAchievement(userId, 'first_message');
          reputationDB.addReputation(userId, 5);
        } else if (messageCount === 10 && !achievementDB.hasAchievement(userId, 'message_10')) {
          achievementDB.unlockAchievement(userId, 'message_10');
          reputationDB.addReputation(userId, 10);
        } else if (messageCount === 100 && !achievementDB.hasAchievement(userId, 'message_100')) {
          achievementDB.unlockAchievement(userId, 'message_100');
          reputationDB.addReputation(userId, 50);
        } else if (messageCount === 1000 && !achievementDB.hasAchievement(userId, 'message_1000')) {
          achievementDB.unlockAchievement(userId, 'message_1000');
          reputationDB.addReputation(userId, 200);
        }
      }

      logger.message(userId, chatId, 'text message');
    } catch (error) {
      logger.errorHandler(error, 'text message handler');
    }
  }

  return next();
});

// ========== ADMIN KOMUTLARI ==========

// Kısa admin komutları (direkt kullanım)
// /ban komutu
bot.command('ban', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'ban');
  logger.command(userId, 'ban');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
  
  if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
    await ctx.reply('**Hata:** Kullanım: /ban @kullanıcı [sebep]\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
    return;
  }

  try {
    // Eğer targetUser yoksa ama reply varsa, boş string geç (fonksiyon reply'ı kontrol edecek)
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı! @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    banDB.banUser(targetUserId, chatId, userId, reason);
    
    try {
      await ctx.telegram.banChatMember(chatId, targetUserId);
      await ctx.reply(
        `**Kullanıcı yasaklandı**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\`\n` +
        `Sebep: ${reason}`,
        { parse_mode: 'Markdown' }
      );
      logger.admin(userId, `Banned user ${targetUserId}`, { reason, username: targetUsername });
    } catch (error: any) {
      await ctx.reply(`**Uyarı:** Kullanıcı veritabanına kaydedildi ancak Telegram API hatası: ${error.message}`);
    }
  } catch (error) {
    logger.errorHandler(error, 'ban command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /unban komutu
bot.command('unban', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'unban');
  logger.command(userId, 'unban');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  
  if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
    await ctx.reply('❌ Kullanım: /unban @kullanıcı\n💡 Veya bir mesaja yanıt vererek kullanabilirsin!');
    return;
  }

  try {
    // Eğer targetUser yoksa ama reply varsa, boş string geç (fonksiyon reply'ı kontrol edecek)
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı! @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    banDB.unbanUser(targetUserId, chatId);
    
    try {
      await ctx.telegram.unbanChatMember(chatId, targetUserId);
      await ctx.reply(
        `**Kullanıcının yasağı kaldırıldı**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\``,
        { parse_mode: 'Markdown' }
      );
      logger.admin(userId, `Unbanned user ${targetUserId}`, { username: targetUsername });
    } catch (error: any) {
      await ctx.reply(`**Uyarı:** Kullanıcı veritabanından kaldırıldı ancak Telegram API hatası: ${error.message}`);
    }
  } catch (error) {
    logger.errorHandler(error, 'unban command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /warn komutu
bot.command('warn', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'warn');
  logger.command(userId, 'warn');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  const reason = args.slice(1).join(' ') || 'Sebep belirtilmedi';
  
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('**Hata:** Kullanım: /warn @kullanıcı [sebep]\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
      return;
    }

  try {
    // Eğer targetUser yoksa ama reply varsa, boş string geç (fonksiyon reply'ı kontrol edecek)
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı! @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    warnDB.addWarn(targetUserId, chatId, userId, reason);
    const warnCount = warnDB.getWarnCount(targetUserId, chatId);
    
    await ctx.reply(
      `**Kullanıcı uyarıldı**\n\n` +
      `İsim: ${targetName}\n` +
      `Kullanıcı Adı: ${targetUsername}\n` +
      `ID: \`${targetUserId}\`\n` +
      `Sebep: ${reason}\n` +
      `Toplam Uyarı: ${warnCount}\n\n` +
      `${warnCount >= 3 ? '3 uyarıya ulaşıldı! Otomatik ban önerilir.' : ''}`,
      { parse_mode: 'Markdown' }
    );
    logger.admin(userId, `Warned user ${targetUserId}`, { reason, count: warnCount, username: targetUsername });
  } catch (error) {
    logger.errorHandler(error, 'warn command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /warns komutu
bot.command('warns', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'warns');
  logger.command(userId, 'warns');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('**Hata:** Kullanım: /warns @kullanıcı\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
      return;
    }

  try {
    // Eğer targetUser yoksa ama reply varsa, boş string geç (fonksiyon reply'ı kontrol edecek)
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı! @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    const warns = warnDB.getUserWarns(targetUserId, chatId);
    
    if (warns.length === 0) {
      await ctx.reply(
        `**Kullanıcının uyarısı yok**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\``,
        { parse_mode: 'Markdown' }
      );
      return;
    }

    let warnText = `**Uyarı Geçmişi**\n\n` +
      `İsim: ${targetName}\n` +
      `Kullanıcı Adı: ${targetUsername}\n` +
      `ID: \`${targetUserId}\`\n` +
      `Toplam: ${warns.length}\n\n`;
    
    warns.forEach((warn, index) => {
      const date = new Date(warn.warned_at).toLocaleString('tr-TR');
      warnText += `${index + 1}. ${date}\nSebep: ${warn.reason || 'Sebep belirtilmedi'}\n\n`;
    });

    await ctx.reply(warnText);
  } catch (error) {
    logger.errorHandler(error, 'warns command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /clearwarns komutu
bot.command('clearwarns', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'clearwarns');
  logger.command(userId, 'clearwarns');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  
  if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
    await ctx.reply('❌ Kullanım: /clearwarns @kullanıcı\n💡 Veya bir mesaja yanıt vererek kullanabilirsin!');
    return;
  }

  try {
    // Eğer targetUser yoksa ama reply varsa, boş string geç (fonksiyon reply'ı kontrol edecek)
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı! @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    warnDB.clearWarns(targetUserId, chatId);
    await ctx.reply(
      `✅ Kullanıcının tüm uyarıları temizlendi!\n\n` +
      `👤 İsim: ${targetName}\n` +
      `📝 Kullanıcı Adı: ${targetUsername}\n` +
      `🆔 ID: \`${targetUserId}\``
    );
    logger.admin(userId, `Cleared warns for user ${targetUserId}`, { username: targetUsername });
  } catch (error) {
    logger.errorHandler(error, 'clearwarns command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// /mute komutu
bot.command('mute', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'mute');
  logger.command(userId, 'mute');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  const durationArg = args[1]; // Örn: 5m, 1h, 30s
  const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
  
  if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
    await ctx.reply('**Hata:** Kullanım: /mute @kullanıcı [süre] [sebep]\n\nÖrnek: /mute @kullanıcı 5m spam\nSüre formatları: 30s, 5m, 1h, 1d\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
    return;
  }

  try {
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    // Süre parse et
    let duration: number | undefined;
    if (durationArg) {
      const match = durationArg.match(/(\d+)([smhd])/);
      if (match) {
        const value = parseInt(match[1]);
        const unit = match[2];
        switch (unit) {
          case 's': duration = value; break;
          case 'm': duration = value * 60; break;
          case 'h': duration = value * 3600; break;
          case 'd': duration = value * 86400; break;
        }
      }
    }

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    muteDB.muteUser(targetUserId, chatId, userId, duration, reason);
    
    try {
      await ctx.telegram.restrictChatMember(chatId, targetUserId, {
        permissions: {
          can_send_messages: false
        }
      });
      
      const durationText = duration ? ` (${durationArg})` : ' (süresiz)';
      await ctx.reply(
        `**Kullanıcı susturuldu**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\`\n` +
        `Süre: ${durationText}\n` +
        `Sebep: ${reason}`
      );
      logger.admin(userId, `Muted user ${targetUserId}`, { duration, reason, username: targetUsername });
    } catch (error: any) {
      await ctx.reply(`**Uyarı:** Kullanıcı veritabanına kaydedildi ancak Telegram API hatası: ${error.message}`);
    }
  } catch (error) {
    logger.errorHandler(error, 'mute command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// Direkt admin komutları (admin prefix olmadan)
// /pin komutu
bot.command('pin', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'pin');
  logger.command(userId, 'pin');

  await handlePinCommand(ctx, userId);
});

// /unpin komutu
bot.command('unpin', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'unpin');
  logger.command(userId, 'unpin');

  await handleUnpinCommand(ctx, userId);
});

// /delete komutu
bot.command('delete', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'delete');
  logger.command(userId, 'delete');

  await handleDeleteCommand(ctx, userId);
});

// /clear komutu
bot.command('clear', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'clear');
  logger.command(userId, 'clear');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  await handleClearCommand(ctx, userId, args);
});

// /stats komutu
bot.command('stats', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'stats');
  logger.command(userId, 'stats');

  await handleStatsCommand(ctx, userId);
});

// /users komutu
bot.command('users', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'users');
  logger.command(userId, 'users');

  await handleUsersCommand(ctx, userId);
});

// /topusers komutu
bot.command('topusers', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'topusers');
  logger.command(userId, 'topusers');

  await handleTopUsersCommand(ctx, userId);
});

// /broadcast komutu
bot.command('broadcast', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'broadcast');
  logger.command(userId, 'broadcast');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  await handleBroadcastCommand(ctx, userId, args);
});

// /announce komutu
bot.command('announce', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'announce');
  logger.command(userId, 'announce');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  await handleAnnounceCommand(ctx, userId, args);
});

// /status komutu
bot.command('status', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'status');
  logger.command(userId, 'status');

  await handleStatusCommand(ctx, userId);
});

// /addadmin komutu
bot.command('addadmin', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'addadmin');
  logger.command(userId, 'addadmin');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  await handleAddAdminCommand(ctx, userId, args);
});

// /removeadmin komutu
bot.command('removeadmin', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'removeadmin');
  logger.command(userId, 'removeadmin');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  await handleRemoveAdminCommand(ctx, userId, args);
});

// /unmute komutu
bot.command('unmute', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx);
  commandDB.saveCommand(userId, 'unmute');
  logger.command(userId, 'unmute');

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const targetUser = args[0];
  
  if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
    await ctx.reply('**Hata:** Kullanım: /unmute @kullanıcı\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
    return;
  }

  try {
    const targetUserId = await getUserFromMention(ctx, targetUser || '');
    
    if (!targetUserId) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
      return;
    }

    const chatId = ctx.chat?.id;
    if (!chatId) return;

    const targetUserInfo = userDB.getUser(targetUserId);
    const targetName = targetUserInfo?.first_name || 'Kullanıcı';
    const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

    muteDB.unmuteUser(targetUserId, chatId);
    
    try {
      await ctx.telegram.restrictChatMember(chatId, targetUserId, {
        permissions: {
          can_send_messages: true
        }
      });
      
      await ctx.reply(
        `**Kullanıcının susturması kaldırıldı**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\``
      );
      logger.admin(userId, `Unmuted user ${targetUserId}`, { username: targetUsername });
    } catch (error: any) {
      await ctx.reply(`**Uyarı:** Kullanıcı veritabanından kaldırıldı ancak Telegram API hatası: ${error.message}`);
    }
  } catch (error) {
    logger.errorHandler(error, 'unmute command');
    await ctx.reply('**Hata:** Bir hata oluştu.');
  }
});

// Admin menü callback
bot.action('admin_menu', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  const userId = ctx.from?.id;
  if (!userId) return;

  try {
    await ctx.answerCbQuery();
    const messageId = 'message' in ctx.callbackQuery && ctx.callbackQuery.message 
      ? ctx.callbackQuery.message.message_id 
      : 0;
    
    const adminText = 
      `**ADMIN PANELİ**\n\n` +
      `Yetkili: ${ctx.from.first_name || 'Admin'}\n` +
      `ID: \`${userId}\`\n\n` +
      `**Yönetim Seçenekleri:**\n\n` +
      `**Kullanıcı Yönetimi**\n` +
      `• Ban/Unban işlemleri\n` +
      `• Uyarı sistemi\n` +
      `• Kullanıcı bilgileri\n\n` +
      `**Grup Yönetimi**\n` +
      `• Mesaj yönetimi\n` +
      `• Pin/Unpin işlemleri\n` +
      `• Grup ayarları\n\n` +
      `**İstatistikler**\n` +
      `• Detaylı raporlar\n` +
      `• Log görüntüleme\n` +
      `• Kullanıcı analizi\n\n` +
      `**Mesajlaşma**\n` +
      `• Broadcast mesajlar\n` +
      `• Duyuru sistemi\n\n` +
      `**Bot Yönetimi**\n` +
      `• Bot durumu\n` +
      `• Ayarlar`;

    await messagingHelpers.editMessage(
      ctx,
      messageId,
      adminText,
      keyboards.adminMenu()
    );
  } catch (error) {
    logger.errorHandler(error, 'admin_menu callback');
  }
});

// Admin callback handler'ları
bot.action('admin_users', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    `👥 **Kullanıcı Yönetimi Komutları:**\n\n` +
    `🔨 /admin ban @kullanıcı [sebep] - Kullanıcıyı yasakla\n` +
    `✅ /admin unban @kullanıcı - Yasaklamayı kaldır\n` +
    `⚠️ /admin warn @kullanıcı [sebep] - Kullanıcıyı uyar\n` +
    `🔇 /admin mute @kullanıcı [süre] - Kullanıcıyı sustur\n` +
    `🔊 /admin unmute @kullanıcı - Susturmayı kaldır\n` +
    `👢 /admin kick @kullanıcı - Kullanıcıyı gruptan at\n` +
    `📋 /admin warns @kullanıcı - Uyarıları görüntüle\n` +
    `🗑️ /admin clearwarns @kullanıcı - Uyarıları temizle`
  );
});

bot.action('admin_group', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    `📢 **Grup Yönetimi Komutları:**\n\n` +
    `📌 /admin pin [yanıt] - Mesajı sabitle\n` +
    `📌 /admin unpin - Sabitlenmiş mesajı kaldır\n` +
    `🗑️ /admin delete [yanıt] - Mesajı sil\n` +
    `🧹 /admin clear [sayı] - Son N mesajı sil\n` +
    `⚙️ /admin settings - Grup ayarlarını göster`
  );
});

bot.action('admin_stats', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    `📊 **İstatistik Komutları:**\n\n` +
    `📈 /admin stats - Detaylı bot istatistikleri\n` +
    `👥 /admin users - Kullanıcı listesi\n` +
    `📝 /admin logs [limit] - Son logları göster\n` +
    `🏆 /admin topusers - En aktif kullanıcılar\n` +
    `📋 /admin reports - Şikayetleri göster`
  );
});

bot.action('admin_messaging', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    `💬 **Mesajlaşma Komutları:**\n\n` +
    `📢 /admin broadcast [mesaj] - Tüm kullanıcılara mesaj gönder\n` +
    `📣 /admin announce [mesaj] - Grup duyurusu yap\n` +
    `💬 /admin reply [user_id] [mesaj] - Kullanıcıya özel yanıt`
  );
});

bot.action('admin_bot', async (ctx: Context) => {
  if (!('callbackQuery' in ctx) || !ctx.callbackQuery) return;
  await ctx.answerCbQuery();
  await ctx.reply(
    `🤖 **Bot Yönetimi Komutları:**\n\n` +
    `🔄 /admin restart - Botu yeniden başlat\n` +
    `📊 /admin status - Bot durumunu göster\n` +
    `⚙️ /admin config - Bot ayarlarını değiştir\n` +
    `👑 /admin addadmin [user_id] - Admin ekle\n` +
    `🗑️ /admin removeadmin [user_id] - Admin kaldır`
  );
});

// Admin komutları
bot.command('admin', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  registerUser(ctx); // Kullanıcıyı kaydet

  const args = ctx.message && 'text' in ctx.message ? ctx.message.text.split(' ').slice(1) : [];
  const subCommand = args[0];

  commandDB.saveCommand(userId, 'admin');
  logger.command(userId, `admin ${subCommand || ''}`);

  // İlk admin olmak için özel komut (sadece özel sohbette ve admin listesi boşsa)
  if (subCommand === 'init' && ctx.chat?.type === 'private') {
    const admins = adminDB.getAdmins();
    if (admins.length === 0) {
      adminDB.addAdmin(userId, userId);
      await ctx.reply(`**İlk admin olarak eklendin**\n\nID: ${userId}\n\nArtık /admin komutlarını kullanabilirsin.`);
      logger.admin(userId, 'First admin initialized');
      return;
    } else {
      await ctx.reply('**Hata:** İlk admin zaten ayarlanmış.');
      return;
    }
  }

  // Admin kontrolü (init komutu hariç)
  const isAdminUser = await isAdmin(ctx);
  if (subCommand !== 'init' && !isAdminUser) {
    await ctx.reply(
      `**Hata:** Bu komutu kullanmak için admin yetkisine ihtiyacın var.\n\n` +
      `İlk admin olmak için (özel sohbette):\n` +
      `/admin init\n\n` +
      `Not: Grup içinde grup admini olman veya bot admini olman gerekiyor.`
    );
    return;
  }

  commandDB.saveCommand(userId, 'admin');
  logger.command(userId, `admin ${subCommand || ''}`);

  if (!subCommand) {
    await messagingHelpers.sendWithKeyboard(
      ctx,
      `**Admin Paneli**\n\nKomut kullanımı: /admin [komut]\n\nYardım için /admin help yazın.\n\nKısa komutlar: /ban, /warn, /unban, /warns, /clearwarns`,
      keyboards.adminMenu()
    );
    return;
  }

  // Kullanıcı yönetimi - admin komutları
  if (subCommand === 'ban') {
    const targetUser = args[1];
    const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
    
    if (!targetUser) {
      await ctx.reply('**Hata:** Kullanım: /admin ban @kullanıcı [sebep]');
      return;
    }

    try {
      const userIdMatch = targetUser.match(/\d+/);
      const targetUserId = userIdMatch ? parseInt(userIdMatch[0]) : null;
      
      if (!targetUserId) {
        await ctx.reply('**Hata:** Geçersiz kullanıcı.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      banDB.banUser(targetUserId, chatId, userId, reason);
      
      try {
        await ctx.telegram.banChatMember(chatId, targetUserId);
        await ctx.reply(`**Kullanıcı yasaklandı**\n\nID: ${targetUserId}\nSebep: ${reason}`);
        logger.admin(userId, `Banned user ${targetUserId}`, { reason });
      } catch (error: any) {
        await ctx.reply(`**Uyarı:** Kullanıcı veritabanına kaydedildi ancak Telegram API hatası: ${error.message}`);
      }
    } catch (error) {
      logger.errorHandler(error, 'admin ban');
      await ctx.reply('**Hata:** Bir hata oluştu.');
    }
  }

  else if (subCommand === 'unban') {
    const targetUser = args[1];
    
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('❌ Kullanım: /admin unban @kullanıcı\n💡 Veya bir mesaja yanıt vererek kullanabilirsin!');
      return;
    }

    try {
      const targetUserId = targetUser ? await getUserFromMention(ctx, targetUser) : null;
      
      if (!targetUserId) {
        await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const targetUserInfo = userDB.getUser(targetUserId);
      const targetName = targetUserInfo?.first_name || 'Kullanıcı';
      const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

      banDB.unbanUser(targetUserId, chatId);
      
      try {
        await ctx.telegram.unbanChatMember(chatId, targetUserId);
        await ctx.reply(
          `**Kullanıcının yasağı kaldırıldı**\n\n` +
          `İsim: ${targetName}\n` +
          `Kullanıcı Adı: ${targetUsername}\n` +
          `ID: \`${targetUserId}\``
        );
        logger.admin(userId, `Unbanned user ${targetUserId}`, { username: targetUsername });
      } catch (error: any) {
        await ctx.reply(`**Uyarı:** Kullanıcı veritabanından kaldırıldı ancak Telegram API hatası: ${error.message}`);
      }
    } catch (error) {
      logger.errorHandler(error, 'admin unban');
      await ctx.reply('**Hata:** Bir hata oluştu.');
    }
  }

  else if (subCommand === 'warn') {
    const targetUser = args[1];
    const reason = args.slice(2).join(' ') || 'Sebep belirtilmedi';
    
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('**Hata:** Kullanım: /admin warn @kullanıcı [sebep]\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
      return;
    }

    try {
      const targetUserId = targetUser ? await getUserFromMention(ctx, targetUser) : null;
      
      if (!targetUserId) {
        await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const targetUserInfo = userDB.getUser(targetUserId);
      const targetName = targetUserInfo?.first_name || 'Kullanıcı';
      const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

      warnDB.addWarn(targetUserId, chatId, userId, reason);
      const warnCount = warnDB.getWarnCount(targetUserId, chatId);
      
      await ctx.reply(
        `**Kullanıcı uyarıldı**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\`\n` +
        `Sebep: ${reason}\n` +
        `Toplam Uyarı: ${warnCount}` +
        `${warnCount >= 3 ? `\n\n3 uyarıya ulaşıldı. Otomatik ban önerilir.` : ''}`
      );
      logger.admin(userId, `Warned user ${targetUserId}`, { reason, count: warnCount, username: targetUsername });
    } catch (error) {
      logger.errorHandler(error, 'admin warn');
      await ctx.reply('**Hata:** Bir hata oluştu.');
    }
  }

  else if (subCommand === 'warns') {
    const targetUser = args[1];
    
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('**Hata:** Kullanım: /admin warns @kullanıcı\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
      return;
    }

    try {
      const targetUserId = targetUser ? await getUserFromMention(ctx, targetUser) : null;
      
      if (!targetUserId) {
        await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const targetUserInfo = userDB.getUser(targetUserId);
      const targetName = targetUserInfo?.first_name || 'Kullanıcı';
      const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

      const warns = warnDB.getUserWarns(targetUserId, chatId);
      
      if (warns.length === 0) {
        await ctx.reply(
          `**Kullanıcının uyarısı yok**\n\n` +
          `İsim: ${targetName}\n` +
          `Kullanıcı Adı: ${targetUsername}\n` +
          `ID: \`${targetUserId}\``
        );
        return;
      }

      let warnText = `**Uyarı Geçmişi**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\`\n` +
        `Toplam: ${warns.length}\n\n`;
      
      warns.forEach((warn, index) => {
        const date = new Date(warn.warned_at).toLocaleString('tr-TR');
        warnText += `${index + 1}. ${date}\n${warn.reason || 'Sebep belirtilmedi'}\n\n`;
      });

      await ctx.reply(warnText);
    } catch (error) {
      logger.errorHandler(error, 'admin warns');
      await ctx.reply('**Hata:** Bir hata oluştu.');
    }
  }

  else if (subCommand === 'clearwarns') {
    const targetUser = args[1];
    
    if (!targetUser && !(ctx.message && 'reply_to_message' in ctx.message)) {
      await ctx.reply('**Hata:** Kullanım: /admin clearwarns @kullanıcı\n\nVeya bir mesaja yanıt vererek kullanabilirsin.');
      return;
    }

    try {
      const targetUserId = targetUser ? await getUserFromMention(ctx, targetUser) : null;
      
      if (!targetUserId) {
        await ctx.reply('**Hata:** Kullanıcı bulunamadı. @kullanıcı şeklinde etiketle veya bir mesaja yanıt ver.');
        return;
      }

      const chatId = ctx.chat?.id;
      if (!chatId) return;

      const targetUserInfo = userDB.getUser(targetUserId);
      const targetName = targetUserInfo?.first_name || 'Kullanıcı';
      const targetUsername = targetUserInfo?.username ? `@${targetUserInfo.username}` : 'Yok';

      warnDB.clearWarns(targetUserId, chatId);
      await ctx.reply(
        `**Kullanıcının tüm uyarıları temizlendi**\n\n` +
        `İsim: ${targetName}\n` +
        `Kullanıcı Adı: ${targetUsername}\n` +
        `ID: \`${targetUserId}\``
      );
      logger.admin(userId, `Cleared warns for user ${targetUserId}`, { username: targetUsername });
    } catch (error) {
      logger.errorHandler(error, 'admin clearwarns');
      await ctx.reply('**Hata:** Bir hata oluştu.');
    }
  }

  // Grup yönetimi
  else if (subCommand === 'pin') {
    await handlePinCommand(ctx, userId);
  }

  else if (subCommand === 'unpin') {
    await handleUnpinCommand(ctx, userId);
  }

  else if (subCommand === 'delete') {
    await handleDeleteCommand(ctx, userId);
  }

  else if (subCommand === 'clear') {
    await handleClearCommand(ctx, userId, args);
  }

  // İstatistikler
  else if (subCommand === 'stats') {
    await handleStatsCommand(ctx, userId);
  }

  else if (subCommand === 'users') {
    await handleUsersCommand(ctx, userId);
  }

  else if (subCommand === 'topusers') {
    await handleTopUsersCommand(ctx, userId);
  }

  // Mesajlaşma
  else if (subCommand === 'broadcast') {
    await handleBroadcastCommand(ctx, userId, args);
  }

  else if (subCommand === 'announce') {
    await handleAnnounceCommand(ctx, userId, args);
  }

  // Bot yönetimi
  else if (subCommand === 'status') {
    await handleStatusCommand(ctx, userId);
  }

  else if (subCommand === 'addadmin') {
    await handleAddAdminCommand(ctx, userId, args);
  }

  else if (subCommand === 'removeadmin') {
    await handleRemoveAdminCommand(ctx, userId, args);
  }

  else if (subCommand === 'help') {
    await ctx.reply(
      `**Admin Komutları Yardımı**\n\n` +
      `**Kullanıcı Yönetimi**\n` +
      `/admin ban @kullanıcı [sebep]\n` +
      `/admin unban @kullanıcı\n` +
      `/admin warn @kullanıcı [sebep]\n` +
      `/admin warns @kullanıcı\n` +
      `/admin clearwarns @kullanıcı\n\n` +
      `**Grup Yönetimi**\n` +
      `/admin pin [yanıt]\n` +
      `/admin unpin\n` +
      `/admin delete [yanıt]\n` +
      `/admin clear [sayı]\n\n` +
      `**İstatistikler**\n` +
      `/admin stats\n` +
      `/admin users\n` +
      `/admin topusers\n\n` +
      `**Mesajlaşma**\n` +
      `/admin broadcast [mesaj]\n` +
      `/admin announce [mesaj]\n\n` +
      `**Bot Yönetimi**\n` +
      `/admin status\n` +
      `/admin addadmin [user_id]\n` +
      `/admin removeadmin [user_id]`
    );
  }

  else {
    await ctx.reply('**Hata:** Bilinmeyen komut. /admin help yazarak tüm komutları görebilirsin.');
  }
});

// Hata yakalama
bot.catch((err, ctx) => {
  // Bot gruptan atıldığında veya benzer hatalarda sessizce devam et
  if (err.message?.includes('kicked') || 
      err.message?.includes('Forbidden: bot was kicked') ||
      err.message?.includes('chat not found') ||
      err.message?.includes('bot is not a member')) {
    logger.info('BOT', 'Bot gruptan atılmış veya grup bulunamadı', { 
      error: err.message,
      chatId: ctx?.chat?.id 
    });
    return;
  }
  
  logger.errorHandler(err, 'bot.catch');
  if (ctx.from?.id) {
    logger.user(ctx.from.id, 'Hata oluştu', { error: err });
  }
  
  try {
    ctx.reply('❌ Bir hata oluştu. Lütfen daha sonra tekrar deneyin.');
  } catch (replyError) {
    // Yanıt gönderilemezse sessizce devam et
  }
});

// Bot açıklamasını ayarla
async function setupBotInfo() {
  try {
    await bot.telegram.setMyShortDescription(BOT_INFO.description);
    logger.info('BOT', 'Bot açıklaması ayarlandı');
    
    await bot.telegram.setMyDescription(BOT_INFO.about);
    logger.info('BOT', 'Bot hakkında metni ayarlandı');
  } catch (error: any) {
    logger.warn('BOT', 'Bot bilgileri ayarlanırken uyarı', { message: error.message });
  }
}

// Bot komutlarını ayarla
async function setupBotCommands() {
  try {
    await bot.telegram.setMyCommands([
      { command: 'start', description: 'Botu başlat' },
      { command: 'help', description: 'Yardım menüsü' },
      { command: 'menu', description: 'İnteraktif menü' },
      { command: 'profile', description: 'Profil bilgileri' },
      { command: 'stats', description: 'Bot istatistikleri' },
      { command: 'info', description: 'Bot hakkında bilgi' },
      { command: 'dice', description: '🎲 Zar at' },
      { command: 'flip', description: '🪙 Yazı tura' },
      { command: 'random', description: '🎲 Rastgele sayı' },
      { command: 'joke', description: '😄 Rastgele şaka' },
      { command: 'quote', description: '💬 İlham verici söz' },
      { command: 'time', description: '🕐 Saat bilgisi' },
      { command: 'date', description: '📅 Tarih bilgisi' },
      { command: 'calc', description: '🔢 Hesap makinesi' },
      { command: 'game', description: '🎮 Oyun menüsü' },
      { command: 'guess', description: '🎯 Sayı tahmin oyunu' },
      { command: 'word', description: '📝 Kelime oyunu' },
      { command: 'admin', description: '⚙️ Admin komutları (sadece adminler)' },
      { command: 'ban', description: '🔨 Kullanıcıyı yasakla' },
      { command: 'unban', description: '✅ Yasaklamayı kaldır' },
      { command: 'warn', description: '⚠️ Kullanıcıyı uyar' },
      { command: 'warns', description: '📋 Uyarıları görüntüle' },
      { command: 'clearwarns', description: '🗑️ Uyarıları temizle' },
      { command: 'mute', description: '🔇 Kullanıcıyı sustur' },
      { command: 'unmute', description: '🔊 Susturmayı kaldır' },
      { command: 'pin', description: '📌 Mesajı sabitle' },
      { command: 'unpin', description: '📌 Sabitlenmiş mesajı kaldır' },
      { command: 'delete', description: '🗑️ Mesajı sil' },
      { command: 'clear', description: '🧹 Mesajları temizle' },
      { command: 'stats', description: '📊 Detaylı istatistikler' },
      { command: 'users', description: '👥 Kullanıcı listesi' },
      { command: 'topusers', description: '🏆 En aktif kullanıcılar' },
      { command: 'broadcast', description: '📢 Tüm kullanıcılara mesaj gönder' },
      { command: 'announce', description: '📢 Duyuru yap' },
      { command: 'status', description: '📈 Bot durumu' },
      { command: 'addadmin', description: '➕ Admin ekle' },
      { command: 'removeadmin', description: '➖ Admin kaldır' }
    ]);
    logger.info('BOT', 'Bot komutları ayarlandı');
  } catch (error) {
    logger.errorHandler(error, 'setupBotCommands');
  }
}

// ========== YENİ ÖZELLİKLER: REPUTATION, LEVEL, DAILY REWARDS ==========

// /daily - Günlük ödül komutu
bot.command('daily', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'daily');
  logger.command(userId, 'daily');

  try {
    registerUser(ctx);
    const result = dailyRewardDB.claimDailyReward(userId);

    if (!result || !result.claimed) {
      await ctx.reply(
        `**Günlük Ödül**\n\n` +
        `Bugün zaten ödül aldınız!\n\n` +
        `Yarın tekrar deneyin.`
      );
      return;
    }

    const levelInfo = reputationDB.getLevel(userId);
    const expInfo = reputationDB.getExperience(userId);
    const requiredExp = reputationDB.getRequiredExperience(levelInfo);

    let levelUpText = '';
    const levelResult = reputationDB.addExperience(userId, result.experience);
    if (levelResult && levelResult.leveledUp) {
      levelUpText = `\n\n**🎉 Level Atladınız!**\nYeni Level: ${levelResult.newLevel}`;
    }

    await ctx.reply(
      `**Günlük Ödül Alındı**\n\n` +
      `Reputation: +${result.reputation}\n` +
      `Experience: +${result.experience}\n` +
      `Streak: ${result.streak} gün${levelUpText}\n\n` +
      `**Mevcut Durum:**\n` +
      `Reputation: ${result.totalReputation}\n` +
      `Level: ${levelInfo}\n` +
      `Experience: ${expInfo}/${requiredExp}`
    );
  } catch (error) {
    logger.errorHandler(error, 'daily command');
    await ctx.reply('**Hata:** Günlük ödül alınırken bir hata oluştu.');
  }
});

// /leaderboard - Liderlik tablosu
bot.command('leaderboard', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'leaderboard');
  logger.command(userId, 'leaderboard');

  try {
    registerUser(ctx);
    const args = (ctx.message as any)?.text?.split(' ') || [];
    const type = args[1] || 'reputation'; // reputation, level, messages

    let leaderboard: any[] = [];
    let title = '';
    let field = '';

    if (type === 'level') {
      leaderboard = reputationDB.getTopLevel(10);
      title = 'Level Liderleri';
      field = 'level';
    } else if (type === 'messages') {
      leaderboard = db.users
        .filter(u => (u.message_count || 0) > 0)
        .sort((a, b) => (b.message_count || 0) - (a.message_count || 0))
        .slice(0, 10)
        .map(u => ({ user_id: u.user_id, value: u.message_count || 0 }));
      title = 'Mesaj Liderleri';
      field = 'messages';
    } else {
      leaderboard = reputationDB.getTopReputation(10);
      title = 'Reputation Liderleri';
      field = 'reputation';
    }

    if (leaderboard.length === 0) {
      await ctx.reply('**Liderlik Tablosu**\n\nHenüz veri yok.');
      return;
    }

    let leaderboardText = `**${title}**\n\n`;
    
    for (let i = 0; i < leaderboard.length; i++) {
      const entry = leaderboard[i];
      const user = userDB.getUser(entry.user_id);
      const username = user?.username ? `@${user.username}` : `ID: ${entry.user_id}`;
      const name = user?.first_name || 'Kullanıcı';
      const medal = i === 0 ? '🥇' : i === 1 ? '🥈' : i === 2 ? '🥉' : `${i + 1}.`;
      
      if (field === 'level') {
        leaderboardText += `${medal} ${name} (${username})\nLevel: ${entry.level} | Exp: ${entry.experience}\n\n`;
      } else if (field === 'messages') {
        leaderboardText += `${medal} ${name} (${username})\nMesaj: ${entry.value}\n\n`;
      } else {
        leaderboardText += `${medal} ${name} (${username})\nReputation: ${entry.reputation} | Level: ${entry.level}\n\n`;
      }
    }

    leaderboardText += `\n**Diğer Liderlik Tabloları:**\n` +
      `/leaderboard reputation - Reputation liderleri\n` +
      `/leaderboard level - Level liderleri\n` +
      `/leaderboard messages - Mesaj liderleri`;

    await ctx.reply(leaderboardText);
  } catch (error) {
    logger.errorHandler(error, 'leaderboard command');
    await ctx.reply('**Hata:** Liderlik tablosu alınırken bir hata oluştu.');
  }
});

// /report - Detaylı raporlar
bot.command('report', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'report');
  logger.command(userId, 'report');

  try {
    registerUser(ctx);
    const args = (ctx.message as any)?.text?.split(' ') || [];
    const period = args[1] || 'daily'; // daily, weekly, monthly

    const now = new Date();
    let startDate: Date;
    let periodName = '';

    if (period === 'weekly') {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 7);
      periodName = 'Son 7 Gün';
    } else if (period === 'monthly') {
      startDate = new Date(now);
      startDate.setMonth(startDate.getMonth() - 1);
      periodName = 'Son 30 Gün';
    } else {
      startDate = new Date(now);
      startDate.setDate(startDate.getDate() - 1);
      periodName = 'Son 24 Saat';
    }

    const startTime = startDate.getTime();

    // Mesaj istatistikleri
    const messagesInPeriod = db.messages.filter(m => {
      const msgTime = new Date(m.created_at).getTime();
      return msgTime >= startTime;
    });
    const totalMessages = messagesInPeriod.length;
    const uniqueUsers = new Set(messagesInPeriod.map(m => m.user_id)).size;

    // Komut istatistikleri
    const commandsInPeriod = db.commands.filter(c => {
      const cmdTime = new Date(c.executed_at).getTime();
      return cmdTime >= startTime;
    });
    const totalCommands = commandsInPeriod.length;
    const popularCommands = commandDB.getPopularCommands(5);

    // Saat bazlı aktivite
    const hourlyActivity: { [key: number]: number } = {};
    messagesInPeriod.forEach(m => {
      const hour = new Date(m.created_at).getHours();
      hourlyActivity[hour] = (hourlyActivity[hour] || 0) + 1;
    });
    const topHours = Object.entries(hourlyActivity)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 3)
      .map(([hour, count]) => `${hour}:00 (${count} mesaj)`);

    let reportText = 
      `**Detaylı Rapor - ${periodName}**\n\n` +
      `**Mesaj İstatistikleri**\n` +
      `Toplam Mesaj: ${totalMessages}\n` +
      `Aktif Kullanıcı: ${uniqueUsers}\n` +
      `Ortalama: ${uniqueUsers > 0 ? Math.round(totalMessages / uniqueUsers) : 0} mesaj/kullanıcı\n\n` +
      `**Komut İstatistikleri**\n` +
      `Toplam Komut: ${totalCommands}\n` +
      `En Çok Kullanılan:\n`;

    popularCommands.forEach((cmd: any, index: number) => {
      reportText += `${index + 1}. /${cmd.command_name} - ${cmd.count} kez\n`;
    });

    if (topHours.length > 0) {
      reportText += `\n**En Aktif Saatler**\n${topHours.join('\n')}`;
    }

    reportText += `\n\n**Diğer Raporlar:**\n` +
      `/report daily - Günlük rapor\n` +
      `/report weekly - Haftalık rapor\n` +
      `/report monthly - Aylık rapor`;

    await ctx.reply(reportText);
  } catch (error) {
    logger.errorHandler(error, 'report command');
    await ctx.reply('**Hata:** Rapor alınırken bir hata oluştu.');
  }
});

// /activity - Kullanıcı aktivite analizi
bot.command('activity', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'activity');
  logger.command(userId, 'activity');

  try {
    registerUser(ctx);
    const user = userDB.getUser(userId);
    if (!user) {
      await ctx.reply('**Hata:** Kullanıcı bulunamadı.');
      return;
    }

    const now = new Date();
    const lastActive = new Date(user.last_active);
    const daysSinceActive = Math.floor((now.getTime() - lastActive.getTime()) / (1000 * 60 * 60 * 24));

    // Son 7 gün mesaj sayısı
    const sevenDaysAgo = new Date(now);
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const recentMessages = db.messages.filter(m => {
      const msgTime = new Date(m.created_at).getTime();
      return m.user_id === userId && msgTime >= sevenDaysAgo.getTime();
    }).length;

    // Son 7 gün komut sayısı
    const recentCommands = db.commands.filter(c => {
      const cmdTime = new Date(c.executed_at).getTime();
      return c.user_id === userId && cmdTime >= sevenDaysAgo.getTime();
    }).length;

    // Günlük ödül streak
    const streak = dailyRewardDB.getStreak(userId);

    // Başarılar
    const achievements = achievementDB.getUserAchievements(userId);
    const achievementDefs = achievementDB.getAchievementDefinitions();
    const unlockedAchievements = achievements.map(a => achievementDefs[a.achievement_id]).filter(Boolean);

    let activityText = 
      `**Aktivite Analizi**\n\n` +
      `**Genel Bilgiler**\n` +
      `Toplam Mesaj: ${user.message_count || 0}\n` +
      `Toplam Komut: ${db.commands.filter(c => c.user_id === userId).length}\n` +
      `Son Aktif: ${daysSinceActive === 0 ? 'Bugün' : `${daysSinceActive} gün önce`}\n\n` +
      `**Son 7 Gün**\n` +
      `Mesaj: ${recentMessages}\n` +
      `Komut: ${recentCommands}\n` +
      `Günlük Ödül Streak: ${streak} gün\n\n` +
      `**Reputation & Level**\n` +
      `Reputation: ${user.reputation || 0}\n` +
      `Level: ${user.level || 1}\n` +
      `Experience: ${user.experience || 0}/${reputationDB.getRequiredExperience(user.level || 1)}\n\n`;

    if (unlockedAchievements.length > 0) {
      activityText += `**Başarılar (${unlockedAchievements.length})**\n`;
      unlockedAchievements.slice(0, 5).forEach(ach => {
        activityText += `• ${ach.name}\n`;
      });
      if (unlockedAchievements.length > 5) {
        activityText += `... ve ${unlockedAchievements.length - 5} başarı daha`;
      }
    }

    await ctx.reply(activityText);
  } catch (error) {
    logger.errorHandler(error, 'activity command');
    await ctx.reply('**Hata:** Aktivite analizi alınırken bir hata oluştu.');
  }
});

// /spam - Mesaj spam komutu
bot.command('spam', async (ctx: Context) => {
  const userId = ctx.from?.id;
  if (!userId) return;

  commandDB.saveCommand(userId, 'spam');
  logger.command(userId, 'spam');

  try {
    registerUser(ctx);
    
    // Rate limiting kontrolü
    if (!checkRateLimit(userId, 'spam', 3, 60000)) {
      await ctx.reply('**Hata:** Çok fazla spam komutu kullandınız. Lütfen 1 dakika bekleyin.');
      return;
    }

    const args = (ctx.message as any)?.text?.split(' ') || [];
    
    if (args.length < 3) {
      await ctx.reply('**Hata:** Kullanım: /spam [mesaj] [miktar]\n\nÖrnek: /spam Merhaba 5');
      return;
    }

    // Miktarı al (son argüman)
    const amount = parseInt(args[args.length - 1]);
    
    if (isNaN(amount) || amount <= 0) {
      await ctx.reply('**Hata:** Geçerli bir miktar girin (1-20 arası).');
      return;
    }

    // Maksimum limit (güvenlik için)
    if (amount > 20) {
      await ctx.reply('**Hata:** Maksimum 20 mesaj gönderebilirsiniz.');
      return;
    }

    // Mesajı al (miktar hariç tüm argümanlar)
    const message = args.slice(1, -1).join(' ');
    
    if (!message || message.trim().length === 0) {
      await ctx.reply('**Hata:** Mesaj boş olamaz.');
      return;
    }

    // Mesaj uzunluk kontrolü
    if (message.length > 1000) {
      await ctx.reply('**Hata:** Mesaj çok uzun (maksimum 1000 karakter).');
      return;
    }

    // Spam gönderme işlemi
    await ctx.reply(`**Spam başlatılıyor...**\n\nMesaj: ${message}\nMiktar: ${amount}`);

    let successCount = 0;
    let failCount = 0;
    const delay = 500; // Her mesaj arasında 500ms bekleme (Telegram rate limit için)

    for (let i = 0; i < amount; i++) {
      try {
        await ctx.reply(message);
        successCount++;
        
        // Her mesaj arasında bekle (Telegram rate limit'i için)
        if (i < amount - 1) {
          await new Promise(resolve => setTimeout(resolve, delay));
        }
      } catch (error: any) {
        failCount++;
        
        // Rate limit hatası varsa durdur
        if (error.message?.includes('Too Many Requests') || error.message?.includes('rate limit')) {
          await ctx.reply(`**Uyarı:** Telegram rate limit'e takıldı. ${successCount} mesaj gönderildi, ${amount - successCount} mesaj gönderilemedi.`);
          break;
        }
        
        // Bot gruptan atılmışsa durdur
        if (error.message?.includes('kicked') || error.message?.includes('Forbidden')) {
          logger.info('BOT', 'Bot gruptan atılmış, spam durduruldu', { chatId: ctx.chat?.id });
          break;
        }
      }
    }

    // Sonuç mesajı
    if (successCount > 0) {
      await ctx.reply(
        `**Spam tamamlandı**\n\n` +
        `Başarılı: ${successCount}\n` +
        `${failCount > 0 ? `Başarısız: ${failCount}\n` : ''}` +
        `Toplam: ${amount}`
      );
    }

    logger.user(userId, 'Spam komutu kullanıldı', { 
      message: message.substring(0, 50), 
      amount, 
      successCount, 
      failCount 
    });
  } catch (error) {
    logger.errorHandler(error, 'spam command');
    await ctx.reply('**Hata:** Spam komutu çalıştırılırken bir hata oluştu.');
  }
});

// Botu başlat
bot.launch()
  .then(async () => {
    // Bot başlangıç zamanını kaydet (eski mesajları görmezden gelmek için)
    botStartTime = Date.now();
    
    logger.info('BOT', 'Bot başarıyla başlatıldı');
    
    // Gelişmiş terminal çıktısı
    console.log('\n' + '='.repeat(60));
    console.log('  🤖 TELEGRAMBOTGROUP BAŞLATILDI');
    console.log('='.repeat(60));
    console.log(`  ✅ Durum: Aktif ve çalışıyor`);
    console.log(`  ⏰ Başlangıç: ${new Date(botStartTime).toLocaleString('tr-TR')}`);
    console.log(`  📨 Eski mesajlar: Görmezden geliniyor`);
    console.log(`  🛡️  Koruma: Aktif (Hafif mod)`);
    console.log('='.repeat(60) + '\n');
    
    await setupBotInfo();
    await setupBotCommands();
    
    console.log('  ✨ Bot hazır ve tüm özellikler aktif!\n');
    logger.info('BOT', 'Bot hazır ve çalışıyor');
  })
  .catch((error: any) => {
    logger.errorHandler(error, 'bot.launch');
    
    console.error('\n' + '='.repeat(60));
    console.error('  ❌ BOT BAŞLATILAMADI!');
    console.error('='.repeat(60));
    
    if (error.response?.error_code === 404) {
      console.error('  🔍 Hata Tipi: 404 Not Found');
      console.error('  📝 Açıklama: Bot token geçersiz veya yanlış');
      console.error('  💡 Çözüm: .env dosyasındaki BOT_TOKEN değerini kontrol edin');
    } else {
      console.error('  🔍 Hata Detayı:', error.message || error);
    }
    
    console.error('='.repeat(60) + '\n');
    process.exit(1);
  });

// Graceful shutdown
process.once('SIGINT', () => {
  logger.info('BOT', 'Bot kapatılıyor (SIGINT)');
  console.log('\n' + '='.repeat(60));
  console.log('  🛑 Bot kapatılıyor...');
  console.log('  ⏰ Kapanış zamanı:', new Date().toLocaleString('tr-TR'));
  console.log('='.repeat(60) + '\n');
  bot.stop('SIGINT');
  process.exit(0);
});

process.once('SIGTERM', () => {
  logger.info('BOT', 'Bot kapatılıyor (SIGTERM)');
  console.log('\n' + '='.repeat(60));
  console.log('  🛑 Bot kapatılıyor...');
  console.log('  ⏰ Kapanış zamanı:', new Date().toLocaleString('tr-TR'));
  console.log('='.repeat(60) + '\n');
  bot.stop('SIGTERM');
  process.exit(0);
});
