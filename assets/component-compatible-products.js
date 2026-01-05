if (!customElements.get('compatible-products-form')) {
    customElements.define('compatible-products-form', class CompatibleProductsForm extends HTMLElement {
        constructor() {
            super();

            this.totalPriceElement = this.querySelector('[data-total-price]');
            this.statusLabel = this.querySelector('[data-count-label]');
            this.addButton = this.querySelector('.bundle-summary__button');
            this.addButtonText = this.querySelector('.bundle-summary__button-text');
            this.loader = this.querySelector('.bundle-summary__loader');

            this.addEventListener('click', this.handleEvent.bind(this));
            this.addEventListener('change', this.handleSelectChange.bind(this));

            this.updateTotal();
        }

        handleEvent(event) {
            // Add to Cart Action
            const addBtn = event.target.closest('.bundle-summary__button');
            if (addBtn) {
                this.handleAddToCart(event);
                return;
            }

            // Card Toggle Action
            const card = event.target.closest('.bundle-card');
            const isControl = event.target.closest('select') || event.target.closest('input[type="checkbox"]');

            if (card && !isControl) {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.updateCardState(card, checkbox.checked);
                    this.updateTotal();
                }
            } else if (event.target.tagName === 'INPUT' && event.target.type === 'checkbox') {
                this.updateCardState(card, event.target.checked);
                this.updateTotal();
            }
        }

        updateCardState(card, isSelected) {
            if (isSelected) {
                card.classList.add('is-selected');
            } else {
                card.classList.remove('is-selected');
            }
        }

        handleSelectChange(event) {
            if (event.target.tagName === 'SELECT') {
                const select = event.target;
                const card = select.closest('.bundle-card');
                const selectedOption = select.options[select.selectedIndex];
                const newPrice = selectedOption.dataset.price;
                const newVariantId = select.value;
                const newSku = selectedOption.dataset.sku;

                // 1. Update card data attributes first
                if (card) {
                    card.dataset.price = newPrice;
                    card.dataset.variantId = newVariantId;

                    // 2. Update card UI
                    const priceElement = card.querySelector('.bundle-card__price');
                    if (priceElement) {
                        priceElement.textContent = Shopify.formatMoney(newPrice, window.theme?.moneyFormat || "${{amount}}");
                    }

                    const skuElement = card.querySelector('[data-sku-display]');
                    if (skuElement) {
                        skuElement.textContent = newSku || '';
                    }

                    // 3. Sync hidden checkbox value
                    const checkbox = card.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.value = newVariantId;
                }
            }
            // 4. Force total recalculation
            this.updateTotal();
        }

        updateTotal() {
            let total = 0;
            let count = 0;

            const checkedBoxes = this.querySelectorAll('input[type="checkbox"]:checked');
            checkedBoxes.forEach(checkbox => {
                const card = checkbox.closest('.bundle-card');
                if (card && card.dataset.price) {
                    const price = parseFloat(card.dataset.price);
                    if (!isNaN(price)) {
                        total += price;
                        count++;
                    }
                }
            });

            // Update Total Display
            if (this.totalPriceElement) {
                this.totalPriceElement.textContent = Shopify.formatMoney(total, window.theme?.moneyFormat || "${{amount}}");
            }

            // Update Label
            if (this.statusLabel) {
                this.statusLabel.textContent = count > 0 ? `${count} selected` : 'Select items to bundle';
            }

            // Update Action Button
            if (this.addButton) {
                if (count === 0) {
                    this.addButton.setAttribute('disabled', 'true');
                    this.addButton.classList.add('is-disabled');
                    if (this.addButtonText) this.addButtonText.textContent = 'Add Bundle';
                } else {
                    this.addButton.removeAttribute('disabled');
                    this.addButton.classList.remove('is-disabled');
                    if (this.addButtonText) {
                        this.addButtonText.textContent = count === 1 ? 'Add selection' : `Add all ${count} to Cart`;
                    }
                }
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

            // Loading state
            this.addButton.setAttribute('disabled', 'true');
            if (this.loader) this.loader.classList.remove('hidden');
            const originalBtnText = this.addButtonText.textContent;
            if (this.addButtonText) this.addButtonText.textContent = 'Adding...';

            try {
                const response = await fetch(window.Shopify.routes.root + 'cart/add.js', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        items: selectedVariants,
                        sections: 'cart-drawer,cart-icon-bubble'
                    })
                });

                if (response.ok) {
                    const responseJson = await response.json();

                    // Update Cart Components
                    const cartDrawer = document.querySelector('cart-drawer');
                    if (cartDrawer) {
                        cartDrawer.renderContents(responseJson);
                    } else {
                        document.dispatchEvent(new CustomEvent('cart:update', {
                            bubbles: true,
                            detail: { cart: responseJson }
                        }));
                    }

                    // Success Feedback
                    if (this.addButtonText) this.addButtonText.textContent = 'Added!';
                    if (this.loader) this.loader.classList.add('hidden');

                    setTimeout(() => {
                        this.addButton.removeAttribute('disabled');
                        if (this.addButtonText) this.addButtonText.textContent = originalBtnText;
                        this.updateTotal(); // Re-sync state
                    }, 2000);

                } else {
                    throw new Error('Failed to add items to cart');
                }
            } catch (error) {
                console.error('Bundle add-to-cart error:', error);
                if (this.addButtonText) this.addButtonText.textContent = 'Error';
                setTimeout(() => {
                    this.addButton.removeAttribute('disabled');
                    if (this.addButtonText) this.addButtonText.textContent = originalBtnText;
                }, 3000);
            } finally {
                if (this.loader) this.loader.classList.add('hidden');
            }
        }
    });
}



