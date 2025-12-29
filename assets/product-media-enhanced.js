/**
 * Enhanced Product Media Gallery Features
 * - Progress indicators (dots)
 * - Image preloading
 * - Smooth animations
 * - Video support
 */

(() => {
  'use strict';

  class EnhancedMediaGallery {
    constructor(galleryElement) {
      this.gallery = galleryElement;
      this.slider = this.gallery.querySelector('.pdp-media__track');
      this.slides = Array.from(this.gallery.querySelectorAll('.pdp-media__item'));
      this.currentIndex = 0;
      this.isAnimating = false;
      
      this.init();
    }

    init() {
      this.createProgressIndicators();
      this.setupImagePreloading();
      this.setupSlideAnimations();
      this.setupVideoSupport();
      this.attachEventListeners();
      this.updateActiveSlide(0);
    }

    /**
     * Feature 2: Progress Indicators (Dots)
     */
    createProgressIndicators() {
      if (this.slides.length <= 1) return;

      const navContainer = this.gallery.querySelector('.pdp-media__nav');
      if (!navContainer) return;

      const progressContainer = document.createElement('div');
      progressContainer.className = 'pdp-media__progress';
      progressContainer.setAttribute('role', 'tablist');
      progressContainer.setAttribute('aria-label', 'Gallery navigation');

      this.slides.forEach((slide, index) => {
        const dot = document.createElement('button');
        dot.className = 'pdp-media__progress-dot';
        dot.setAttribute('type', 'button');
        dot.setAttribute('role', 'tab');
        dot.setAttribute('aria-label', `Go to slide ${index + 1}`);
        dot.setAttribute('aria-selected', index === 0 ? 'true' : 'false');
        dot.dataset.slideIndex = index;
        
        dot.addEventListener('click', () => {
          this.goToSlide(index);
        });

        progressContainer.appendChild(dot);
      });

      // Insert after the nav container
      navContainer.parentNode.insertBefore(progressContainer, navContainer.nextSibling);
      this.progressDots = Array.from(progressContainer.querySelectorAll('.pdp-media__progress-dot'));
    }

    updateProgressDots(index) {
      if (!this.progressDots) return;

      this.progressDots.forEach((dot, i) => {
        if (i === index) {
          dot.classList.add('is-active');
          dot.setAttribute('aria-selected', 'true');
        } else {
          dot.classList.remove('is-active');
          dot.setAttribute('aria-selected', 'false');
        }
      });
    }

    /**
     * Feature 3: Image Preloading
     */
    setupImagePreloading() {
      // Preload adjacent images
      this.preloadAdjacentImages(0);
    }

    preloadAdjacentImages(currentIndex) {
      const preloadIndices = [
        currentIndex - 1,
        currentIndex + 1,
      ].filter(i => i >= 0 && i < this.slides.length);

      preloadIndices.forEach(index => {
        const slide = this.slides[index];
        if (!slide) return;

        const img = slide.querySelector('img');
        if (!img || img.complete || slide.dataset.preloaded === 'true') return;

        // Preload the image
        const preloadImg = new Image();
        preloadImg.onload = () => {
          slide.dataset.preloaded = 'true';
        };
        preloadImg.src = img.src;
        if (img.srcset) {
          preloadImg.srcset = img.srcset;
        }
      });
    }

    /**
     * Feature 4: Smooth Animations
     */
    setupSlideAnimations() {
      // Add initial state
      this.slides.forEach((slide, index) => {
        if (index === 0) {
          slide.classList.add('is-active');
        } else {
          slide.classList.remove('is-active');
        }
      });
    }

    updateActiveSlide(index) {
      if (this.isAnimating) return;
      this.isAnimating = true;

      this.slides.forEach((slide, i) => {
        if (i === index) {
          slide.classList.add('is-active');
          slide.setAttribute('aria-hidden', 'false');
        } else {
          slide.classList.remove('is-active');
          slide.setAttribute('aria-hidden', 'true');
        }
      });

      this.currentIndex = index;
      this.updateProgressDots(index);
      this.preloadAdjacentImages(index);

      // Reset animation lock
      setTimeout(() => {
        this.isAnimating = false;
      }, 400);
    }

    /**
     * Feature 5: Video Support
     */
    setupVideoSupport() {
      this.slides.forEach(slide => {
        const video = slide.querySelector('video');
        if (!video) return;

        // Mark slide as video
        slide.classList.add('product__media-item--video');

        // Pause video when not active
        const observer = new IntersectionObserver((entries) => {
          entries.forEach(entry => {
            if (entry.isIntersecting) {
              video.play().catch(() => {
                // Autoplay might be blocked
              });
            } else {
              video.pause();
            }
          });
        }, { threshold: 0.5 });

        observer.observe(slide);

        // Add loading state
        if (video.readyState < 3) {
          slide.classList.add('is-loading');
          video.addEventListener('canplaythrough', () => {
            slide.classList.remove('is-loading');
          }, { once: true });
        }
      });
    }

    /**
     * Event Listeners
     */
    attachEventListeners() {
      // Navigation buttons
      const prevBtn = this.gallery.querySelector('.slider-button--prev');
      const nextBtn = this.gallery.querySelector('.slider-button--next');

      if (prevBtn) {
        prevBtn.addEventListener('click', () => this.goToPrevious());
      }

      if (nextBtn) {
        nextBtn.addEventListener('click', () => this.goToNext());
      }

      // Keyboard navigation
      this.gallery.addEventListener('keydown', (e) => {
        if (e.key === 'ArrowLeft') {
          e.preventDefault();
          this.goToPrevious();
        } else if (e.key === 'ArrowRight') {
          e.preventDefault();
          this.goToNext();
        }
      });

      // Touch/swipe support
      this.setupSwipeGestures();

      // Update counter
      this.updateCounter();
    }

    setupSwipeGestures() {
      let touchStartX = 0;
      let touchEndX = 0;

      this.slider.addEventListener('touchstart', (e) => {
        touchStartX = e.changedTouches[0].screenX;
      }, { passive: true });

      this.slider.addEventListener('touchend', (e) => {
        touchEndX = e.changedTouches[0].screenX;
        this.handleSwipe(touchStartX, touchEndX);
      }, { passive: true });
    }

    handleSwipe(startX, endX) {
      const threshold = 50;
      const diff = startX - endX;

      if (Math.abs(diff) < threshold) return;

      if (diff > 0) {
        // Swipe left - go to next
        this.goToNext();
      } else {
        // Swipe right - go to previous
        this.goToPrevious();
      }
    }

    goToSlide(index) {
      if (index < 0 || index >= this.slides.length) return;
      this.updateActiveSlide(index);
      this.updateCounter();
      this.scrollToSlide(index);
    }

    goToNext() {
      const nextIndex = (this.currentIndex + 1) % this.slides.length;
      this.goToSlide(nextIndex);
    }

    goToPrevious() {
      const prevIndex = (this.currentIndex - 1 + this.slides.length) % this.slides.length;
      this.goToSlide(prevIndex);
    }

    scrollToSlide(index) {
      const slide = this.slides[index];
      if (!slide) return;

      slide.scrollIntoView({
        behavior: 'smooth',
        block: 'nearest',
        inline: 'center'
      });
    }

    updateCounter() {
      const counter = this.gallery.querySelector('.slider-counter--current');
      if (counter) {
        counter.textContent = this.currentIndex + 1;
      }
    }
  }

  /**
   * Initialize enhanced galleries
   */
  function initEnhancedGalleries() {
    const galleries = document.querySelectorAll('[data-media-gallery]');
    
    galleries.forEach(gallery => {
      // Skip if already initialized
      if (gallery.dataset.enhanced === 'true') return;
      
      // Initialize
      new EnhancedMediaGallery(gallery);
      gallery.dataset.enhanced = 'true';
    });
  }

  // Initialize on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initEnhancedGalleries);
  } else {
    initEnhancedGalleries();
  }

  // Re-initialize on Shopify section load
  document.addEventListener('shopify:section:load', initEnhancedGalleries);
})();
