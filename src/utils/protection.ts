import { Context } from 'telegraf';
import { PROTECTION_CONFIG } from '../config/protection';
import { warnDB, banDB } from '../database';
import { logger } from '../logger';

// Kullanıcı mesaj geçmişi (spam/flood kontrolü için)
interface UserMessageHistory {
  messages: Array<{ text: string; timestamp: number }>;
  lastMessage: string;
  spamCount: number;
  lastSpamTime: number;
}

const userHistory: { [key: string]: UserMessageHistory } = {};

// Admin kontrolü helper
async function isUserAdmin(ctx: Context): Promise<boolean> {
  try {
    const userId = ctx.from?.id;
    const chatId = ctx.chat?.id;
    if (!userId || !chatId) return false;
    
    const chatMember = await ctx.telegram.getChatMember(chatId, userId);
    return ['administrator', 'creator'].includes(chatMember.status);
  } catch (error) {
    return false;
  }
}

// Spam kontrolü
export async function checkSpam(ctx: Context): Promise<boolean> {
  if (!PROTECTION_CONFIG.spam.enabled) return false;
  
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const message = (ctx.message as any)?.text;
  
  if (!userId || !chatId || !message || message.startsWith('/')) return false;
  
  // Admin kontrolü - adminler spam korumasından muaf
  if (await isUserAdmin(ctx)) return false;
  
  const key = `${chatId}_${userId}`;
  const now = Date.now();
  
  if (!userHistory[key]) {
    userHistory[key] = {
      messages: [],
      lastMessage: '',
      spamCount: 0,
      lastSpamTime: 0
    };
  }
  
  const history = userHistory[key];
  
  // Aynı mesajı tekrar gönderiyor mu?
  if (message === history.lastMessage) {
    history.spamCount++;
    
    // Zaman penceresi içinde mi?
    if (now - history.lastSpamTime < PROTECTION_CONFIG.spam.timeWindow) {
      if (history.spamCount >= PROTECTION_CONFIG.spam.banThreshold) {
        // Ban
        try {
          await ctx.telegram.banChatMember(chatId, userId);
          banDB.banUser(userId, chatId, userId, 'Spam koruması - Aynı mesajı tekrar gönderme');
          await ctx.reply(`**Kullanıcı yasaklandı**\n\nSebep: Spam (aynı mesajı ${history.spamCount} kez gönderdi)`);
          logger.admin(userId, `Banned for spam`, { count: history.spamCount });
          return true;
        } catch (error: any) {
          // Admin hatası veya başka bir hata - sessizce devam et
          if (error.message?.includes('administrator') || error.message?.includes('admin')) {
            // Admin hatası, görmezden gel
            return false;
          }
          logger.errorHandler(error, 'spam ban');
        }
      } else if (history.spamCount >= PROTECTION_CONFIG.spam.threshold) {
        // Uyarı + mesaj sil
        try {
          await ctx.deleteMessage();
          warnDB.addWarn(userId, chatId, userId, 'Spam koruması - Aynı mesajı tekrar gönderme');
          const warnCount = warnDB.getWarnCount(userId, chatId);
          await ctx.reply(`**Uyarı**\n\nSpam tespit edildi. Aynı mesajı tekrar göndermeyin.\n\nToplam uyarı: ${warnCount}`);
          logger.user(userId, 'Spam detected', { count: history.spamCount });
          return true;
        } catch (error: any) {
          // Admin hatası veya başka bir hata - sessizce devam et
          if (error.message?.includes('administrator') || error.message?.includes('admin')) {
            return false;
          }
          logger.errorHandler(error, 'spam warn');
        }
      }
    } else {
      // Zaman penceresi dışında, sıfırla
      history.spamCount = 1;
      history.lastSpamTime = now;
    }
  } else {
    // Farklı mesaj, sıfırla
    history.spamCount = 1;
    history.lastSpamTime = now;
  }
  
  history.lastMessage = message;
  history.messages.push({ text: message, timestamp: now });
  
  // Eski mesajları temizle
  history.messages = history.messages.filter(
    msg => now - msg.timestamp < PROTECTION_CONFIG.spam.timeWindow
  );
  
  return true;
}

// Flood kontrolü
export async function checkFlood(ctx: Context): Promise<boolean> {
  if (!PROTECTION_CONFIG.flood.enabled) return false;
  
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  
  if (!userId || !chatId) return false;
  
  // Admin kontrolü - adminler flood korumasından muaf
  if (await isUserAdmin(ctx)) return false;
  
  const key = `${chatId}_${userId}`;
  const now = Date.now();
  
  if (!userHistory[key]) {
    userHistory[key] = {
      messages: [],
      lastMessage: '',
      spamCount: 0,
      lastSpamTime: 0
    };
  }
  
  const history = userHistory[key];
  
  // Önce mesajı geçmişe ekle
  const messageText = (ctx.message as any)?.text || '';
  history.messages.push({ text: messageText, timestamp: now });
  
  // Son mesajları filtrele (zaman penceresi içinde)
  const recentMessages = history.messages.filter(
    msg => now - msg.timestamp < PROTECTION_CONFIG.flood.timeWindow
  );
  
  // Eski mesajları temizle
  history.messages = history.messages.filter(
    msg => now - msg.timestamp < PROTECTION_CONFIG.flood.timeWindow * 2
  );
  
  // Şimdi kontrol et
  if (recentMessages.length >= PROTECTION_CONFIG.flood.banThreshold) {
    // Ban
    try {
      await ctx.telegram.banChatMember(chatId, userId);
      banDB.banUser(userId, chatId, userId, 'Flood koruması - Çok hızlı mesaj gönderme');
      await ctx.reply(`**Kullanıcı yasaklandı**\n\nSebep: Flood (${recentMessages.length} mesaj ${PROTECTION_CONFIG.flood.timeWindow / 1000} saniyede)`);
      logger.admin(userId, `Banned for flood`, { count: recentMessages.length });
      return true;
    } catch (error: any) {
      // Admin hatası veya başka bir hata - sessizce devam et
      if (error.message?.includes('administrator') || error.message?.includes('admin')) {
        return false;
      }
      logger.errorHandler(error, 'flood ban');
    }
  } else if (recentMessages.length >= PROTECTION_CONFIG.flood.threshold) {
    // Uyarı
    try {
      await ctx.deleteMessage();
      warnDB.addWarn(userId, chatId, userId, 'Flood koruması - Çok hızlı mesaj gönderme');
      const warnCount = warnDB.getWarnCount(userId, chatId);
      await ctx.reply(`**Uyarı**\n\nFlood tespit edildi. Mesaj gönderme hızınızı düşürün.\n\nToplam uyarı: ${warnCount}`);
      logger.user(userId, 'Flood detected', { count: recentMessages.length });
      return true;
    } catch (error: any) {
      // Admin hatası veya başka bir hata - sessizce devam et
      if (error.message?.includes('administrator') || error.message?.includes('admin')) {
        return false;
      }
      logger.errorHandler(error, 'flood warn');
    }
  }
  
  return false;
}

// Bot kontrolü
export async function checkBot(ctx: Context): Promise<boolean> {
  if (!PROTECTION_CONFIG.bots.enabled) return false;
  
  const newMembers = (ctx.message as any)?.new_chat_members;
  const chatId = ctx.chat?.id;
  
  if (!newMembers || !chatId) return false;
  
  for (const member of newMembers) {
    if (member.is_bot && member.id !== ctx.botInfo?.id) {
      // Bot tespit edildi, ban
      try {
        await ctx.telegram.banChatMember(chatId, member.id);
        banDB.banUser(member.id, chatId, member.id, 'Bot koruması - Bot ekleme yasak');
        await ctx.reply(`**Bot yasaklandı**\n\nBot ekleme yasaktır.`);
        logger.admin(member.id, `Banned bot`, { username: member.username });
        return true;
      } catch (error) {
        logger.errorHandler(error, 'bot ban');
      }
    }
  }
  
  return false;
}

// Büyük harf kontrolü
export async function checkCaps(ctx: Context): Promise<boolean> {
  if (!PROTECTION_CONFIG.caps.enabled) return false;
  
  const userId = ctx.from?.id;
  const chatId = ctx.chat?.id;
  const message = (ctx.message as any)?.text;
  
  if (!userId || !chatId || !message || message.startsWith('/')) return false;
  
  // Admin kontrolü - adminler caps korumasından muaf
  if (await isUserAdmin(ctx)) return false;
  
  // Minimum uzunluk kontrolü
  if (message.length < PROTECTION_CONFIG.caps.minLength) return false;
  
  // Büyük harf oranı
  const capsCount = (message.match(/[A-ZĞÜŞİÖÇ]/g) || []).length;
  const capsRatio = capsCount / message.length;
  
  if (capsRatio >= PROTECTION_CONFIG.caps.threshold) {
    // Büyük harf tespit edildi
    try {
      await ctx.deleteMessage();
      warnDB.addWarn(userId, chatId, userId, 'Büyük harf koruması - Çok fazla büyük harf kullanımı');
      const warnCount = warnDB.getWarnCount(userId, chatId);
      
      if (warnCount >= 3) {
        // 3 uyarıdan sonra ban
        try {
          await ctx.telegram.banChatMember(chatId, userId);
          banDB.banUser(userId, chatId, userId, 'Büyük harf koruması - 3 uyarı');
          await ctx.reply(`**Kullanıcı yasaklandı**\n\nSebep: Büyük harf kullanımı (3 uyarı)`);
          logger.admin(userId, `Banned for caps`, { warnCount });
          return true;
        } catch (error: any) {
          // Admin hatası - sessizce devam et
          if (error.message?.includes('administrator') || error.message?.includes('admin')) {
            return false;
          }
          throw error;
        }
      } else {
        await ctx.reply(`**Uyarı**\n\nÇok fazla büyük harf kullanımı tespit edildi.\n\nToplam uyarı: ${warnCount}`);
        logger.user(userId, 'Caps detected', { ratio: capsRatio });
        return true;
      }
    } catch (error: any) {
      // Admin hatası veya başka bir hata - sessizce devam et
      if (error.message?.includes('administrator') || error.message?.includes('admin')) {
        return false;
      }
      logger.errorHandler(error, 'caps warn');
    }
  }
  
  return false;
}

// Anti-raid kontrolü
const recentJoins: { [key: number]: Array<{ userId: number; timestamp: number }> } = {};

export async function checkAntiRaid(ctx: Context): Promise<boolean> {
  if (!PROTECTION_CONFIG.antiRaid.enabled) return false;
  
  const newMembers = (ctx.message as any)?.new_chat_members;
  const chatId = ctx.chat?.id;
  
  if (!newMembers || !chatId) return false;
  
  const now = Date.now();
  
  if (!recentJoins[chatId]) {
    recentJoins[chatId] = [];
  }
  
  // Yeni üyeleri ekle
  for (const member of newMembers) {
    if (!member.is_bot && member.id !== ctx.botInfo?.id) {
      recentJoins[chatId].push({ userId: member.id, timestamp: now });
    }
  }
  
  // Son zaman penceresi içindeki üyeleri filtrele
  const recent = recentJoins[chatId].filter(
    join => now - join.timestamp < PROTECTION_CONFIG.antiRaid.timeWindow
  );
  
  if (recent.length >= PROTECTION_CONFIG.antiRaid.threshold) {
    // Raid tespit edildi, son eklenenleri ban
    try {
      for (const join of recent) {
        try {
          await ctx.telegram.banChatMember(chatId, join.userId);
          banDB.banUser(join.userId, chatId, join.userId, 'Anti-raid koruması - Şüpheli toplu katılım');
          logger.admin(join.userId, `Banned for raid`, { chatId });
        } catch (error) {
          // Sessizce devam et
        }
      }
      
      await ctx.reply(`**Anti-raid koruması aktif**\n\n${recent.length} şüpheli kullanıcı yasaklandı.`);
      logger.info('PROTECTION', 'Anti-raid triggered', { chatId, count: recent.length });
      
      // Listeyi temizle
      recentJoins[chatId] = [];
      return true;
    } catch (error) {
      logger.errorHandler(error, 'anti-raid ban');
    }
  }
  
  // Eski kayıtları temizle
  recentJoins[chatId] = recentJoins[chatId].filter(
    join => now - join.timestamp < PROTECTION_CONFIG.antiRaid.timeWindow * 2
  );
  
  return false;
}

