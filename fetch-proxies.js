const https = require('https');
const fs = require('fs');

const CHANNEL_URL = 'https://t.me/s/ProxyFree_Ru';

const FALLBACK = [
  {type:"MTProto",server:"185.173.36.38",port:"443",secret:"eeRighJJvXrFGRMCIMJdCQ",flag:"🇳🇱"},
  {type:"MTProto",server:"91.107.255.159",port:"8443",secret:"eeNEgYdJvXrFGRMCIMJdCQ",flag:"🇩"},
  {type:"MTProto",server:"65.109.153.70",port:"8443",secret:"1320PuNyHw_LQKT_Y7XNJw",flag:"🇫🇮"},
  {type:"MTProto",server:"51.15.246.20",port:"8443",secret:"eeNEgYdJvXrFGRMCIMJdCQ",flag:"🇫🇷"},
  {type:"MTProto",server:"149.154.167.91",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.167.103",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.167.92",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.167.100",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.171.100",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.175.100",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.175.102",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"},
  {type:"MTProto",server:"149.154.167.200",port:"8443",secret:"dd070b1b71f82167e279061e9b53f4f1",flag:"🇬🇧"}
];

const FLAG_MAP = {
  '185.': '🇳🇱', '91.107.': '🇩🇪', '65.109.': '🇫🇮', '51.15.': '🇫',
  '149.154.': '🇬🇧', '.ru': '🇷🇺', '.de': '🇩🇪', '.nl': '🇳🇱',
  '.fr': '🇫🇷', '.fi': '🇫🇮', '.uk': '🇬🇧', '.us': '🇺', '.sg': '🇬',
  '.ir': '🇮🇷', '.ae': '🇦🇪', '.tr': '🇹🇷', '.pl': '🇵🇱', '.by': '🇧🇾',
  '.info': '🌐', '.xyz': '🌐', '.best': '🌐', '.click': '🌐', '.lat': '🌐'
};

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

function parseProxiesFromChannel(html) {
  const proxies = [];
  const now = new Date();
  
  // 🔥 Разбиваем на сообщения
  const messageBlocks = html.split(/<div[^>]*class="[^"]*tgme_widget_message[^"]*"[^>]*>/i).slice(1);
  console.log(`📦 Found ${messageBlocks.length} message blocks`);
  
  for (let i = 0; i < messageBlocks.length; i++) {
    const block = messageBlocks[i];
    
    // 🕐 Извлекаем время из <time datetime="...">
    const timeMatch = block.match(/<time[^>]*datetime="([^"]+)"/i);
    let messageTime = now.toISOString();
    
    if (timeMatch && timeMatch[1]) {
      messageTime = new Date(timeMatch[1]).toISOString();
      console.log(`⏰ Message ${i} time:`, timeMatch[1]);
    }
    
    // 🔍 Ищем tg:// ссылки
    const tgLinks = block.match(/tg:\/\/proxy\?server=[^\s"&]+&port=\d+&secret=[^\s"&]+/gi) || [];
    
    for (const link of tgLinks) {
      try {
        const cleanLink = link.replace(/"/g, '').replace(/&amp;/g, '&').trim();
        const params = new URLSearchParams(cleanLink.replace('tg://proxy?', ''));
        const server = params.get('server')?.trim();
        const port = params.get('port')?.trim();
        const secret = params.get('secret')?.trim();
        
        if (server && port && secret && secret.length >= 16 && server.toLowerCase() !== 'unknown') {
          proxies.push({
            type: 'MTProto',
            server,
            port,
            secret,
            flag: getFlag(server),
            fetchedAt: messageTime,
            raw: cleanLink
          });
          console.log(`✅ [${messageTime}] ${server}:${port}`);
        }
      } catch(e) {
        console.warn('Parse error:', e.message);
      }
    }
  }
  
  return proxies;
}

function getFlag(ip) {
  for (const [prefix, flag] of Object.entries(FLAG_MAP)) {
    if (ip.includes(prefix) && flag !== '🇺🇦') return flag;
  }
  return '🌐';
}

async function main() {
  const now = new Date();
  console.log('🔍 Fetching from ProxyFree_Ru...', now.toISOString());
  
  try {
    const html = await fetchUrl(CHANNEL_URL);
    console.log('📄 HTML length:', html.length);
    
    const proxies = parseProxiesFromChannel(html);
    console.log('📊 Total parsed:', proxies.length);
    
    // 🔥 Сортировка: самые свежие первыми
    proxies.sort((a, b) => new Date(b.fetchedAt) - new Date(a.fetchedAt));
    
    // Убираем дубликаты
    const seen = new Set();
    const uniqueProxies = [];
    for (const p of proxies) {
      const key = `${p.server}:${p.port}`;
      if (!seen.has(key)) {
        seen.add(key);
        uniqueProxies.push(p);
      }
    }
    
    console.log('📊 Unique proxies:', uniqueProxies.length);
    
    // 🛡️ Фоллбэк
    let finalProxies = uniqueProxies.slice(0, 12);
    if (finalProxies.length < 3) {
      console.log('⚠️ Using fallback');
      for (const fb of FALLBACK) {
        const key = `${fb.server}:${fb.port}`;
        if (!seen.has(key) && finalProxies.length < 12) {
          seen.add(key);
          finalProxies.push({
            ...fb,
            fetchedAt: now.toISOString(),
            raw: `tg://proxy?server=${fb.server}&port=${fb.port}&secret=${fb.secret}`
          });
        }
      }
    }
    
    const result = {
      success: true,
      count: finalProxies.length,
      timestamp: now.toISOString(),
      next_update: new Date(now.getTime() + 10*60*1000).toISOString(),
      proxies: finalProxies,
      source: 'ProxyFree_Ru'
    };
    
    fs.writeFileSync('proxies.json', JSON.stringify(result, null, 2));
    console.log(`💾 Saved ${finalProxies.length} proxies`);
  } catch (e) {
    console.error('❌ Critical error:', e.message);
    const result = {
      success: false,
      count: FALLBACK.length,
      timestamp: now.toISOString(),
      proxies: FALLBACK.map(p => ({...p, fetchedAt: now.toISOString(), raw: `tg://proxy?server=${p.server}&port=${p.port}&secret=${p.secret}`})),
      source: 'fallback',
      error: e.message
    };
    fs.writeFileSync('proxies.json', JSON.stringify(result, null, 2));
  }
}

main().catch(console.error);
