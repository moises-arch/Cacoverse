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
      // Fast initial filter
      this.filterByCurrentSelections();
      // Backup filter after a short delay for slow-loading variant data
      setTimeout(() => this.filterByCurrentSelections(), 300);
      this.bindEvents();
    }

    initSwiper() {
      if (!window.Swiper) {
        setTimeout(() => this.initSwiper(), 100);
        return;
      }

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
        },
        observer: true,
        observeParents: true,
        autoHeight: true,
      });
    }

    bindEvents() {
      // Listen for standard Shopify variant changes
      document.addEventListener('variant:change', (e) => {
        if (e.detail && e.detail.variant) {
          this.onVariantChange(e.detail.variant);
        }
      });

      // Catch manual changes
      document.body.addEventListener('change', (e) => {
        const productForm = e.target.closest('product-info') || e.target.closest('.product-form');
        if (productForm) {
          this.filterByCurrentSelections();
        }
      });

      // Thumbnail navigation
      this.addEventListener('click', (e) => {
        const thumbSlide = e.target.closest('.gallery-thumbs .swiper-slide');
        if (thumbSlide) {
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
      // Find all active options in the product form
      const productInfo = document.querySelector('product-info') || document.querySelector('.product-form');
      if (!productInfo) return;

      const checkedInputs = Array.from(productInfo.querySelectorAll('input[type="radio"]:checked, select'));
      const activeTokens = checkedInputs.map(input => {
        return input.value.toLowerCase().trim().replace(/\s+/g, '-');
      }).filter(t => t !== '');

      this.filterSlides(null, activeTokens);
    }

    slideToMedia(mediaId) {
      if (!this.mainSwiper || !mediaId) return;

      // Find the slide in the swiper's internal collection
      const targetSlide = Array.from(this.mainSwiper.slides).find(slide => slide.dataset.mediaId == mediaId);

      if (targetSlide) {
        const index = Array.from(this.mainSwiper.slides).indexOf(targetSlide);
        if (index !== -1) {
          this.mainSwiper.slideTo(index);
        }
      }
    }

    filterSlides(variant, manualTokens = null) {
      if (!this.mainSwiper || !this.thumbSwiper) return;

      const productInfo = document.querySelector('product-info') || document.querySelector('.product-form');
      if (!productInfo) return;

      // 1. Get ALL possible option values to identify which tags are "variable tags"
      const allPossibleValues = Array.from(productInfo.querySelectorAll('input[type="radio"], select option'))
        .map(el => (el.value || el.textContent || '').toLowerCase().trim().replace(/\s+/g, '-'))
        .filter(t => t && t !== 'all');

      // 2. Get CURRENTLY selected tokens
      let activeTokens = [];
      if (variant && variant.options) {
        activeTokens = variant.options.map(opt => opt.toLowerCase().trim().replace(/\s+/g, '-'));
      } else if (manualTokens) {
        activeTokens = manualTokens;
      } else {
        // Fallback to reading DOM
        const checkedInputs = Array.from(productInfo.querySelectorAll('input[type="radio"]:checked, select'));
        activeTokens = checkedInputs.map(input => input.value.toLowerCase().trim().replace(/\s+/g, '-')).filter(t => t !== '');
      }

      if (activeTokens.length === 0) return;

      const mainSlides = Array.from(this.querySelectorAll('.gallery-main .swiper-slide'));
      const thumbSlides = Array.from(this.querySelectorAll('.gallery-thumbs .swiper-slide'));
      const featuredMediaId = variant ? variant.featured_media?.id : null;

      // 3. Advanced Filtering Logic
      const filterItem = (item) => {
        const itemMediaId = item.dataset.mediaId;
        const itemTags = (item.dataset.color || '').split(',').map(t => t.trim()).filter(t => t !== '');

        const isFeatured = featuredMediaId && itemMediaId == featuredMediaId;
        const isAll = itemTags.includes('all') || itemTags.includes('all-show');

        // Accurate check: 
        // a) Must match at least one active token
        const matchesAny = activeTokens.some(token => itemTags.includes(token));
        // b) Must NOT have any tag that belongs to another unselected option (prevents "10 Pack" showing when "3 Pack" is selected)
        const hasMismatch = itemTags.some(tag => allPossibleValues.includes(tag) && !activeTokens.includes(tag));

        const isMatch = isFeatured || isAll || (matchesAny && !hasMismatch);

        item.style.display = isMatch ? 'flex' : 'none';
        if (item.classList.contains('swiper-slide')) {
          item.style.height = isMatch ? '' : '0px';
        }
        return isMatch;
      };

      mainSlides.forEach(filterItem);
      thumbSlides.forEach(filterItem);

      // Crucial: Update Swiper so it can recalculate layout without the hidden slides
      this.mainSwiper.update();
      this.thumbSwiper.update();

      // Navigate to the correct starting slide with a slight delay for Swiper stability
      setTimeout(() => {
        if (featuredMediaId) {
          this.slideToMedia(featuredMediaId);
        } else {
          const firstMatch = mainSlides.find(s => s.style.display !== 'none');
          if (firstMatch) {
            this.slideToMedia(firstMatch.dataset.mediaId);
          }
        }
      }, 50);
    }
  });
}
