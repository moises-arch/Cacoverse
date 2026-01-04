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
      this.initZoom();
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

      // Also listen for manual input changes (fallback)
      document.body.addEventListener('change', (e) => {
        if (e.target.matches('input[type="radio"][name*="Option"], input[type="radio"][name*="Color"], input[type="radio"][name*="color"], .swatch-input__input')) {
          const color = e.target.value;
          this.filterSlides(color);
        }
      });

      // Explicitly handle thumbnail clicks to ensure synchronization
      this.addEventListener('click', (e) => {
        const thumbSlide = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumbSlide && this.mainSwiper) {
          // Find the index of this media in the current visible set or absolute set
          const mediaId = thumbSlide.dataset.mediaId;
          const mainSlide = this.querySelector(`.gallery-main .swiper-slide[data-media-id="${mediaId}"]`);
          if (mainSlide) {
            // Get internal swiper index of the matching slide
            const index = Array.from(this.mainSwiper.slides).indexOf(mainSlide);
            if (index !== -1) {
              this.mainSwiper.slideTo(index);
            }
          }
        }
      });
    }

    onVariantChange(variant) {
      if (!variant) return;

      // Try to find color from options
      let color = variant.featured_media ? variant.featured_media.alt : null;

      // Fallback: Check options for 'Color' or 'Colour'
      if (!color && variant.options) {
        // This requires knowledge of which option is color, but often it's one of them
        // Let's try to find the selected swatch in the DOM if possible
        const activeSwatch = document.querySelector('.swatch-input__input:checked');
        if (activeSwatch) {
          color = activeSwatch.value;
        }
      }

      if (color) {
        this.filterSlides(color);
      } else if (variant.featured_media) {
        // If no color but has featured media, slide to it
        this.slideToMedia(variant.featured_media.id);
      }
    }

    slideToMedia(mediaId) {
      if (!this.mainSwiper || !mediaId) return;
      const slides = Array.from(this.mainSwiper.slides);
      const targetIndex = slides.findIndex(s => s.dataset.mediaId == mediaId);
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

      let firstVisibleIndex = -1;

      // Filter Main Slides
      slides.forEach((slide, index) => {
        const slideColor = (slide.dataset.color || '').split(',');
        const isMatch = slideColor.some(c => c === 'all' || c === normalizedColor);

        if (isMatch) {
          slide.style.display = 'flex';
          if (firstVisibleIndex === -1) firstVisibleIndex = index;
        } else {
          slide.style.display = 'none';
        }
      });

      // Filter Thumbnails
      thumbSlides.forEach((slide) => {
        const slideColor = (slide.dataset.color || '').split(',');
        const isMatch = slideColor.some(c => c === 'all' || c === normalizedColor);
        slide.style.display = isMatch ? 'block' : 'none';
      });

      // Re-update Swiper structures
      this.mainSwiper.update();
      this.thumbSwiper.update();

      // Ensure we are at the first matching slide
      if (firstVisibleIndex >= 0) {
        // We need to wait a tick for Swiper to realize slides are hidden/shown
        setTimeout(() => {
          this.mainSwiper.update();
          this.thumbSwiper.update();
          // Find the new index of the first visible slide in the CURRENT list
          // Actually, slideTo works on the absolute index if slides are still in DOM
          this.mainSwiper.slideTo(firstVisibleIndex);
        }, 50);
      }
    }

    // Zoom Functionality
    initZoom() {
      if (window.matchMedia('(max-width: 990px)').matches) return; // Disable on mobile

      const mainContainer = this.querySelector('.gallery-main');
      const lens = this.querySelector('.zoom-lens');

      mainContainer.addEventListener('mousemove', (e) => this.onZoomMove(e, mainContainer, lens));
      mainContainer.addEventListener('mouseleave', () => {
        lens.style.display = 'none';
      });
      mainContainer.addEventListener('mouseenter', () => {
        // Activate lens only if we have an image
        const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
        if (activeSlide && activeSlide.querySelector('img')) {
          lens.style.display = 'block';
        }
      });
    }

    onZoomMove(e, container, lens) {
      const activeSlide = this.mainSwiper.slides[this.mainSwiper.activeIndex];
      const img = activeSlide ? activeSlide.querySelector('img[data-zoom]') : null;
      if (!img) { lens.style.display = 'none'; return; }

      lens.style.display = 'block';

      const rect = container.getBoundingClientRect();
      const x = e.clientX - rect.left;
      const y = e.clientY - rect.top;

      // Lens dimensions
      const lw = lens.offsetWidth;
      const lh = lens.offsetHeight;

      // Positioning lens
      let lx = x - lw / 2;
      let ly = y - lh / 2;

      // Boundary checks
      if (lx < 0) lx = 0;
      if (lx > rect.width - lw) lx = rect.width - lw;
      if (ly < 0) ly = 0;
      if (ly > rect.height - lh) ly = rect.height - lh;

      lens.style.left = lx + 'px';
      lens.style.top = ly + 'px';

      // Background Position for Zoom
      // Calculate ratio
      const fullImageSrc = img.dataset.zoom;

      // We set the background image of the lens
      lens.style.backgroundImage = `url('${fullImageSrc}')`;

      // Calculate percentages
      const ratioX = (lx / (rect.width - lw)) * 100;
      const ratioY = (ly / (rect.height - lh)) * 100;

      lens.style.backgroundPosition = `${ratioX}% ${ratioY}%`;
      // We assume zoom image is essentially larger than container. 
      // Typically standard background-size: cover working against the lens size creates the zoom effect
      // But for exact zoom we usually do:
      // background-size: (img.width * ratio) (img.height * ratio)
      // Simplest "Good enough" approach:
      lens.style.backgroundSize = `${rect.width * 2.5}px ${rect.height * 2.5}px`;
    }
  });
}
