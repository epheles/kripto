# Saatlik haber özeti görevi

Bu dosya, saatte bir çalışan Claude görevinin talimatıdır. Görev bu repoda çalışır.

## Amaç

Dünyadaki güvenilir kaynaklardan son haberleri oku. Kripto piyasasını (özellikle Bitcoin'i) etkileyenleri seç. Türkçe, sade ve kısa bir özet halinde `haberler.json` dosyasına yaz. Okuyucu kripto alım-satımı yapan, haberi hızlıca anlamak isteyen biri; ekonomi jargonu bilmesi gerekmez.

## Adımlar

1. Haberleri al:
   - `git pull -q origin main`
   - **`haber/ham.json`** dosyasını oku. Bu dosyayı GitHub Actions her saat (xx:40) toplar: son 12 saat; Reuters, Bloomberg, FT, WSJ, CNBC, CoinDesk, The Block, Cointelegraph, Decrypt.
   - Dosyanın içindeki en yeni haber 3 saatten eskiyse ya da dosya yoksa `python3 haber/topla.py 12` ile kendin toplamayı dene.
2. Çıktıdan kripto fiyatlarını etkileyebilecek **8–12 haber** seç:
   - Bitcoin fiyat hareketi, ETF giriş/çıkışları, büyük şirket alımları
   - Fed, faiz, enflasyon, dolar, tahvil faizleri, büyük jeopolitik olaylar (makro)
   - Düzenleme (SEC, CFTC, AB, Türkiye), büyük borsa/hack haberleri
   - Önemli altcoin haberleri (ETH, SOL, SUI, TAO vb.)
   - Aynı olayı anlatan birden fazla haber varsa birini al. Kriptoyla ilgisi olmayan haberleri (spor, magazin, şirket birleşmeleri vb.) alma.
3. `haberler.json` dosyasını aşağıdaki biçimde **baştan yaz**.
4. Dosyanın geçerli JSON olduğunu kontrol et: `python3 -c "import json;json.load(open('haberler.json'))"`
5. Sadece `haberler.json` dosyasını commit'le (`ham.json`'a dokunma) ve `main` dalına push'la. Commit mesajı: `Haber özeti: <saat UTC>`. Başka dosyaya dokunma.

### Hiç haber alınamazsa

`ham.json` yoksa ya da eskiyse ve `topla.py` ağ hatası veriyorsa (ör. "Tunnel connection failed: 403"), dosyayı değiştirme ve commit atma. Telefona bildirim gönderme.

## Biçim

```json
{
 "guncelleme": "2026-10-05T16:00+00:00",
 "duygu": "olumlu | olumsuz | karisik | notr",
 "ozet": "3-4 cümle. Piyasanın genel durumu: BTC nerede, neden, dikkat edilecek seviye/olay. Sade Türkçe.",
 "takvim": ["Önümüzdeki günlerde piyasayı oynatabilecek 1-3 olay, gün adıyla (örn. 'Çarşamba 7 Ekim: Fed tutanakları. Faiz artışı vurgusu çıkarsa kripto düşebilir.')"],
 "haberler": [
  {
   "baslik": "Türkçe kısa başlık (en fazla ~70 karakter)",
   "ozet": "1-2 sade cümle: ne oldu ve kripto için ne anlama geliyor.",
   "etki": "olumlu | olumsuz | notr",
   "coinler": ["BTC"],
   "kaynak": "Reuters",
   "link": "kaynaktaki orijinal link",
   "tarih": "haberin tarihi, topla.py çıktısındaki gibi"
  }
 ]
}
```

## Kurallar

- `etki`, haberin kripto fiyatları için yönünü belirtir (olumlu = fiyatı destekler).
- `coinler`: haberin doğrudan ilgilendirdiği coinlerin kısaltmaları (BTC, ETH, SUI, TAO…). Genel bir haberse boş liste.
- Sadece topla.py çıktısındaki bilgileri kullan. Rakam ve olay uydurma. Emin olmadığın şeyi yazma.
- Haberleri yeniden eskiye sırala. `guncelleme` alanına şu anki UTC zamanı yaz.
- Yatırım tavsiyesi verme ("al", "sat" deme); ne olduğunu ve olası etkisini anlat.
