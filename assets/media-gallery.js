if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.section;
      this.mainSwiper = null;
      this.thumbSwiper = null;
      this.zoomLevel = 1;
      this.isDragging = false;
      this.startX = 0;
      this.startY = 0;
      this.translateX = 0;
      this.translateY = 0;
    }

    connectedCallback() {
      this.init();
    }

    async init() {
      await this.waitForSwiper();
      this.initSwiper();
      this.initLightbox();
      this.bindEvents();

      // Force initial filter
      setTimeout(() => this.filterByCurrentSelections(), 300);
    }

    waitForSwiper() {
      return new Promise(resolve => {
        const check = () => {
          if (window.Swiper) resolve();
          else setTimeout(check, 100);
        };
        check();
      });
    }

    initSwiper() {
      this.thumbSwiper = new Swiper(`.thumbs-swiper-${this.sectionId}`, {
        spaceBetween: 12,
        slidesPerView: 'auto',
        freeMode: {
          enabled: true,
          sticky: false
        },
        watchSlidesProgress: true,
        watchOverflow: true,
        observer: true,
        observeParents: true,
        navigation: {
          nextEl: `.thumb-next-${this.sectionId}`,
          prevEl: `.thumb-prev-${this.sectionId}`,
        },
      });

      this.mainSwiper = new Swiper(`.main-swiper-${this.sectionId}`, {
        spaceBetween: 0,
        autoHeight: true,
        observer: true,
        observeParents: true,
        threshold: 5,
        pagination: {
          el: `.swiper-pagination-${this.sectionId}`,
          clickable: true,
          dynamicBullets: true,
        },
        navigation: {
          nextEl: `.swiper-button-next-${this.sectionId}`,
          prevEl: `.swiper-button-prev-${this.sectionId}`,
        },
        on: {
          slideChange: () => this.syncThumbnails()
        }
      });
    }

    syncThumbnails() {
      if (!this.mainSwiper || !this.thumbSwiper) return;
      const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
      if (!activeSlide) return;

      const mediaId = activeSlide.dataset.mediaId;
      const thumbSlides = Array.from(this.thumbSwiper.slides);

      thumbSlides.forEach(thumb => {
        if (thumb.dataset.mediaId == mediaId) {
          thumb.classList.add('swiper-slide-thumb-active');
          const index = thumbSlides.indexOf(thumb);
          this.thumbSwiper.slideTo(index);
        } else {
          thumb.classList.remove('swiper-slide-thumb-active');
        }
      });
    }

    bindEvents() {
      // Variant changes
      document.addEventListener('variant:change', (e) => {
        if (e.detail?.variant) this.filterSlides(e.detail.variant);
      });

      // Manual option changes
      document.body.addEventListener('change', (e) => {
        if (e.target.closest('product-info') || e.target.closest('.product-form')) {
          this.filterByCurrentSelections();
        }
      });

      // Keyboard Navigation
      this.handleKeyDown = (e) => {
        if (['INPUT', 'TEXTAREA', 'SELECT'].includes(document.activeElement.tagName)) return;
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          if (this.mainSwiper) this.mainSwiper.slidePrev();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          if (this.mainSwiper) this.mainSwiper.slideNext();
        } else if (e.key === 'Escape') {
          this.closeLightbox();
        }
      };
      document.addEventListener('keydown', this.handleKeyDown);

      // Main image click for Lightbox (checks if not swiping)
      this.querySelector('.gallery-main').addEventListener('click', (e) => {
        const swiper = this.mainSwiper;
        if (!swiper || (swiper.touches && Math.abs(swiper.touches.diff) > 5)) return;

        const img = e.target.closest('.swiper-slide img');
        if (img && img.dataset.zoomUrl) {
          this.openLightbox(img.dataset.zoomUrl);
        }
      });

      // Thumbnail click sync
      this.addEventListener('click', (e) => {
        const thumb = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumb) {
          e.stopPropagation();
          this.slideToMedia(thumb.dataset.mediaId);
        }
      });
    }

    disconnectedCallback() {
      if (this.handleKeyDown) {
        document.removeEventListener('keydown', this.handleKeyDown);
      }
    }

    filterByCurrentSelections() {
      const productInfo = document.querySelector('product-info') || document.querySelector('.product-form');
      if (!productInfo) return;

      const checkedInputs = Array.from(productInfo.querySelectorAll('input[type="radio"]:checked, select'));
      const activeTokens = checkedInputs.map(input =>
        input.value.toLowerCase().trim().replace(/\s+/g, '-')
      ).filter(t => t !== '');

      this.filterSlides(null, activeTokens);
    }

    filterSlides(variant, manualTokens = null) {
      const productInfo = document.querySelector('product-info') || document.querySelector('.product-form');
      if (!productInfo) return;

      const allPossibleValues = Array.from(productInfo.querySelectorAll('input[type="radio"], select option'))
        .map(el => (el.value || el.textContent || '').toLowerCase().trim().replace(/\s+/g, '-'))
        .filter(t => t && t !== 'all');

      let activeTokens = manualTokens || (variant?.options ? variant.options.map(o => o.toLowerCase().trim().replace(/\s+/g, '-')) : []);

      const featuredMediaId = variant?.featured_media?.id;
      const mainSlides = Array.from(this.querySelectorAll('.gallery-main .swiper-slide'));
      const thumbSlides = Array.from(this.querySelectorAll('.gallery-thumbs .swiper-slide'));

      // Check if this product actually uses the Alt-Text filtering system
      // We look for at least ONE image that has a tag matching a real variant option
      const productUsesFiltering = mainSlides.some(slide => {
        const itemTags = (slide.dataset.color || '').toLowerCase().split(',').map(t => t.trim());
        return itemTags.some(tag => allPossibleValues.includes(tag));
      });

      const currentVariantId = String(variant?.id || this.dataset.selectedVariantId || '');

      const filterLogic = (item) => {
        // If the product doesn't use the filtering system at all, everything stays visible
        if (!productUsesFiltering) {
          item.style.display = 'flex';
          item.style.height = '';
          return true;
        }

        const itemMediaId = String(item.dataset.mediaId || '');
        const itemVariantIds = (item.dataset.variants || '').split(',').map(v => v.trim()).filter(v => v);
        const rawColorTags = (item.dataset.color || '').toLowerCase();
        const itemTags = rawColorTags.split(',').map(t => t.trim()).filter(t => t);

        const isFeatured = featuredMediaId && String(itemMediaId) === String(featuredMediaId);
        const isAll = itemTags.some(tag => tag === 'all' || tag === 'all-show');

        // SKU IMAGE PROTECTION:
        // If the image is explicitly assigned to OTHER variants, and not the current one, hide it.
        const isAssignedToOtherVariant = itemVariantIds.length > 0 && !itemVariantIds.includes(currentVariantId);

        // Matches current selected alt-text tokens (e.g. blue, 10-pack)
        const matchesAnyAlt = activeTokens.some(token => itemTags.includes(token));

        // Category collision check (logic to hide 'Red' when 'Blue' is selected)
        const hasAltMismatch = itemTags.some(tag => allPossibleValues.includes(tag) && !activeTokens.includes(tag));

        // FINAL MATCH CONDITION:
        // Priority 1: Featured SKU Image always shows.
        // Priority 2: Generic All-Show content always shows.
        // Priority 3: Hide if assigned specifically to a different SKU.
        // Priority 4: Show if matches current selections AND has no tag category conflicts.
        const isMatch = isFeatured || isAll || (!isAssignedToOtherVariant && (matchesAnyAlt && !hasAltMismatch));

        item.style.display = isMatch ? 'flex' : 'none';
        item.style.height = isMatch ? '' : '0px';
        return isMatch;
      };

      mainSlides.forEach(filterLogic);
      thumbSlides.forEach(filterLogic);

      const mainWrapper = this.querySelector('.gallery-main .swiper-wrapper');
      const thumbWrapper = this.querySelector('.gallery-thumbs .swiper-wrapper');

      const sortSlides = (slides, wrapper) => {
        if (!wrapper) return;

        const visible = slides.filter(s => s.style.display !== 'none');
        const hidden = slides.filter(s => s.style.display === 'none');

        const featured = [];
        const specific = [];
        const generic = [];

        visible.forEach(slide => {
          const tags = (slide.dataset.color || '').toLowerCase().split(',').map(t => t.trim());
          const isAll = tags.some(tag => tag === 'all' || tag === 'all-show');
          const isFeaturedId = featuredMediaId && String(slide.dataset.mediaId) === String(featuredMediaId);

          if (isFeaturedId) {
            featured.push(slide);
          } else if (isAll) {
            generic.push(slide);
          } else {
            specific.push(slide);
          }
        });

        const sortedVisible = [...featured, ...specific, ...generic];
        const fragment = document.createDocumentFragment();
        sortedVisible.forEach(s => fragment.appendChild(s));
        hidden.forEach(s => fragment.appendChild(s));

        wrapper.innerHTML = '';
        wrapper.appendChild(fragment);
      };

      sortSlides(mainSlides, mainWrapper);
      sortSlides(thumbSlides, thumbWrapper);

      // Robust Swiper Update
      const updateSwipers = () => {
        [this.mainSwiper, this.thumbSwiper].forEach(swiper => {
          if (swiper) {
            swiper.update();
            if (swiper.updateSlides) swiper.updateSlides();
            if (swiper.updateSize) swiper.updateSize();
            if (swiper.updateProgress) swiper.updateProgress();

            // Recalculate snap points and bounds
            if (swiper.scrollbar && swiper.scrollbar.updateSize) swiper.scrollbar.updateSize();

            swiper.slideTo(0, 0);
          }
        });

        // Final sync check
        setTimeout(() => this.syncThumbnails(), 50);
      };

      // Execute update after DOM settles
      setTimeout(updateSwipers, 150);
      setTimeout(updateSwipers, 400); // Second pass to handle lazy loads/reflows
    }

    slideToMedia(mediaId) {
      if (!this.mainSwiper || !mediaId) return;
      const target = Array.from(this.mainSwiper.slides).find(s => s.dataset.mediaId == mediaId);
      if (target) this.mainSwiper.slideTo(Array.from(this.mainSwiper.slides).indexOf(target));
    }

    initLightbox() {
      const lb = document.getElementById('GalleryLightbox');
      if (!lb) return;
      const lbImg = lb.querySelector('.lightbox-image');
      const close = lb.querySelector('.lightbox-close');
      const btnIn = lb.querySelector('.zoom-in');
      const btnOut = lb.querySelector('.zoom-out');

      close.onclick = () => {
        this.zoomLevel = 1;
        this.updateLightboxImage();
        lb.classList.remove('active');
        document.body.style.overflow = '';
      };

      btnIn.onclick = () => this.changeZoom(0.5);
      btnOut.onclick = () => this.changeZoom(-0.5);

      lb.onwheel = (e) => {
        e.preventDefault();
        this.changeZoom(e.deltaY > 0 ? -0.2 : 0.2);
      };

      // Drag to pan
      lbImg.onmousedown = (e) => {
        if (this.zoomLevel <= 1) return;
        this.isDragging = true;
        this.startX = e.clientX - this.translateX;
        this.startY = e.clientY - this.translateY;
      };

      window.onmousemove = (e) => {
        if (!this.isDragging) return;
        this.translateX = e.clientX - this.startX;
        this.translateY = e.clientY - this.startY;
        this.updateLightboxImage();
      };

      window.onmouseup = () => this.isDragging = false;
    }

    openLightbox(url) {
      const lb = document.getElementById('GalleryLightbox');
      if (!lb) return;
      const lbImg = lb.querySelector('.lightbox-image');
      lbImg.src = url;
      lb.classList.add('active');
      document.body.style.overflow = 'hidden';
      this.zoomLevel = 1;
      this.translateX = 0;
      this.translateY = 0;
      this.updateLightboxImage();
    }

    changeZoom(delta) {
      this.zoomLevel = Math.max(1, Math.min(4, this.zoomLevel + delta));
      if (this.zoomLevel === 1) {
        this.translateX = 0;
        this.translateY = 0;
      }
      this.updateLightboxImage();
    }

    updateLightboxImage() {
      const lb = document.getElementById('GalleryLightbox');
      if (!lb) return;
      const lbImg = lb.querySelector('.lightbox-image');
      if (lbImg) {
        lbImg.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoomLevel})`;
      }
    }
  });
}
