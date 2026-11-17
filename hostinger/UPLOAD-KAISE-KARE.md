# Sunrise Villa — Hostinger pe kaise chalayein 🏔️

## Step 1: Database banao (hPanel mein)

1. **hPanel** kholo → **Databases** → **MySQL Databases**
2. Naya database banao:
   - Database name: `sunrise` (ya jo bhi)
   - Username: `sunrise_user`
   - Password: strong password (yaad rakhna!)
3. Hostinger aapko 3 cheezein dega — aage kaam aayengi:
   - **Database name** (jaise `u123456789_sunrise`)
   - **Database user** (jaise `u123456789_sunrise_user`)
   - **Password**

## Step 2: config.php edit karo

`includes/config.php` file kholo (Notepad mein) aur ye 3 lines apni values se bharo:

```php
define('DB_NAME', 'u123456789_sunrise');
define('DB_USER', 'u123456789_sunrise_user');
define('DB_PASS', 'aapka_database_password');
```

Admin panel ka password bhi abhi badal do:

```php
define('ADMIN_PASSWORD', 'aapka_naya_strong_password');
```

Save kar do.

## Step 3: Files upload karo

**SABSE AASAN TARIKA:**

1. `hostinger` folder ke **andar ki sab files** (index.php, rooms.php, admin.php, includes, api, assets...) select karo
2. **ZIP** banao (sab select → right-click → Send to → Compressed folder)
3. hPanel → **Files** → **File Manager** → `public_html` kholo
4. ZIP upload karo → **Extract** karo
5. Bas! `sv-data` folder khud ban jayega

> ⚠️ Note: `public_html` mein jo pehle se files hain (jaise default.php), unhe delete kar sakte ho.

## Step 4: Website kholo 🎉

- Website: `https://aapkadomain.com`
- Admin panel: `https://aapkadomain.com/admin.php`
- Login: `admin` + config.php mein set kiya password

**Database tables KHUD ban jaati hain** — pehli website-visit pe. Kuch import nahi karna!

## Booking kaise aayegi? 📥

1. Guest website pe form bharega → booking **database mein save** hogi
2. Aap `admin.php` pe login karke dekh sakte ho
3. **Confirm** ya **Cancel** button se status badal sakte ho
4. **Export CSV** se saari bookings Excel mein le sakte ho
5. Contact page ke messages bhi admin mein dikhenge

## Baad mein custom domain 🌐

Domain (`sunrisevilladarjeeling.in`) Hostinger pe ho toh apne aap chal jayega.

## Zaroori safety 📌

- `includes/config.php` mein **password kabhi na rakho** jo kahin aur use hota hai
- Admin password strong rakhna: kam se kam 12 letters/numbers
- GitHub pe ye PHP version **upload mat karna** (usme database password hota hai)

## Common problems 🔧

| Problem | Solution |
|---|---|
| "Setup needed" page aata hai | `config.php` mein DB details sahi bharo |
| Admin login nahi hota | `config.php` mein ADMIN_PASSWORD check karo |
| Booking save nahi hoti | Database details sahi hain? File Manager mein `sv-data` folder dekho |
| Page blank/500 error | File Manager mein `error_log` file dekho |
