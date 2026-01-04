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

            this.addEventListener('click', this.handleEvent.bind(this));
            this.addEventListener('change', this.handleCheckboxChange.bind(this));

            this.initializeQueue();
            this.updateTotal();
        }

        initializeQueue() {
            const cards = this.querySelectorAll('.compatible-product-card');
            let visibleCount = 0;

            cards.forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                const isHidden = card.classList.contains('hidden-queue-item') || card.style.display === 'none';

                if (!isHidden && visibleCount < 4) {
                    if (checkbox) checkbox.checked = true;
                    visibleCount++;
                } else {
                    if (checkbox) checkbox.checked = false;
                    card.classList.add('hidden-queue-item');
                    card.style.display = 'none';
                }
            });
            this.updateTotal();
        }

        handleEvent(event) {
            // Handle Add to Cart
            if (event.target.closest('.compatible-products__add-btn')) {
                this.handleAddToCart(event);
                return;
            }

            // Handle Remove (X) button
            if (event.target.closest('.compatible-product__remove')) {
                this.handleRemove(event.target.closest('.compatible-product__remove'));
                return;
            }
        }

        handleRemove(button) {
            const cardToRemove = button.closest('.compatible-product-card');

            // 1. Uncheck the item so it's removed from total
            const checkbox = cardToRemove.querySelector('input[type="checkbox"]');
            if (checkbox) checkbox.checked = false;

            // 2. Hide the card (remove from flow)
            cardToRemove.classList.add('hidden-queue-item');
            cardToRemove.style.display = 'none';

            // 3. Find the next hidden item in the queue to show
            const nextHidden = this.querySelector('.compatible-product-card.hidden-queue-item:not([style*="display: none"])')
                || this.querySelector('.compatible-product-card.hidden-queue-item');

            if (nextHidden) {
                // Determine if we should check it by default. 
                // The visual queue implies "these are the recommended bundle". 
                // Usually user expects the new item to be part of the deal unless they remove it too.
                const nextCheckbox = nextHidden.querySelector('input[type="checkbox"]');
                if (nextCheckbox) nextCheckbox.checked = true;

                nextHidden.classList.remove('hidden-queue-item');
                nextHidden.style.display = 'flex';
                // Optional: Fade in animation class could go here
            }

            // 4. Update totals
            this.updateTotal();
        }

        handleCheckboxChange(event) {
            if (event.target.tagName === 'SELECT') {
                const select = event.target;
                const card = select.closest('.compatible-product-card');
                const selectedOption = select.options[select.selectedIndex];
                const newPrice = selectedOption.dataset.price;
                const newVariantId = select.value;
                const newSku = selectedOption.dataset.sku;

                // Update card data
                card.dataset.price = newPrice;
                card.dataset.variantId = newVariantId;

                // Update UI text (Price)
                const priceElement = card.querySelector('.price-item');
                if (priceElement) {
                    const priceText = selectedOption.textContent.split('-')[1] ? selectedOption.textContent.split('-')[1].trim() : selectedOption.textContent.trim();
                    priceElement.textContent = priceText;
                }

                // Update SKU if exists
                const skuElement = card.querySelector('.compatible-product-card__sku');
                if (skuElement && newSku) {
                    skuElement.textContent = newSku;
                }

                // Update Checkbox value
                const checkbox = card.querySelector('input[type="checkbox"]');
                checkbox.value = newVariantId;
            }
            this.updateTotal();
        }

        updateTotal() {
            let total = 0;
            let count = 0;
            const currencySymbol = window.Shopify ? (window.Shopify.currency.active === 'USD' ? '$' : '') : '$';

            // Only count checked boxes
            const checkedBoxes = this.querySelectorAll('input[type="checkbox"]:checked');

            checkedBoxes.forEach(checkbox => {
                const card = checkbox.closest('.compatible-product-card');
                if (card) {
                    const price = parseFloat(card.dataset.price);
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
                this.addButton.textContent = 'Add Bundle';
            } else {
                this.addButton.removeAttribute('disabled');
                this.addButton.textContent = 'Add all to Cart';
            }
        }

        async handleAddToCart(event) {
            event.preventDefault();

            const selectedVariants = [];
            const checkedBoxes = this.querySelectorAll('input[type="checkbox"]:checked');

            checkedBoxes.forEach(checkbox => {
                selectedVariants.push({
                    id: parseInt(checkbox.value),
                    quantity: 1
                });
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
                        items: selectedVariants,
                        sections: 'cart-drawer,cart-icon-bubble'
                    })
                });

                if (response.ok) {
                    const responseJson = await response.json();

                    // Update Cart Drawer
                    const cartDrawer = document.querySelector('cart-drawer');
                    if (cartDrawer) {
                        cartDrawer.renderContents(responseJson);
                    } else {
                        // Fallback for non-drawer carts
                        document.dispatchEvent(new CustomEvent('cart:update', {
                            bubbles: true,
                            detail: {
                                cart: responseJson
                            }
                        }));
                    }

                    // Reset button state
                    setTimeout(() => {
                        this.addButton.classList.remove('loading');
                        this.addButton.textContent = 'Added!';
                        setTimeout(() => {
                            this.addButton.textContent = originalText;
                            this.addButton.removeAttribute('disabled');
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
