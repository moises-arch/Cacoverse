if (!customElements.get('media-gallery')) {
  customElements.define('media-gallery', class MediaGallery extends HTMLElement {
    constructor() {
      super();
      this.sectionId = this.dataset.section;
      this.mainSwiper = null;
      this.thumbSwiper = null;
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

      // Catch any input change in the product form
      document.body.addEventListener('change', (e) => {
        if (e.target.closest('product-info') || e.target.closest('.product-form') || e.target.closest('[id^="product-form"]')) {
          // If a variation option changed, we find the new variant object if possible 
          // or just filter based on all current selections.
          this.filterByCurrentSelections();
        }
      });

      // Fixed Thumbnail click handling
      this.addEventListener('click', (e) => {
        const thumbSlide = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumbSlide && this.mainSwiper) {
          const mediaId = thumbSlide.dataset.mediaId;
          this.slideToMedia(mediaId);
        }
      });
    }

    onVariantChange(variant) {
      if (!variant) return;
      this.filterSlides(variant);
    }

    filterByCurrentSelections() {
      // Filter based on currently checked inputs in the DOM
      const checkedInputs = Array.from(document.querySelectorAll('input[type="radio"]:checked, select'));
      const tokens = checkedInputs.map(i => i.value.toLowerCase().trim().replace(/\s+/g, '-')).filter(t => t !== '');
      this.filterSlides(null, tokens);
    }

    slideToMedia(mediaId) {
      if (!this.mainSwiper || !mediaId) return;
      const allSlides = Array.from(this.querySelectorAll('.gallery-main .swiper-slide'));
      const targetSlide = this.querySelector(`.gallery-main .swiper-slide[data-media-id="${mediaId}"]`);

      if (targetSlide) {
        // Slide works on the index within the current Swiper instance (which includes hidden slides)
        // but Swiper handles display:none slides usually by skipping them if reached via navigation.
        // For direct slideTo, we need the index relative to all slides.
        const index = allSlides.indexOf(targetSlide);
        if (index !== -1) {
          this.mainSwiper.slideTo(index);
        }
      }
    }

    filterSlides(variant, manualTokens = null) {
      if (!this.mainSwiper || !this.thumbSwiper) return;

      let activeTokens = [];
      if (variant && variant.options) {
        activeTokens = variant.options.map(opt => opt.toLowerCase().trim().replace(/\s+/g, '-'));
      } else if (manualTokens) {
        activeTokens = manualTokens;
      }

      if (activeTokens.length === 0) return;

      const slides = this.querySelectorAll('.gallery-main .swiper-slide');
      const thumbSlides = this.querySelectorAll('.gallery-thumbs .swiper-slide');

      const featuredMediaId = variant ? variant.featured_media?.id : null;

      // Filter Logic:
      // A slide matches if it has 'all', 'all-show', OR if it contains ANY of the active tokens.
      // Additionally, the variant's featured_media MUST always be shown.
      slides.forEach(slide => {
        const slideMediaId = slide.dataset.mediaId;
        const slideColors = (slide.dataset.color || '').split(',');

        const isFeatured = featuredMediaId && slideMediaId == featuredMediaId;
        const isMatch = isFeatured || slideColors.some(c => c === 'all' || c === 'all-show' || activeTokens.includes(c));

        slide.style.display = isMatch ? 'flex' : 'none';
      });

      thumbSlides.forEach(slide => {
        const slideMediaId = slide.dataset.mediaId;
        const slideColors = (slide.dataset.color || '').split(',');

        const isFeatured = featuredMediaId && slideMediaId == featuredMediaId;
        const isMatch = isFeatured || slideColors.some(c => c === 'all' || c === 'all-show' || activeTokens.includes(c));
        slide.style.display = isMatch ? 'block' : 'none';
      });

      // Swiper Update
      this.mainSwiper.update();
      this.thumbSwiper.update();

      // Priority: Slide to Featured Media if it exists, otherwise first visible
      if (featuredMediaId) {
        setTimeout(() => this.slideToMedia(featuredMediaId), 10);
      } else {
        setTimeout(() => {
          const firstVisible = Array.from(slides).find(s => s.style.display !== 'none');
          if (firstVisible) {
            this.slideToMedia(firstVisible.dataset.mediaId);
          }
        }, 50);
      }
    }
  });
}
