if (!customElements.get('compatible-products-form')) {
    customElements.define('compatible-products-form', class CompatibleProductsForm extends HTMLElement {
        constructor() {
            super();

            this.loadMoreButton = this.querySelector('.compatible-products__load-more-btn');

            this.checkboxes = this.querySelectorAll('input[type="checkbox"]');
            this.totalPriceElement = this.querySelector('[data-total-price]');
            this.countElement = this.querySelector('[data-count]');
            this.addButton = this.querySelector('.compatible-products__add-btn');
            this.form = this.closest('form') || this.querySelector('form');

            this.addEventListener('change', this.handleCheckboxChange.bind(this));
            this.addButton.addEventListener('click', this.handleAddToCart.bind(this));
            if (this.loadMoreButton) {
                this.loadMoreButton.addEventListener('click', this.handleLoadMore.bind(this));
            }

            this.updateTotal();
        }

        handleLoadMore() {
            const hiddenItems = this.querySelectorAll('.hidden-compatible-product');
            hiddenItems.forEach(item => {
                item.style.display = 'flex';
                item.classList.remove('hidden-compatible-product');
                // Trigger animation if desired
            });
            this.loadMoreButton.closest('.compatible-products__load-more-container').style.display = 'none';
        }

        handleCheckboxChange() {
            this.updateTotal();
        }

        updateTotal() {
            let total = 0;
            let count = 0;
            const currencySymbol = window.Shopify ? (window.Shopify.currency.active === 'USD' ? '$' : '') : '$'; // Fallback

            this.checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    const price = parseFloat(checkbox.closest('.compatible-product-card').dataset.price);
                    total += price;
                    count++;
                }
            });

            // Format total price (assuming cents)
            const formattedTotal = (total / 100).toFixed(2);
            this.totalPriceElement.textContent = `${currencySymbol}${formattedTotal}`;
            this.countElement.textContent = `(${count} item${count !== 1 ? 's' : ''})`;

            if (count === 0) {
                this.addButton.setAttribute('disabled', 'true');
            } else {
                this.addButton.removeAttribute('disabled');
            }
        }

        async handleAddToCart(event) {
            event.preventDefault();

            const selectedVariants = [];
            this.checkboxes.forEach(checkbox => {
                if (checkbox.checked) {
                    selectedVariants.push({
                        id: parseInt(checkbox.value),
                        quantity: 1
                    });
                }
            });

            if (selectedVariants.length === 0) return;

            this.addButton.classList.add('loading');
            this.addButton.setAttribute('disabled', 'true');
            const originalText = this.addButton.textContent;
            this.addButton.textContent = 'Adding...';

            try {
                const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json'
                    },
                    body: JSON.stringify({
                        items: selectedVariants
                    })
                });

                if (response.ok) {
                    // Dispatch event to update cart drawer
                    document.dispatchEvent(new CustomEvent('cart:update', {
                        bubbles: true
                    }));

                    // Also try to open cart drawer if it exists
                    const cartDrawer = document.querySelector('cart-drawer');
                    if (cartDrawer) {
                        cartDrawer.classList.add('active'); // Basic class check, might be different based on theme
                        if (cartDrawer.open) cartDrawer.open();
                    }

                    // Reset button state
                    setTimeout(() => {
                        this.addButton.classList.remove('loading');
                        this.addButton.textContent = 'Added!';
                        setTimeout(() => {
                            this.addButton.textContent = originalText;
                            this.addButton.removeAttribute('disabled');
                            // Optional: uncheck items? No, Amazon keeps them checked.
                        }, 2000);
                    }, 500);


                } else {
                    const error = await response.json();
                    console.error('Error adding to cart:', error);
                    alert('Error adding products to cart.');
                    this.addButton.classList.remove('loading');
                    this.addButton.textContent = originalText;
                    this.addButton.removeAttribute('disabled');
                }
            } catch (e) {
                console.error('Error:', e);
                this.addButton.classList.remove('loading');
                this.addButton.textContent = originalText;
                this.addButton.removeAttribute('disabled');
            }
        }
    });
}
