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
        // Check if this event belongs to current section or is global
        // e.detail.variant is usually consistent in Shopify themes
        if (e.detail && e.detail.variant) {
          this.onVariantChange(e.detail.variant);
        }
      });

      // Also listen for manual input changes (fallback)
      document.body.addEventListener('change', (e) => {
        if (e.target.matches('input[type="radio"][name*="Option"], input[type="radio"][name*="Color"], input[type="radio"][name*="color"]')) {
          const color = e.target.value.toLowerCase().trim().replace(/\s+/g, '-');
          this.filterSlides(color);
        }
      });
    }

    onVariantChange(variant) {
      // Extract color option. Usually Option1, Option2, or Option3
      // We look for the option name 'Color' or 'Colour'
      let color = null;

      variant.options.forEach((opt, index) => {
        // Find the option key name (needs access to product options matching)
        // simplified: assume we get the selected value directly
      });

      // Better approach: look at the form data or the variant title
      // For robustness, let's grab the color from the standard variant selector if possible.
      // Or simply iterate options to find one that looks like a color.

      // Hack: Check common option names
      const colorOption = variant.option1 || variant.option2 || variant.option3; // This is naive

      // Revert to DOM check for selected color input
      const checkedInput = document.querySelector('input[name="Color"]:checked') || document.querySelector('input[name="color"]:checked') || document.querySelector('.color-option:checked');
      if (checkedInput) {
        this.filterSlides(checkedInput.value);
      }
    }

    filterSlides(color) {
      if (!this.mainSwiper) return;
      if (!color) return;

      const normalizedColor = color.toLowerCase().trim().replace(/\s+/g, '-');
      if (this.currentColor === normalizedColor) return;
      this.currentColor = normalizedColor;

      console.log('Media Gallery: Filtering by', normalizedColor);

      const slides = this.querySelectorAll('.gallery-main .swiper-slide');
      const thumbSlides = this.querySelectorAll('.gallery-thumbs .swiper-slide');

      let firstVisibleIndex = -1;

      // Filter Main Slides
      slides.forEach((slide, index) => {
        const slideColorLists = (slide.dataset.color || '').split(',');
        const isMatch = slideColorLists.some(c => c === 'all' || c === 'all-show' || c === normalizedColor);

        if (isMatch) {
          slide.style.display = 'flex';
          if (firstVisibleIndex === -1) firstVisibleIndex = index;
        } else {
          slide.style.display = 'none';
        }
      });

      // Filter Thumbnails
      thumbSlides.forEach((slide) => {
        const slideColorLists = (slide.dataset.color || '').split(',');
        const isMatch = slideColorLists.some(c => c === 'all' || c === 'all-show' || c === normalizedColor);
        slide.style.display = isMatch ? 'block' : 'none';
      });

      // Update Swiper
      this.mainSwiper.update();
      this.thumbSwiper.update();

      if (firstVisibleIndex >= 0) {
        this.mainSwiper.slideTo(firstVisibleIndex);
      } else {
        // Fallback: Show all if no matches (safety)
        slides.forEach(s => s.style.display = 'flex');
        thumbSlides.forEach(s => s.style.display = 'block');
        this.mainSwiper.update();
        this.thumbSwiper.update();
        this.mainSwiper.slideTo(0);
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
