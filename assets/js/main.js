/* =========================================================
   Sunrise Villa — site interactions
   Booking requests are sent to the Node server and saved in data/bookings.json.
   ========================================================= */

document.documentElement.classList.add('js');

(() => {
  'use strict';

  const WHATSAPP_NUMBER = '919832233086';
  const ROOM_PRICES = {
    premier: 2200,
    deluxe: 1800,
    family: 2600,
    cozy: 1499,
  };
  const ROOM_NAMES = {
    premier: 'Premier Double',
    deluxe: 'Deluxe Double',
    family: 'Family Room',
    cozy: 'Cozy Double',
    any: 'Not sure — help me choose',
  };

  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => Array.from(root.querySelectorAll(selector));

  /* ---------------- Helpers ---------------- */

  const pad = (value) => String(value).padStart(2, '0');

  function toISODate(date) {
    return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
  }

  function fromISODate(value) {
    if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
    const [year, month, day] = value.split('-').map(Number);
    const date = new Date(year, month - 1, day);
    return Number.isNaN(date.getTime()) ? null : date;
  }

  function addDays(date, amount) {
    const next = new Date(date.getFullYear(), date.getMonth(), date.getDate());
    next.setDate(next.getDate() + amount);
    return next;
  }

  function formatDate(value) {
    const date = fromISODate(value);
    if (!date) return '—';
    return date.toLocaleDateString('en-IN', {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    });
  }

  function formatINR(value) {
    return new Intl.NumberFormat('en-IN', {
      style: 'currency',
      currency: 'INR',
      maximumFractionDigits: 0,
    }).format(value);
  }

  function nightsBetween(checkin, checkout) {
    const start = fromISODate(checkin);
    const end = fromISODate(checkout);
    if (!start || !end) return 0;
    const diff = Math.round((end - start) / 86400000);
    return diff > 0 ? diff : 0;
  }

  function setDateLimits(checkin, checkout) {
    if (!checkin || !checkout) return;
    const today = new Date();
    const todayISO = toISODate(today);
    checkin.min = todayISO;

    if (checkin.value) {
      const start = fromISODate(checkin.value);
      const minimumOut = start ? addDays(start, 1) : addDays(today, 1);
      checkout.min = toISODate(minimumOut);
    }

    if (checkout.value && checkout.value <= checkin.value) {
      const start = fromISODate(checkin.value) || today;
      checkout.value = toISODate(addDays(start, 1));
    }
  }

  function setDefaultDates() {
    const today = new Date();
    const checkinDefault = toISODate(addDays(today, 1));
    const checkoutDefault = toISODate(addDays(today, 3));

    [['avail-checkin', 'avail-checkout'], ['checkin', 'checkout']].forEach(([inId, outId]) => {
      const checkin = document.getElementById(inId);
      const checkout = document.getElementById(outId);
      if (!checkin || !checkout) return;

      if (!checkin.value) checkin.value = checkinDefault;
      if (!checkout.value) checkout.value = checkoutDefault;
      setDateLimits(checkin, checkout);
    });
  }

  /* ---------------- Header / mobile navigation ---------------- */

  const navToggle = $('[data-nav-toggle]');
  const mainNav = $('#main-nav');
  const header = $('[data-header]');

  function closeNav() {
    if (!navToggle || !mainNav) return;
    navToggle.setAttribute('aria-expanded', 'false');
    navToggle.setAttribute('aria-label', 'Open menu');
    mainNav.classList.remove('is-open');
    document.body.classList.remove('nav-open');
  }

  if (navToggle && mainNav) {
    navToggle.addEventListener('click', () => {
      const isOpen = navToggle.getAttribute('aria-expanded') === 'true';
      if (isOpen) {
        closeNav();
      } else {
        navToggle.setAttribute('aria-expanded', 'true');
        navToggle.setAttribute('aria-label', 'Close menu');
        mainNav.classList.add('is-open');
        document.body.classList.add('nav-open');
      }
    });

    $$('a', mainNav).forEach((link) => link.addEventListener('click', closeNav));

    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') closeNav();
    });

    document.addEventListener('click', (event) => {
      if (document.body.classList.contains('nav-open') &&
          !mainNav.contains(event.target) &&
          !navToggle.contains(event.target)) {
        closeNav();
      }
    });
  }

  if (header) {
    const updateHeader = () => {
      header.classList.toggle('is-scrolled', window.scrollY > 20);
    };
    updateHeader();
    window.addEventListener('scroll', updateHeader, { passive: true });
  }

  /* ---------------- Dates & availability bar ---------------- */

  const availForm = $('#availability-form');
  const availCheckin = $('#avail-checkin');
  const availCheckout = $('#avail-checkout');
  const availGuests = $('#avail-guests');

  const bookingForm = $('#booking-form');
  const bookingCheckin = $('#checkin');
  const bookingCheckout = $('#checkout');
  const bookingGuests = $('#guests');
  const bookingChildren = $('#children');
  const roomSelect = $('#room');
  const bookingName = $('#name');
  const bookingPhone = $('#phone');
  const bookingEmail = $('#email');
  const bookingNotes = $('#notes');
  const formError = $('[data-form-error]');
  const estimateEl = $('[data-estimate]');
  const nightsLabel = $('[data-nights-label]');
  const priceLabel = $('[data-price-label]');

  setDefaultDates();

  // Pre-fill the booking form from ?room=&checkin=&checkout=&guests=
  if (bookingForm) {
    const params = new URLSearchParams(window.location.search);
    const room = params.get('room');
    const checkin = params.get('checkin');
    const checkout = params.get('checkout');
    const guests = params.get('guests');

    if (room && ROOM_NAMES[room]) roomSelect.value = room;
    if (checkin && fromISODate(checkin)) bookingCheckin.value = checkin;
    if (checkout && fromISODate(checkout)) bookingCheckout.value = checkout;
    if (guests && bookingGuests) {
      const matching = Array.from(bookingGuests.options).find((option) => option.value === guests);
      if (matching) bookingGuests.value = guests;
    }
    setDateLimits(bookingCheckin, bookingCheckout);
  }

  [availCheckin, bookingCheckin].forEach((input) => {
    if (!input) return;
    input.addEventListener('change', () => {
      const paired = input === availCheckin ? availCheckout : bookingCheckout;
      setDateLimits(input, paired);
      updateEstimate();
      if (formError) formError.hidden = true;
    });
  });

  [availCheckout, bookingCheckout].forEach((input) => {
    if (!input) return;
    input.addEventListener('change', () => {
      updateEstimate();
      if (formError) formError.hidden = true;
    });
  });

  if (roomSelect) roomSelect.addEventListener('change', updateEstimate);

  function updateEstimate() {
    if (!estimateEl || !roomSelect) return;
    const nights = nightsBetween(bookingCheckin?.value, bookingCheckout?.value);
    const price = ROOM_PRICES[roomSelect.value];

    if (nights > 0) {
      nightsLabel.textContent = `${nights} ${nights === 1 ? 'night' : 'nights'}`;
    } else {
      nightsLabel.textContent = 'Select your dates';
    }

    if (price && nights > 0) {
      estimateEl.textContent = formatINR(price * nights);
      priceLabel.textContent = `${formatINR(price)} × ${nights} ${nights === 1 ? 'night' : 'nights'}`;
    } else if (roomSelect.value === 'any' && nights > 0) {
      estimateEl.textContent = 'On request';
      priceLabel.textContent = 'We will suggest the best room for you';
    } else {
      estimateEl.textContent = '₹—';
      priceLabel.textContent = roomSelect.value ? 'Choose valid dates' : 'Room rate applies';
    }
  }

  // The quick availability bar sends guests to the booking page with dates pre-filled.
  if (availForm) {
    availForm.addEventListener('submit', (event) => {
      event.preventDefault();
      const checkin = availCheckin?.value;
      const checkout = availCheckout?.value;

      if (!checkin || !checkout || nightsBetween(checkin, checkout) < 1) {
        if (availCheckout) {
          availCheckout.focus();
          availCheckout.setAttribute('aria-invalid', 'true');
        }
        return;
      }

      if (availCheckout) availCheckout.removeAttribute('aria-invalid');
      const params = new URLSearchParams({
        checkin,
        checkout,
        guests: availGuests?.value || '2',
      });
      window.location.href = `/book.html?${params.toString()}`;
    });
  }

  /* ---------------- Booking form ---------------- */

  const successPanel = $('#booking-success');
  const successRef = $('[data-booking-ref]');
  const successSummary = $('[data-success-summary]');
  const successWhatsApp = $('[data-whatsapp-link]');
  const copyButton = $('[data-copy-booking]');
  const newBookingButton = $('[data-new-booking]');
  const submitButton = $('.form-submit');
  let currentBookingText = '';

  function clearFieldError(field) {
    if (!field) return;
    field.removeAttribute('aria-invalid');
  }

  if (bookingForm) {
    $$('input, select, textarea', bookingForm).forEach((field) => {
      field.addEventListener('input', () => {
        clearFieldError(field);
        if (formError) formError.hidden = true;
      });
      field.addEventListener('change', () => clearFieldError(field));
    });

    bookingForm.addEventListener('submit', async (event) => {
      event.preventDefault();
      if (formError) formError.hidden = true;

      const checkin = bookingCheckin?.value;
      const checkout = bookingCheckout?.value;
      const nights = nightsBetween(checkin, checkout);
      const name = bookingName?.value.trim() || '';
      const phone = bookingPhone?.value.trim() || '';
      const email = bookingEmail?.value.trim() || '';
      const phoneDigits = phone.replace(/\D/g, '');

      let invalidField = null;
      let message = '';

      if (!roomSelect?.value) {
        message = 'Please choose a room before sending your request.';
        invalidField = roomSelect;
      } else if (!checkin || !checkout || nights < 1) {
        message = 'Please select valid check-in and check-out dates.';
        invalidField = !checkin || nights < 1 ? bookingCheckin : bookingCheckout;
      } else if (name.length < 2) {
        message = 'Please enter your name so we know who to expect.';
        invalidField = bookingName;
      } else if (phoneDigits.length < 10 || phoneDigits.length > 13) {
        message = 'Please enter a valid mobile number (at least 10 digits).';
        invalidField = bookingPhone;
      } else if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        message = 'That email address does not look right. You can also leave it blank.';
        invalidField = bookingEmail;
      }

      if (message) {
        if (formError) {
          formError.textContent = message;
          formError.hidden = false;
        }
        invalidField?.setAttribute('aria-invalid', 'true');
        invalidField?.focus();
        return;
      }

      const roomValue = roomSelect.value;
      const roomName = ROOM_NAMES[roomValue] || 'Room to be confirmed';
      const price = ROOM_PRICES[roomValue];
      const estimate = price ? formatINR(price * nights) : 'To be confirmed';
      const guests = bookingGuests?.value || '2';
      const children = bookingChildren?.value || '0';
      const notes = bookingNotes?.value.trim() || '';
      const guestText = `${guests} ${guests === '1' ? 'adult' : 'adults'}${children !== '0' ? `, ${children} ${children === '1' ? 'child' : 'children'}` : ''}`;

      const payload = {
        roomId: roomValue,
        checkin,
        checkout,
        adults: Number(guests) || 1,
        children: Number(children) || 0,
        name,
        phone,
        email,
        notes,
      };

      if (submitButton) {
        submitButton.disabled = true;
        submitButton.setAttribute('aria-busy', 'true');
      }

      try {
        const response = await fetch('/api/bookings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const data = await response.json().catch(() => ({}));

        if (!response.ok) {
          const serverMessage = data.error || 'We could not save your request. Please call or WhatsApp us.';
          if (formError) {
            formError.textContent = serverMessage;
            formError.hidden = false;
          }
          formError?.scrollIntoView({ behavior: 'smooth', block: 'center' });
          return;
        }

        const booking = data.booking || {};
        const reference = booking.reference || 'SV';
        currentBookingText = [
          'Hello Sunrise Villa! I just sent a booking request on your website.',
          '',
          `Reference: ${reference}`,
          `Room: ${roomName}`,
          `Check-in: ${formatDate(checkin)}`,
          `Check-out: ${formatDate(checkout)}`,
          `Nights: ${nights}`,
          `Guests: ${guestText}`,
          `Name: ${name}`,
          `Phone: ${phone}`,
          email ? `Email: ${email}` : null,
          `Estimated total: ${estimate}`,
          notes ? `Notes: ${notes}` : null,
          '',
          'Please confirm availability. Thank you!',
        ].filter((line) => line !== null).join('\n');

        if (successRef) successRef.textContent = reference;
        if (successSummary) {
          successSummary.innerHTML = '';
          const rows = [
            ['Room', roomName],
            ['Dates', `${formatDate(checkin)} → ${formatDate(checkout)}`],
            ['Guests', guestText],
            ['Estimate', estimate],
          ];
          rows.forEach(([label, value]) => {
            const row = document.createElement('div');
            const labelEl = document.createElement('span');
            const valueEl = document.createElement('strong');
            labelEl.textContent = label;
            valueEl.textContent = value;
            row.append(labelEl, valueEl);
            successSummary.append(row);
          });
        }
        if (successWhatsApp) {
          successWhatsApp.href = `https://wa.me/${WHATSAPP_NUMBER}?text=${encodeURIComponent(currentBookingText)}`;
        }

        bookingForm.hidden = true;
        if (successPanel) {
          successPanel.hidden = false;
          successPanel.setAttribute('tabindex', '-1');
          successPanel.focus({ preventScroll: true });
        }
      } catch (error) {
        if (formError) {
          formError.textContent = 'We could not reach the booking server. Please check your connection or call us.';
          formError.hidden = false;
        }
      } finally {
        if (submitButton) {
          submitButton.disabled = false;
          submitButton.removeAttribute('aria-busy');
        }
      }
    });
  }

  if (copyButton) {
    copyButton.addEventListener('click', async () => {
      if (!currentBookingText) return;
      try {
        await navigator.clipboard.writeText(currentBookingText);
        copyButton.textContent = 'Copied!';
      } catch (error) {
        const textarea = document.createElement('textarea');
        textarea.value = currentBookingText;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        textarea.remove();
        copyButton.textContent = 'Copied!';
      }
      window.setTimeout(() => {
        copyButton.textContent = 'Copy booking details';
      }, 2200);
    });
  }

  if (newBookingButton) {
    newBookingButton.addEventListener('click', () => {
      bookingForm?.reset();
      if (formError) formError.hidden = true;
      setDefaultDates();
      updateEstimate();
      if (successPanel) successPanel.hidden = true;
      if (bookingForm) {
        bookingForm.hidden = false;
        bookingForm.scrollIntoView({ behavior: 'smooth', block: 'start' });
        window.setTimeout(() => roomSelect?.focus({ preventScroll: true }), 500);
      }
    });
  }

  updateEstimate();

  /* ---------------- Gallery lightbox ---------------- */

  const lightbox = $('[data-lightbox-dialog]');
  const lightboxImage = $('[data-lightbox-image]');
  const lightboxCaption = $('[data-lightbox-caption]');
  const lightboxClose = $('[data-lightbox-close]');
  const lightboxPrev = $('[data-lightbox-prev]');
  const lightboxNext = $('[data-lightbox-next]');
  const galleryButtons = $$('[data-lightbox]');
  let lightboxIndex = 0;

  function showLightbox(index) {
    if (!lightbox || !lightboxImage || !galleryButtons.length) return;
    lightboxIndex = (index + galleryButtons.length) % galleryButtons.length;
    const button = galleryButtons[lightboxIndex];
    lightboxImage.src = button.getAttribute('data-src') || '';
    lightboxImage.alt = button.querySelector('img')?.alt || '';
    if (lightboxCaption) lightboxCaption.textContent = button.getAttribute('data-caption') || '';
  }

  galleryButtons.forEach((button, index) => {
    button.addEventListener('click', () => {
      showLightbox(index);
      if (typeof lightbox?.showModal === 'function') {
        lightbox.showModal();
      }
    });
  });

  lightboxClose?.addEventListener('click', () => lightbox?.close());
  lightboxPrev?.addEventListener('click', () => showLightbox(lightboxIndex - 1));
  lightboxNext?.addEventListener('click', () => showLightbox(lightboxIndex + 1));

  lightbox?.addEventListener('click', (event) => {
    if (event.target === lightbox) lightbox.close();
  });

  lightbox?.addEventListener('keydown', (event) => {
    if (event.key === 'ArrowLeft') {
      event.preventDefault();
      showLightbox(lightboxIndex - 1);
    } else if (event.key === 'ArrowRight') {
      event.preventDefault();
      showLightbox(lightboxIndex + 1);
    }
  });

  /* ---------------- Reveal on scroll ---------------- */

  const reveals = $$('.reveal');
  if ('IntersectionObserver' in window && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            entry.target.classList.add('is-visible');
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.08, rootMargin: '0px 0px -30px' }
    );
    reveals.forEach((element) => observer.observe(element));
  } else {
    reveals.forEach((element) => element.classList.add('is-visible'));
  }

  /* ---------------- Footer year ---------------- */

  const year = $('[data-year]');
  if (year) year.textContent = String(new Date().getFullYear());
})();
