<?php
/* Sunrise Villa â€” booking API
   POST api/bookings.php  â†’ nayi booking (guest)
   GET  api/bookings.php  â†’ admin: saari bookings + stats */

define('SV_API', true);
require_once __DIR__ . '/../includes/db.php';

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

/* ---------------- guest: new booking ---------------- */
if ($method === 'POST') {
    global $SV_ROOMS;
    $body = sv_json_body();
    if ($body === null) sv_json_out(400, ['error' => 'Invalid request body.']);

    $roomId   = (string) ($body['roomId'] ?? '');
    $checkin  = trim((string) ($body['checkin'] ?? ''));
    $checkout = trim((string) ($body['checkout'] ?? ''));
    $adults   = (int) ($body['adults'] ?? 0);
    $children = (int) ($body['children'] ?? 0);
    $name     = trim((string) ($body['name'] ?? ''));
    $phone    = trim((string) ($body['phone'] ?? ''));
    $email    = trim((string) ($body['email'] ?? ''));
    $notes    = trim((string) ($body['notes'] ?? ''));

    if (!isset($SV_ROOMS[$roomId])) sv_json_out(400, ['error' => 'Please choose a valid room.']);
    if (!sv_valid_date($checkin) || !sv_valid_date($checkout)) {
        sv_json_out(400, ['error' => 'Please provide valid check-in and check-out dates.']);
    }
    $nights = sv_nights($checkin, $checkout);
    if ($nights < 1 || $nights > 30) {
        sv_json_out(400, ['error' => 'Your stay must be between 1 and 30 nights.']);
    }
    if ($adults < 1 || $adults > 10) sv_json_out(400, ['error' => 'Please enter a valid number of adults.']);
    if ($children < 0 || $children > 6) sv_json_out(400, ['error' => 'Please enter a valid number of children.']);
    if (sv_len($name) < 2) sv_json_out(400, ['error' => 'Please enter your full name.']);
    $phoneDigits = preg_replace('/\D/', '', $phone);
    if (strlen($phoneDigits) < 10 || strlen($phoneDigits) > 13) {
        sv_json_out(400, ['error' => 'Please enter a valid mobile number.']);
    }
    if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
        sv_json_out(400, ['error' => 'Please enter a valid email address or leave it blank.']);
    }

    $pdo = sv_db();

    /* overlap check â€” same room already CONFIRMED for these dates? */
    if ($roomId !== 'any') {
        $stmt = $pdo->prepare(
            "SELECT COUNT(*) FROM sv_bookings
             WHERE status = 'confirmed' AND room_id = :room
               AND :checkin < checkout AND :checkout > checkin"
        );
        $stmt->execute([':room' => $roomId, ':checkin' => $checkin, ':checkout' => $checkout]);
        if ((int) $stmt->fetchColumn() > 0) {
            sv_json_out(409, ['error' => 'That room is already confirmed for these dates. Please choose different dates or another room, or call us.']);
        }
    }

    $room = $SV_ROOMS[$roomId];
    $total = $room['price'] ? $room['price'] * $nights : null;
    $now = date('Y-m-d H:i:s');
    $reference = sv_reference();

    $stmt = $pdo->prepare(
        "INSERT INTO sv_bookings
         (reference, room_id, room_name, price_per_night, checkin, checkout, nights,
          adults, children, total, name, phone, email, notes, status, created_at, updated_at)
         VALUES
         (:reference, :room_id, :room_name, :price_per_night, :checkin, :checkout, :nights,
          :adults, :children, :total, :name, :phone, :email, :notes, 'pending', :created, :updated)"
    );
    $stmt->execute([
        ':reference' => $reference,
        ':room_id' => $roomId,
        ':room_name' => $room['name'],
        ':price_per_night' => $room['price'] ?: null,
        ':checkin' => $checkin,
        ':checkout' => $checkout,
        ':nights' => $nights,
        ':adults' => $adults,
        ':children' => $children,
        ':total' => $total,
        ':name' => $name,
        ':phone' => $phone,
        ':email' => $email !== '' ? $email : null,
        ':notes' => $notes !== '' ? $notes : null,
        ':created' => $now,
        ':updated' => $now,
    ]);

    sv_json_out(201, ['booking' => [
        'reference' => $reference,
        'roomId' => $roomId,
        'roomName' => $room['name'],
        'pricePerNight' => $room['price'],
        'checkin' => $checkin,
        'checkout' => $checkout,
        'nights' => $nights,
        'adults' => $adults,
        'children' => $children,
        'total' => $total,
        'name' => $name,
        'phone' => $phone,
        'email' => $email !== '' ? $email : null,
        'notes' => $notes !== '' ? $notes : null,
        'status' => 'pending',
        'createdAt' => $now,
    ]]);
}

/* ---------------- admin: list + stats ---------------- */
if ($method === 'GET') {
    if (!sv_is_admin()) sv_json_out(401, ['error' => 'Not authorised.']);
    $pdo = sv_db();
    $rows = $pdo->query("SELECT * FROM sv_bookings ORDER BY created_at DESC")->fetchAll();

    $bookings = array_map('sv_booking_out', $rows);
    $stats = [
        'total' => count($rows),
        'pending' => count(array_filter($rows, fn($b) => $b['status'] === 'pending')),
        'confirmed' => count(array_filter($rows, fn($b) => $b['status'] === 'confirmed')),
        'cancelled' => count(array_filter($rows, fn($b) => $b['status'] === 'cancelled')),
        'revenue' => array_sum(array_map(fn($b) => $b['status'] === 'confirmed' ? (int) ($b['total'] ?? 0) : 0, $rows)),
    ];
    sv_json_out(200, ['bookings' => $bookings, 'stats' => $stats]);
}

sv_json_out(405, ['error' => 'Method not allowed.']);

/* DB row â†’ JS-friendly camelCase object */
function sv_booking_out($b) {
    return [
        'id' => (int) $b['id'],
        'reference' => $b['reference'],
        'roomId' => $b['room_id'],
        'roomName' => $b['room_name'],
        'pricePerNight' => $b['price_per_night'] !== null ? (int) $b['price_per_night'] : null,
        'checkin' => $b['checkin'],
        'checkout' => $b['checkout'],
        'nights' => (int) $b['nights'],
        'adults' => (int) $b['adults'],
        'children' => (int) $b['children'],
        'total' => $b['total'] !== null ? (int) $b['total'] : null,
        'name' => $b['name'],
        'phone' => $b['phone'],
        'email' => $b['email'],
        'notes' => $b['notes'],
        'status' => $b['status'],
        'createdAt' => $b['created_at'],
        'updatedAt' => $b['updated_at'],
    ];
}
