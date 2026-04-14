const https = require('https');
const fs = require('fs');

// ✅ Источник прокси
const CHANNEL_URL = 'https://t.me/s/ProxyFree_Ru';

// 🛡️ Фоллбэк-прокси (без пробелов!)
const FALLBACK = [
  {type: "MTProto", server: "185.173.36.38", port: "443", secret: "eeRighJJvXrFGRMCIMJdCQ", flag: "🇳🇱"},
  {type: "MTProto", server: "91.107.255.159", port: "8443", secret: "eeNEgYdJvXrFGRMCIMJdCQ", flag: "🇩🇪"},
  {type: "MTProto", server: "65.109.153.70", port: "8443", secret: "1320PuNyHw_LQKT_Y7XNJw", flag: "🇫🇮"},
  {type: "MTProto", server: "51.15.246.20", port: "8443", secret: "eeNEgYdJvXrFGRMCIMJdCQ", flag: "🇫🇷"},
  {type: "MTProto", server: "149.154.167.91", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.167.103", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.167.92", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.167.100", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.171.100", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.175.100", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.175.102", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"},
  {type: "MTProto", server: "149.154.167.200", port: "8443", secret: "dd070b1b71f82167e279061e9b53f4f1", flag: "🇬🇧"}
];

// 🏳️ Карта флагов (исправлены обрезанные эмодзи)
const FLAG_MAP = {
  '185.': '🇳🇱', '91.107.': '🇩🇪', '65.109.': '🇫🇮', '51.15.': '🇫🇷',
  '149.154.': '🇬🇧', '.ru': '🇷🇺', '.de': '🇩🇪', '.nl': '🇳🇱',
  '.fr': '🇫🇷', '.fi': '🇫🇮', '.uk': '🇬🇧', '.us': '🇺🇸', '.sg': '🇸🇬',
  '.ir': '🇮🇷', '.ae': '🇦🇪', '.tr': '🇹🇷', '.pl': '🇵🇱', '.by': '🇧🇾'
};

// 🔁 Глобальный кэш для отслеживания "первого появления"
let knownProxiesCache = new Map();

function fetchUrl(url) {
  return new Promise((resolve, reject) => {
    https.get(url, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'ru-RU,ru;q=0.9',
      },
      timeout: 10000
    }, res => {
      let data = '';
      res.on('data', chunk => data += chunk);
      res.on('end', () => resolve(data));
    }).on('error', reject);
  });
}

// 🔍 Парсинг прокси с привязкой ко времени публикации
function parseProxiesFromChannel(html) {
  const proxies = [];
  const decoded = html
    .replace(/&amp;/g, '&').replace(/&lt;/g, '<').replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"').replace(/&#39;/g, "'");

  const messageBlocks = decoded.split(/<div[^>]*class="[^"]*tgme_widget_message[^"]*"[^>]*>/i).slice(1);
  console.log(`📦 Found ${messageBlocks.length} message blocks`);

  for (const block of messageBlocks) {
    // 🕐 Время публикации
    const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/);
    const messageTime = timeMatch ? new Date(timeMatch[1]).toISOString() : new Date().toISOString();

    // 🔍 Поиск tg://proxy ссылок (исправлен регекс — без пробелов внутри)
    const tgLinks = block.match(/tg:\/\/proxy\?server=[^&\s"&]+&port=\d+&secret=[^\s"&]+/gi) || [];

    for (const link of tgLinks) {
      try {
        const cleanLink = link.replace(/&amp;/g, '&').replace(/"/g, '');
        const params = new URLSearchParams(cleanLink.replace('tg://proxy?', ''));
        const server = params.get('server')?.trim();
        const port = params.get('port')?.trim();
        const secret = params.get('secret')?.trim();

        if (server && port && secret?.length >= 16 && server.toLowerCase() !== 'unknown') {
          proxies.push({
            type: 'MTProto',
            server,
            port,
            secret,
            flag: getFlag(server),
            lastPosted: messageTime,
            raw: cleanLink
          });
          console.log(`✅ [${messageTime}] ${server}:${port}`);
        }
      } catch(e) {
        console.warn('⚠️ Parse error:', e.message);
      }
    }

    // 🔍 Альтернативный парсинг из текста
    if (tgLinks.length === 0) {
      const text = block.replace(/<[^>]+>/g, ' ');
      const serverMatch = text.match(/(?:server|хост)[:\s]*([a-zA-Z0-9.\-_]+)/i);
      const portMatch = text.match(/(?:port|порт)[:\s]*(\d{3,5})/i);
      const secretMatch = text.match(/(?:secret|ключ)[:\s]*([A-Za-z0-9_+\-=/]{16,})/i);
      
      if (serverMatch && portMatch && secretMatch) {
        const server = serverMatch[1].trim();
        const port = portMatch[1].trim();
        const secret = secretMatch[1].trim();
        
        if (server && port && secret.length >= 16 && server.toLowerCase() !== 'unknown') {
          proxies.push({
            type: 'MTProto',
            server,
            port,
            secret,
            flag: getFlag(server),
            lastPosted: messageTime,
            raw: `tg://proxy?server=${server}&port=${port}&secret=${secret}`
          });
        }
      }
    }
  }
  return proxies;
}

function getFlag(ip) {
  for (const [prefix, flag] of Object.entries(FLAG_MAP)) {
    if (ip.includes(prefix)) return flag;
  }
  return '🌐';
}

// 🔑 Уникальный ключ прокси (сервер:порт:секрет)
function getProxyKey(proxy) {
  return `${proxy.server}:${proxy.port}:${proxy.secret}`;
}

async function main() {
  const now = new Date();
  console.log('🔍 Fetching from ProxyFree_Ru...', now.toISOString());

  // 🔄 Загружаем кэш
  try {
    const cacheRaw = fs.readFileSync('proxies-cache.json', 'utf8');
    const cache = JSON.parse(cacheRaw);
    knownProxiesCache = new Map(Object.entries(cache));
    console.log(`📥 Loaded ${knownProxiesCache.size} known proxies from cache`);
  } catch (e) {
    console.log('ℹ️ No cache found, starting fresh');
  }

  try {
    const html = await fetchUrl(CHANNEL_URL);
    console.log('📄 HTML length:', html.length);
    
    const proxies = parseProxiesFromChannel(html);
    console.log('📊 Total parsed:', proxies.length);

    // 🧠 Обогащаем прокси данными о "первом появлении"
    const enriched = proxies.map(p => {
      const key = getProxyKey(p);
      const isFirstTime = !knownProxiesCache.has(key);
      
      if (isFirstTime) {
        knownProxiesCache.set(key, {
          firstSeen: now.toISOString(),
          server: p.server,
          port: p.port
        });
      }
      
      const firstSeen = knownProxiesCache.get(key)?.firstSeen || now.toISOString();
      const ageMs = now - new Date(firstSeen);
      const ageHours = Math.round(ageMs / (1000 * 60 * 60));
      
      return {
        ...p,
        firstSeen,
        ageHours,
        isNew: ageHours < 2,
        repostCount: ageHours > 0 ? Math.floor(ageHours / 2) : 0
      };
    });

    // 🗑️ Убираем дубликаты по ключу server:port:secret
    const seen = new Set();
    const uniqueProxies = [];
    for (const p of enriched) {
      const key = getProxyKey(p);
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProxies.push(p);
      }
    }
    console.log('📊 Unique proxies:', uniqueProxies.length);

    // 🔥 Сортировка: сначала новые, потом по возрасту
    uniqueProxies.sort((a, b) => {
      if (a.isNew && !b.isNew) return -1;
      if (!a.isNew && b.isNew) return 1;
      return new Date(a.firstSeen) - new Date(b.firstSeen);
    });

    // 🛡️ Фоллбэк
    let finalProxies = uniqueProxies.slice(0, 12);
    if (finalProxies.length < 3) {
      console.log('⚠️ Using fallback proxies');
      for (const fb of FALLBACK) {
        const key = getProxyKey(fb);
        if (!seen.has(key) && finalProxies.length < 12) {
          seen.add(key);
          finalProxies.push({
            ...fb,
            firstSeen: now.toISOString(),
            lastPosted: now.toISOString(),
            ageHours: 999,
            isNew: false,
            repostCount: 0,
            flag: fb.flag || getFlag(fb.server),
            raw: `tg://proxy?server=${fb.server}&port=${fb.port}&secret=${fb.secret}`
          });
        }
      }
    }

    // 💾 Результат (БЕЗ ПРОБЕЛОВ в ключах!)
    const result = {
      success: true,
      count: finalProxies.length,
      timestamp: now.toISOString(),
      next_update: new Date(now.getTime() + 30*60*1000).toISOString(),
      proxies: finalProxies,
      source: 'ProxyFree_Ru'
    };

    fs.writeFileSync('proxies.json', JSON.stringify(result, null, 2));
    console.log(`💾 Saved ${finalProxies.length} proxies to proxies.json`);

    // 💾 Обновляем кэш
    const cacheObj = Object.fromEntries(knownProxiesCache);
    fs.writeFileSync('proxies-cache.json', JSON.stringify(cacheObj, null, 2));
    console.log(`💾 Updated cache with ${knownProxiesCache.size} entries`);

  } catch (e) {
    console.error('❌ Critical error:', e.message);
    
    const result = {
      success: false,
      count: FALLBACK.length,
      timestamp: now.toISOString(),
      next_update: new Date(now.getTime() + 30*60*1000).toISOString(),
      proxies: FALLBACK.map(p => ({
        ...p,
        firstSeen: now.toISOString(),
        lastPosted: now.toISOString(),
        ageHours: 999,
        isNew: false,
        repostCount: 0,
        flag: p.flag || getFlag(p.server),
        raw: `tg://proxy?server=${p.server}&port=${p.port}&secret=${p.secret}`
      })),
      source: 'fallback',
      error: e.message
    };
    fs.writeFileSync('proxies.json', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
