<?php
/* =========================================================
   Sunrise Villa â€” Owner Admin Panel (PHP + MySQL)
   Login: includes/config.php mein set kiya hua admin/password
   ========================================================= */

if (session_status() === PHP_SESSION_NONE) {
    session_start();
}
require_once __DIR__ . '/includes/db.php';

$error = '';
$flash = '';

/* CSRF token */
if (empty($_SESSION['sv_token'])) {
    $_SESSION['sv_token'] = bin2hex(random_bytes(16));
}
$token = $_SESSION['sv_token'];

/* ---------------- logout ---------------- */
if (($_POST['action'] ?? '') === 'logout') {
    $_SESSION = [];
    session_destroy();
    header('Location: admin.php');
    exit;
}

/* ---------------- login ---------------- */
if (($_POST['action'] ?? '') === 'login') {
    if (sv_login_limited()) {
        $error = 'Too many attempts. Try again in a few minutes.';
    } else {
        $user = trim((string) ($_POST['username'] ?? ''));
        $pass = (string) ($_POST['password'] ?? '');
        if (hash_equals(ADMIN_USER, $user) && hash_equals(ADMIN_PASSWORD, $pass)) {
            session_regenerate_id(true);
            $_SESSION['sv_admin_ok'] = true;
            $_SESSION['sv_token'] = bin2hex(random_bytes(16));
            $token = $_SESSION['sv_token'];
            header('Location: admin.php');
            exit;
        }
        $error = 'Incorrect username or password.';
    }
}

$loggedIn = !empty($_SESSION['sv_admin_ok']);

/* filter state (GET) â€” actions ke baad wapas bhi isme redirect karte hain */
$filterStatus = in_array($_GET['status'] ?? '', ['all', 'pending', 'confirmed', 'cancelled'], true) ? $_GET['status'] : 'all';
$searchQ = trim((string) ($_GET['q'] ?? ''));

/* ---------------- booking actions (POST, PRG) ---------------- */
if ($loggedIn && ($_SERVER['REQUEST_METHOD'] ?? 'GET') === 'POST' && ($_POST['action'] ?? '') !== 'login') {
    $action = (string) ($_POST['action'] ?? '');
    $id = (int) ($_POST['id'] ?? 0);

    if (!hash_equals($token, (string) ($_POST['token'] ?? ''))) {
        http_response_code(403);
        exit('Bad request.');
    }

    if (in_array($action, ['confirm', 'cancel', 'delete'], true)) {
        try {
            $pdo = sv_db();
            if ($action === 'delete') {
                $stmt = $pdo->prepare("DELETE FROM sv_bookings WHERE id = :id");
            } else {
                $newStatus = $action === 'confirm' ? 'confirmed' : 'cancelled';
                $stmt = $pdo->prepare("UPDATE sv_bookings SET status = :status, updated_at = :updated WHERE id = :id");
                $stmt->bindValue(':status', $newStatus);
                $stmt->bindValue(':updated', date('Y-m-d H:i:s'));
            }
            $stmt->bindValue(':id', $id, PDO::PARAM_INT);
            $stmt->execute();
            header('Location: admin.php?msg=' . urlencode($action) . '&status=' . urlencode($filterStatus) . '&q=' . urlencode($searchQ));
            exit;
        } catch (PDOException $e) {
            $error = 'Could not save the change. Please try again.';
        }
    }
}

/* ---------------- helpers ---------------- */
function sv_inr($value) {
    if ($value === null || $value === '') return 'On request';
    $n = (string) number_format((float) $value, 0);
    $last3 = substr($n, -3);
    $rest = substr($n, 0, -3);
    if ($rest !== '' && $rest !== false) {
        $rest = preg_replace('/\B(?=(\d{2})+(?!\d))/', ',', $rest);
        $n = $rest . ',' . $last3;
    }
    return 'â‚¹' . $n;
}

function sv_date_out($value) {
    $ts = strtotime((string) $value);
    return $ts ? date('j M Y', $ts) : 'â€”';
}

function sv_h($value) {
    return htmlspecialchars((string) ($value ?? ''), ENT_QUOTES, 'UTF-8');
}

/* ---------------- CSV export ---------------- */
if ($loggedIn && isset($_GET['export']) && $_GET['export'] === 'csv') {
    try {
        $pdo = sv_db();
        header('Content-Type: text/csv; charset=utf-8');
        header('Content-Disposition: attachment; filename="sunrise-villa-bookings-' . date('Ymd') . '.csv"');
        $out = fopen('php://output', 'w');
        fputcsv($out, ['Reference', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Name', 'Phone', 'Email', 'Total', 'Status', 'Notes', 'Created']);
        $rows = $pdo->query("SELECT * FROM sv_bookings ORDER BY created_at DESC")->fetchAll();
        foreach ($rows as $b) {
            fputcsv($out, [
                $b['reference'], $b['room_name'], $b['checkin'], $b['checkout'], $b['nights'],
                $b['adults'] . 'A+' . $b['children'] . 'C', $b['name'], $b['phone'],
                $b['email'], $b['total'], $b['status'], $b['notes'], $b['created_at'],
            ]);
        }
        fclose($out);
        exit;
    } catch (PDOException $e) {
        /* fall through to normal page */
    }
}

/* ---------------- data for dashboard ---------------- */
$stats = ['total' => 0, 'pending' => 0, 'confirmed' => 0, 'cancelled' => 0, 'revenue' => 0];
$bookings = [];
$messages = [];
$statsError = '';

if ($loggedIn) {
    try {
        $pdo = sv_db();

        $sql = "SELECT * FROM sv_bookings";
        $conds = [];
        $params = [];
        if ($filterStatus !== 'all') {
            $conds[] = "status = :status";
            $params[':status'] = $filterStatus;
        }
        if ($searchQ !== '') {
            $conds[] = "(reference LIKE :q OR name LIKE :q OR phone LIKE :q OR email LIKE :q OR room_name LIKE :q)";
            $params[':q'] = '%' . $searchQ . '%';
        }
        if ($conds) $sql .= " WHERE " . implode(' AND ', $conds);
        $sql .= " ORDER BY created_at DESC";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $bookings = $stmt->fetchAll();

        $all = $pdo->query("SELECT status, total FROM sv_bookings")->fetchAll();
        $stats = [
            'total' => count($all),
            'pending' => count(array_filter($all, fn($b) => $b['status'] === 'pending')),
            'confirmed' => count(array_filter($all, fn($b) => $b['status'] === 'confirmed')),
            'cancelled' => count(array_filter($all, fn($b) => $b['status'] === 'cancelled')),
            'revenue' => array_sum(array_map(fn($b) => $b['status'] === 'confirmed' ? (float) $b['total'] : 0, $all)),
        ];

        $messages = $pdo->query("SELECT * FROM sv_messages ORDER BY created_at DESC LIMIT 30")->fetchAll();
    } catch (PDOException $e) {
        $statsError = 'Bookings load nahi hui â€” includes/config.php mein database details check karo.';
    }
}

$flashText = [
    'confirm' => 'Booking confirmed âœ…',
    'cancel' => 'Booking cancelled',
    'delete' => 'Booking deleted',
];
if (isset($_GET['msg'], $flashText[$_GET['msg']])) {
    $flash = $flashText[$_GET['msg']];
}
?>
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Owner Panel | Sunrise Villa Admin</title>
  <meta name="robots" content="noindex, nofollow">
  <meta name="theme-color" content="#0c1c16">
  <link rel="icon" href="assets/images/favicon.svg" type="image/svg+xml">
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Cormorant+Garamond:ital,wght@0,500;0,600;0,700;1,500;1,600&family=Manrope:wght@400;500;600;700&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="assets/css/style.css?v=5">
  <link rel="stylesheet" href="assets/css/admin.css?v=5">
</head>
<body class="admin-body">
  <a class="skip-link" href="#main">Skip to content</a>

  <header class="admin-header">
    <div class="container admin-header-inner">
      <a class="brand brand-admin" href="index.php" aria-label="Back to website">
        <img class="brand-logo" src="assets/images/logo.svg" alt="" width="52" height="52">
        <span class="brand-copy">
          <strong>Sunrise Villa</strong>
          <span>Owner panel</span>
        </span>
      </a>
      <?php if ($loggedIn): ?>
      <div class="admin-header-actions">
        <a class="admin-link" href="index.php" target="_blank" rel="noopener">View website</a>
        <form method="post" action="admin.php">
          <input type="hidden" name="action" value="logout">
          <button class="admin-button admin-button-ghost" type="submit">Log out</button>
        </form>
      </div>
      <?php endif; ?>
    </div>
  </header>

  <main id="main" class="admin-main">
    <?php if (!$loggedIn): ?>

    <section class="admin-login">
      <div class="container admin-login-inner">
        <div class="admin-card admin-login-card">
          <p class="eyebrow">Owner access</p>
          <h1>Log in to see <em>bookings.</em></h1>
          <p class="admin-lede">Enter your owner username and password to view and manage booking requests.</p>
          <?php if ($error): ?><p class="form-error" role="alert"><?php echo sv_h($error); ?></p><?php endif; ?>
          <form method="post" action="admin.php" novalidate>
            <input type="hidden" name="action" value="login">
            <div class="field">
              <label for="admin-user">Username</label>
              <input type="text" id="admin-user" name="username" autocomplete="username" placeholder="admin" required>
            </div>
            <div class="field">
              <label for="admin-pass">Password</label>
              <input type="password" id="admin-pass" name="password" autocomplete="current-password" placeholder="â€¢â€¢â€¢â€¢â€¢â€¢â€¢â€¢" required>
            </div>
            <button class="btn btn-primary btn-large" type="submit">Log in</button>
          </form>
          <p class="admin-footnote">Login <code>includes/config.php</code> file mein set hota hai. LIVE se pehle password badalna.</p>
        </div>
      </div>
    </section>

    <?php else: ?>

    <section class="admin-dashboard">
      <div class="container">
        <div class="admin-toolbar">
          <div>
            <p class="eyebrow">Bookings</p>
            <h1>All booking <em>requests.</em></h1>
          </div>
          <div class="admin-toolbar-actions">
            <a class="admin-button" href="admin.php?export=csv<?php echo $filterStatus !== 'all' || $searchQ !== '' ? '&' . http_build_query(['status' => $filterStatus, 'q' => $searchQ]) : ''; ?>">Export CSV</a>
          </div>
        </div>

        <?php if ($flash): ?><p class="admin-flash"><?php echo sv_h($flash); ?></p><?php endif; ?>
        <?php if ($statsError): ?><p class="form-error" role="alert"><?php echo sv_h($statsError); ?></p><?php endif; ?>

        <div class="admin-stats">
          <div class="admin-stat"><span>Total</span><strong><?php echo (int) $stats['total']; ?></strong></div>
          <div class="admin-stat"><span>Pending</span><strong><?php echo (int) $stats['pending']; ?></strong></div>
          <div class="admin-stat"><span>Confirmed</span><strong><?php echo (int) $stats['confirmed']; ?></strong></div>
          <div class="admin-stat"><span>Cancelled</span><strong><?php echo (int) $stats['cancelled']; ?></strong></div>
          <div class="admin-stat"><span>Confirmed value</span><strong><?php echo sv_inr($stats['revenue']); ?></strong></div>
        </div>

        <form class="admin-filters" method="get" action="admin.php">
          <div class="admin-filter">
            <label for="admin-status">Status</label>
            <select id="admin-status" name="status">
              <option value="all" <?php echo $filterStatus === 'all' ? 'selected' : ''; ?>>All</option>
              <option value="pending" <?php echo $filterStatus === 'pending' ? 'selected' : ''; ?>>Pending</option>
              <option value="confirmed" <?php echo $filterStatus === 'confirmed' ? 'selected' : ''; ?>>Confirmed</option>
              <option value="cancelled" <?php echo $filterStatus === 'cancelled' ? 'selected' : ''; ?>>Cancelled</option>
            </select>
          </div>
          <div class="admin-filter">
            <label for="admin-search">Search</label>
            <input type="search" id="admin-search" name="q" value="<?php echo sv_h($searchQ); ?>" placeholder="Name, phone or reference">
          </div>
          <button class="admin-button" type="submit">Apply</button>
        </form>

        <div class="admin-table-wrap">
          <table class="admin-table">
            <thead>
              <tr>
                <th>Ref</th>
                <th>Guest</th>
                <th>Room</th>
                <th>Dates</th>
                <th>Guests</th>
                <th>Total</th>
                <th>Status</th>
                <th>Actions</th>
              </tr>
            </thead>
            <tbody>
              <?php if (!$bookings): ?>
              <tr><td colspan="8" class="admin-empty">No bookings match this filter yet.</td></tr>
              <?php else: foreach ($bookings as $b): ?>
              <tr>
                <td><strong><?php echo sv_h($b['reference']); ?></strong></td>
                <td><?php echo sv_h($b['name']); ?><br><small><?php echo sv_h($b['phone']); ?></small></td>
                <td><?php echo sv_h($b['room_name']); ?></td>
                <td><?php echo sv_date_out($b['checkin']); ?> â†’ <?php echo sv_date_out($b['checkout']); ?><br><small><?php echo (int) $b['nights']; ?> night<?php echo (int) $b['nights'] === 1 ? '' : 's'; ?></small></td>
                <td><?php echo (int) $b['adults']; ?> adult<?php echo (int) $b['adults'] === 1 ? '' : 's'; ?><?php echo (int) $b['children'] ? ', ' . (int) $b['children'] . ' child' . ((int) $b['children'] === 1 ? '' : 'ren') : ''; ?></td>
                <td><strong><?php echo sv_inr($b['total'] !== null ? $b['total'] : null); ?></strong></td>
                <td><span class="status-pill status-<?php echo sv_h($b['status']); ?>"><?php echo sv_h($b['status']); ?></span></td>
                <td>
                  <div class="admin-actions">
                    <?php if ($b['status'] !== 'confirmed'): ?>
                    <form method="post" action="admin.php">
                      <input type="hidden" name="action" value="confirm">
                      <input type="hidden" name="id" value="<?php echo (int) $b['id']; ?>">
                      <input type="hidden" name="token" value="<?php echo sv_h($token); ?>">
                      <input type="hidden" name="status" value="<?php echo sv_h($filterStatus); ?>">
                      <input type="hidden" name="q" value="<?php echo sv_h($searchQ); ?>">
                      <button class="admin-action" type="submit">Confirm</button>
                    </form>
                    <?php endif; ?>
                    <?php if ($b['status'] !== 'cancelled'): ?>
                    <form method="post" action="admin.php" onsubmit="return confirm('Cancel this booking?');">
                      <input type="hidden" name="action" value="cancel">
                      <input type="hidden" name="id" value="<?php echo (int) $b['id']; ?>">
                      <input type="hidden" name="token" value="<?php echo sv_h($token); ?>">
                      <input type="hidden" name="status" value="<?php echo sv_h($filterStatus); ?>">
                      <input type="hidden" name="q" value="<?php echo sv_h($searchQ); ?>">
                      <button class="admin-action admin-action--danger" type="submit">Cancel</button>
                    </form>
                    <?php endif; ?>
                    <form method="post" action="admin.php" onsubmit="return confirm('Delete this booking permanently?');">
                      <input type="hidden" name="action" value="delete">
                      <input type="hidden" name="id" value="<?php echo (int) $b['id']; ?>">
                      <input type="hidden" name="token" value="<?php echo sv_h($token); ?>">
                      <input type="hidden" name="status" value="<?php echo sv_h($filterStatus); ?>">
                      <input type="hidden" name="q" value="<?php echo sv_h($searchQ); ?>">
                      <button class="admin-action admin-action--danger" type="submit">Delete</button>
                    </form>
                  </div>
                  <?php if ($b['notes']): ?>
                  <details class="admin-notes"><summary>Notes</summary><p><?php echo sv_h($b['notes']); ?></p></details>
                  <?php endif; ?>
                </td>
              </tr>
              <?php endforeach; endif; ?>
            </tbody>
          </table>
        </div>

        <div class="admin-card admin-messages-card">
          <h2>Guest <em>messages</em></h2>
          <?php if (!$messages): ?>
          <p class="admin-empty">No messages yet.</p>
          <?php else: ?>
          <ul class="admin-messages">
            <?php foreach ($messages as $m): ?>
            <li>
              <strong><?php echo sv_h($m['name']); ?></strong>
              <small><?php echo sv_date_out($m['created_at']); ?></small>
              <p><?php echo nl2br(sv_h($m['message'])); ?></p>
              <?php if ($m['phone']): ?><span>ðŸ“ž <?php echo sv_h($m['phone']); ?></span><?php endif; ?>
              <?php if ($m['email']): ?><span>âœ‰ <?php echo sv_h($m['email']); ?></span><?php endif; ?>
            </li>
            <?php endforeach; ?>
          </ul>
          <?php endif; ?>
        </div>
      </div>
    </section>

    <?php endif; ?>
  </main>
</body>
</html>
