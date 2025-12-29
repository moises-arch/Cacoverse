/**
 * Sticky Add to Cart Component
 * Displays a sticky CTA bar on mobile when user scrolls past the main add-to-cart button
 */

(() => {
    'use strict';

    class StickyAddToCart {
        constructor() {
            this.stickyBar = null;
            this.mainForm = null;
            this.mainAddToCartBtn = null;
            this.productInfo = null;
            this.isVisible = false;
            this.scrollThreshold = 0;
            this.isMobile = window.matchMedia('(max-width: 749px)').matches;

            if (!this.isMobile) return;

            this.init();
        }

        init() {
            this.findElements();
            if (!this.mainForm || !this.mainAddToCartBtn) {
                console.warn('Sticky Add to Cart: Required elements not found');
                return;
            }

            this.createStickyBar();
            this.calculateScrollThreshold();
            this.attachEventListeners();
            this.checkVisibility();
        }

        findElements() {
            // Find the main product form
            this.mainForm = document.querySelector('form[id^="product-form-"]');
            this.productInfo = document.querySelector('product-info');

            if (this.mainForm) {
                // Find the main add to cart button
                this.mainAddToCartBtn = this.mainForm.querySelector('button[name="add"]');
            }
        }

        createStickyBar() {
            // Create sticky bar container
            this.stickyBar = document.createElement('div');
            this.stickyBar.className = 'sticky-add-to-cart';
            this.stickyBar.setAttribute('role', 'region');
            this.stickyBar.setAttribute('aria-label', 'Sticky add to cart');
            this.stickyBar.style.cssText = `
        position: fixed;
        bottom: 0;
        left: 0;
        right: 0;
        background: #fff;
        border-top: 1px solid #e5e5e5;
        padding: 12px 16px;
        transform: translateY(100%);
        transition: transform 0.3s cubic-bezier(0.4, 0, 0.2, 1);
        z-index: 100;
        box-shadow: 0 -2px 10px rgba(0, 0, 0, 0.1);
        display: none;
      `;

            // Create inner content
            const content = document.createElement('div');
            content.className = 'sticky-add-to-cart__content';
            content.style.cssText = `
        display: flex;
        align-items: center;
        justify-content: space-between;
        gap: 12px;
        max-width: 100%;
      `;

            // Product info section
            const productInfoSection = this.createProductInfoSection();

            // Add to cart button
            const addToCartBtn = this.createAddToCartButton();

            content.appendChild(productInfoSection);
            content.appendChild(addToCartBtn);
            this.stickyBar.appendChild(content);

            // Append to body
            document.body.appendChild(this.stickyBar);
        }

        createProductInfoSection() {
            const section = document.createElement('div');
            section.className = 'sticky-add-to-cart__info';
            section.style.cssText = `
        flex: 1;
        min-width: 0;
        display: flex;
        align-items: center;
        gap: 10px;
      `;

            // Product image
            const productImage = document.querySelector('.product__media-item img');
            if (productImage) {
                const img = document.createElement('img');
                img.src = productImage.src;
                img.alt = productImage.alt || '';
                img.style.cssText = `
          width: 48px;
          height: 48px;
          object-fit: cover;
          border-radius: 6px;
          flex-shrink: 0;
        `;
                section.appendChild(img);
            }

            // Product details
            const details = document.createElement('div');
            details.className = 'sticky-add-to-cart__details';
            details.style.cssText = `
        flex: 1;
        min-width: 0;
      `;

            // Product title
            const titleEl = document.querySelector('.product__title h1');
            if (titleEl) {
                const title = document.createElement('div');
                title.className = 'sticky-add-to-cart__title';
                title.textContent = titleEl.textContent.trim();
                title.style.cssText = `
          font-size: 14px;
          font-weight: 600;
          line-height: 1.3;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
          color: #000;
        `;
                details.appendChild(title);
            }

            // Product price
            const priceEl = document.querySelector('.price');
            if (priceEl) {
                const price = document.createElement('div');
                price.className = 'sticky-add-to-cart__price';
                price.innerHTML = priceEl.innerHTML;
                price.style.cssText = `
          font-size: 14px;
          font-weight: 700;
          color: #0d6ba6;
          margin-top: 2px;
        `;
                details.appendChild(price);
            }

            section.appendChild(details);
            return section;
        }

        createAddToCartButton() {
            const btn = document.createElement('button');
            btn.type = 'button';
            btn.className = 'sticky-add-to-cart__button';
            btn.textContent = 'Add to Cart';
            btn.style.cssText = `
        background-color: #0d6ba6;
        color: #fff;
        border: none;
        border-radius: 8px;
        padding: 12px 20px;
        font-size: 14px;
        font-weight: 700;
        cursor: pointer;
        white-space: nowrap;
        flex-shrink: 0;
        transition: background-color 0.25s ease;
      `;

            // Sync with main button state
            this.syncButtonState(btn);

            // Handle click
            btn.addEventListener('click', () => {
                this.handleAddToCart();
            });

            // Hover effect
            btn.addEventListener('mouseenter', () => {
                btn.style.backgroundColor = '#fa650c';
            });
            btn.addEventListener('mouseleave', () => {
                btn.style.backgroundColor = '#0d6ba6';
            });

            return btn;
        }

        syncButtonState(stickyBtn) {
            if (!this.mainAddToCartBtn || !stickyBtn) return;

            // Check if main button is disabled
            const isDisabled = this.mainAddToCartBtn.disabled ||
                this.mainAddToCartBtn.classList.contains('disabled');

            stickyBtn.disabled = isDisabled;

            if (isDisabled) {
                stickyBtn.style.backgroundColor = '#ccc';
                stickyBtn.style.cursor = 'not-allowed';
                stickyBtn.textContent = 'Sold Out';
            } else {
                stickyBtn.style.backgroundColor = '#0d6ba6';
                stickyBtn.style.cursor = 'pointer';
                stickyBtn.textContent = 'Add to Cart';
            }

            // Observe changes to main button
            const observer = new MutationObserver(() => {
                this.syncButtonState(stickyBtn);
            });

            observer.observe(this.mainAddToCartBtn, {
                attributes: true,
                attributeFilter: ['disabled', 'class']
            });
        }

        handleAddToCart() {
            // Trigger click on main add to cart button
            if (this.mainAddToCartBtn && !this.mainAddToCartBtn.disabled) {
                this.mainAddToCartBtn.click();

                // Provide visual feedback
                const btn = this.stickyBar.querySelector('.sticky-add-to-cart__button');
                if (btn) {
                    const originalText = btn.textContent;
                    btn.textContent = 'Adding...';
                    btn.disabled = true;

                    setTimeout(() => {
                        btn.textContent = originalText;
                        btn.disabled = false;
                    }, 1500);
                }
            }
        }

        calculateScrollThreshold() {
            if (!this.mainAddToCartBtn) return;

            const rect = this.mainAddToCartBtn.getBoundingClientRect();
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;

            // Show sticky bar when main button is scrolled past
            this.scrollThreshold = scrollTop + rect.bottom + 100;
        }

        checkVisibility() {
            const scrollTop = window.pageYOffset || document.documentElement.scrollTop;
            const shouldBeVisible = scrollTop > this.scrollThreshold;

            if (shouldBeVisible !== this.isVisible) {
                this.isVisible = shouldBeVisible;
                this.toggleVisibility(shouldBeVisible);
            }
        }

        toggleVisibility(show) {
            if (!this.stickyBar) return;

            if (show) {
                this.stickyBar.style.display = 'block';
                // Force reflow
                this.stickyBar.offsetHeight;
                this.stickyBar.style.transform = 'translateY(0)';
            } else {
                this.stickyBar.style.transform = 'translateY(100%)';
                setTimeout(() => {
                    if (!this.isVisible) {
                        this.stickyBar.style.display = 'none';
                    }
                }, 300);
            }
        }

        attachEventListeners() {
            let ticking = false;

            const handleScroll = () => {
                if (!ticking) {
                    window.requestAnimationFrame(() => {
                        this.checkVisibility();
                        ticking = false;
                    });
                    ticking = true;
                }
            };

            window.addEventListener('scroll', handleScroll, { passive: true });

            // Recalculate threshold on resize
            window.addEventListener('resize', () => {
                this.calculateScrollThreshold();
            });

            // Update when variant changes
            if (this.productInfo) {
                this.productInfo.addEventListener('variant-change', () => {
                    this.updateProductInfo();
                });
            }
        }

        updateProductInfo() {
            // Update price
            const priceContainer = this.stickyBar.querySelector('.sticky-add-to-cart__price');
            const mainPrice = document.querySelector('.price');

            if (priceContainer && mainPrice) {
                priceContainer.innerHTML = mainPrice.innerHTML;
            }

            // Update image if variant has different image
            const imgContainer = this.stickyBar.querySelector('.sticky-add-to-cart__info img');
            const mainImage = document.querySelector('.product__media-item.is-active img');

            if (imgContainer && mainImage) {
                imgContainer.src = mainImage.src;
            }

            // Sync button state
            const stickyBtn = this.stickyBar.querySelector('.sticky-add-to-cart__button');
            this.syncButtonState(stickyBtn);
        }
    }

    // Initialize on DOM ready
    function init() {
        // Only initialize on product pages
        if (!document.querySelector('product-info')) return;

        new StickyAddToCart();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }

    // Re-initialize on Shopify section load
    document.addEventListener('shopify:section:load', init);
})();
