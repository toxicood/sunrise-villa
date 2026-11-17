<?php
/* Sunrise Villa — shared header (nav) */
$active = $active ?? '';
function sv_nav_link($href, $label, $active) {
    $isActive = $active === $href ? ' class="is-active" aria-current="page"' : '';
    return '<a href="' . $href . '"' . $isActive . '>' . $label . '</a>';
}
?>
  <header class="site-header" data-header>
    <div class="container header-inner">
      <a class="brand" href="index.php" aria-label="Sunrise Villa home">
        <img class="brand-logo" src="assets/images/logo.svg" alt="" width="64" height="64">
        <span class="brand-copy">
          <strong>Sunrise Villa</strong>
          <span>Lebong · Darjeeling</span>
        </span>
      </a>
      <nav class="main-nav" id="main-nav" aria-label="Main navigation">
        <?php echo sv_nav_link('index.php', 'Home', $active); ?>
        <?php echo sv_nav_link('rooms.php', 'Rooms', $active); ?>
        <?php echo sv_nav_link('gallery.php', 'Gallery', $active); ?>
        <?php echo sv_nav_link('about.php', 'About', $active); ?>
        <?php echo sv_nav_link('contact.php', 'Contact', $active); ?>
        <?php echo sv_nav_link('book.php', 'Book', $active); ?>
      </nav>
      <div class="header-actions">
        <a class="header-phone" href="tel:+919832233086">
          <svg viewBox="0 0 24 24" aria-hidden="true"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07 19.5 19.5 0 0 1-6-6A19.79 19.79 0 0 1 2.12 4.18 2 2 0 0 1 4.11 2h3a2 2 0 0 1 2 1.72c.13.96.36 1.9.7 2.81a2 2 0 0 1-.45 2.11L8.09 9.91a16 16 0 0 0 6 6l1.27-1.27a2 2 0 0 1 2.11-.45c.91.34 1.85.57 2.81.7A2 2 0 0 1 22 16.92z"/></svg>
          <span>98322 33086</span>
        </a>
        <a class="btn btn-small btn-primary header-book" href="book.php">Book your stay</a>
        <button class="nav-toggle" type="button" aria-expanded="false" aria-controls="main-nav" aria-label="Open menu" data-nav-toggle>
          <span></span><span></span><span></span>
        </button>
      </div>
    </div>
  </header>
