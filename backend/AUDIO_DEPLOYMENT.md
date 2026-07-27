# Ses dosyalarını canlıya taşıma

`backend/audio/` klasörü git'e dahil değil (şu an ~364 MB / ~3875 dosya -- GitHub'a normal
şekilde push edilemeyecek kadar büyük). Bu yüzden Render'a deploy ederken bu klasörü ayrı bir
şekilde sunucuya taşımamız gerekiyor.

## Kısa vadede (ilk launch): Render Persistent Disk

1. Render dashboard'da backend Web Service'ine bir **Persistent Disk** ekle (Settings > Disks),
   mount path olarak `/opt/render/project/src/backend/audio` (veya servisin çalışma dizinine göre
   `audio` klasörünün gerçek yolu neyse onu) kullan. Ücretsiz katmanda disk desteklenmez, en düşük
   ücretli instance tipine geçmek gerekir.
2. Disk boş şekilde ilk deploy'u yap.
3. Yerel `backend/audio` klasörünü sunucuya taşı -- en pratik yöntem Render'ın verdiği shell
   erişimi (`render ssh <service-adı>`) üzerinden `rsync` veya `scp` ile yüklemek. Render CLI kurulu
   değilse önce `brew install render` (macOS) ile kurulabilir.
4. Yeni bir mock test / pratik havuzu eklendiğinde (yeni ses dosyaları üretildiğinde) bu yükleme
   adımını tekrar yapman gerekecek -- disk her deploy'da silinmiyor, sadece ilk seferde boş olarak
   geliyor.

Bu yöntem hızlı başlamak için yeterli ama öğrenci sayısı ve içerik arttıkça (özellikle birden fazla
sunucu instance'ı çalıştırmak istersen) ölçeklenmez, çünkü persistent disk tek bir instance'a bağlıdır.

## Orta/uzun vadede: Obje depolama + CDN (önerilen)

Cloudflare R2, AWS S3 veya Backblaze B2 gibi bir obje depolama servisine tüm `audio/` klasörünü
bir kere yükleyip, `main.py`'deki `BACKEND_PUBLIC_URL` tabanlı ses URL'lerini doğrudan o servisin
public URL'ine (gerekirse önüne bir CDN koyarak) yönlendirmek gerekir. Bu, sunucudan bağımsız,
sınırsız ölçeklenen ve daha ucuz bir çözüm. Bu geçişi istediğinde ayrı bir iş olarak ele alabiliriz;
kod tarafında sadece ses URL'lerinin üretildiği birkaç satır değişir (`main.py` içinde
`{BACKEND_PUBLIC_URL}/audio/...` yerine obje depolamanın URL'i kullanılır), mock test JSON'ları veya
diğer içerikler etkilenmez.
