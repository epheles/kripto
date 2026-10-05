# Kripto Çizelge: iPhone kurulumu

Üç parça var:

| Parça | Ne yapar | Nerede çalışır |
|---|---|---|
| Site (`index.html`) | Çizelge, grafik, Türkçe haber özeti | GitHub Pages |
| Haber görevi (`haber/`) | Saatte bir haberleri okuyup `haberler.json`'u Türkçe günceller | Claude (bulut) |
| Bildirim (`bildirim/worker.js`) | Her dakika BTC'ye bakar, %0.5 oynarsa telefona bildirim atar | Cloudflare Workers + Telegram |

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

## 4. Telefona bildirim (Telegram + Cloudflare)

> İlk denemede ntfy kullanıldı ama ücretsiz plan, Cloudflare'in paylaşılan IP'si yüzünden
> "daily message quota reached" hatası verdi. Bu yüzden bildirimler Telegram botu üzerinden gider.

### 4a. Telegram botu oluştur

1. Telegram'da **@BotFather** hesabını ara (mavi tikli olan) ve aç → **Başlat / Start**.
2. `/newbot` yaz ve gönder.
3. Bot adı sorar: `Kripto Çizelge` yaz.
4. Kullanıcı adı sorar: sonu `bot` ile biten benzersiz bir ad yaz (ör. `kripto_cizelge_hakan_bot`).
5. BotFather `123456789:AA…` biçiminde bir **token** verir. Kopyala; gizli tut.
6. Aynı mesajdaki `t.me/…` linkine dokunup kendi botunu aç → **Başlat** → `merhaba` yaz.

### 4b. Cloudflare worker

1. https://dash.cloudflare.com → **Storage & Databases → KV → Create** → ad: `kripto-kv`.
2. **Workers & Pages → Create → Worker** ("Hello World" ile başla) → ad: `kripto-bildirim` → **Deploy**.
3. **Edit code**: içindeki her şeyi sil, `bildirim/worker.js` dosyasının tamamını yapıştır → **Deploy**.
4. Worker sayfasında **Settings**:
   - **Bindings → Add binding → KV namespace**: Variable name `KV`, namespace `kripto-kv`.
   - **Variables and secrets → Add variable** (Production işaretli):
     - `TELEGRAM_TOKEN` = BotFather'dan aldığın token, **Secret** işaretli
     - (isteğe bağlı) `SITE_URL` = `https://epheles.github.io/kripto/`
     - (isteğe bağlı) `ESIK` = `0.5`
   - **Trigger events → Add → Cron Triggers**: `* * * * *` (her dakika).
5. **Bağla**: worker adresini sonuna `?baglan=1` ekleyip aç
   (`https://kripto-bildirim.<hesabın>.workers.dev/?baglan=1`). Telegram'a "✅ Kripto Çizelge bağlandı" mesajı gelir.
6. **Test** (isteğe bağlı): `?test=1` ile açınca deneme mesajı gelir.
7. Adresi parametresiz açınca anlık fiyatı, referansı ve değişimi görürsün.

Bildirim, fiyat son bildirimdeki fiyattan %0.5 uzaklaştığında gelir (en geç 1 dakika içinde). Telefon kilitliyken de gelir.
