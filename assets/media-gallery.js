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
        freeMode: true,
        watchSlidesProgress: true,
        observer: true,
        observeParents: true,
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
        },
        navigation: {
          nextEl: `.swiper-button-next-${this.sectionId}`,
          prevEl: `.swiper-button-prev-${this.sectionId}`,
        },
        thumbs: {
          swiper: this.thumbSwiper,
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

      // Main image click for Lightbox
      this.querySelector('.gallery-main').addEventListener('click', (e) => {
        const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
        const img = activeSlide.querySelector('img');
        if (img && img.dataset.zoomUrl) {
          this.openLightbox(img.dataset.zoomUrl);
        }
      });

      // Thumbnail click sync
      this.addEventListener('click', (e) => {
        const thumb = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumb) this.slideToMedia(thumb.dataset.mediaId);
      });
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

      const filterLogic = (item) => {
        const itemMediaId = item.dataset.mediaId;
        const itemTags = (item.dataset.color || '').split(',').map(t => t.trim()).filter(t => t);

        const isFeatured = featuredMediaId && itemMediaId == featuredMediaId;
        const isAll = itemTags.includes('all') || itemTags.includes('all-show');
        const matchesAny = activeTokens.some(token => itemTags.includes(token));
        const hasMismatch = itemTags.some(tag => allPossibleValues.includes(tag) && !activeTokens.includes(tag));

        const isMatch = isFeatured || isAll || (matchesAny && !hasMismatch);
        item.style.display = isMatch ? 'flex' : 'none';
        item.style.height = isMatch ? '' : '0px';
        return isMatch;
      };

      mainSlides.forEach(filterLogic);
      thumbSlides.forEach(filterLogic);

      if (this.mainSwiper) this.mainSwiper.update();
      if (this.thumbSwiper) this.thumbSwiper.update();

      setTimeout(() => {
        if (featuredMediaId) this.slideToMedia(featuredMediaId);
        else {
          const first = mainSlides.find(s => s.style.display !== 'none');
          if (first) this.slideToMedia(first.dataset.mediaId);
        }
      }, 100);
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
      const lbImg = document.querySelector('.lightbox-image');
      if (lbImg) {
        lbImg.style.transform = `translate(${this.translateX}px, ${this.translateY}px) scale(${this.zoomLevel})`;
      }
    }
  });
}
