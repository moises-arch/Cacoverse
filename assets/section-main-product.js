/**
 * main-product.liquid logic extracted for performance.
 * This file handles the lightbox, gallery rebuilds, and variant changes.
 */

window.initMainProduct = function (sectionId, productTitle) {
    const root = document.getElementById(`shopify-section-${sectionId}`) || document;
    const gallerySelector = `#Slider-Gallery-${sectionId} .product__media-item`;
    const sliderList = document.getElementById(`Slider-Gallery-${sectionId}`);
    const lightbox = document.getElementById('galleryLightbox');

    if (!lightbox) return;

    const body = document.body;
    const preview = lightbox.querySelector('#appleLightboxImage');
    const caption = lightbox.querySelector('.apple-lightbox__caption-text');
    const progress = lightbox.querySelector('.apple-lightbox__progress-bar');
    const closeBtn = lightbox.querySelector('.apple-lightbox__close');
    const nextBtn = lightbox.querySelector('.apple-lightbox__nav--next');
    const prevBtn = lightbox.querySelector('.apple-lightbox__nav--prev');
    const backdrop = lightbox.querySelector('.apple-lightbox__backdrop');
    const countCurrent = lightbox.querySelector('.apple-lightbox__counter-current');
    const countTotal = lightbox.querySelector('.apple-lightbox__counter-total');

    const counterCurrent = document.querySelector(`#GalleryViewer-${sectionId} .slider-counter--current`);
    const counterTotal = document.querySelector(`#GalleryViewer-${sectionId} .slider-counter--total`);

    let gallerySlides = [];
    let galleryImages = [];
    let currentIndex = 0;
    let lastFocus = null;
    let touchStartX = 0;

    if (preview) {
        preview.addEventListener('touchstart', (e) => {
            touchStartX = e.touches[0].pageX;
        }, { passive: true });

        preview.addEventListener('touchend', (e) => {
            if (e.changedTouches.length === 1) {
                let touchEndX = e.changedTouches[0].pageX;
                if (touchStartX - touchEndX > 60) goNext();
                else if (touchStartX - touchEndX < -60) goPrev();
            }
        }, { passive: true });
    }

    const isVisible = (el) => {
        if (!el) return false;
        const cs = window.getComputedStyle(el);
        return cs.display !== 'none' && cs.visibility !== 'hidden' && cs.opacity !== '0';
    };

    const rebuildGallery = () => {
        const sectionRoot = document.getElementById(`shopify-section-${sectionId}`) || document;
        const allSlides = Array.from(sectionRoot.querySelectorAll(gallerySelector));
        gallerySlides = allSlides.filter(isVisible);
        galleryImages = gallerySlides
            .map((slide) => slide.querySelector('.product__media-img, .gallery-image, img'))
            .filter(Boolean);

        const total = galleryImages.length;
        if (countTotal) countTotal.textContent = total;
        if (counterTotal) counterTotal.textContent = total;

        if (currentIndex >= total) {
            currentIndex = total > 0 ? total - 1 : 0;
        }
    };

    const updatePreview = (index) => {
        if (!galleryImages.length) return;
        const target = galleryImages[index];
        if (!target) return;

        preview.src = target.dataset.zoomUrl || target.dataset.full || target.currentSrc || target.src;
        preview.alt = target.alt || productTitle;

        if (caption) {
            caption.textContent = target.alt || productTitle;
        }

        if (countCurrent) countCurrent.textContent = index + 1;
        if (counterCurrent) counterCurrent.textContent = index + 1;

        if (progress) {
            progress.style.width = `${((index + 1) / (galleryImages.length || 1)) * 100}%`;
        }
    };

    const showLightbox = (index = 0) => {
        rebuildGallery();
        if (!galleryImages.length) return;
        currentIndex = index;
        lastFocus = document.activeElement;
        const target = galleryImages[currentIndex];
        preview.alt = target?.alt || productTitle;
        updatePreview(currentIndex);
        lightbox.removeAttribute('hidden');
        lightbox.classList.add('is-visible');
        body.classList.add('apple-lock-scroll');
        if (closeBtn) closeBtn.focus({ preventScroll: true });
    };

    const hideLightbox = () => {
        lightbox.setAttribute('hidden', 'hidden');
        lightbox.classList.remove('is-visible');
        body.classList.remove('apple-lock-scroll');
        if (lastFocus && typeof lastFocus.focus === 'function') {
            lastFocus.focus({ preventScroll: true });
        }
    };

    const goNext = () => {
        if (!galleryImages.length) return;
        currentIndex = (currentIndex + 1) % galleryImages.length;
        updatePreview(currentIndex);
    };

    const goPrev = () => {
        if (!galleryImages.length) return;
        currentIndex = (currentIndex - 1 + galleryImages.length) % galleryImages.length;
        updatePreview(currentIndex);
    };

    const handleKeydown = (event) => {
        if (lightbox.hasAttribute('hidden')) return;
        if (event.key === 'Escape') hideLightbox();
        else if (event.key === 'ArrowRight') goNext();
        else if (event.key === 'ArrowLeft') goPrev();
    };

    const allowBackdropClose = () => window.innerWidth >= 750;

    const bindSlides = () => {
        const sectionRoot = document.getElementById(`shopify-section-${sectionId}`) || document;
        const allSlides = Array.from(sectionRoot.querySelectorAll(gallerySelector));
        allSlides.forEach((slide) => {
            slide.setAttribute('tabindex', '0');
            const image = slide.querySelector('.product__media-img, .gallery-image, img');
            const openFromSlide = () => {
                rebuildGallery();
                const idx = gallerySlides.indexOf(slide);
                showLightbox(idx >= 0 ? idx : 0);
            };
            if (image) {
                image.setAttribute('role', 'button');
                image.setAttribute('tabindex', '0');
                image.addEventListener('click', openFromSlide);
                image.addEventListener('keydown', (event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                        event.preventDefault();
                        openFromSlide();
                    }
                });
            }
            slide.addEventListener('keydown', (event) => {
                if (event.target !== slide) return;
                if (event.key === 'Enter' || event.key === ' ') {
                    event.preventDefault();
                    openFromSlide();
                }
            });
        });
    };

    const syncCounter = () => {
        const total = gallerySlides.length;
        if (counterTotal) counterTotal.textContent = total || 0;
        if (counterCurrent) {
            const activeIndex = gallerySlides.findIndex((slide) =>
                slide.classList.contains('is-active') ||
                slide.classList.contains('__mobile-visible')
            );
            counterCurrent.textContent = activeIndex >= 0 ? activeIndex + 1 : (total ? 1 : 0);
        }
    };

    if (sliderList) {
        const slideObserver = new MutationObserver(() => {
            rebuildGallery();
            syncCounter();
        });
        slideObserver.observe(sliderList, { attributes: true, attributeFilter: ['class', 'style'], subtree: true, childList: true });
    }

    const refreshFromVariant = () => {
        rebuildGallery();
        syncCounter();
    };

    document.addEventListener('variant:change', refreshFromVariant);
    document.addEventListener('variant:changed', refreshFromVariant);
    document.addEventListener('product:variant-change', refreshFromVariant);
    document.addEventListener('shopify:section:load', refreshFromVariant);

    lightbox.addEventListener('click', (event) => {
        if (!allowBackdropClose()) return;
        if (event.target === lightbox) hideLightbox();
    });

    if (backdrop) {
        backdrop.addEventListener('click', () => {
            if (!allowBackdropClose()) return;
            hideLightbox();
        });
    }

    if (closeBtn) closeBtn.addEventListener('click', hideLightbox);
    if (nextBtn) nextBtn.addEventListener('click', goNext);
    if (prevBtn) prevBtn.addEventListener('click', goPrev);
    document.addEventListener('keydown', handleKeydown);

    document.querySelectorAll('.image-magnify-full-size').forEach((node) => node.remove());

    rebuildGallery();
    bindSlides();
    syncCounter();

    const applySwatchContrast = () => {
        const sectionRoot = document.getElementById(`shopify-section-${sectionId}`);
        if (!sectionRoot) return;
        const labels = sectionRoot.querySelectorAll('.product-form__input--swatch .swatch-input__label');
        const rgbToLuminance = (rgbString) => {
            const parts = (rgbString.match(/[\d.]+/g) || []).slice(0, 3).map((v) => parseFloat(v));
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
            const bg = window.getComputedStyle(swatch).getPropertyValue('background-color');
            const lum = rgbToLuminance(bg);
            label.style.setProperty('--swatch-text-color', lum > 0.55 ? '#0f172a' : '#f8fafc');
        });
    };

    applySwatchContrast();
    document.addEventListener('shopify:section:load', applySwatchContrast);
    document.addEventListener('variant:change', applySwatchContrast);
    document.addEventListener('variant:changed', applySwatchContrast);
};
