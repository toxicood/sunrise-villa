<?php
/* Sunrise Villa â€” contact messages API
   POST api/messages.php â†’ contact form se message save */

define('SV_API', true);
require_once __DIR__ . '/../includes/db.php';

$method = $_SERVER['REQUEST_METHOD'] ?? 'GET';

if ($method !== 'POST') sv_json_out(405, ['error' => 'Method not allowed.']);

$body = sv_json_body();
if ($body === null) sv_json_out(400, ['error' => 'Invalid request body.']);

$name    = trim((string) ($body['name'] ?? ''));
$email   = trim((string) ($body['email'] ?? ''));
$phone   = trim((string) ($body['phone'] ?? ''));
$message = trim((string) ($body['message'] ?? ''));

if (sv_len($name) < 2 || sv_len($message) < 5) {
    sv_json_out(400, ['error' => 'Please enter your name and a short message.']);
}
if ($email !== '' && !filter_var($email, FILTER_VALIDATE_EMAIL)) {
    sv_json_out(400, ['error' => 'Please enter a valid email address.']);
}

$pdo = sv_db();
$stmt = $pdo->prepare(
    "INSERT INTO sv_messages (name, email, phone, message, created_at)
     VALUES (:name, :email, :phone, :message, :created)"
);
$stmt->execute([
    ':name' => $name,
    ':email' => $email !== '' ? $email : null,
    ':phone' => $phone !== '' ? $phone : null,
    ':message' => $message,
    ':created' => date('Y-m-d H:i:s'),
]);

sv_json_out(201, ['ok' => true]);
