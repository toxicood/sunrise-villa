<?php
/* Sunrise Villa — MySQL connection + table setup
   Tables khud ban jaati hain pehli baar chalane pe (koi import nahi karna padta). */

if (!defined('SV_API')) {
    define('SV_API', false);
}

require_once __DIR__ . '/config.php';

function sv_db() {
    static $pdo = null;
    if ($pdo !== null) return $pdo;

    try {
        $pdo = new PDO(
            'mysql:host=' . DB_HOST . ';port=' . DB_PORT . ';dbname=' . DB_NAME . ';charset=utf8mb4',
            DB_USER,
            DB_PASS,
            [
                PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
                PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
                PDO::ATTR_EMULATE_PREPARES => false,
            ]
        );
    } catch (PDOException $e) {
        sv_db_fail($e);
    }

    sv_create_tables($pdo);
    return $pdo;
}

/* Friendly error — user ko pata chale ki config.php edit karna hai */
function sv_db_fail($e) {
    $hint = "Website setup abhi complete nahi hui.\n"
          . "Owner sahab: hPanel → Databases → MySQL database banao, aur\n"
          . "includes/config.php mein DB_NAME / DB_USER / DB_PASS bharo.";
    if (SV_API) {
        header('Content-Type: application/json; charset=utf-8');
        http_response_code(500);
        echo json_encode(['error' => $hint]);
    } else {
        http_response_code(500);
        echo '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8">'
           . '<meta name="viewport" content="width=device-width, initial-scale=1.0">'
           . '<title>Setup needed — Sunrise Villa</title>'
           . '<link rel="stylesheet" href="assets/css/style.css?v=5"></head>'
           . '<body><main style="min-height:100vh;display:flex;align-items:center;justify-content:center;padding:24px">'
           . '<div style="max-width:560px;text-align:center;white-space:pre-line;font-family:Georgia,serif">'
           . '<h1>Sunrise Villa</h1><p>' . htmlspecialchars($hint) . '</p></div>'
           . '</main></body></html>';
    }
    exit;
}

function sv_create_tables(PDO $pdo) {
    $pdo->exec("CREATE TABLE IF NOT EXISTS sv_bookings (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        reference VARCHAR(20) NOT NULL UNIQUE,
        room_id VARCHAR(20) NOT NULL,
        room_name VARCHAR(60) NOT NULL,
        price_per_night INT NULL,
        checkin DATE NOT NULL,
        checkout DATE NOT NULL,
        nights INT NOT NULL,
        adults INT NOT NULL,
        children INT NOT NULL DEFAULT 0,
        total INT NULL,
        name VARCHAR(120) NOT NULL,
        phone VARCHAR(20) NOT NULL,
        email VARCHAR(160) NULL,
        notes TEXT NULL,
        status VARCHAR(12) NOT NULL DEFAULT 'pending',
        created_at DATETIME NOT NULL,
        updated_at DATETIME NOT NULL,
        INDEX idx_status (status),
        INDEX idx_dates (room_id, checkin, checkout)
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");

    $pdo->exec("CREATE TABLE IF NOT EXISTS sv_messages (
        id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
        name VARCHAR(120) NOT NULL,
        email VARCHAR(160) NULL,
        phone VARCHAR(20) NULL,
        message TEXT NOT NULL,
        created_at DATETIME NOT NULL
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4");
}

/* ------------ shared helpers ------------ */

function sv_json_out($status, $payload) {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    echo json_encode($payload);
    exit;
}

function sv_json_body() {
    $raw = file_get_contents('php://input');
    if (!$raw) return [];
    $data = json_decode($raw, true);
    return is_array($data) ? $data : null;
}

function sv_valid_date($value) {
    if (!is_string($value) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $value)) return false;
    [$y, $m, $d] = array_map('intval', explode('-', $value));
    return checkdate($m, $d, $y);
}

function sv_nights($a, $b) {
    $start = new DateTime($a);
    $end = new DateTime($b);
    return (int) $start->diff($end)->days;
}

function sv_reference() {
    $stamp = date('ymd');
    return 'SV-' . $stamp . '-' . random_int(1000, 9999);
}

function sv_is_admin() {
    return !empty($_SESSION['sv_admin_ok']);
}

/* text length — mbstring ho ya na ho */
function sv_len($s) {
    return function_exists('mb_strlen') ? mb_strlen($s) : strlen($s);
}

/* Simple login rate-limit (file based, 8 attempts / 10 minutes) */
function sv_login_limited() {
    $dir = __DIR__ . '/../sv-data';
    if (!is_dir($dir)) { @mkdir($dir, 0755, true); }
    $file = $dir . '/login_guard.json';
    $ip = $_SERVER['REMOTE_ADDR'] ?? 'unknown';
    $state = ['attempts' => 0, 'first' => time()];
    if (is_file($file)) {
        $decoded = json_decode((string) file_get_contents($file), true);
        if (is_array($decoded)) $state = $decoded;
    }
    if (time() - (int) $state['first'] > 600) {
        $state = ['attempts' => 0, 'first' => time()];
    }
    $state['attempts'] = (int) $state['attempts'] + 1;
    @file_put_contents($file, json_encode($state));
    return $state['attempts'] > 8;
}
