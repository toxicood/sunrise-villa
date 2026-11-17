<?php
/* =========================================================
   Sunrise Villa — Configuration
   Hostinger pe upload karne se PEHLE ye file edit karo:
   hPanel → Databases → apna MySQL database banao → details yahan bharo
   ========================================================= */

/* ---------- DATABASE (Hostinger hPanel se milta hai) ---------- */
define('DB_HOST', 'localhost');
define('DB_PORT', '3306');
define('DB_NAME', 'yahan_database_ka_naam');   // hPanel se, e.g. u123456789_sunrise
define('DB_USER', 'yahan_database_ka_user');   // hPanel se, e.g. u123456789_sunrise_user
define('DB_PASS', 'yahan_database_ka_password');

/* ---------- ADMIN PANEL LOGIN ---------- */
define('ADMIN_USER', 'admin');
define('ADMIN_PASSWORD', 'sunrise@2026');   /* LIVE se pehle ye zaroor badlo! */

/* ---------- ROOMS & PRICES ---------- */
$SV_ROOMS = [
  'premier' => ['name' => 'Premier Double', 'price' => 2200, 'capacity' => 2, 'label' => '₹2,200 / night'],
  'deluxe'  => ['name' => 'Deluxe Double',  'price' => 1800, 'capacity' => 2, 'label' => '₹1,800 / night'],
  'family'  => ['name' => 'Family Room',    'price' => 2600, 'capacity' => 4, 'label' => '₹2,600 / night'],
  'cozy'    => ['name' => 'Cozy Double',    'price' => 1499, 'capacity' => 2, 'label' => '₹1,499 / night'],
  'any'     => ['name' => 'Not sure — help me choose', 'price' => 0, 'capacity' => 4, 'label' => 'Best rate'],
];

/* Timezone (India) */
date_default_timezone_set('Asia/Kolkata');
