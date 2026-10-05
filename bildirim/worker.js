// Kripto Çizelge: BTC bildirim worker'ı (Cloudflare Workers)
//
// Her dakika BTC fiyatına bakar. Son bildirimden bu yana fiyat ESIK (%) kadar
// değiştiyse ntfy üzerinden telefona bildirim yollar ve referansı yeni fiyata çeker.
//
// Gerekli ayarlar (Cloudflare panelinde, kurulum: bildirim/KURULUM.md):
//   KV         : KV namespace bağlantısı (referans fiyatı saklar)
//   NTFY_TOPIC : ntfy konu adı (gizli tut, tahmin edilemeyen bir isim)
//   ESIK       : isteğe bağlı, varsayılan 0.5
//   SITE_URL   : isteğe bağlı, bildirime dokununca açılacak adres
//   Cron       : * * * * *

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

async function ntfy(env, baslik, mesaj, yukari) {
  const r = await fetch('https://ntfy.sh/', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
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

async function kontrol(env) {
  if (!env.KV || !env.NTFY_TOPIC) throw new Error('KV veya NTFY_TOPIC ayarlanmamış');
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
    await ntfy(env,
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

  // Tarayıcıdan açınca durumu gösterir. ?test=1 telefona deneme bildirimi yollar.
  async fetch(req, env) {
    const url = new URL(req.url);
    try {
      if (url.searchParams.get('test') === '1') {
        await ntfy(env, 'Kripto Çizelge bağlandı', 'BTC %' + (env.ESIK || '0.5') + ' hareket edince buraya bildirim gelecek.', true);
        return Response.json({ test: 'gönderildi' });
      }
      return Response.json(await kontrol(env));
    } catch (e) {
      return Response.json({ hata: e.message }, { status: 500 });
    }
  },
};
