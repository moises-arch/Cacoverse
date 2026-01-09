/**
 * Caco Header Section JS
 * Optimized and externalized for performance.
 */
document.addEventListener('DOMContentLoaded', function () {

  // Get configuration from window (passed from Liquid)
  var config = window.CacoHeaderConfig || {};

  /* ----------------------------------------------------------------------------
     1. Sticky Header Logic
     ---------------------------------------------------------------------------- */
  (function () {
    var headerWrapper = document.querySelector('.caco-header-wrapper');
    if (!headerWrapper) return;

    var lastScrollY = window.scrollY || 0;
    var lastDirection = null;
    var directionChangeStartY = lastScrollY;

    var HIDE_THRESHOLD = 8;
    var MIN_SCROLL_TO_HIDE = 120;
    var SHOW_AFTER = 200;
    var ANNOUNCEMENT_HIDE_AFTER = 120;
    var ticking = false;

    var resizeDebounceTimer = null;
    var isTransitioning = false;

    var announcementBar = headerWrapper.querySelector('.caco-announcement-bar');
    if (announcementBar) {
      announcementBar.addEventListener('transitionstart', function () { isTransitioning = true; });
      announcementBar.addEventListener('transitionend', function () {
        isTransitioning = false;
        safeRecalcHeaderHeight();
      });
    }

    function computeHeaderHeight() {
      if (isTransitioning) return;
      if (headerWrapper.classList.contains('caco-hide-announcement') || headerWrapper.classList.contains('caco-hide-nav')) {
        return;
      }

      var h = headerWrapper.offsetHeight || 0;
      if (h > 0) {
        document.documentElement.style.setProperty('--caco-header-height', h + 'px');
        document.documentElement.classList.add('has-caco-sticky');
      }
    }

    function safeRecalcHeaderHeight() {
      requestAnimationFrame(computeHeaderHeight);
      setTimeout(computeHeaderHeight, 300);
    }

    if ('ResizeObserver' in window) {
      var ro = new ResizeObserver(function () {
        clearTimeout(resizeDebounceTimer);
        resizeDebounceTimer = setTimeout(safeRecalcHeaderHeight, 100);
      });
      ro.observe(headerWrapper);
    }

    window.addEventListener('resize', safeRecalcHeaderHeight);
    window.addEventListener('orientationchange', safeRecalcHeaderHeight);
    window.addEventListener('pageshow', safeRecalcHeaderHeight);
    document.addEventListener('visibilitychange', function () {
      if (!document.hidden) safeRecalcHeaderHeight();
    });

    window.cacoUpdateHeaderHeight = computeHeaderHeight;

    function handleScroll() {
      var currentY = window.scrollY || 0;
      var delta = currentY - lastScrollY;

      var direction = lastDirection;
      if (delta > 0) {
        direction = 'down';
      } else if (delta < 0) {
        direction = 'up';
      }

      if (direction !== lastDirection && direction !== null) {
        directionChangeStartY = currentY;
        lastDirection = direction;
      }

      if (currentY > 0) {
        headerWrapper.classList.add('is-scrolled');
      } else {
        headerWrapper.classList.remove('is-scrolled');
      }

      if (currentY <= ANNOUNCEMENT_HIDE_AFTER) {
        headerWrapper.classList.remove('caco-hide-announcement');
      } else {
        headerWrapper.classList.add('caco-hide-announcement');
      }

      if (currentY <= MIN_SCROLL_TO_HIDE) {
        headerWrapper.classList.remove('caco-hide-nav');
      } else {
        if (direction === 'down' && Math.abs(delta) >= HIDE_THRESHOLD) {
          headerWrapper.classList.add('caco-hide-nav');
        }
        if (direction === 'up' && (directionChangeStartY - currentY) >= SHOW_AFTER) {
          headerWrapper.classList.remove('caco-hide-nav');
        }
      }

      lastScrollY = currentY;
    }

    computeHeaderHeight();
    handleScroll();

    requestAnimationFrame(function () {
      headerWrapper.classList.add('caco-is-ready');
    });

    window.addEventListener('scroll', function () {
      if (!ticking) {
        window.requestAnimationFrame(function () {
          handleScroll();
          ticking = false;
        });
        ticking = true;
      }
    });

    window.addEventListener('resize', function () {
      computeHeaderHeight();
    });
  })();

  /* ----------------------------------------------------------------------------
     2. Mega Menu Sidebar Behavior
     ---------------------------------------------------------------------------- */
  (function () {
    document.querySelectorAll('.caco-nav-item.mega-menu').forEach(function (megaItem) {
      var sidebarLinks = megaItem.querySelectorAll('.caco-mega-sidebar-link');
      var panels = megaItem.querySelectorAll('.caco-mega-panel');
      if (!sidebarLinks.length || !panels.length) return;

      function activatePanel(targetHandle, linkEl) {
        sidebarLinks.forEach(function (l) { l.classList.remove('active'); });
        panels.forEach(function (p) { p.classList.remove('active'); });

        if (linkEl) linkEl.classList.add('active');

        var panelId = 'panel-' + targetHandle;
        var targetPanel = megaItem.querySelector('#' + CSS.escape(panelId));
        if (targetPanel) targetPanel.classList.add('active');
      }

      sidebarLinks.forEach(function (link) {
        var handle = link.getAttribute('data-target');
        if (!handle) return;

        link.addEventListener('mouseenter', function () {
          if (window.innerWidth >= 1025) activatePanel(handle, link);
        });

        link.addEventListener('focus', function () {
          if (window.innerWidth >= 1025) activatePanel(handle, link);
        });

        link.addEventListener('click', function (evt) {
          if (window.innerWidth >= 1025 && !link.classList.contains('active')) {
            evt.preventDefault();
            activatePanel(handle, link);
          }
        });
      });
    });
  })();

  /* ----------------------------------------------------------------------------
     3. Header Overlay Manager
     ---------------------------------------------------------------------------- */
  var cacoOverlayManager = (function () {
    var overlay = document.getElementById('caco-search-overlay');
    var headerWrapper = document.querySelector('.caco-header-wrapper');
    var sources = new Set();

    function isDesktop() {
      return window.innerWidth >= 1025;
    }

    function sync() {
      if (!overlay) return;
      var active = sources.size > 0 && isDesktop();

      overlay.classList.toggle('active', active);

      if (headerWrapper) {
        headerWrapper.classList.toggle('caco-overlay-active', active);
      }
    }

    window.addEventListener('resize', sync);

    return {
      show: function (source) {
        if (!overlay) return;
        if (source) sources.add(source);
        sync();
      },
      hide: function (source) {
        if (!overlay) return;
        if (source) sources.delete(source);
        sync();
      }
    };
  })();

  (function () {
    if (!cacoOverlayManager) return;
    var navItems = document.querySelectorAll('.caco-nav-item');
    if (!navItems.length) return;

    function shouldApplyOverlay() {
      return window.innerWidth >= 1025;
    }

    navItems.forEach(function (item) {
      item.addEventListener('mouseenter', function () { if (shouldApplyOverlay()) cacoOverlayManager.show('nav'); });
      item.addEventListener('mouseleave', function () { if (shouldApplyOverlay()) cacoOverlayManager.hide('nav'); });
      item.addEventListener('focusin', function () { if (shouldApplyOverlay()) cacoOverlayManager.show('nav'); });
      item.addEventListener('focusout', function () { if (shouldApplyOverlay()) cacoOverlayManager.hide('nav'); });
    });
  })();

  /* ----------------------------------------------------------------------------
     4. Cart Integration
     ---------------------------------------------------------------------------- */
  (function () {
    var cartButton = document.querySelector('[data-caco-cart-drawer]');
    if (!cartButton) return;
    cartButton.addEventListener('click', function (e) {
      var cartDrawer = document.querySelector('cart-drawer');
      if (!cartDrawer) return;
      e.preventDefault();
      if (typeof cartDrawer.open === 'function') {
        cartDrawer.open();
      } else {
        cartDrawer.setAttribute('open', 'true');
        cartDrawer.classList.add('is-open');
      }
    });
  })();

  (function () {
    var cartBtn = document.querySelector('.caco-cart-btn');
    if (!cartBtn) return;

    var lastCount = null;
    var refreshTimeout = null;

    function ensureBadge() {
      var badge = cartBtn.querySelector('.caco-cart-count');
      if (!badge) {
        badge = document.createElement('div');
        badge.className = 'caco-cart-count';
        cartBtn.appendChild(badge);
      }
      return badge;
    }

    function renderCount(count) {
      if (lastCount === count) return;
      lastCount = count;

      var badge = cartBtn.querySelector('.caco-cart-count');
      if (!badge && count > 0) {
        badge = ensureBadge();
      }
      if (!badge) return;

      if (count > 0) {
        badge.textContent = count;
        badge.style.display = 'flex';
        badge.classList.remove('caco-cart-count--pulse');
        badge.offsetWidth;
        badge.classList.add('caco-cart-count--pulse');
      } else {
        badge.textContent = '';
        badge.style.display = 'none';
      }
    }

    function updateFromCart(cart) {
      if (!cart || typeof cart.item_count !== 'number') return;
      window.requestAnimationFrame(function () {
        renderCount(cart.item_count);
      });
    }

    function fetchCartAndUpdate(delay) {
      if (refreshTimeout) clearTimeout(refreshTimeout);
      refreshTimeout = setTimeout(function () {
        fetch('/cart.js', {
          credentials: 'same-origin',
          cache: 'no-store'
        })
          .then(function (res) { return res.json(); })
          .then(function (cart) {
            updateFromCart(cart);
          })
          .catch(function (err) {
            console.warn('Cart count update failed', err);
          });
      }, delay || 120);
    }

    function handleCartEvent(e) {
      if (e && e.detail && e.detail.cart) {
        updateFromCart(e.detail.cart);
      } else {
        fetchCartAndUpdate(80);
      }
    }

    ['cart:updated', 'cart:change', 'cart:refresh', 'cart:requestComplete']
      .forEach(function (evtName) {
        document.addEventListener(evtName, handleCartEvent);
      });

    document.body.addEventListener('submit', function (e) {
      var form = e.target;
      if (!form || form.tagName !== 'FORM') return;
      var action = form.getAttribute('action') || '';
      if (action.indexOf('/cart/add') !== -1 || form.querySelector('[name="add"]')) {
        fetchCartAndUpdate(150);
      }
      if (action.indexOf('/cart') !== -1 && form.querySelector('input[name="updates[]"]')) {
        fetchCartAndUpdate(150);
      }
    });

    document.body.addEventListener('click', function (e) {
      var target = e.target;
      if (target.closest('[data-cart-remove], .cart-remove, .cart-remove-button, .cart__remove')) {
        fetchCartAndUpdate(150);
      }
      if (target.closest('.quantity__button, [name="minus"], [name="plus"]')) {
        fetchCartAndUpdate(200);
      }
    });

    if (window.fetch && !window.__cacoCartPatchedFetch) {
      var originalFetch = window.fetch;
      window.fetch = function () {
        var args = arguments;
        var urlStr = (typeof args[0] === 'string') ? args[0] : (args[0] && args[0].url) || '';
        var isCartCall = urlStr.indexOf('/cart') !== -1;
        var p = originalFetch.apply(this, args);
        if (isCartCall) {
          p.then(function () { fetchCartAndUpdate(120); }).catch(function () { fetchCartAndUpdate(200); });
        }
        return p;
      };
      window.__cacoCartPatchedFetch = true;
    }

    if (window.XMLHttpRequest && !window.__cacoCartPatchedXHR) {
      var XHROpen = XMLHttpRequest.prototype.open;
      var XHRSend = XMLHttpRequest.prototype.send;
      XMLHttpRequest.prototype.open = function (method, url) {
        this.__cacoIsCart = typeof url === 'string' && url.indexOf('/cart') !== -1;
        return XHROpen.apply(this, arguments);
      };
      XMLHttpRequest.prototype.send = function (body) {
        if (this.__cacoIsCart) {
          this.addEventListener('load', function () { fetchCartAndUpdate(120); });
          this.addEventListener('error', function () { fetchCartAndUpdate(200); });
        }
        return XHRSend.apply(this, arguments);
      };
      window.__cacoCartPatchedXHR = true;
    }

    fetchCartAndUpdate(0);
  })();

  /* ----------------------------------------------------------------------------
     5. Dropdowns (Partner, Help, Industries)
     ---------------------------------------------------------------------------- */
  function setupDropdown(menuSelector, toggleSelector, extraCloseSelector) {
    var menu = document.querySelector(menuSelector);
    if (!menu) return;
    var toggle = menu.querySelector(toggleSelector);
    if (!toggle) return;

    toggle.addEventListener('click', function (e) {
      if (toggle.tagName === 'A') e.preventDefault();
      e.stopPropagation();
      var isOpen = menu.classList.contains('open');

      // Close others if specified
      if (extraCloseSelector) {
        document.querySelectorAll(extraCloseSelector).forEach(function (m) { m.classList.remove('open'); });
      }

      if (isOpen) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (cacoOverlayManager) cacoOverlayManager.hide('nav');
      } else {
        menu.classList.add('open');
        toggle.setAttribute('aria-expanded', 'true');
        if (cacoOverlayManager) cacoOverlayManager.show('nav');
      }
    });

    document.addEventListener('click', function (e) {
      if (!menu.contains(e.target)) {
        menu.classList.remove('open');
        toggle.setAttribute('aria-expanded', 'false');
        if (cacoOverlayManager) cacoOverlayManager.hide('nav');
      }
    });
  }

  setupDropdown('.caco-partner-menu', '.caco-partner-toggle');
  setupDropdown('.caco-help-menu', '.caco-help-toggle', '.caco-industries-menu');
  setupDropdown('.caco-industries-menu', '.caco-industries-toggle', '.caco-help-menu');

  /* ----------------------------------------------------------------------------
     6. Announcement Slider
     ---------------------------------------------------------------------------- */
  (function () {
    var bar = document.getElementById('caco-announcement-bar');
    if (!bar) return;
    var slider = bar.querySelector('.caco-announcement-slider');
    if (!slider) return;

    var originalHTML = slider.innerHTML;
    var timer;
    var current = 0;
    var currentMode = null;

    function initAnnouncement() {
      var isMobile = window.innerWidth <= 768;
      var newMode = isMobile ? 'mobile' : 'desktop';
      if (newMode === currentMode) return;
      currentMode = newMode;

      if (timer) clearInterval(timer);
      slider.innerHTML = originalHTML;

      var slides = slider.querySelectorAll('.caco-announcement-slide');
      var total = slides.length;
      if (!total) return;

      var prevBtn = bar.querySelector('.caco-ann-prev');
      var nextBtn = bar.querySelector('.caco-ann-next');
      var currentEl = bar.querySelector('#caco-ann-current');
      var totalEl = bar.querySelector('#caco-ann-total');
      var navGroup = bar.querySelector('.caco-ann-nav-group');

      if (totalEl) totalEl.textContent = String(total);

      if (isMobile) {
        if (navGroup) navGroup.style.display = 'none';
      } else {
        if (navGroup) navGroup.style.display = 'flex';
        var desktopSlides = slider.querySelectorAll('.caco-announcement-slide.caco-desktop-only-ann');
        var dTotal = desktopSlides.length;
        if (!dTotal) return;

        function showSlide(index) {
          desktopSlides.forEach(function (s) { s.classList.remove('active'); });
          current = (index + dTotal) % dTotal;
          desktopSlides[current].classList.add('active');
          if (currentEl) currentEl.textContent = String(current + 1);
        }

        var intervalSec = parseInt(bar.getAttribute('data-interval') || '8', 10);
        if (isNaN(intervalSec) || intervalSec <= 0) intervalSec = 8;

        function startAuto() {
          if (timer) clearInterval(timer);
          if (dTotal <= 1) return;
          timer = setInterval(function () { showSlide(current + 1); }, intervalSec * 1000);
        }

        if (prevBtn && !prevBtn._hasCacoListener) {
          prevBtn.addEventListener('click', function () { showSlide(current - 1); startAuto(); });
          prevBtn._hasCacoListener = true;
        }
        if (nextBtn && !nextBtn._hasCacoListener) {
          nextBtn.addEventListener('click', function () { showSlide(current + 1); startAuto(); });
          nextBtn._hasCacoListener = true;
        }
        showSlide(0);
        startAuto();
      }
    }

    initAnnouncement();
    window.addEventListener('resize', initAnnouncement);

    var closeBtn = bar.querySelector('.caco-announcement-close');
    if (closeBtn) {
      closeBtn.addEventListener('click', function () {
        bar.style.display = 'none';
        if (window.cacoUpdateHeaderHeight) window.cacoUpdateHeaderHeight();
      });
    }
  })();

  /* ----------------------------------------------------------------------------
     7. Predictive Search
     ---------------------------------------------------------------------------- */
  (function () {
    if (!config.predictiveEnabled) return;

    var defaultImage = 'https://www.cacoamerica.com/cdn/shop/files/caco-usa.png';

    function setupPredictive(formSelector, inputSelector) {
      var form = document.querySelector(formSelector);
      var input = document.querySelector(inputSelector);
      if (!form || !input) return;

      var resultsContainer = document.createElement('div');
      resultsContainer.className = 'caco-predictive-results';
      form.parentNode.appendChild(resultsContainer);

      var typingTimer;

      function closePredictive() {
        resultsContainer.innerHTML = '';
        resultsContainer.style.display = 'none';
        resultsContainer.classList.remove('is-visible');
        if (cacoOverlayManager) cacoOverlayManager.hide('search');
      }

      function openOverlay() {
        if (cacoOverlayManager && config.predictiveOverlayOn) cacoOverlayManager.show('search');
      }

      input.addEventListener('focus', function () {
        if (input.value.trim().length >= config.predictiveMinChars) openOverlay();
      });

      input.addEventListener('input', function () {
        var q = input.value.trim();
        clearTimeout(typingTimer);

        if (!q || q.length < config.predictiveMinChars) {
          closePredictive();
          return;
        }

        typingTimer = setTimeout(function () {
          var fields = ['title', 'product_type', 'variants.title', 'variants.sku', 'variants.barcode', 'tag'].join(',');
          if (/^\d+$/.test(q)) fields = ['title', 'variants.sku', 'variants.barcode', 'tag'].join(',');

          var url = '/search/suggest.json' +
            '?q=' + encodeURIComponent(q) +
            '&resources[type]=product' +
            '&resources[options][fields]=' + encodeURIComponent(fields) +
            '&resources[options][unavailable_products]=last' +
            '&resources[limit]=' + encodeURIComponent(config.predictiveLimit);

          fetch(url)
            .then(function (res) { return res.json(); })
            .then(function (data) {
              var products = (data.resources && data.resources.results && data.resources.results.products) || [];
              if (!products.length) { closePredictive(); return; }

              var html = '<ul class="caco-predictive-list">';
              products.forEach(function (p) {
                var imgSrc = p.image || defaultImage;
                html += '<li class="caco-predictive-item">'
                  + '<a class="caco-predictive-link" href="' + p.url + '">'
                  + '<img src="' + imgSrc + '" alt="">'
                  + '<div class="caco-predictive-info">'
                  + '<span class="caco-predictive-title">' + p.title + '</span>'
                  + (p.price ? '<span class="caco-predictive-price">' + p.price + '</span>' : '')
                  + '</div></a></li>';
              });
              html += '</ul><div class="caco-view-all"><a href="' + config.searchBase + '?q=' + encodeURIComponent(q) + '" class="caco-view-all-link">View all results</a></div>';

              resultsContainer.innerHTML = html;
              resultsContainer.style.display = 'block';
              resultsContainer.classList.add('is-visible');
              openOverlay();
            })
            .catch(closePredictive);
        }, config.predictiveDebounce);
      });

      document.addEventListener('click', function (e) {
        if (!resultsContainer.contains(e.target) && !form.contains(e.target)) closePredictive();
      });
      input.addEventListener('blur', function () { setTimeout(closePredictive, 150); });
    }

    setupPredictive('.caco-search-form--desktop', '#CacoSearchInputDesktop');
    setupPredictive('.caco-search-form--mobile', '#CacoSearchInputMobile');
  })();

  /* ----------------------------------------------------------------------------
     8. Mobile Drawer
     ---------------------------------------------------------------------------- */
  (function () {
    var drawer = document.getElementById('caco-mobile-drawer');
    var overlay = document.getElementById('caco-mobile-overlay');
    var burger = document.getElementById('caco-mobile-trigger');
    var searchBtn = document.getElementById('caco-mobile-search-toggle');
    if (!drawer || !overlay) return;

    var panels = drawer.querySelectorAll('.caco-mobile-panel');
    var titleEl = drawer.querySelector('[data-panel-title]');
    var backBtn = drawer.querySelector('.caco-mobile-back');
    var rootPanel = drawer.querySelector('.caco-mobile-panel[data-panel-root]');
    var currentPanelId = 'root';
    var historyStack = [];

    function clearRootActive() {
      if (!rootPanel) return;
      rootPanel.querySelectorAll('.caco-mobile-item--root-active').forEach(function (li) { li.classList.remove('caco-mobile-item--root-active'); });
    }
    function clearGrandActive() {
      drawer.querySelectorAll('.caco-mobile-item.is-grand-active').forEach(function (li) { li.classList.remove('is-grand-active'); });
    }
    function setBackVisibility() {
      if (!backBtn) return;
      (historyStack.length === 0) ? backBtn.classList.remove('is-visible') : backBtn.classList.add('is-visible');
    }
    function showPanel(id) {
      var target = drawer.querySelector('.caco-mobile-panel[data-panel-id="' + id + '"]');
      if (!target) return;
      panels.forEach(function (p) { p.classList.remove('is-active'); });
      target.classList.add('is-active');
      currentPanelId = id;
      var title = target.getAttribute('data-panel-title');
      if (titleEl && title) titleEl.textContent = title;
      setBackVisibility();
    }
    function resetPanels() {
      historyStack = [];
      currentPanelId = 'root';
      clearRootActive();
      clearGrandActive();
      showPanel('root');
    }
    function openDrawer() {
      drawer.classList.add('open');
      drawer.style.transform = '';
      overlay.classList.add('open');
      drawer.setAttribute('aria-hidden', 'false');
      document.documentElement.classList.add('caco-mobile-open');
      if (window.cacoUpdateHeaderHeight) window.cacoUpdateHeaderHeight();
      if (burger) burger.classList.add('is-open');
      resetPanels();
    }
    function closeDrawer() {
      drawer.classList.remove('open');
      drawer.style.transform = '';
      overlay.classList.remove('open');
      drawer.setAttribute('aria-hidden', 'true');
      document.documentElement.classList.remove('caco-mobile-open');
      if (window.cacoUpdateHeaderHeight) window.cacoUpdateHeaderHeight();
      if (burger) burger.classList.remove('is-open');
      resetPanels();
    }

    [burger, searchBtn].forEach(function (btn) {
      if (btn) btn.addEventListener('click', function (e) {
        e.preventDefault();
        drawer.classList.contains('open') ? closeDrawer() : openDrawer();
      });
    });

    overlay.addEventListener('click', closeDrawer);
    document.addEventListener('keyup', function (e) { if (e.key === 'Escape' && drawer.classList.contains('open')) closeDrawer(); });

    drawer.addEventListener('click', function (e) {
      var grandLink = e.target.closest('.caco-mobile-link-grand');
      if (grandLink) {
        var panel = grandLink.closest('.caco-mobile-panel');
        if (panel) {
          panel.querySelectorAll('.caco-mobile-item.is-grand-active').forEach(function (li) { li.classList.remove('is-grand-active'); });
          var liGrand = grandLink.closest('.caco-mobile-item');
          if (liGrand) liGrand.classList.add('is-grand-active');
        }
      }

      var trigger = e.target.closest('[data-panel-target]');
      if (!trigger) return;
      var targetId = trigger.getAttribute('data-panel-target');
      if (!targetId) return;
      var parentPanel = trigger.closest('.caco-mobile-panel');
      if (parentPanel && parentPanel.hasAttribute('data-panel-root')) {
        clearRootActive();
        var li = trigger.closest('.caco-mobile-item');
        if (li) li.classList.add('caco-mobile-item--root-active');
      }
      if (currentPanelId) historyStack.push(currentPanelId);
      showPanel(targetId);
    });

    if (backBtn) {
      backBtn.addEventListener('click', function () {
        if (!historyStack.length) return;
        historyStack.pop();
        var prev = historyStack[historyStack.length - 1] || 'root';
        showPanel(prev);
        if (!historyStack.length) setBackVisibility();
      });
    }

    // Swipe logic
    var startX = 0, currentX = 0, isDragging = false, SWIPE_THRESHOLD = 60;
    drawer.addEventListener('touchstart', function (e) {
      if (!drawer.classList.contains('open')) return;
      startX = e.touches[0].clientX;
      currentX = startX;
      isDragging = true;
      drawer.style.transition = 'none';
    });
    drawer.addEventListener('touchmove', function (e) {
      if (!isDragging) return;
      currentX = e.touches[0].clientX;
      var deltaX = currentX - startX;
      if (deltaX > 0) {
        var translate = Math.min(deltaX / (drawer.offsetWidth || window.innerWidth) * 100, 100);
        drawer.style.transform = 'translateX(' + translate + '%)';
      }
    });
    drawer.addEventListener('touchend', function () {
      if (!isDragging) return;
      var deltaX = currentX - startX;
      drawer.style.transition = '';
      isDragging = false;
      if (deltaX > SWIPE_THRESHOLD) closeDrawer(); else { drawer.classList.add('open'); drawer.style.transform = ''; }
    });
  })();

  /* ----------------------------------------------------------------------------
     9. Voice Search
     ---------------------------------------------------------------------------- */
  (function () {
    var SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      document.querySelectorAll('.caco-search-voice-btn').forEach(function (btn) { btn.style.display = 'none'; });
      return;
    }

    function setupVoiceSearch(btnSelector, inputSelector) {
      var btn = document.querySelector(btnSelector), input = document.querySelector(inputSelector);
      if (!btn || !input) return;
      var recognition = new SpeechRecognition();
      recognition.lang = 'en-US';
      var listening = false;
      function setListening(on) { listening = on; (on) ? btn.classList.add('is-listening') : btn.classList.remove('is-listening'); }
      btn.addEventListener('click', function (e) {
        e.preventDefault();
        if (listening) { recognition.stop(); return; }
        try { recognition.start(); } catch (err) { console.warn('Voice start error', err); }
      });
      recognition.addEventListener('start', function () { setListening(true); });
      recognition.addEventListener('end', function () { setListening(false); });
      recognition.addEventListener('result', function (event) {
        var transcript = '';
        for (var i = event.resultIndex; i < event.results.length; i++) { transcript += event.results[i][0].transcript; }
        transcript = transcript.trim();
        if (!transcript) return;
        input.value = transcript;
        input.dispatchEvent(new Event('input', { bubbles: true }));
      });
      recognition.addEventListener('error', function (e) { console.warn('Voice error', e.error); setListening(false); });
    }
    setupVoiceSearch('.caco-search-voice-btn--desktop', '#CacoSearchInputDesktop');
    setupVoiceSearch('.caco-search-voice-btn--mobile', '#CacoSearchInputMobile');
  })();

  /* ----------------------------------------------------------------------------
     10. Animated Search Placeholder
     ---------------------------------------------------------------------------- */
  (function () {
    var desktopInput = document.getElementById('CacoSearchInputDesktop'), mobileInput = document.getElementById('CacoSearchInputMobile');
    if (!desktopInput && !mobileInput) return;

    var hints = [
      'Search gloves, helmets, tools and more…',
      'Try “cut resistant gloves”',
      'Looking for safety helmets?',
      'Try typing a SKU like “GH400”…'
    ];
    var basePlaceholder = hints[0], currentIndex = 0, typingTimer = null, cycleTimer = null, isFocused = false;

    function setPlaceholder(text) {
      if (desktopInput) desktopInput.setAttribute('placeholder', text);
      if (mobileInput) mobileInput.setAttribute('placeholder', text);
    }
    function clearTimers() { if (typingTimer) { clearInterval(typingTimer); typingTimer = null; } if (cycleTimer) { clearTimeout(cycleTimer); cycleTimer = null; } }
    function typeText(text, done) {
      clearTimers();
      var i = 0;
      setPlaceholder('');
      typingTimer = setInterval(function () {
        if (isFocused) { clearTimers(); setPlaceholder(basePlaceholder); return; }
        i++;
        setPlaceholder(text.slice(0, i));
        if (i >= text.length) {
          clearInterval(typingTimer); typingTimer = null;
          cycleTimer = setTimeout(function () { if (typeof done === 'function') done(); }, 9900);
        }
      }, 55);
    }
    function startCycle() {
      if (isFocused) { setPlaceholder(basePlaceholder); return; }
      var text = hints[currentIndex];
      currentIndex = (currentIndex + 1) % hints.length;
      typeText(text, startCycle);
    }
    function attachFocusHandlers(input) {
      if (!input) return;
      input.addEventListener('focus', function () { isFocused = true; clearTimers(); setPlaceholder(basePlaceholder); });
      input.addEventListener('blur', function () { isFocused = false; clearTimers(); cycleTimer = setTimeout(startCycle, 1500); });
    }
    attachFocusHandlers(desktopInput);
    attachFocusHandlers(mobileInput);
    setPlaceholder(basePlaceholder);
    setTimeout(startCycle, 1500);
  })();

  /* ----------------------------------------------------------------------------
     11. Simple Dropdowns Column Logic
     ---------------------------------------------------------------------------- */
  (function () {
    document.querySelectorAll('.caco-nav-item:not(.mega-menu) > .caco-dropdown').forEach(function (drop) {
      var simple = drop.querySelector('.caco-simple-dropdown');
      if (!simple) return;
      var list = simple.querySelector('.caco-simple-list');
      if (!list) return;
      if (list.querySelectorAll('.caco-simple-item').length > 4) {
        simple.classList.add('caco-simple-dropdown--three-cols');
        drop.classList.add('caco-dropdown--wide');
      }
    });
  })();

});
