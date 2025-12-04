// Küfür filtresi ve yanıt sistemi (Türk Mitolojisi Epik Fantazi Modu – Küfür Finali)

// Küfür kelimeleri (orijinal + mitolojik tetikleyiciler)
const profanityWords = [
  // Orijinal liste (yaygın küfürler, ekler, kombinasyonlar – kısalttım ama tamını koru)
  'aptal', 'salak', 'gerizekalı', 'mal', 'kafasız', 'ahmak', 'beyinsiz',
  'pislik', 'çöp', 'bok', 'siktir', 'amk', 'orospu', 'piç',
  'göt', 'yarrak', 'sik', 'am', 'taşşak', 'penis', 'vajina',
  'amına', 'siktiğim', 'siktirgit', 'orospuçocuğu', 'piçkurusu',
  // ... (tam orijinal listen buraya, yer kaplamasın diye kısalttım)
  
  // Mitolojik tetikleyiciler (küfürle karışık kullanım için)
  'erlik', 'albasti', 'tepegoz', 'sahmaran', 'nazar', 'yelbegen', 'hortlak',
  'ulgen', 'kayra', 'bozkurt', 'tengri', 'oguz', 'dede korkut'
];

// Epik Türk Mitolojisi Küfür Yanıtları (Şiir Küfür Finali – Daha Küfürlü)
const epicMythicProfanityResponses = [
  // Erlik Han temalı (2 varyasyon)
  'Erlik Han\'ın yeraltı bozkırı seni yutsun, ulan! Zincirleri ruhuna dolansın, ejderha nefesiyle kavrulsun – Tengri\'nin gök oku seni ıskalasın, siktir git cehennem atlısı amk piç!',
  'Erlik\'in karanlık ordusu seni kuşatsın, amk! Bozkırın derin çukurunda ezil, ulu lanetle helak ol – siktir git, yeraltı ejderhasının midesinde kaybol ulan siktir ol piç!',
  
  // Albastı temalı
  'Albastı\'nın ters pençeleriyle dans et, amk! Gecenin bozkırında ulu, çığlıkların nazar gibi batar – gölgen kendi kuyruğunu ısırır, siktir git lanetli dansçı ulan siktir!',
  'Albastı gibi gecede ulu, ters ayaklı gez lan! Şaman davulunun ritmiyle titret, ama Erlik\'in gölgesinde boğul – amına koyayım gece iblisi, siktir ol ulan piç git!',
  
  // Tepegöz temalı
  'Tepegöz\'ün tek gözlü okları kalbine saplansın, piç! Bozkır devinin homurtusu kulaklarında çınlasın – kör intikamınla sürün, Oğuz Kağan\'ın kılıcı seni biçsin, amına koyayım tek gözlü trol siktir git!',
  'Tek gözlü devin laneti gözlerine insin, siktir! Dede Korkut\'un yay sesi gibi gürle ama kör kal – ulan trol, amına koyayım, bozkırın korkusu ol siktir git amk!',
  
  // Şahmaran temalı
  'Şahmeran\'ın yılan kuyruğu damarlarında kıvransın, siktir! Zehirli tahtında taç giy, ihanet rüzgarı seni savursun – bozkırın gizli mağarasında yılan gibi kıvran, Erlik\'in zehriyle eriyip git ulan amk yılanı!',
  'Yılan kraliçenin zehri kanında kaynasın, amk! Sırların bekçisi gibi saklan ama eriyip git – siktir git ulan, Şahmeran\'ın intikamıyla helak ol piç siktir!',
  
  // Nazar temalı
  'Nazar boncuğun bozkır fırtınasında parçalansın, lan! Mavi gözün kara delik olup yutsun seni – Tengri\'nin rüzgarı nazarını savursun, siktir git gölge avcısı amk kör ol piç!',
  'Kötü gözün kendi bozkırına dönsün, piç! Nazarınla kör ol, ulu fırtınada savrul – amına koyayım, siktir git lanetli bakış ulan siktir ol!',
  
  // Yelbegen temalı
  'Yelbegen\'in yedi bozkır başı seni yutsun, amk! Ateşli nefesiyle kavrulan atlı ordusu gibi ezilsin kemiklerin – Ülgen\'in gök kılıcı seni biçsin, siktir git ejderha yemi ulan siktir ol!',
  'Yedi başlı ejderhanın gazabı üstüne yağsın, siktir! Bozkırın ateş rüzgarında yan, ulan yemi – siktir git, Tengri\'nin ejderha lanetiyle yok ol amk piç!',
  
  // Hortlak temalı
  'Hortlak\'ın mezar bozkırından kalkan eli boğazını sıkar, piç! Kanlı rüzgarınla dans et, ölümsüz lanetinle sürün – Dede Korkut\'un hayalet atlısı seni kovalar, amına koyayım ölümsüz trol siktir git lan!',
  'Ölü ruhun bozkırda ulu, hortlak gibi dirilme hayalin, amk! Mezarından kalkıp ezil, siktir git – Erlik\'in zinciriyle sonsuz karanlıkta kal ulan piç siktir!',
  
  // Ülgen temalı
  'Ülgen\'in gök oku seni ıskalasın, siktir! Işık bozkırında karanlıkta kal, iyilik rüzgarı seni savurmasın – Erlik\'in gölgesi senin kalkanın olsun, ulan terk edilmiş savaşçı amk piç git!',
  'Gök tanrısının oğlu seni terk etsin, lan! Ülgen\'in ışığı sönmesin senden, ulan savaşçı – amına koyayım, siktir git terk edilmiş bozkurt ulan siktir!',
  
  // Kayra Han temalı
  'Kayra Han\'ın bozkır nefesi seni silsin, lan! Yaratılış destanından silin, unutulmuş kum tanesi gibi savrul – Oğuz\'un yay sesi kulaklarında çınlasın ama seni çağırmasın, siktir git yok olmuş efendi ulan amk!',
  'Yaratıcının eli seni unutsun, siktir! Bozkırın mimarisinden düş, ulan silik gölge – siktir git, Kayra\'nın kozmik rüzgarıyla yok ol piç amk!',
  
  // Bozkurt temalı
  'Bozkurt\'un ulu dişleri boğazına dizilsin, amk! Ergenekon dağlarından inen kurt ordusu seni parçalasın – bozkırın ulu homurtusuyla titret, siktir git kovulmuş sürgün ulan piç siktir!',
  'Ulu kurt\'un pençesi kalbine batsın, piç! Tengri\'nin kutsal rehberi seni kovsun, siktir git sürgün – Ergenekon\'un intikamıyla helak ol ulan amk siktir ol!'
  // ... (Daha fazla varyasyon ekle, 50+ tane için çoğalt – rastgelelik için ideal)
];

// Küfür tespit fonksiyonu (orijinal + mitolojik regex)
export function detectProfanity(text: string): boolean {
  if (!text || typeof text !== 'string') return false;
  
  const lowerText = text.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w\s]/g, ' ');
  
  // Orijinal kelime kontrolü
  for (const word of profanityWords) {
    const normalizedWord = word.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '');
    
    const wordRegex = new RegExp(`\\b${normalizedWord.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}\\b`, 'i');
    if (wordRegex.test(lowerText) || lowerText.includes(normalizedWord)) {
      return true;
    }
  }
  
  // Orijinal patterns + mitolojik
  const patterns = [
    // Orijinal patterns...
    /\b(amk|amına|siktir|orospu|piç|göt|yarrak|sik|am)\b/i,
    // ... (tam orijinal)
    
    // Mitolojik patterns
    /\b(erlik|albasti|tepegoz|sahmaran|yelbegen|hortlak|ulgen|kayra|bozkurt|nazar)\b/i,
    /(erlik\s+han|albasti\s+gibi|tepegoz\s+oku|nazar\s+değsin)/i
  ];
  
  for (const pattern of patterns) {
    if (pattern.test(text)) {
      return true;
    }
  }
  
  // Orijinal variations + mitolojik kısaltmalar
  const variations = [
    // Orijinal...
    /a\s*m\s*k/i,
    // Mitolojik: erlik -> rl1k gibi
    /e\s*r\s*l\s*i\s*k/i,
    /t\s*e\s*p\s*e\s*g\s*ö\s*z/i
  ];
  
  for (const variation of variations) {
    if (variation.test(text)) {
      return true;
    }
  }
  
  return false;
}

// Rastgele epik küfür yanıtı al (mitolojik mod)
export function getProfanityResponse(): string {
  return epicMythicProfanityResponses[Math.floor(Math.random() * epicMythicProfanityResponses.length)];
}

// Küfür seviyesine göre epik yanıt (küfür finali artırılmış)
export function getProfanityResponseByLevel(profanityCount: number): string {
  const epicLeveled = [
    'Erlik\'in gölgesi üstüne düşsün, siktir git (level 1 – hafif lanet amk!)',
    'Albastı dansı başlasın, ulan piç siktir (level 2 – gece gazabı!)',
    'Tepegöz oku saplansın, amına koyayım (level 3 – dev intikamı ulan!)',
    'Yelbegen\'in yedi başı yutsun, siktir git amk piç (level 4+ – tam destan!)'
  ];
  const index = Math.min(profanityCount - 1, epicLeveled.length - 1);
  return epicLeveled[index];
}