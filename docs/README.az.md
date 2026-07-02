# <img src="../logo.svg" alt="" height="28" align="absmiddle"> Polygonize

[en](../README.md) · [zh-Hans](README.zh-Hans.md) · [hi](README.hi.md) · [es](README.es.md) · [fr](README.fr.md) · [bn](README.bn.md) · [pt](README.pt.md) · [ru](README.ru.md) · [id](README.id.md) · [de](README.de.md) · [ja](README.ja.md) · [tr](README.tr.md) · [vi](README.vi.md) · [ko](README.ko.md) · [it](README.it.md) · [pl](README.pl.md) · [uk](README.uk.md) · [uz](README.uz.md) · **az** · [kk](README.kk.md) · [be](README.be.md)

Bir fotoşəkili low-poly təsvirə (üçbucaqlardan yığılmış şəklə) çevirməyə imkan verən, brauzerdə işləyən redaktor. Onu adi generatorlardan fərqləndirən əsas şey budur: hazır generasiya olunmuş şəbəkəyə əlavə olaraq, istiqamətləndiriciləri özün çəkə bilirsən və üçbucaqların tilləri onların boyunca düzülür. Buna görə də vacib konturlar - çənə xətti, eynək çərçivəsi, siluet - təsadüfi şəbəkədə itib getmir, aydın qalır. Hazır nəticəni vektor (SVG, PDF) ya da şəkil (PNG, JPG, WebP) kimi saxlaya bilərsən.

**[REDAKTORU AÇ](https://jango-git.github.io/polygonize/)**

![Ekran görüntüsü](../image.png)

## Nə bacarır

- **Özün çəkdiyin istiqamətləndiricilər.** Təsvirin üstündən xətlər, çevrələr, hamar əyrilər çəkirsən - üçbucaqlar da onların boyunca düzülür. Bunlar şəklin üstündəki ayrıca modifikatorlardır, ona görə də istənilən an onların yerini dəyişə, detallaşdırma parametrlərini düzəldə və ya qruplaşdıra bilərsən.
- **Şəbəkə detallara uyğunlaşır.** Çoxlu xırda detalın və kəskin sərhədin olduğu yerlərdə üçbucaqlar daha xırda; göy üzü ya da fon kimi hamar sahələrdə isə daha iri olur. Şəkil lazım olan yerdə ətraflı, qalan yerlərdə isə sakit alınır. Üstəlik nəticə əvvəlcədən təxmin oluna bilən şəkildə təkrar yaradılır: eyni parametrlərlə şəbəkə tam eyni alınır.
- **Başlanğıc üçün avtomatik izləmə.** Boş vərəqdən başlamamaq üçün "Şəkli izlə" düyməsinə bas - redaktor şəklin kənarlarını özü tapır və onları redaktə oluna bilən modifikatorlara çevirib ayrıca qrupda toplayır.
- **Üçbucaqların rəngi.** Hər üçbucaq altındakı piksellərin orta rəngi ilə doldurulur - ya da parlaq kənar dəyərləri yatırtmaq lazımdırsa, median rənglə.
- **İxrac.** Vektor (SVG, PDF) ya da rastr (PNG, JPG, WebP), 4096 piksələ qədər.
- **Layihələr.** İşini bir `.json` fayla yadda saxlayıb sonra ona qayıda bilərsən. Amma cari sessiya da öz-özünə bərpa olunur, hətta sən sadəcə nişanı bağlamış olsan belə.
- **21 dildə interfeys.** Dil brauzerə görə müəyyən edilir, yuxarı paneldən dəyişdirilir.

## Kapotun altında

Maraqlananlar üçün: nöqtələr dəyişkən radiuslu Puasson diski seçməsi (Bridson alqoritmi) ilə yerləşdirilir - radiusu Sobel sərhəd xəritəsi təyin edir, ona görə də konturlar boyunca şəbəkə daha sıx olur. Generasiya deterministikdir: eyni seed hər zaman eyni şəbəkəni verir.
Bütün ağır həndəsi konveyer - sərhəd xəritəsi, nöqtələrin yerləşdirilməsi və triangulyasiyanın özü - Rust dilində yazılmış WASM modulunda toplanıb. Üçbucaqların rəngi isə ayrıca, bir Web Worker daxilində hesablanır.

Mənbə kodunu oxumağı planlaşdırırsansa, [arxitekturaya icmaldan](onboarding.az.md) başla.

## İnkişaf

```sh
npm install
npm run dev    # http://localhost:3000 ünvanında inkişaf serveri
npm run build  # dist/bundle.js faylını yaradır
```

## Lisenziya

[MIT](../LICENSE)
