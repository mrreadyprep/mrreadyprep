# mrreadyprep — Genel Yol Haritası (Şu Andan İtibaren)

Bu doküman artık sadece şirketleşmeyi değil, **şu anki noktadan gerçek bir işletmeye kadar** olan tüm yolu kapsıyor: Pazartesi'nin mali müşavir görüşmesi, Delaware C-Corp + Türkiye yapısı kararı, ürünün tamamlanması, gerçek ödeme sistemine geçiş ve büyüme/kullanıcı kazanımı. Her bölüm bir öncekine bağlı olacak şekilde sıralandı; paralel yürütülebilecek yerler ayrıca belirtildi.

**Not:** Bu bir avukat/mali müşavir görüşü değil, genel bir yol haritasıdır. Faz A'daki danışmanlık görüşmesi atlanmadan hukuki/mali adımlara geçilmemeli.

---

## Şu anki durum (8-9 Ağustos 2026 itibarıyla)

**Ürün — tamamlanmış ve canlı:**
- mrreadyprep.com'da yayında: Reading (Complete the Words / Read in Daily Life / Academic Passage), Listening (4 alt tür), Writing (Build a Sentence / Email / Academic Discussion), Speaking (Listen & Repeat / Take an Interview) pratik modülleri — her biri yüzlerce soru/pasaj havuzuyla — artı 20 adet sabit Full Mock Test.
- Hesap sistemi: email/şifre + Google ile giriş, email doğrulama, şifremi unuttum akışı, admin paneli (kullanıcı listesi, premium grant/revoke, istatistikler).
- İlerleme takibi: Dashboard, bölüm bazlı hedef/skor karşılaştırması, geçmiş sonuçlar.
- Mobil uyumlu, freemium içerik kilitleme sistemi kurulu (1 ücretsiz öğe + "Subscribe to unlock").
- Barındırma: Render (backend + frontend), ücretsiz plan + UptimeRobot keep-alive ile uyku sorunu ücretsiz çözüldü; ses dosyaları Cloudflare R2'de.
- Sağlamlık: 6 tur detaylı kod taraması tamamlandı (güvenlik açıkları, veri tutarlılığı, performans dahil), binlerce kullanıcı senaryosu için yük testi yapıldı (JSON cache + Postgres connection pool eklendi), canlı tarayıcıda uçtan uca test edildi (kayıt, giriş, admin panel, Google ile giriş, mobil görünüm, ödeme ekranı dahil).

**Ödeme — kurulu ama henüz canlı değil:**
- iyzico entegrasyonu kodda tamam (checkout, webhook, abonelik iptali) ama şu an **sandbox modunda** — gerçek kart işlemi almıyor, bugüne kadar **gerçek gelir oluşmadı**.
- Production'a geçiş, iyzico'nun istediği vergi levhası + imza sirküleri gibi belgeleri sağlayacak bir tüzel/şahıs kimliği gerektiriyor — bu yüzden Faz A/B'nin sonucuna bağlı.

**Kullanıcılar:** şu an sistemde yalnızca birkaç test/deneme hesabı var, gerçek ödeyen kullanıcı yok.

**Şirketleşme:** Mali müşavirle görüşüldü. Karar: önce Türkiye'de kuruluş (tür — şahıs şirketi/Ltd. Şti. — mali müşavirin belirleyeceği, takip mali müşavirde), Türkiye tarafında biraz ilerledikten sonra Delaware C-Corp'a geçiş planlanıyor (Seçenek B'nin sıralı hali: Türkiye önce, ABD sonra). Kuruluş sürecinin kendisi mali müşavir tarafında yürüyor — ürün geliştirme tarafında devam ediliyor.

**Büyüme/pazarlama:** henüz başlamadı — analytics (ziyaretçi takibi) kurulu değil, site Google'da aranınca hiç çıkmıyor (henüz indexlenmemiş), Kullanım Şartları/Gizlilik Politikası sayfası yok.

---

## Faz A — Pazartesi: mali müşavir görüşmesi (kritik karar noktası, her şeyin önü)

Hafta sonu vergi dairesi/ticaret odası kapalı olduğu için zaten hiçbir resmi işlem başlatılamaz — bu süre tamamen hazırlık için. Amaç, Pazartesi görüşmesinin "işi anlatmakla" değil doğrudan karar almakla geçmesi.

**Netleşmiş bilgiler (görüşmeye giderken elinde olsun):**
- iyzico şu an **sandbox'ta**, gerçek işlem almıyor. Bugüne kadar **gerçek gelir yok** — bu, geriye dönük vergi sorunu riskini ortadan kaldırıyor, mali müşavire net söyleyebilirsin.
- Ürün tamamen hazır ve teknik olarak istediğin an gerçek ödeme almaya başlayabilecek durumda; şu an bekleyen tek şey şirket/kimlik yapısı kararı.

**Senin netleştirmen gereken bilgiler (görüşmeden önce kendine sor):**
- Şu an herhangi bir vergi mükellefiyetin var mı (başka bir iş/freelance üzerinden)?
- TR / uluslararası kullanıcı oranı kabaca ne olacak (tahmin yeterli — henüz gerçek kullanıcı olmadığı için hedef kitleni düşün)?
- iyzico'yu kesin korumak mı istiyorsun, yoksa tamamen Stripe'a geçmek de masada mı?
- Yatırım alma hedefin ne kadar acil (6 ay içinde mi, 1-2 yıl sonra mı)? Bu, ne kadar "temiz" bir yapı kurman gerektiğini belirliyor.

**Yanına al / topla:**
- Kimlik fotokopisi, ikametgah belgesi
- Bu dosyayı (sirketlesme-yol-haritasi.md) — birlikte üzerinden geçin
- Varsa mevcut vergi kaydı bilgisi

**Mali müşavire soracağın net sorular (öncelik sırasıyla):**
1. Delaware C-Corp + Türkiye şahıs şirketi (iyzico için) kombinasyonu bu iş modeli için mantıklı mı?
2. CFC (kontrol edilen yabancı kurum) kuralı mrreadyprep'in SaaS abonelik gelirine uygulanır mı — "pasif gelir" testini geçer mi?
3. ABD şirketinden Türkiye yapısına para akışı nasıl kurulmalı (hizmet faturası mı, lisans anlaşması mı)?
4. iyzico'nun kabul ettiği asgari yapı şahıs şirketi (esnaf kaydı, vergi levhası + imza sirküleri yeterli) — ilerisi için direkt Ltd. Şti. ile başlamak daha mı mantıklı olur?
5. Kişisel gelir vergisi + ABD kurumlar vergisi çifte vergilendirmesi ABD-Türkiye vergi anlaşmasıyla nasıl önleniyor?
6. Şirket kurulmadan önce (kuruluş öncesi dönemde) siteye gerçek ödeme entegre edilirse, o gelirin vergisel durumu ne olur — bu netleşmeden iyzico'yu production'a almamak en güvenlisi.

*Not: iyzico'nun şahıs şirketi başvurusunda istediği belgeler — vergi levhası, imza sirküleri, kimlik fotokopisi ve vergi levhasındaki isimle eşleşen IBAN. Yani ilk aşamada büyük bir şirket kurmaya gerek yok, bunu mali müşavirle teyit et.*

**Görüşme çıktısı olarak netleşmesi gereken tek şey:** Seçenek A (Stripe'a tam geçiş, sadece Delaware yeterli) mi, Seçenek B (iyzico + Delaware + hafif Türkiye yapısı) mi? Bu karar Faz B'nin tamamının şeklini belirliyor.

---

## Faz B — Şirketleşme

### B0 — Karar öncesi son kontrol
1. **İsim/marka kontrolü**: "mrreadyprep" adının Delaware'de ve ABD'de ticari marka olarak müsait olduğunu kontrol et (USPTO TESS üzerinden hızlı bir arama yeterli, tescil zorunlu değil ama çakışma riski görmek için bak).

### B1 — Delaware C-Corp kuruluşu
2. **Kuruluş hizmeti seç**: Stripe Atlas (~$500, tek seferlik, EIN başvurusu + ilk yıl registered agent dahil) veya Firstbase (~$863, US adresi dahil). Atlas genelde fiyat/hız açısından en pratik seçenek.
3. **Certificate of Incorporation'ı dosyala** (seçtiğin hizmet bunu senin adına yapıyor) — hisse sayısı, kurucu payı, founder vesting (varsa) burada belirleniyor.
4. **EIN başvurusunu hemen başlat** (Form SS-4). SSN'in olmadığı için bu faks/postayla gidiyor ve 4-8 hafta sürebiliyor — sürecin en yavaş adımı, bu yüzden en erken bu adımı tetikle, diğer işleri bunu beklerken yap.
5. **Registered agent ve Delaware franchise tax takvimini not al**: yıllık ~$300 franchise tax (Delaware'e, genelde 1 Mart son tarih) + ~$100 registered agent ücreti.

### B2 — Bankacılık ve altyapı
6. **ABD iş bankası hesabı aç**: Mercury veya Wise Business — ikisi de yurt dışından kurucularla çalışıyor, EIN geldikten sonra başvurabilirsin (bazıları EIN beklerken de ön başvuru alıyor).
7. **Ödeme altyapısını Delaware şirketine bağla** (Seçenek A ise Stripe ana altyapın olur; Seçenek B'de global/ABD kullanıcıları için Stripe, Türkiye kullanıcıları için iyzico ayrı ayrı çalışabilir).
8. **83(b) seçimi** (varsa vesting'e tabi kurucu hissesi): IRS'e hisse alındıktan sonra 30 gün içinde bildirilmesi gerekiyor, süre kaçırılırsa geri dönüşü yok.

### B3 — Türkiye tarafı (sadece Seçenek B ise)
9. **Şahıs şirketi veya basit Ltd. Şti. kur** — vergi dairesine kayıt, gerekirse ticaret sicili. Bunun tek amacı iyzico'nun vergi levhası şartını karşılamak, büyük bir yapı olması gerekmiyor.
10. Delaware şirketi ile Türkiye yapısı arasındaki para akışını mali müşavirinle netleştir — genelde hizmet faturası/lisans anlaşması ile yapılıyor.

### B4 — Varlıkların yeni şirkete devri
11. **IP devir sözleşmesi (IP assignment)**: mrreadyprep kodunu, mrreadyprep.com domainini ve ilgili tüm fikri mülkiyeti şahsından yeni Delaware şirketine devret — kuruluş hizmetleri genelde şablonunu sağlıyor.
12. **Domain ve hesapları güncelle**: mrreadyprep.com'un kayıt sahibini, Render/Cloudflare/Resend gibi servislerin fatura hesaplarını yeni şirket adına çevir.

---

## Faz C — Ürünü tamamlama (Faz B ile paralel yürütülebilir)

Bunlar şirketleşme kararını beklemeden, istediğin an yapılabilir — kod/ürün işleri, hukuki bir bağımlılığı yok.

13. **Take an Interview ekranına konuşan kişi videosu ekle** (bekleyen küçük özellik) — Speaking bölümündeki görsel deneyimi iyileştirir.
14. **Kullanım Şartları / Gizlilik Politikası sayfası ekle** — ödeme ve kişisel veri toplayan bir site için şu an eksik olan bu sayfayı yazıp siteye ekle. (Faz B4'teki "tüzel kişi güncelleme" adımı bunun üstüne, şirket kurulduktan sonra sadece isim güncellemesi olarak eklenir.)

---

## Faz D — Gerçek ödeme sistemine geçiş (iyzico'yu production'a alma)

Bu faz, Faz A'daki karara ve (Seçenek B ise) Faz B3'teki Türkiye kimliğine bağlı — mali müşavirin onayı olmadan bu adıma geçilmemeli.

15. **iyzico merchant onayını** yeni kimlikle (şahıs şirketi/Ltd.) tamamla — sandbox'tan production'a geçiş, vergi levhası + imza sirküleri + IBAN ile başvuru.
16. **iyzico ürün/plan/webhook kurulumunu** production ortamında yap ve test et (küçük bir gerçek işlemle uçtan uca doğrula).
17. Bu noktadan sonra site gerçek ödeme almaya başlar — **bu adımdan önce Faz A'daki 6. soru netleşmeli**, aksi halde geriye dönük vergi belirsizliği yaratma riski var.

---

## Faz E — Büyüme ve kullanıcı kazanımı (Faz D'yi beklemek zorunda değil, ama gerçek ödeme öncesi tam hızlanmak riskli)

Analytics/SEO/içerik hazırlığı şirketleşme veya ödeme kararını beklemeden yapılabilir; gerçek kullanıcı çekmeye "tam gaz" başlamak ideal olarak Faz D tamamlandıktan sonra (ödeme sorunsuz çalışırken) olmalı.

18. **Analytics kurulumu (GA4)** — Google Analytics hesabı oluştur, measurement ID al, siteye entegre et. Trafiği ölçmeden büyütemeyiz.
19. **Google Search Console'a kayıt** — siteyi ekle, sitemap gönder, indexlenmeyi talep et (şu an site Google'da hiç çıkmıyor).
20. **Sitemap.xml genişletme** — ana sayfa dışında indexlenebilir alt sayfalar varsa ekle.
21. **İlk kullanıcı kazanım kanalları** — ilgili subreddit'ler (r/TOEFL vb.), Product Hunt lansmanı, sosyal medya için içerik/plan hazırla.

---

## Faz F — Sürekli işletme (kuruluş sonrası, sürekli)

22. **Yıllık takvim**: Delaware franchise tax + annual report (Mart), IRS Form 5472 + pro-forma 1120 (yabancı sahipli şirket bildirimi, ceza $25.000 — kaçırma), Türkiye'de varsa CFC beyanı ve kişisel gelir vergisi beyanı (temettü aldıysan).
23. **Muhasebe**: ABD tarafı için basit bir bookkeeping aracı (Bench, Pilot, veya sadece bir CPA) tut.
24. **Büyüme metriklerini takip et, iterasyona devam et**: GA4 verisine göre hangi kanalın işe yaradığını gör, ürün/içerik tarafında (yeni pratik havuzları, yeni özellikler) öğrenci geri bildirimine göre ilerle.

---

### Önerilen genel sıralama (özet)

**Pazartesi:** Faz A (mali müşavir görüşmesi, kritik karar).
**Hemen ardından, paralel:** Faz B (kuruluş + EIN — EIN'i en erken tetikle) ve Faz C (ürün tamamlama, ToS/Privacy) aynı anda yürüyebilir.
**Kuruluş/kimlik netleşince:** Faz D (iyzico'yu production'a al, gerçek ödeme başlasın).
**Ödeme sorunsuz çalışırken:** Faz E'yi tam hızlandır (analytics zaten Faz C ile başlamış olabilir, ama asıl kullanıcı kazanım çabası gerçek ödeme çalışırken anlamlı).
**Sürekli:** Faz F (yıllık uyum + büyüme iterasyonu).
