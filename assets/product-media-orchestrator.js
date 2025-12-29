(() => {
  class MediaPubSub {
    constructor() {
      this.topics = new Map();
    }

    subscribe(topic, callback) {
      if (!this.topics.has(topic)) {
        this.topics.set(topic, new Set());
      }
      this.topics.get(topic).add(callback);
      return () => this.topics.get(topic)?.delete(callback);
    }

    publish(topic, payload) {
      const listeners = this.topics.get(topic);
      if (!listeners || !listeners.size) return;
      listeners.forEach((listener) => {
        try {
          listener(payload);
        } catch (error) {
          console.error('[media-bus] subscriber failure', error);
        }
      });
    }
  }

  const bus = (() => {
    const shared = window.__cacoMediaBus || new MediaPubSub();
    window.__cacoMediaBus = shared;
    return shared;
  })();

  const idle = window.requestIdleCallback || ((cb) => window.setTimeout(cb, 1));

  const FOCUSABLE = [
    'a[href]',
    'area[href]',
    'button:not([disabled])',
    'input:not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    '[tabindex]:not([tabindex="-1"])',
  ].join(',');

  const parseIndex = (value, fallback = 0) => {
    const parsed = Number.parseInt(value, 10);
    return Number.isFinite(parsed) ? parsed : fallback;
  };

  const buildSrcset = (img) => {
    const template = img.dataset.srcTemplate;
    const widths = (img.dataset.srcWidths || '')
      .split(',')
      .map((value) => Number.parseInt(value, 10))
      .filter(Boolean);
    if (!template || !widths.length) return '';

    return widths.map((width) => `${template.replace('{width}', width)} ${width}w`).join(', ');
  };

  const applyContrastToSwatches = (sectionId) => {
    const root = document.getElementById(`shopify-section-${sectionId}`);
    if (!root) return;
    const labels = root.querySelectorAll('.product-form__input--swatch .swatch-input__label');
    const rgbToLuminance = (rgbString) => {
      const parts = (rgbString.match(/[\d.]+/g) || [])
        .slice(0, 3)
        .map((value) => Number.parseFloat(value))
        .filter((value) => !Number.isNaN(value));
      if (parts.length < 3) return 1;
      const [r, g, b] = parts;
      const channel = (v) => {
        const c = v / 255;
        return c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4);
      };
      return 0.2126 * channel(r) + 0.7152 * channel(g) + 0.0722 * channel(b);
    };

    labels.forEach((label) => {
      const swatch = label.querySelector('.swatch');
      if (!swatch) return;
      const background = window.getComputedStyle(swatch).getPropertyValue('background-color');
      const luminance = rgbToLuminance(background);
      const textColor = luminance > 0.55 ? '#0f172a' : '#f8fafc';
      label.style.setProperty('--swatch-text-color', textColor);
    });
  };

  const hydrateLooseGalleries = () => {
    document.querySelectorAll('[data-media-gallery]').forEach((gallery) => {
      if (gallery.closest('caco-product-media')) return;
      gallery.querySelectorAll('[data-src-template]').forEach((img) => {
        if (img.dataset.hydratedStandalone === 'true') return;
        const srcset = buildSrcset(img);
        if (srcset) img.srcset = srcset;
        if (img.dataset.sizes) img.sizes = img.dataset.sizes;
        if (img.dataset.lowSrc) img.src = img.dataset.lowSrc;
        img.dataset.hydratedStandalone = 'true';
      });
    });
  };

  const bootstrapLooseGalleries = () => {
    if (document.readyState === 'loading') {
      document.addEventListener('DOMContentLoaded', hydrateLooseGalleries, { once: true });
    } else {
      hydrateLooseGalleries();
    }
    document.addEventListener('shopify:section:load', hydrateLooseGalleries);
  };

  class CacoProductMedia extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.sectionId;
      this.gallery = this.querySelector('[data-media-gallery]');
      this.intersectionObserver = null;
      this.subscriptions = [];
      this.handleVariantChange = this.handleVariantChange.bind(this);
      this.handleLightboxTrigger = this.handleLightboxTrigger.bind(this);
      this.preventNativeModal = this.preventNativeModal.bind(this);
    }

    connectedCallback() {
      if (!this.gallery) return;
      this.attachEventDelegates();
      this.observeMedia();
      this.registerMedia();
      this.subscriptions.push(
        bus.subscribe('media:refresh', ({ sectionId }) => {
          if (!sectionId || sectionId === this.sectionId) {
            this.registerMedia();
          }
        })
      );
      document.addEventListener('variant:change', this.handleVariantChange);
      document.addEventListener('variant:changed', this.handleVariantChange);
      document.addEventListener('product:variant-change', this.handleVariantChange);
      document.addEventListener('shopify:section:load', this.handleVariantChange);
      applyContrastToSwatches(this.sectionId);
    }

    disconnectedCallback() {
      this.intersectionObserver?.disconnect();
      this.subscriptions.forEach((unsubscribe) => unsubscribe());
      document.removeEventListener('variant:change', this.handleVariantChange);
      document.removeEventListener('variant:changed', this.handleVariantChange);
      document.removeEventListener('product:variant-change', this.handleVariantChange);
      document.removeEventListener('shopify:section:load', this.handleVariantChange);
      this.removeEventListener('click', this.preventNativeModal, true);
    }

    attachEventDelegates() {
      this.addEventListener('click', this.preventNativeModal, { capture: true });
      this.gallery.addEventListener('click', this.handleLightboxTrigger);
      this.gallery.addEventListener('keydown', (event) => {
        if (event.key !== 'Enter' && event.key !== ' ') return;
        const trigger = event.target.closest('[data-lightbox-index]');
        if (!trigger) return;
        event.preventDefault();
        this.openFromTrigger(trigger);
      });
    }

    preventNativeModal(event) {
      const blocker = event.target.closest(
        '.product__modal-opener, .product__media-toggle, [data-media-modal-opener]'
      );
      if (!blocker) return;
      event.preventDefault();
      event.stopImmediatePropagation();
    }

    handleLightboxTrigger(event) {
      const trigger = event.target.closest('[data-lightbox-index]');
      if (!trigger) return;
      event.preventDefault();
      this.openFromTrigger(trigger);
    }

    openFromTrigger(trigger) {
      const index = parseIndex(trigger.getAttribute('data-lightbox-index'));
      bus.publish('lightbox:open', { sectionId: this.sectionId, index });
    }

    observeMedia() {
      if (this.intersectionObserver) {
        this.intersectionObserver.disconnect();
      }
      const options = { root: null, rootMargin: '300px', threshold: 0.05 };
      this.intersectionObserver = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
          const img = entry.target;
          if (!entry.isIntersecting && img.dataset.loadingBehavior !== 'eager') return;
          this.hydrateImage(img);
          this.intersectionObserver.unobserve(img);
        });
      }, options);

      this.querySelectorAll('[data-src-template]').forEach((img) => {
        if (img.dataset.loadingBehavior === 'eager') {
          this.hydrateImage(img);
          return;
        }
        this.intersectionObserver.observe(img);
      });
    }

    hydrateImage(img) {
      const srcset = buildSrcset(img);
      if (srcset) {
        img.srcset = srcset;
      }
      if (img.dataset.sizes) {
        img.sizes = img.dataset.sizes;
      }
      if (img.dataset.lowSrc) {
        img.src = img.dataset.lowSrc;
      }
      if (img.dataset.fetchpriority && !img.getAttribute('fetchpriority')) {
        img.setAttribute('fetchpriority', img.dataset.fetchpriority);
      }
      img.loading = img.dataset.loadingBehavior || 'lazy';
      img.decoding = img.decoding || 'async';
      img.removeAttribute('data-lazy');
      bus.publish('media:image-hydrated', { sectionId: this.sectionId, id: img.dataset.mediaId });
    }

    registerMedia() {
      idle(() => {
        const slides = Array.from(this.gallery.querySelectorAll('.product__media-item'));
        const items = slides
          .map((slide, fallbackIndex) => {
            const source = slide.querySelector('[data-lightbox-source]') || slide.querySelector('img');
            if (!source) return null;
            const index = parseIndex(slide.dataset.mediaIndex, fallbackIndex);
            const full = source.dataset.full || source.currentSrc || source.src;
            const thumb = source.dataset.lowSrc || source.currentSrc || source.src;
            return {
              id: slide.dataset.mediaId || source.dataset.mediaId || `${this.sectionId}-${index}`,
              src: thumb,
              full,
              alt: source.getAttribute('alt') || source.dataset.alt || this.dataset.productTitle || '',
              index,
            };
          })
          .filter(Boolean)
          .sort((a, b) => a.index - b.index);

        if (!items.length) return;
        bus.publish('media:register', { sectionId: this.sectionId, items });
      });
    }

    handleVariantChange() {
      this.observeMedia();
      this.registerMedia();
      applyContrastToSwatches(this.sectionId);
    }
  }

  class CacoMediaLightbox extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.sectionId;
      this.items = [];
      this.currentIndex = 0;
      this.lastFocus = null;
      this.zoom = 1;
      this.maxZoom = 4;
      this.panX = 0;
      this.panY = 0;
      this.dragState = null;
      this.subscriptions = [];
      this.boundKeydown = this.handleKeydown.bind(this);
    }

    connectedCallback() {
      this.cacheElements();
      this.bindEvents();
      this.subscriptions.push(
        bus.subscribe('media:register', ({ sectionId, items }) => {
          if (!sectionId || sectionId !== this.sectionId) return;
          this.items = items;
          this.updateCounters();
        })
      );
      this.subscriptions.push(
        bus.subscribe('lightbox:open', ({ sectionId, index = 0 }) => {
          if (!sectionId || sectionId !== this.sectionId) return;
          this.open(index);
        })
      );
      if (!this.sectionId) {
        this.sectionId = this.dataset.sectionId || this.getAttribute('data-section-id');
      }
    }

    disconnectedCallback() {
      this.subscriptions.forEach((unsubscribe) => unsubscribe());
      document.removeEventListener('keydown', this.boundKeydown);
    }

    cacheElements() {
      this.backdrop = this.querySelector('[data-lightbox-backdrop]');
      this.closeBtn = this.querySelector('[data-lightbox-close]');
      this.nextBtn = this.querySelector('[data-lightbox-next]');
      this.prevBtn = this.querySelector('[data-lightbox-prev]');
      this.preview = this.querySelector('[data-lightbox-image]');
      this.caption = this.querySelector('[data-lightbox-caption]');
      this.progress = this.querySelector('[data-lightbox-progress]');
      this.counterCurrent = this.querySelector('[data-lightbox-current]');
      this.counterTotal = this.querySelector('[data-lightbox-total]');
      this.frame = this.querySelector('[data-lightbox-frame]');
      this.zoomInBtn = this.querySelector('[data-zoom-in]');
      this.zoomOutBtn = this.querySelector('[data-zoom-out]');
      this.zoomResetBtn = this.querySelector('[data-zoom-reset]');
    }

    bindEvents() {
      this.closeBtn?.addEventListener('click', () => this.close());
      this.backdrop?.addEventListener('click', () => this.close());
      this.nextBtn?.addEventListener('click', () => this.goTo(this.currentIndex + 1));
      this.prevBtn?.addEventListener('click', () => this.goTo(this.currentIndex - 1));
      this.zoomInBtn?.addEventListener('click', () => this.setZoom(this.zoom + 0.25));
      this.zoomOutBtn?.addEventListener('click', () => this.setZoom(this.zoom - 0.25));
      this.zoomResetBtn?.addEventListener('click', () => this.resetZoom());
      this.preview?.addEventListener('wheel', (event) => this.handleWheel(event), { passive: false });
      this.preview?.addEventListener('pointerdown', (event) => this.startDrag(event));
      this.preview?.addEventListener('pointermove', (event) => this.handleDrag(event));
      this.preview?.addEventListener('pointerup', (event) => this.endDrag(event));
      this.preview?.addEventListener('pointercancel', (event) => this.endDrag(event));
    }

    open(index = 0) {
      if (!this.items.length) {
        this.items = this.collectFromDom();
      }
      if (!this.items.length) return;

      this.currentIndex = Math.max(0, Math.min(index, this.items.length - 1));
      this.lastFocus = document.activeElement;
      this.setAttribute('data-open', 'true');
      this.removeAttribute('hidden');
      this.classList.add('is-visible');
      document.body.classList.add('apple-lock-scroll');
      this.updateImage(this.currentIndex);
      this.updateCounters();
      this.focusFirstControl();
      document.addEventListener('keydown', this.boundKeydown);
    }

    close() {
      this.setAttribute('hidden', 'hidden');
      this.removeAttribute('data-open');
      this.classList.remove('is-visible');
      document.body.classList.remove('apple-lock-scroll');
      this.resetZoom();
      document.removeEventListener('keydown', this.boundKeydown);
      if (this.lastFocus && typeof this.lastFocus.focus === 'function') {
        this.lastFocus.focus({ preventScroll: true });
      }
    }

    handleKeydown(event) {
      if (this.hasAttribute('hidden')) return;
      if (event.key === 'Escape') {
        this.close();
        return;
      }
      if (event.key === 'ArrowRight') {
        this.goTo(this.currentIndex + 1);
        return;
      }
      if (event.key === 'ArrowLeft') {
        this.goTo(this.currentIndex - 1);
        return;
      }
      if (event.key === 'Tab') {
        this.trapFocus(event);
      }
    }

    focusableElements() {
      return Array.from(this.querySelectorAll(FOCUSABLE)).filter(
        (el) => !el.hasAttribute('disabled') && !el.hasAttribute('hidden')
      );
    }

    focusFirstControl() {
      const focusables = this.focusableElements();
      const target = focusables[0] || this.closeBtn;
      target?.focus({ preventScroll: true });
    }

    trapFocus(event) {
      const focusables = this.focusableElements();
      if (!focusables.length) return;
      const first = focusables[0];
      const last = focusables[focusables.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus({ preventScroll: true });
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus({ preventScroll: true });
      }
    }

    goTo(nextIndex) {
      if (!this.items.length) return;
      const total = this.items.length;
      this.currentIndex = (nextIndex + total) % total;
      this.updateImage(this.currentIndex);
      this.updateCounters();
    }

    updateCounters() {
      if (this.counterCurrent) {
        this.counterCurrent.textContent = this.currentIndex + 1;
      }
      if (this.counterTotal) {
        this.counterTotal.textContent = this.items.length || 0;
      }
      if (this.progress) {
        const percent = ((this.currentIndex + 1) / Math.max(1, this.items.length)) * 100;
        this.progress.style.width = `${percent}%`;
      }
    }

    updateImage(index) {
      const item = this.items[index];
      if (!item || !this.preview) return;
      const nextSrc = item.full || item.src;
      if (nextSrc) {
        this.preview.src = nextSrc;
      }
      this.preview.alt = item.alt || this.getAttribute('aria-label') || '';
      this.preview.onload = () => {
        this.maxZoom = Math.max(
          1,
          Math.min(
            4,
            (this.preview.naturalWidth || 1) / Math.max(1, this.frame?.clientWidth || this.preview.clientWidth || 1)
          )
        );
        this.resetZoom();
      };
      if (this.caption) {
        this.caption.textContent = item.alt || '';
      }
    }

    setZoom(nextZoom) {
      const clamped = Math.max(1, Math.min(this.maxZoom, nextZoom));
      if (clamped === this.zoom) return;
      this.zoom = clamped;
      this.applyTransform();
      if (this.zoomResetBtn) {
        this.zoomResetBtn.toggleAttribute('hidden', this.zoom <= 1.01);
      }
    }

    resetZoom() {
      this.zoom = 1;
      this.panX = 0;
      this.panY = 0;
      this.applyTransform();
      if (this.zoomResetBtn) {
        this.zoomResetBtn.setAttribute('hidden', 'hidden');
      }
    }

    applyTransform() {
      if (!this.preview) return;
      window.requestAnimationFrame(() => {
        this.preview.style.transform = `translate(${this.panX}px, ${this.panY}px) scale(${this.zoom})`;
        this.classList.toggle('apple-lightbox--zoomed', this.zoom > 1.01);
      });
    }

    handleWheel(event) {
      event.preventDefault();
      const delta = event.deltaY > 0 ? -0.2 : 0.2;
      this.setZoom(this.zoom + delta);
    }

    startDrag(event) {
      if (this.zoom <= 1) return;
      this.dragState = {
        x: event.clientX,
        y: event.clientY,
        panX: this.panX,
        panY: this.panY,
      };
      this.preview?.setPointerCapture(event.pointerId);
    }

    handleDrag(event) {
      if (!this.dragState) return;
      event.preventDefault();
      this.panX = this.dragState.panX + (event.clientX - this.dragState.x);
      this.panY = this.dragState.panY + (event.clientY - this.dragState.y);
      this.applyTransform();
    }

    endDrag(event) {
      if (!this.dragState) return;
      this.dragState = null;
      this.preview?.releasePointerCapture(event.pointerId);
    }

    collectFromDom() {
      const host = this.closest('caco-product-media') || document;
      const slides = host.querySelectorAll('.product__media-item');
      return Array.from(slides).map((slide, index) => {
        const source = slide.querySelector('[data-lightbox-source], img');
        return {
          id: slide.dataset.mediaId || `${this.sectionId || 'section'}-${index}`,
          src: source?.dataset.lowSrc || source?.currentSrc || source?.src || '',
          full: source?.dataset.full || source?.currentSrc || source?.src || '',
          alt: source?.getAttribute('alt') || '',
          index,
        };
      });
    }
  }

  bootstrapLooseGalleries();

  if (!customElements.get('caco-product-media')) {
    customElements.define('caco-product-media', CacoProductMedia);
  }
  if (!customElements.get('caco-media-lightbox')) {
    customElements.define('caco-media-lightbox', CacoMediaLightbox);
  }
})();
