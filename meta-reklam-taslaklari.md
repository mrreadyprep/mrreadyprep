# mrreadyprep — Meta (Instagram/Facebook) Reklam Taslakları

*Hazırlanma tarihi: 13 Eylül 2026*

## Önce bir teknik eksik: Meta Pixel kurulu değil

Kod tabanını kontrol ettim — sitede şu an **Meta Pixel yok** (GA4 ve Microsoft Clarity var, ama Facebook/Instagram'ın kendi izleme kodu yok). Pixel olmadan:

- Reklam panelinde "kaç kişi kayıt oldu" gibi gerçek bir dönüşüm göremezsin, sadece tıklama sayısını görürsün.
- Meta'nın algoritması "kayıt olma ihtimali yüksek kişilere göster" diye optimize edemez — sadece "tıklama ihtimali yüksek kişilere" gösterir, bu da parayı gereksiz yere geniş bir kitleye yayar.
- İleride lookalike audience (mevcut kayıtlı kullanıcılara benzeyen kişileri hedefleme) kuramazsın.

**Öneri:** Reklamı başlatmadan önce Pixel'i kurmamı ister misin? Meta Business Suite'te bir Pixel ID oluşturman yeterli (sana adım adım anlatırım), ben de kodu (sayfa görüntüleme + kayıt tamamlama + checkout başlatma event'leri) siteye eklerim. 15-20 dakikalık bir iş, ama reklam bütçeni gerçekten optimize edebilmek için önemli. İstersen bunu atlayıp reklamı Pixel'siz de başlatabiliriz — sadece performansı daha kaba ölçeriz.

Aşağıdaki taslaklar Pixel olsun olmasın kullanılabilir; kurulumu ne zaman istersen ayrıca hallederiz.

## Kampanya çerçevesi

**Hedef:** Pixel kurulmadan önce "Traffic" (trafik), kurulduktan sonra "Conversions" (dönüşüm — kayıt tamamlama event'ine göre) hedefi.

**Bütçe:** Ürün $50/ay (WELCOME50 ile ilk ay $25). Hesap tamamen yeni, hiç reklam verisi yok — küçük başlamak şart. Günlük $5-10 ile 5-7 gün test edip, hangi reklam metninin/görselin daha çok tıklama+kayıt getirdiğine bakıp öyle büyütmek en güvenlisi. Tek kampanyada 3-4 reklam varyasyonunu aynı anda test et (aşağıda), Meta bütçeyi otomatik olarak en iyi performans gösterene kaydırır.

**Yönlendirme:** Reklamlar doğrudan ana sayfaya (mrreadyprep.com) değil, mümkünse doğrudan kayıt akışına düşecek şekilde link'lensin (ana sayfadaki "Get Started Free" butonunun gittiği yer). Tek adım azaltmak dönüşüm oranını yükseltir.

**Hedef kitle önerisi (ilk test):**
- Yaş: 18-30
- Dil: İngilizce (ikinci dil olarak) + hedef ülkelerin ana dilleri (Türkçe, Hintçe/İngilizce-Hindistan, Korece, Arapça, İspanyolca/Portekizce — Meta'da dil hedeflemesi yerine ilgi alanı hedeflemesi daha güvenilir sonuç verir)
- İlgi alanları: TOEFL, IELTS, "study abroad", "study in USA/Canada/UK", üniversite başvuru danışmanlığı sayfaları, İngilizce dil okulları
- Coğrafya: İlk testte Türkiye + Hindistan + Nijerya + Vietnam (TOEFL adaylarının en yoğun olduğu ülkelerden, ve reklam maliyeti görece düşük) — çok geniş global hedeflemeden daha ucuz ve ölçülebilir sonuç verir.
- Placement: Instagram Feed + Reels, Facebook Feed (Stories'i ilk testte kapatabilirsin, genelde daha düşük dönüşüm)

## Reklam metni varyasyonları (A/B/C/D test için 4 farklı açı)

Her biri için Meta'nın istediği üç alan: **Primary text** (ana metin), **Headline** (başlık, kısa), **Description** (açıklama, opsiyonel).

### Varyant A — Fiyat/indirim odaklı (WELCOME50)

**Primary text:**
TOEFL prep that doesn't cost a full paycheck. Get unlimited practice across Reading, Listening, Writing, and Speaking — plus all 20 full-length mock tests — for $50/month. New students: use code WELCOME50 at checkout for 50% off your first month.

**Headline:** 50% off your first month of TOEFL prep

**Description:** Unlimited practice + 20 full mock tests. Code: WELCOME50

### Varyant B — Ücretsiz başlangıç odaklı (bariyer düşük)

**Primary text:**
Start practicing for the TOEFL iBT for free — no credit card required. Real Reading, Listening, Writing, and Speaking exercises with instant AI-powered feedback, built to match the actual exam format. Upgrade only when you're ready for the full question bank and all 20 mock tests.

**Headline:** Free TOEFL practice, no card required

**Description:** Instant AI feedback on every section.

### Varyant C — 2026 format değişikliği / farklılaşma odaklı (aciliyet)

**Primary text:**
TOEFL changed its format in 2026 — including a brand-new Speaking task, Listen and Repeat, that most prep material hasn't caught up with yet. mrreadyprep is built specifically for the current exam: real one-play audio, real timing, real AI scoring on the new 1-6 scale. Don't train on outdated material.

**Headline:** Practice for the CURRENT TOEFL format

**Description:** Updated for the 2026 exam changes.

### Varyant D — Acı nokta / gerçekçilik odaklı (Full Mock Test)

**Primary text:**
Most TOEFL prep lets you review questions at your own pace — the real exam won't. mrreadyprep's full-length mock tests run under the exact timing and pressure of test day, so the first time you feel that pressure isn't on the actual exam. Reading, Listening, Writing, and Speaking, scored instantly.

**Headline:** Practice under real exam conditions

**Description:** 20 full-length mock tests, real timing.

## Görsel/video önerisi

Reklam için ayrı bir prodüksiyon yapmana gerek yok — zaten her gün üretilen kısa video senaryolarından (video-senaryo-2026-09-*.md dosyaları) en iyi performans göstereni (en çok izlenen/beğenilen) reklam kreatifi olarak kullanabilirsin. Instagram/TikTok'ta organik olarak iyi giden bir video varsa, onu "Boost" etmek yerine doğrudan Ads Manager'da yeni bir reklam olarak yükleyip yukarıdaki metinlerle eşleştirmek daha fazla kontrol verir (hedefleme, bütçe, A/B test).

Statik görsel istersen: fiyat kartını gösteren basit bir ekran görüntüsü (Subscribe ekranındaki WELCOME50 rozeti) veya "20 Full Mock Tests" yazan sade bir tasarım — karmaşık grafik tasarıma gerek yok, TOEFL adayları için net bilgi (fiyat, ne içerdiği) daha iyi çalışır.

## Sonraki adım

Hazır olduğunda:
1. Meta Business Suite hesabı / Business Manager kurulu mu, yoksa oradan başlayalım.
2. Pixel kurulumunu ister misin (yukarıda anlattığım gibi) — bunu önce yapmak reklamın ilk gününden itibaren daha iyi veri toplamanı sağlar.
3. Yukarıdaki 4 varyanttan hangileriyle başlamak istediğine karar ver (hepsiyle aynı anda başlamak da mantıklı, Meta kendi içinde eler).
