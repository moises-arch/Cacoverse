if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.section;
      this.mainSwiper = null;
      this.thumbSwiper = null;
      this.currentColor = null;
    }

    connectedCallback() {
      this.initSwiper();
      this.bindEvents();
    }

    initSwiper() {
      if (!window.Swiper) {
        console.error('Swiper not loaded');
        // Retry if Swiper is lazy loaded
        setTimeout(() => this.initSwiper(), 100);
        return;
      }

      // Initialize Thumbnails first
      const thumbsParams = {
        spaceBetween: 10,
        slidesPerView: 4,
        freeMode: true,
        watchSlidesProgress: true,
        observer: true,
        observeParents: true,
        breakpoints: {
          320: { slidesPerView: 3 },
          768: { slidesPerView: 5 },
          1024: { slidesPerView: 6 }
        }
      };

      this.thumbSwiper = new Swiper(`.thumbs-swiper-${this.sectionId}`, thumbsParams);

      // Initialize Main Swiper
      const mainParams = {
        spaceBetween: 0,
        navigation: {
          nextEl: `.swiper-button-next-${this.sectionId}`,
          prevEl: `.swiper-button-prev-${this.sectionId}`,
        },
        thumbs: {
          swiper: this.thumbSwiper,
        },
        observer: true,
        observeParents: true,
        autoHeight: true, // Crucial for responsive height adaptation
      };

      this.mainSwiper = new Swiper(`.main-swiper-${this.sectionId}`, mainParams);

      // Ensure visibility on load
      this.mainSwiper.update();
    }

    bindEvents() {
      // Listen for standard Shopify variant changes
      document.addEventListener('variant:change', (e) => {
        if (e.detail && e.detail.variant) {
          this.onVariantChange(e.detail.variant);
        }
      });

      // Manual input changes (fallback)
      document.body.addEventListener('change', (e) => {
        if (e.target.matches('input[type="radio"][name*="Option"], input[type="radio"][name*="Color"], input[type="radio"][name*="color"], .swatch-input__input')) {
          this.filterSlides(e.target.value);
        }
      });

      // Fixed Thumbnail click handling
      this.addEventListener('click', (e) => {
        const thumbSlide = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumbSlide && this.mainSwiper) {
          const mediaId = thumbSlide.dataset.mediaId;
          const allSlides = Array.from(this.querySelectorAll('.gallery-main .swiper-slide'));

          // Find the index of the slide that is NOT hidden by display: none
          const targetSlide = this.querySelector(`.gallery-main .swiper-slide[data-media-id="${mediaId}"]`);
          if (targetSlide) {
            const visibleSlides = allSlides.filter(s => s.style.display !== 'none');
            const targetIndex = visibleSlides.indexOf(targetSlide);
            if (targetIndex !== -1) {
              this.mainSwiper.slideTo(targetIndex);
            }
          }
        }
      });
    }

    onVariantChange(variant) {
      if (!variant) return;

      let color = null;
      // 1. Try to get color from selected swatch in DOM
      const activeSwatch = document.querySelector('.swatch-input__input:checked');
      if (activeSwatch) {
        color = activeSwatch.value;
      }

      // 2. Fallback to featured media alt if available
      if (!color && variant.featured_media && variant.featured_media.alt) {
        color = variant.featured_media.alt;
      }

      if (color) {
        this.filterSlides(color);
      } else if (variant.featured_media) {
        this.slideToMedia(variant.featured_media.id);
      }
    }

    slideToMedia(mediaId) {
      if (!this.mainSwiper || !mediaId) return;
      const visibleSlides = Array.from(this.querySelectorAll('.gallery-main .swiper-slide')).filter(s => s.style.display !== 'none');
      const targetIndex = visibleSlides.findIndex(s => s.dataset.mediaId == mediaId);
      if (targetIndex !== -1) {
        this.mainSwiper.slideTo(targetIndex);
      }
    }

    filterSlides(color) {
      if (!this.mainSwiper || !this.thumbSwiper || !color) return;

      const normalizedColor = color.toLowerCase().trim().replace(/\s+/g, '-');
      if (this.currentColor === normalizedColor) return;
      this.currentColor = normalizedColor;

      console.log('Media Gallery: Filtering by', normalizedColor);

      const slides = this.querySelectorAll('.gallery-main .swiper-slide');
      const thumbSlides = this.querySelectorAll('.gallery-thumbs .swiper-slide');

      // Filter Main Slides
      slides.forEach(slide => {
        const slideColors = (slide.dataset.color || '').split(',');
        const isMatch = slideColors.some(c => c === 'all' || c === 'all-show' || c === normalizedColor);
        slide.style.display = isMatch ? 'flex' : 'none';
      });

      // Filter Thumbnails
      thumbSlides.forEach(slide => {
        const slideColors = (slide.dataset.color || '').split(',');
        const isMatch = slideColors.some(c => c === 'all' || c === 'all-show' || c === normalizedColor);
        slide.style.display = isMatch ? 'block' : 'none';
      });

      // Re-update Swiper structures
      this.mainSwiper.update();
      this.thumbSwiper.update();

      // Go to first image of variant
      setTimeout(() => {
        this.mainSwiper.slideTo(0);
      }, 50);
    }
  });
}
