# Bonj Cake Story

Gaziantep merkezli Bonj Cake Story için mobil öncelikli marka ve menü sitesi.

## Yerelde çalıştırma

1. `.env.example` dosyasını `.env.local` olarak kopyalayın.
2. `npm install`
3. `npm run dev`

Veritabanı olmadan da arayüz, kürasyonlu örnek menüyle çalışır. PostgreSQL
bağlandığında `/api/menu` doğrudan veritabanındaki aktif ürünleri döndürür.

## Veritabanı

```bash
npm run db:generate
npm run db:migrate
npm run db:seed
```

Şema; kategori, menü ürünü ve şube bilgilerini ayrı tablolarda tutar. Fiyatlar
kuruş cinsinden ve isteğe bağlıdır; içerik yapısı yeni ürünler ve şubeler için
genişletilebilir.

## Railway

1. Railway projesine bu repoyu bağlayın.
2. Bir PostgreSQL servisi ekleyin; `DATABASE_URL` otomatik bağlanır.
3. `NEXT_PUBLIC_SITE_URL` değerini üretim alan adınıza ayarlayın.
4. İlk dağıtımdan sonra migration ve seed komutlarını Railway shell üzerinden
   bir kez çalıştırın.

`railway.json` Dockerfile dağıtımını, Dockerfile ise Next.js standalone üretim
sunucusunu kullanır. Sağlık kontrolü `/api/health` yolundadır.
