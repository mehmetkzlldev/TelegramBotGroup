import * as path from 'path';
import * as fs from 'fs';

// Veritabanı dosyası yolu
const dbPath = path.join(__dirname, '../data/bot.json');
const dbDir = path.dirname(dbPath);

// Veritabanı yapısı
interface Database {
  users: User[];
  messages: Message[];
  commands: Command[];
  gameScores: GameScore[];
  userStats: UserStat[];
  admins: Admin[];
  bans: Ban[];
  warns: Warn[];
  mutes: Mute[];
  dailyRewards: DailyReward[];
  achievements: Achievement[];
}

interface Admin {
  user_id: number;
  added_by: number;
  added_at: string;
  permissions: string[];
}

interface Ban {
  user_id: number;
  chat_id: number;
  banned_by: number;
  banned_at: string;
  reason?: string;
}

interface Warn {
  id: number;
  user_id: number;
  chat_id: number;
  warned_by: number;
  warned_at: string;
  reason?: string;
}

interface Mute {
  user_id: number;
  chat_id: number;
  muted_by: number;
  muted_at: string;
  unmuted_at?: string;
  duration?: number; // Saniye cinsinden
  reason?: string;
}

interface GameScore {
  id: number;
  user_id: number;
  game_type: string;
  score: number;
  level?: string;
  created_at: string;
}

interface UserStat {
  user_id: number;
  dice_count: number;
  flip_count: number;
  flip_yazi: number;
  flip_tura: number;
  games_won: number;
  games_played: number;
}

interface DailyReward {
  id: number;
  user_id: number;
  claimed_at: string;
  reward_type: string;
  reward_amount: number;
  streak: number;
}

interface Achievement {
  id: number;
  user_id: number;
  achievement_id: string;
  unlocked_at: string;
}

interface User {
  id: number;
  user_id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
  is_bot: number;
  language_code?: string;
  registered_at: string;
  last_active: string;
  message_count: number;
  is_active: number;
  reputation?: number;
  level?: number;
  experience?: number;
  badges?: string[];
  last_daily_reward?: string;
}

interface Message {
  id: number;
  user_id: number;
  chat_id: number;
  message_text?: string;
  message_type: string;
  created_at: string;
}

interface Command {
  id: number;
  user_id: number;
  command_name: string;
  executed_at: string;
}

// Veritabanı klasörünü oluştur
if (!fs.existsSync(dbDir)) {
  fs.mkdirSync(dbDir, { recursive: true });
}

// Veritabanını yükle veya oluştur
function loadDatabase(): Database {
  if (fs.existsSync(dbPath)) {
    try {
      const data = fs.readFileSync(dbPath, 'utf8');
      const db = JSON.parse(data);
      // Eski veritabanı için yeni alanları ekle
      if (!db.gameScores) db.gameScores = [];
      if (!db.userStats) db.userStats = [];
      if (!db.admins) db.admins = [];
      if (!db.bans) db.bans = [];
      if (!db.warns) db.warns = [];
      if (!db.mutes) db.mutes = [];
      if (!db.dailyRewards) db.dailyRewards = [];
      if (!db.achievements) db.achievements = [];
      
      // Eski kullanıcılar için yeni alanları ekle
      db.users.forEach(user => {
        if (user.reputation === undefined) user.reputation = 0;
        if (user.level === undefined) user.level = 1;
        if (user.experience === undefined) user.experience = 0;
        if (!user.badges) user.badges = [];
        if (!user.last_daily_reward) user.last_daily_reward = '';
      });
      
      return db;
    } catch (error) {
      console.error('Veritabanı okuma hatası:', error);
      return { users: [], messages: [], commands: [], gameScores: [], userStats: [], admins: [], bans: [], warns: [], mutes: [], dailyRewards: [], achievements: [] };
    }
  }
  return { users: [], messages: [], commands: [], gameScores: [], userStats: [], admins: [], bans: [], warns: [], mutes: [], dailyRewards: [], achievements: [] };
}

// Veritabanını kaydet
function saveDatabase(db: Database) {
  try {
    fs.writeFileSync(dbPath, JSON.stringify(db, null, 2), 'utf8');
  } catch (error) {
    console.error('Veritabanı yazma hatası:', error);
  }
}

// Veritabanı instance'ı
let db = loadDatabase();

// ID oluşturucu
function getNextId(items: any[]): number {
  return items.length > 0 ? Math.max(...items.map(item => item.id || 0)) + 1 : 1;
}

// Veritabanı işlemleri
export const userDB = {
  // Kullanıcı kaydet/güncelle
  saveUser(user: {
    id: number;
    username?: string;
    first_name?: string;
    last_name?: string;
    is_bot?: boolean;
    language_code?: string;
  }) {
    const existingUser = db.users.find(u => u.user_id === user.id);
    const now = new Date().toISOString();

    if (existingUser) {
      // Güncelle
      existingUser.username = user.username || existingUser.username;
      existingUser.first_name = user.first_name || existingUser.first_name;
      existingUser.last_name = user.last_name || existingUser.last_name;
      existingUser.language_code = user.language_code || existingUser.language_code;
      existingUser.last_active = now;
      existingUser.is_active = 1;
    } else {
      // Yeni kullanıcı
      const newUser: User = {
        id: getNextId(db.users),
        user_id: user.id,
        username: user.username,
        first_name: user.first_name,
        last_name: user.last_name,
        is_bot: user.is_bot ? 1 : 0,
        language_code: user.language_code,
        registered_at: now,
        last_active: now,
        message_count: 0,
        is_active: 1,
        reputation: 0,
        level: 1,
        experience: 0,
        badges: [],
        last_daily_reward: ''
      };
      db.users.push(newUser);
    }

    saveDatabase(db);
    return { changes: 1 };
  },

  // Kullanıcı bilgilerini getir
  getUser(userId: number): User | undefined {
    return db.users.find(u => u.user_id === userId);
  },

  // Mesaj sayısını artır
  incrementMessageCount(userId: number) {
    const user = db.users.find(u => u.user_id === userId);
    if (user) {
      user.message_count = (user.message_count || 0) + 1;
      saveDatabase(db);
    }
    return { changes: user ? 1 : 0 };
  },

  // Toplam kullanıcı sayısı
  getTotalUsers(): number {
    return db.users.length;
  },

  // Aktif kullanıcı sayısı (son 7 gün)
  getActiveUsers(): number {
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const cutoff = sevenDaysAgo.toISOString();

    return db.users.filter(user => {
      const lastActive = new Date(user.last_active);
      return lastActive >= new Date(cutoff);
    }).length;
  },

  // Kullanıcı istatistikleri
  getUserStats(userId: number) {
    const user = this.getUser(userId);
    if (!user) return null;

    const commandCount = db.commands.filter(c => c.user_id === userId).length;

    return {
      ...user,
      command_count: commandCount
    };
  }
};

// Mesaj işlemleri (loglama)
export const messageDB = {
  // Mesaj kaydet
  saveMessage(data: {
    userId: number;
    chatId: number;
    text?: string;
    type: string;
  }) {
    const newMessage: Message = {
      id: getNextId(db.messages),
      user_id: data.userId,
      chat_id: data.chatId,
      message_text: data.text,
      message_type: data.type,
      created_at: new Date().toISOString()
    };

    db.messages.push(newMessage);
    saveDatabase(db);
    return { changes: 1 };
  },

  // Kullanıcının mesaj geçmişi
  getUserMessages(userId: number, limit: number = 10): Message[] {
    return db.messages
      .filter(m => m.user_id === userId)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
      .slice(0, limit);
  },

  // Toplam mesaj sayısı
  getTotalMessages(): number {
    return db.messages.length;
  }
};

// Komut işlemleri
export const commandDB = {
  // Komut kaydet
  saveCommand(userId: number, commandName: string) {
    const newCommand: Command = {
      id: getNextId(db.commands),
      user_id: userId,
      command_name: commandName,
      executed_at: new Date().toISOString()
    };

    db.commands.push(newCommand);
    saveDatabase(db);
    return { changes: 1 };
  },

  // En çok kullanılan komutlar
  getPopularCommands(limit: number = 10) {
    const commandCounts: { [key: string]: number } = {};

    db.commands.forEach(cmd => {
      commandCounts[cmd.command_name] = (commandCounts[cmd.command_name] || 0) + 1;
    });

    return Object.entries(commandCounts)
      .map(([command_name, count]) => ({ command_name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, limit);
  }
};

// Oyun skorları ve istatistikler
export const gameDB = {
  // Kullanıcı istatistiklerini getir veya oluştur
  getUserStat(userId: number): UserStat {
    let stat = db.userStats.find(s => s.user_id === userId);
    if (!stat) {
      stat = {
        user_id: userId,
        dice_count: 0,
        flip_count: 0,
        flip_yazi: 0,
        flip_tura: 0,
        games_won: 0,
        games_played: 0
      };
      db.userStats.push(stat);
      saveDatabase(db);
    }
    return stat;
  },

  // İstatistik güncelle
  updateUserStat(userId: number, updates: Partial<UserStat>) {
    const stat = this.getUserStat(userId);
    Object.assign(stat, updates);
    saveDatabase(db);
  },

  // Zar sayısını artır
  incrementDice(userId: number) {
    const stat = this.getUserStat(userId);
    stat.dice_count = (stat.dice_count || 0) + 1;
    saveDatabase(db);
  },

  // Yazı tura sayısını artır
  incrementFlip(userId: number, result: 'yazi' | 'tura') {
    const stat = this.getUserStat(userId);
    stat.flip_count = (stat.flip_count || 0) + 1;
    if (result === 'yazi') {
      stat.flip_yazi = (stat.flip_yazi || 0) + 1;
    } else {
      stat.flip_tura = (stat.flip_tura || 0) + 1;
    }
    saveDatabase(db);
  },

  // Oyun skoru kaydet
  saveGameScore(userId: number, gameType: string, score: number, level?: string) {
    const newScore: GameScore = {
      id: getNextId(db.gameScores),
      user_id: userId,
      game_type: gameType,
      score: score,
      level: level,
      created_at: new Date().toISOString()
    };
    db.gameScores.push(newScore);
    saveDatabase(db);

    // Kullanıcı istatistiklerini güncelle
    const stat = this.getUserStat(userId);
    stat.games_played = (stat.games_played || 0) + 1;
    if (score > 0) {
      stat.games_won = (stat.games_won || 0) + 1;
    }
    saveDatabase(db);
  },

  // En iyi skorları getir
  getTopScores(gameType: string, limit: number = 10) {
    return db.gameScores
      .filter(s => s.game_type === gameType)
      .sort((a, b) => b.score - a.score)
      .slice(0, limit);
  },

  // Kullanıcının en iyi skorunu getir
  getUserBestScore(userId: number, gameType: string) {
    const scores = db.gameScores
      .filter(s => s.user_id === userId && s.game_type === gameType)
      .sort((a, b) => b.score - a.score);
    return scores.length > 0 ? scores[0] : null;
  }
};

// Admin veritabanı işlemleri
export const adminDB = {
  // Admin ekle
  addAdmin(userId: number, addedBy: number, permissions: string[] = ['all']) {
    const existing = db.admins.find(a => a.user_id === userId);
    if (existing) {
      existing.permissions = permissions;
      existing.added_by = addedBy;
      existing.added_at = new Date().toISOString();
    } else {
      db.admins.push({
        user_id: userId,
        added_by: addedBy,
        added_at: new Date().toISOString(),
        permissions
      });
    }
    saveDatabase(db);
  },

  // Admin kontrolü
  isAdmin(userId: number): boolean {
    return db.admins.some(a => a.user_id === userId);
  },

  // Admin yetkisi kontrolü
  hasPermission(userId: number, permission: string): boolean {
    const admin = db.admins.find(a => a.user_id === userId);
    if (!admin) return false;
    return admin.permissions.includes('all') || admin.permissions.includes(permission);
  },

  // Admin listesi
  getAdmins() {
    return db.admins;
  },

  // Admin kaldır
  removeAdmin(userId: number) {
    db.admins = db.admins.filter(a => a.user_id !== userId);
    saveDatabase(db);
  }
};

// Ban veritabanı işlemleri
export const banDB = {
  // Kullanıcıyı yasakla
  banUser(userId: number, chatId: number, bannedBy: number, reason?: string) {
    const existing = db.bans.find(b => b.user_id === userId && b.chat_id === chatId);
    if (existing) {
      existing.banned_by = bannedBy;
      existing.banned_at = new Date().toISOString();
      existing.reason = reason;
    } else {
      db.bans.push({
        user_id: userId,
        chat_id: chatId,
        banned_by: bannedBy,
        banned_at: new Date().toISOString(),
        reason
      });
    }
    saveDatabase(db);
  },

  // Yasaklamayı kaldır
  unbanUser(userId: number, chatId: number) {
    db.bans = db.bans.filter(b => !(b.user_id === userId && b.chat_id === chatId));
    saveDatabase(db);
  },

  // Yasaklı mı kontrolü
  isBanned(userId: number, chatId: number): boolean {
    return db.bans.some(b => b.user_id === userId && b.chat_id === chatId);
  },

  // Yasaklı kullanıcıları getir
  getBannedUsers(chatId: number) {
    return db.bans.filter(b => b.chat_id === chatId);
  }
};

// Warn veritabanı işlemleri
export const warnDB = {
  // Uyarı ekle
  addWarn(userId: number, chatId: number, warnedBy: number, reason?: string) {
    const warn: Warn = {
      id: getNextId(db.warns),
      user_id: userId,
      chat_id: chatId,
      warned_by: warnedBy,
      warned_at: new Date().toISOString(),
      reason
    };
    db.warns.push(warn);
    saveDatabase(db);
    return warn;
  },

  // Kullanıcının uyarılarını getir
  getUserWarns(userId: number, chatId: number) {
    return db.warns.filter(w => w.user_id === userId && w.chat_id === chatId);
  },

  // Uyarı sayısı
  getWarnCount(userId: number, chatId: number): number {
    return this.getUserWarns(userId, chatId).length;
  },

  // Uyarıları temizle
  clearWarns(userId: number, chatId: number) {
    db.warns = db.warns.filter(w => !(w.user_id === userId && w.chat_id === chatId));
    saveDatabase(db);
  },

  // Belirli bir uyarıyı sil
  removeWarn(warnId: number) {
    db.warns = db.warns.filter(w => w.id !== warnId);
    saveDatabase(db);
  }
};

// Mute veritabanı işlemleri
export const muteDB = {
  // Kullanıcıyı sustur
  muteUser(userId: number, chatId: number, mutedBy: number, duration?: number, reason?: string) {
    const existing = db.mutes.find(m => m.user_id === userId && m.chat_id === chatId && !m.unmuted_at);
    if (existing) {
      existing.muted_by = mutedBy;
      existing.muted_at = new Date().toISOString();
      existing.duration = duration;
      existing.reason = reason;
      existing.unmuted_at = undefined;
    } else {
      db.mutes.push({
        user_id: userId,
        chat_id: chatId,
        muted_by: mutedBy,
        muted_at: new Date().toISOString(),
        duration,
        reason
      });
    }
    saveDatabase(db);
  },

  // Susturmayı kaldır
  unmuteUser(userId: number, chatId: number) {
    const mute = db.mutes.find(m => m.user_id === userId && m.chat_id === chatId && !m.unmuted_at);
    if (mute) {
      mute.unmuted_at = new Date().toISOString();
      saveDatabase(db);
    }
  },

  // Susturulmuş mu kontrolü
  isMuted(userId: number, chatId: number): boolean {
    const mute = db.mutes.find(m => m.user_id === userId && m.chat_id === chatId && !m.unmuted_at);
    if (!mute) return false;
    
    // Süre kontrolü
    if (mute.duration) {
      const mutedAt = new Date(mute.muted_at).getTime();
      const now = Date.now();
      const elapsed = (now - mutedAt) / 1000; // Saniye
      
      if (elapsed >= mute.duration) {
        // Süre dolmuş, otomatik unmute
        this.unmuteUser(userId, chatId);
        return false;
      }
    }
    
    return true;
  },

  // Kullanıcının mute bilgisini getir
  getUserMute(userId: number, chatId: number): Mute | undefined {
    return db.mutes.find(m => m.user_id === userId && m.chat_id === chatId && !m.unmuted_at);
  }
};

// Reputation ve Level sistemi
export const reputationDB = {
  // Reputation ekle
  addReputation(userId: number, amount: number) {
    const user = db.users.find(u => u.user_id === userId);
    if (user) {
      user.reputation = (user.reputation || 0) + amount;
      if (user.reputation < 0) user.reputation = 0;
      
      // Experience ekle (reputation'un %10'u)
      const expGain = Math.floor(amount * 0.1);
      this.addExperience(userId, expGain);
      
      saveDatabase(db);
      return user.reputation;
    }
    return 0;
  },

  // Experience ekle ve level kontrolü
  addExperience(userId: number, amount: number) {
    const user = db.users.find(u => u.user_id === userId);
    if (!user) return;
    
    user.experience = (user.experience || 0) + amount;
    user.level = user.level || 1;
    
    // Level hesaplama: Her level için 100 * level experience gerekli
    let requiredExp = 0;
    let newLevel = user.level;
    
    while (true) {
      requiredExp = 100 * newLevel;
      if (user.experience >= requiredExp) {
        newLevel++;
        user.experience -= requiredExp;
      } else {
        break;
      }
    }
    
    if (newLevel > user.level) {
      user.level = newLevel;
      saveDatabase(db);
      return { leveledUp: true, newLevel, remainingExp: user.experience };
    }
    
    saveDatabase(db);
    return { leveledUp: false, level: user.level, experience: user.experience };
  },

  // Kullanıcının reputation'unu getir
  getReputation(userId: number): number {
    const user = db.users.find(u => u.user_id === userId);
    return user?.reputation || 0;
  },

  // Kullanıcının level'ını getir
  getLevel(userId: number): number {
    const user = db.users.find(u => u.user_id === userId);
    return user?.level || 1;
  },

  // Kullanıcının experience'unu getir
  getExperience(userId: number): number {
    const user = db.users.find(u => u.user_id === userId);
    return user?.experience || 0;
  },

  // Bir sonraki level için gerekli experience
  getRequiredExperience(level: number): number {
    return 100 * level;
  },

  // Top reputation liderleri
  getTopReputation(limit: number = 10) {
    return db.users
      .filter(u => (u.reputation || 0) > 0)
      .sort((a, b) => (b.reputation || 0) - (a.reputation || 0))
      .slice(0, limit)
      .map(u => ({ user_id: u.user_id, reputation: u.reputation || 0, level: u.level || 1 }));
  },

  // Top level liderleri
  getTopLevel(limit: number = 10) {
    return db.users
      .filter(u => (u.level || 1) > 1)
      .sort((a, b) => (b.level || 1) - (a.level || 1))
      .slice(0, limit)
      .map(u => ({ user_id: u.user_id, level: u.level || 1, experience: u.experience || 0 }));
  }
};

// Günlük ödül sistemi
export const dailyRewardDB = {
  // Günlük ödül al
  claimDailyReward(userId: number) {
    const user = db.users.find(u => u.user_id === userId);
    if (!user) return null;

    const now = new Date();
    const today = now.toISOString().split('T')[0]; // YYYY-MM-DD formatı
    
    // Son ödül tarihi
    const lastReward = user.last_daily_reward || '';
    
    // Streak hesaplama
    let streak = 1;
    if (lastReward) {
      const lastDate = new Date(lastReward);
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      
      if (lastReward === today) {
        // Bugün zaten ödül alınmış
        return { claimed: false, message: 'Bugün zaten ödül aldınız!' };
      } else if (lastDate.toISOString().split('T')[0] === yesterday.toISOString().split('T')[0]) {
        // Dün ödül alınmış, streak devam ediyor
        const lastRewardRecord = db.dailyRewards
          .filter(r => r.user_id === userId)
          .sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime())[0];
        streak = (lastRewardRecord?.streak || 0) + 1;
      }
    }

    // Ödül miktarı (streak'e göre artar)
    const baseReward = 10;
    const reputationReward = baseReward + (streak - 1) * 2; // Her streak +2 reputation
    const expReward = Math.floor(reputationReward * 0.5); // Reputation'un yarısı kadar exp

    // Ödülü kaydet
    const reward: DailyReward = {
      id: getNextId(db.dailyRewards),
      user_id: userId,
      claimed_at: now.toISOString(),
      reward_type: 'reputation',
      reward_amount: reputationReward,
      streak
    };
    db.dailyRewards.push(reward);

    // Kullanıcıyı güncelle
    user.last_daily_reward = today;
    reputationDB.addReputation(userId, reputationReward);
    reputationDB.addExperience(userId, expReward);

    saveDatabase(db);

    return {
      claimed: true,
      reputation: reputationReward,
      experience: expReward,
      streak,
      totalReputation: user.reputation || 0,
      totalExperience: user.experience || 0
    };
  },

  // Kullanıcının streak'ini getir
  getStreak(userId: number): number {
    const lastReward = db.dailyRewards
      .filter(r => r.user_id === userId)
      .sort((a, b) => new Date(b.claimed_at).getTime() - new Date(a.claimed_at).getTime())[0];
    return lastReward?.streak || 0;
  },

  // Bugün ödül alınmış mı?
  hasClaimedToday(userId: number): boolean {
    const user = db.users.find(u => u.user_id === userId);
    if (!user || !user.last_daily_reward) return false;
    
    const today = new Date().toISOString().split('T')[0];
    return user.last_daily_reward === today;
  }
};

// Başarı/Rozet sistemi
export const achievementDB = {
  // Başarı açıldı mı kontrol et
  hasAchievement(userId: number, achievementId: string): boolean {
    return db.achievements.some(a => a.user_id === userId && a.achievement_id === achievementId);
  },

  // Başarı ekle
  unlockAchievement(userId: number, achievementId: string) {
    if (this.hasAchievement(userId, achievementId)) return false;

    const achievement: Achievement = {
      id: getNextId(db.achievements),
      user_id: userId,
      achievement_id: achievementId,
      unlocked_at: new Date().toISOString()
    };
    db.achievements.push(achievement);

    // Kullanıcının badges listesine ekle
    const user = db.users.find(u => u.user_id === userId);
    if (user) {
      if (!user.badges) user.badges = [];
      if (!user.badges.includes(achievementId)) {
        user.badges.push(achievementId);
      }
    }

    saveDatabase(db);
    return true;
  },

  // Kullanıcının başarılarını getir
  getUserAchievements(userId: number): Achievement[] {
    return db.achievements.filter(a => a.user_id === userId);
  },

  // Tüm başarı tanımları
  getAchievementDefinitions() {
    return {
      'first_message': { name: 'İlk Mesaj', description: 'İlk mesajını gönder', reward: 5 },
      'first_command': { name: 'İlk Komut', description: 'İlk komutu kullan', reward: 5 },
      'message_10': { name: 'Sohbetçi', description: '10 mesaj gönder', reward: 10 },
      'message_100': { name: 'Aktif Kullanıcı', description: '100 mesaj gönder', reward: 50 },
      'message_1000': { name: 'Sohbet Ustası', description: '1000 mesaj gönder', reward: 200 },
      'command_10': { name: 'Komutçu', description: '10 komut kullan', reward: 10 },
      'command_100': { name: 'Komut Ustası', description: '100 komut kullan', reward: 50 },
      'game_win': { name: 'Kazanan', description: 'İlk oyunu kazan', reward: 15 },
      'game_10_wins': { name: 'Oyun Ustası', description: '10 oyun kazan', reward: 100 },
      'level_5': { name: 'Yükselen', description: 'Level 5\'e ulaş', reward: 50 },
      'level_10': { name: 'Deneyimli', description: 'Level 10\'a ulaş', reward: 150 },
      'level_20': { name: 'Usta', description: 'Level 20\'ye ulaş', reward: 300 },
      'daily_7': { name: 'Sadık', description: '7 gün üst üste günlük ödül al', reward: 100 },
      'daily_30': { name: 'Düzenli', description: '30 gün üst üste günlük ödül al', reward: 500 },
      'reputation_100': { name: 'Saygın', description: '100 reputation kazan', reward: 50 },
      'reputation_500': { name: 'Ünlü', description: '500 reputation kazan', reward: 200 },
      'reputation_1000': { name: 'Efsane', description: '1000 reputation kazan', reward: 500 }
    };
  }
};

// Veritabanını başlat
console.log('✅ Veritabanı başlatıldı (JSON tabanlı)');

// Veritabanı instance'ını dışa aktar
export default db;
