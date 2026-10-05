// Kripto Çizelge: BTC bildirim worker'ı (Cloudflare Workers)
//
// Her dakika BTC fiyatına bakar. Son bildirimden bu yana fiyat ESIK (%) kadar
// değiştiyse telefona bildirim yollar ve referansı yeni fiyata çeker.
// Bildirim Telegram botu üzerinden gider (TELEGRAM_TOKEN varsa), yoksa ntfy denenir.
//
// Gerekli ayarlar (Cloudflare panelinde, kurulum: KURULUM.md):
//   KV             : KV namespace bağlantısı (referans fiyatı ve Telegram sohbetini saklar)
//   TELEGRAM_TOKEN : @BotFather'dan alınan bot anahtarı (Secret)
//   ESIK           : isteğe bağlı, varsayılan 0.5
//   SITE_URL       : isteğe bağlı, mesajın altına eklenen site adresi
//   Cron           : * * * * *
// Telegram sohbeti bir kez bağlanır: bota mesaj yaz, sonra worker adresini ?baglan=1 ile aç.
//
// ntfy (yedek): NTFY_TOPIC (+ NTFY_TOKEN). Ücretsiz planda Cloudflare'in paylaşılan IP'si
// yüzünden çoğu zaman "daily message quota reached" (429) verir.

const KOD_SURUMU = 3;

const FIYAT_KAYNAKLARI = [
  async () => {
    const r = await fetch('https://data-api.binance.vision/api/v3/ticker/price?symbol=BTCUSDT');
    if (!r.ok) throw new Error('binance ' + r.status);
    return parseFloat((await r.json()).price);
  },
  async () => {
    const r = await fetch('https://api.coinbase.com/v2/prices/BTC-USD/spot');
    if (!r.ok) throw new Error('coinbase ' + r.status);
    return parseFloat((await r.json()).data.amount);
  },
];

async function btcFiyati() {
  const hatalar = [];
  for (const kaynak of FIYAT_KAYNAKLARI) {
    try {
      const p = await kaynak();
      if (p > 0) return p;
    } catch (e) { hatalar.push(e.message); }
  }
  throw new Error('Fiyat alınamadı: ' + hatalar.join(', '));
}

const fmt = p => Math.round(p).toLocaleString('en-US');

/* ---------- Telegram ---------- */
const tgApi = (env, metot) => `https://api.telegram.org/bot${env.TELEGRAM_TOKEN}/${metot}`;

async function telegram(env, metin) {
  const chat = await env.KV.get('tg_chat');
  if (!chat) throw new Error('Telegram sohbeti bağlı değil. Telegram\'da botuna bir mesaj yaz, sonra bu adresi ?baglan=1 ile aç.');
  const r = await fetch(tgApi(env, 'sendMessage'), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ chat_id: chat, text: metin, disable_web_page_preview: true }),
  });
  if (!r.ok) throw new Error('telegram ' + r.status + ' ' + (await r.text()));
}

// Bota en son mesaj yazan sohbeti bulur ve KV'ye kaydeder
async function telegramBagla(env) {
  if (!env.TELEGRAM_TOKEN) throw new Error('TELEGRAM_TOKEN ayarlanmamış');
  const r = await fetch(tgApi(env, 'getUpdates'));
  const j = await r.json();
  if (!j.ok) throw new Error('telegram: ' + j.description);
  const son = [...j.result].reverse().find(u => u.message && u.message.chat);
  if (!son) throw new Error('Bota henüz mesaj gelmemiş. Telegram\'da botunu aç, "merhaba" yaz, sonra bu sayfayı yenile.');
  await env.KV.put('tg_chat', String(son.message.chat.id));
  await telegram(env, '✅ Kripto Çizelge bağlandı.\nBTC %' + (env.ESIK || '0.5') + ' hareket edince buraya mesaj gelecek.');
  return { baglandi: true, sohbet: son.message.chat.first_name || son.message.chat.title || 'tamam' };
}

/* ---------- ntfy (yedek) ---------- */
async function ntfy(env, baslik, mesaj, yukari) {
  const headers = { 'Content-Type': 'application/json' };
  if (env.NTFY_TOKEN) headers.Authorization = 'Bearer ' + env.NTFY_TOKEN;
  const r = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers,
    body: JSON.stringify({
      topic: env.NTFY_TOPIC,
      title: baslik,
      message: mesaj,
      priority: 4,
      tags: [yukari ? 'chart_with_upwards_trend' : 'chart_with_downwards_trend'],
      ...(env.SITE_URL ? { click: env.SITE_URL } : {}),
    }),
  });
  if (!r.ok) throw new Error('ntfy ' + r.status + ' ' + (await r.text()));
}

async function bildir(env, baslik, mesaj, yukari) {
  if (env.TELEGRAM_TOKEN) {
    return telegram(env, `${yukari ? '📈' : '📉'} ${baslik}\n${mesaj}${env.SITE_URL ? '\n' + env.SITE_URL : ''}`);
  }
  if (env.NTFY_TOPIC) return ntfy(env, baslik, mesaj, yukari);
  throw new Error('Bildirim kanalı ayarlanmamış (TELEGRAM_TOKEN)');
}

/* ---------- fiyat kontrolü ---------- */
async function kontrol(env) {
  if (!env.KV) throw new Error('KV bağlantısı ayarlanmamış');
  const esik = parseFloat(env.ESIK || '0.5');
  const p = await btcFiyati();
  const ref = await env.KV.get('ref', 'json');

  if (!ref) {
    await env.KV.put('ref', JSON.stringify({ p, t: Date.now() }));
    return { fiyat: p, referans: p, degisim: 0, esik, bildirim: false, not: 'ilk referans kaydedildi' };
  }

  const degisim = (p / ref.p - 1) * 100;
  let bildirim = false;
  if (Math.abs(degisim) >= esik) {
    const yukari = degisim > 0;
    await bildir(env,
      `BTC ${yukari ? 'yükseldi' : 'düştü'} ${yukari ? '+' : '−'}%${Math.abs(degisim).toFixed(2)}`,
      `${fmt(ref.p)} → ${fmt(p)} $`,
      yukari);
    await env.KV.put('ref', JSON.stringify({ p, t: Date.now() }));
    bildirim = true;
  }
  return { fiyat: p, referans: ref.p, degisim: +degisim.toFixed(3), esik, bildirim };
}

export default {
  async scheduled(event, env, ctx) {
    ctx.waitUntil(kontrol(env));
  },

  // Tarayıcıdan açınca durumu gösterir.
  //   ?baglan=1  Telegram sohbetini bağlar (önce bota mesaj yaz)
  //   ?test=1    telefona deneme bildirimi yollar
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.searchParams.get('baglan') === '1') return Response.json(await telegramBagla(env));
      if (url.searchParams.get('test') === '1') {
        await bildir(env, 'Kripto Çizelge test', 'BTC %' + (env.ESIK || '0.5') + ' hareket edince bildirim gelecek.', true);
        return Response.json({ test: 'gönderildi' });
      }
      return Response.json(await kontrol(env));
    } catch (e) {
      // Teşhis için hangi ayarların tanımlı olduğunu da göster (değerleri değil)
      return Response.json({
        hata: e.message,
        ayarlar: {
          KV: !!env.KV,
          TELEGRAM_TOKEN: !!env.TELEGRAM_TOKEN,
          telegram_bagli: env.KV ? !!(await env.KV.get('tg_chat')) : false,
          kod_surumu: KOD_SURUMU,
        },
      }, { status: 500 });
    }
  },
};
