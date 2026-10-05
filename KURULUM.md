# Kripto Çizelge: iPhone kurulumu

Üç parça var:

| Parça | Ne yapar | Nerede çalışır |
|---|---|---|
| Site (`index.html`) | Çizelge, grafik, Türkçe haber özeti | GitHub Pages |
| Haber görevi (`haber/`) | Saatte bir haberleri okuyup `haberler.json`'u Türkçe günceller | Claude (bulut) |
| Bildirim (`bildirim/worker.js`) | Her dakika BTC'ye bakar, %0.5 oynarsa telefona bildirim atar | Cloudflare Workers + ntfy |

---

## 1. Siteyi yayınla (GitHub Pages)

1. https://github.com/new adresine git.
   - Repository name: `kripto`
   - **Public** seç
   - README, .gitignore ve lisans ekleme (boş repo olsun)
   - **Create repository**
2. Claude'a "repo hazır" de. Dosyaları Claude yükleyecek.
3. Repoda **Settings → Pages** bölümüne gir.
   - Source: **Deploy from a branch**
   - Branch: `main`, klasör: `/ (root)` → **Save**
4. 1-2 dakika sonra site şu adreste açılır: **https://epheles.github.io/kripto/**

## 2. iPhone'da uygulama gibi kullan

1. iPhone'da **Safari** ile https://epheles.github.io/kripto/ adresini aç.
2. Alttaki **Paylaş** düğmesine bas → **Ana Ekrana Ekle** → **Ekle**.
3. Ana ekranda "Kripto" simgesi çıkar. Tam ekran uygulama gibi açılır.

> Parite listesi her cihazda ayrı saklanır. iPhone'da listeyi bir kez "Pariteleri düzenle" ile ayarla.
> Tablo telefonda yana kaydırılır; coin sütunu sabit kalır.

## 3. Türkçe haber görevi (Claude)

1. https://claude.ai/connect-github adresinden GitHub hesabını Claude'a bağla ve `kripto` reposuna izin ver.
2. Claude'a "GitHub bağlandı" de. Saatlik görevi Claude kuracak.

Görevin talimatı `haber/GOREV.md` dosyasında. Görev bu talimata göre `haberler.json` dosyasını günceller.

## 4. Telefona bildirim (ntfy + Cloudflare)

### 4a. ntfy uygulaması

1. App Store'dan **ntfy** uygulamasını indir (ücretsiz).
2. Aç, bildirimlere **izin ver**.
3. **+** → konu adı olarak Claude'un sohbette verdiği adı yaz (`kripto-btc-…`) → **Subscribe**.

> Konu adı şifre gibidir: bilen herkes bildirimleri görebilir. Bu yüzden repoya yazılmadı.

### 4b. Cloudflare worker

1. https://dash.cloudflare.com/sign-up adresinden ücretsiz hesap aç.
2. **Storage & Databases → KV → Create** → ad: `kripto-kv` → oluştur.
3. **Workers & Pages → Create → Worker** ("Hello World" ile başla) → ad: `kripto-bildirim` → **Deploy**.
4. **Edit code**: içindeki her şeyi sil, `bildirim/worker.js` dosyasının tamamını yapıştır → **Deploy**.
5. Worker sayfasında **Settings**:
   - **Bindings → Add → KV namespace**: Variable name `KV`, namespace `kripto-kv` → kaydet.
   - **Variables and Secrets → Add**:
     - Type **Secret**, name `NTFY_TOPIC`, value: ntfy konu adın
     - (isteğe bağlı) Type Text, name `SITE_URL`, value `https://epheles.github.io/kripto/`
     - (isteğe bağlı) Type Text, name `ESIK`, value `0.5` (yüzde eşiği)
   - **Trigger Events (Triggers) → Add → Cron Triggers**: `* * * * *` (her dakika) → kaydet.
6. **Test**: worker adresinin sonuna `?test=1` ekleyip tarayıcıda aç (ör. `https://kripto-bildirim.<hesabın>.workers.dev/?test=1`). iPhone'a "Kripto Çizelge bağlandı" bildirimi gelmeli.
7. Worker adresini `?test=1` olmadan açınca anlık fiyatı, referansı ve değişimi görürsün.

Bildirim, fiyat son bildirimdeki fiyattan %0.5 uzaklaştığında gelir (en geç 1 dakika içinde). Telefon kilitliyken de gelir.
