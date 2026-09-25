# Backend Almas Laundry (Express TypeScript + MySQL)

Backend REST API untuk Laundry App dengan arsitektur modular **Repository - Service - Controller** menggunakan **Express.js, TypeScript, dan MySQL**.

---

## 📁 Struktur Folder

```text
be_laundry_app/
├── src/
│   ├── config/
│   │   ├── database.ts             # MySQL2 Connection Pool
│   │   └── env.ts                  # Loader & Decryptor konfigurasi .env
│   ├── modules/
│   │   ├── auth/                   # Login, Register, Me (JWT Token)
│   │   ├── services/               # Katalog Layanan Laundry
│   │   ├── orders/                 # Pemesanan & Live Tracking Timeline
│   │   ├── promos/                 # Voucher & Diskon
│   │   └── user/                   # Profil & Manajemen Alamat
│   ├── middleware/
│   │   ├── auth.middleware.ts       # Validasi Bearer Token JWT
│   │   └── error.middleware.ts      # Global Exception Handler
│   ├── utils/
│   │   ├── crypto.util.ts           # Dekripsi Kredensial DB
│   │   └── response.util.ts         # Standarisasi Response JSON
│   ├── routes.ts                    # Routing Utama (/api/v1)
│   └── app.ts                       # Express Server Entrypoint
├── .env                             # Environment Variables
├── package.json
└── tsconfig.json
```

---

## 🚀 Cara Menjalankan

```bash
cd /home/programmer/Documents/Almas/be_laundry_app

# Mode Development (Auto-reload):
npm run dev

# Mode Production Build:
npm run build
npm start
```

---

## 📡 Daftar Endpoint API (`/api/v1`)

| Method | Endpoint | Deskripsi | Auth |
| :--- | :--- | :--- | :--- |
| **GET** | `/api/v1/health` | Healthcheck server status | Publik |
| **POST** | `/api/v1/auth/register` | Pendaftaran akun baru | Publik |
| **POST** | `/api/v1/auth/login` | Login user & generate JWT | Publik |
| **GET** | `/api/v1/auth/me` | Dapatkan data user saat ini | Bearer Token |
| **GET** | `/api/v1/services` | Ambil katalog layanan (query `?category=&q=`) | Publik |
| **GET** | `/api/v1/services/:id` | Detail layanan | Publik |
| **POST** | `/api/v1/services` | Tambah layanan baru | Admin |
| **GET** | `/api/v1/orders` | Daftar pesanan (`?type=active` atau `?type=history`) | Publik |
| **GET** | `/api/v1/orders/:id` | Detail pesanan & timeline status | Publik |
| **POST** | `/api/v1/orders/create` | Buat & jadwalkan pesanan baru | Publik / Token |
| **PATCH** | `/api/v1/orders/:id/status` | Update status tahapan pengerjaan | Admin / Kurir |
| **GET** | `/api/v1/promos` | Daftar promo & voucher aktif | Publik |
| **GET** | `/api/v1/user/profile` | Profil akun pengguna | Publik / Token |
| **GET** | `/api/v1/user/addresses` | Daftar alamat penjemputan | Publik / Token |
| **POST** | `/api/v1/user/addresses` | Tambah alamat penjemputan baru | Publik / Token |

---

## 🗄️ Struktur Tabel MySQL Rekomendasi (DBeaver)

Jika Anda ingin membuat tabelnya di MySQL via DBeaver, berikut referensi kolomnya:

1. **`users`**: `id` (VARCHAR), `name` (VARCHAR), `email` (VARCHAR), `phone` (VARCHAR), `password` (VARCHAR), `member_tier` (VARCHAR), `laundry_pay_balance` (INT), `reward_points` (INT)
2. **`services`**: `id` (VARCHAR), `name` (VARCHAR), `description` (TEXT), `price` (INT), `unit` (VARCHAR), `duration` (VARCHAR), `icon_code` (VARCHAR), `category` (VARCHAR), `is_popular` (BOOLEAN), `badge_color_hex` (INT)
3. **`orders`**: `id` (VARCHAR), `invoice_no` (VARCHAR), `user_id` (VARCHAR), `service_name` (VARCHAR), `service_type` (VARCHAR), `order_date` (DATETIME), `estimated_completion_date` (DATETIME), `status` (VARCHAR), `quantity` (DOUBLE), `unit` (VARCHAR), `price_per_unit` (INT), `delivery_fee` (INT), `discount` (INT), `pickup_address` (TEXT), `delivery_address` (TEXT), `courier_name` (VARCHAR), `courier_phone` (VARCHAR), `notes` (TEXT)
4. **`order_timelines`**: `id` (INT AUTO_INCREMENT), `order_id` (VARCHAR), `title` (VARCHAR), `description` (TEXT), `time` (VARCHAR), `is_completed` (BOOLEAN), `is_current` (BOOLEAN), `step_order` (INT)
5. **`promos`**: `id` (VARCHAR), `title` (VARCHAR), `subtitle` (VARCHAR), `code` (VARCHAR), `discount_amount` (INT), `min_order_amount` (INT), `icon_code` (VARCHAR), `color_hex` (INT), `is_active` (BOOLEAN)
6. **`addresses`**: `id` (VARCHAR), `user_id` (VARCHAR), `label` (VARCHAR), `full_address` (TEXT), `note` (VARCHAR), `is_default` (BOOLEAN)
# laundry_be
