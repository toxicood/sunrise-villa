/* Sunrise Villa — owner panel */

(() => {
  'use strict';

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  const loginSection = $('[data-admin-login]');
  const dashboardSection = $('[data-admin-dashboard]');
  const loginForm = $('#admin-login-form');
  const adminError = $('[data-admin-error]');
  const adminActions = $('[data-admin-actions]');

  const rowsBody = $('[data-admin-rows]');
  const statusFilter = $('#admin-status');
  const searchInput = $('#admin-search');
  const refreshButton = $('[data-admin-refresh]');
  const exportButton = $('[data-admin-export]');

  const statTotal = $('[data-stat-total]');
  const statPending = $('[data-stat-pending]');
  const statConfirmed = $('[data-stat-confirmed]');
  const statCancelled = $('[data-stat-cancelled]');
  const statRevenue = $('[data-stat-revenue]');

  const detailPanel = $('[data-admin-detail]');
  const detailRef = $('[data-detail-ref]');
  const detailGuest = $('[data-detail-guest]');
  const detailContact = $('[data-detail-contact]');
  const detailStay = $('[data-detail-stay]');
  const detailTotal = $('[data-detail-total]');
  const detailNotes = $('[data-detail-notes]');
  const detailClose = $('[data-detail-close]');

  let bookings = [];

  function formatINR(value) {
    if (value === null || value === undefined) return 'On request';
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function formatDate(value) {
    if (!value) return '—';
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function showLogin() {
    if (loginSection) loginSection.hidden = false;
    if (dashboardSection) dashboardSection.hidden = true;
    if (adminActions) adminActions.hidden = true;
  }

  function showDashboard() {
    if (loginSection) loginSection.hidden = true;
    if (dashboardSection) dashboardSection.hidden = false;
    if (adminActions) adminActions.hidden = false;
    loadBookings();
  }

  async function checkSession() {
    try {
      const response = await fetch('/api/admin/session');
      const data = await response.json();
      if (data.authenticated) showDashboard();
      else showLogin();
    } catch (error) {
      showLogin();
    }
  }

  if (loginForm) {
    loginForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (adminError) adminError.hidden = true;
      const username = $('#admin-user')?.value.trim() || '';
      const password = $('#admin-pass')?.value || '';

      try {
        const response = await fetch('/api/admin/login', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ username, password }),
        });
        const data = await response.json().catch(() => ({}));
        if (!response.ok) {
          if (adminError) {
            adminError.textContent = data.error || 'Login failed.';
            adminError.hidden = false;
          }
          return;
        }
        loginForm.reset();
        showDashboard();
      } catch (error) {
        if (adminError) {
          adminError.textContent = 'Could not reach the server. Please try again.';
          adminError.hidden = false;
        }
      }
    });
  }

  async function loadBookings() {
    if (!rowsBody) return;
    rowsBody.innerHTML = '<tr><td colspan="8" class="admin-empty">Loading bookings…</td></tr>';
    try {
      const response = await fetch('/api/bookings');
      if (response.status === 401) {
        showLogin();
        return;
      }
      const data = await response.json();
      bookings = data.bookings || [];
      renderStats(data.stats || {});
      renderRows();
    } catch (error) {
      rowsBody.innerHTML = '<tr><td colspan="8" class="admin-empty">Could not load bookings.</td></tr>';
    }
  }

  function renderStats(stats) {
    if (statTotal) statTotal.textContent = String(stats.total ?? bookings.length);
    if (statPending) statPending.textContent = String(stats.pending ?? 0);
    if (statConfirmed) statConfirmed.textContent = String(stats.confirmed ?? 0);
    if (statCancelled) statCancelled.textContent = String(stats.cancelled ?? 0);
    if (statRevenue) statRevenue.textContent = formatINR(stats.revenue ?? 0);
  }

  function visibleBookings() {
    const status = statusFilter?.value || 'all';
    const query = (searchInput?.value || '').trim().toLowerCase();
    return bookings.filter((booking) => {
      const statusOk = status === 'all' || booking.status === status;
      const haystack = [
        booking.reference,
        booking.name,
        booking.phone,
        booking.email,
        booking.roomName,
      ].filter(Boolean).join(' ').toLowerCase();
      const queryOk = !query || haystack.includes(query);
      return statusOk && queryOk;
    });
  }

  function renderRows() {
    if (!rowsBody) return;
    const list = visibleBookings();
    if (!list.length) {
      rowsBody.innerHTML = '<tr><td colspan="8" class="admin-empty">No bookings match this filter yet.</td></tr>';
      return;
    }

    rowsBody.innerHTML = '';
    list.forEach((booking) => {
      const row = document.createElement('tr');
      const cells = [
        `<strong>${escapeHTML(booking.reference)}</strong>`,
        `${escapeHTML(booking.name)}<br><small>${escapeHTML(booking.phone)}</small>`,
        escapeHTML(booking.roomName),
        `${formatDate(booking.checkin)} → ${formatDate(booking.checkout)}<br><small>${booking.nights} night${booking.nights === 1 ? '' : 's'}</small>`,
        `${booking.adults} adult${booking.adults === 1 ? '' : 's'}${booking.children ? `, ${booking.children} child${booking.children === 1 ? '' : 'ren'}` : ''}`,
        `<strong>${formatINR(booking.total)}</strong>`,
        `<span class="status-pill status-${booking.status}">${booking.status}</span>`,
      ];

      cells.forEach((cell) => {
        const td = document.createElement('td');
        td.innerHTML = cell;
        row.append(td);
      });

      const actionsTd = document.createElement('td');
      const actions = document.createElement('div');
      actions.className = 'admin-actions';

      if (booking.status !== 'confirmed') {
        actions.append(makeActionButton('Confirm', () => updateStatus(booking.id, 'confirmed')));
      }
      if (booking.status !== 'cancelled') {
        actions.append(makeActionButton('Cancel', () => updateStatus(booking.id, 'cancelled'), true));
      }
      actions.append(makeActionButton('View', () => showDetail(booking)));
      actions.append(makeActionButton('Delete', () => deleteBooking(booking.id), true));

      actionsTd.append(actions);
      row.append(actionsTd);
      rowsBody.append(row);
    });
  }

  function makeActionButton(label, onClick, isDanger = false) {
    const button = document.createElement('button');
    button.type = 'button';
    button.className = `admin-action${isDanger ? ' admin-action--danger' : ''}`;
    button.textContent = label;
    button.addEventListener('click', onClick);
    return button;
  }

  function escapeHTML(value) {
    return String(value ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&#39;');
  }

  async function updateStatus(id, status) {
    try {
      const response = await fetch(`/api/bookings/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ status }),
      });
      if (!response.ok) return;
      await loadBookings();
    } catch (error) {
      // ignore
    }
  }

  async function deleteBooking(id) {
    if (!window.confirm('Delete this booking permanently?')) return;
    try {
      const response = await fetch(`/api/bookings/${id}`, { method: 'DELETE' });
      if (!response.ok) return;
      await loadBookings();
    } catch (error) {
      // ignore
    }
  }

  function showDetail(booking) {
    if (!detailPanel) return;
    if (detailRef) detailRef.textContent = booking.reference;
    if (detailGuest) detailGuest.textContent = booking.name;
    if (detailContact) {
      detailContact.innerHTML = '';
      const phoneLink = document.createElement('a');
      phoneLink.href = `tel:${booking.phone}`;
      phoneLink.textContent = booking.phone;
      detailContact.append(phoneLink);
      if (booking.email) {
        const emailLine = document.createElement('span');
        emailLine.textContent = ` · ${booking.email}`;
        detailContact.append(emailLine);
      }
    }
    if (detailStay) {
      detailStay.textContent = `${booking.roomName} · ${formatDate(booking.checkin)} → ${formatDate(booking.checkout)} · ${booking.nights} night${booking.nights === 1 ? '' : 's'}`;
    }
    if (detailTotal) detailTotal.textContent = `${formatINR(booking.total)} · ${booking.status}`;
    if (detailNotes) detailNotes.textContent = booking.notes || 'No special notes.';
    detailPanel.hidden = false;
    detailPanel.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  if (detailClose) {
    detailClose.addEventListener('click', () => {
      if (detailPanel) detailPanel.hidden = true;
    });
  }

  if (statusFilter) statusFilter.addEventListener('change', renderRows);
  if (searchInput) searchInput.addEventListener('input', renderRows);
  if (refreshButton) refreshButton.addEventListener('click', loadBookings);

  if (exportButton) {
    exportButton.addEventListener('click', () => {
      if (!bookings.length) return;
      const headers = ['Reference', 'Room', 'Check-in', 'Check-out', 'Nights', 'Guests', 'Name', 'Phone', 'Email', 'Total', 'Status', 'Notes', 'Created'];
      const rows = bookings.map((booking) => [
        booking.reference,
        booking.roomName,
        booking.checkin,
        booking.checkout,
        booking.nights,
        `${booking.adults} adults, ${booking.children} children`,
        booking.name,
        booking.phone,
        booking.email || '',
        booking.total ?? '',
        booking.status,
        booking.notes || '',
        booking.createdAt,
      ]);
      const csv = [headers, ...rows]
        .map((row) => row.map((cell) => `"${String(cell).replace(/"/g, '""')}"`).join(','))
        .join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `sunrise-villa-bookings-${new Date().toISOString().slice(0, 10)}.csv`;
      document.body.append(link);
      link.click();
      link.remove();
      URL.revokeObjectURL(url);
    });
  }

  $$('[data-admin-logout]').forEach((button) => {
    button.addEventListener('click', async () => {
      try {
        await fetch('/api/admin/logout', { method: 'POST' });
      } catch (error) {
        // ignore
      }
      showLogin();
    });
  });

  checkSession();
})();
