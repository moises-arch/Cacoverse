if (!customElements.get('compatible-products-form')) {
    customElements.define('compatible-products-form', class CompatibleProductsForm extends HTMLElement {
        constructor() {
            super();
            this._boundUpdateTotal = this.updateTotal.bind(this);
            this._boundHandleSelectChange = this.handleSelectChange.bind(this);
            this._boundHandleEvent = this.handleEvent.bind(this);
        }

        connectedCallback() {
            this.totalPriceElement = this.querySelector('[data-total-price]');
            this.statusLabel = this.querySelector('[data-count-label]');
            this.addButton = this.querySelector('.bundle-summary__button');
            this.addButtonText = this.querySelector('.bundle-summary__button-text');
            this.loader = this.querySelector('.bundle-summary__loader');

            this.addEventListener('click', this._boundHandleEvent);
            this.addEventListener('change', this._boundHandleSelectChange);

            // Initial calculation
            setTimeout(() => this.updateTotal(), 0);
        }

        formatMoney(cents, format) {
            if (typeof cents === 'string') cents = cents.replace('.', '');
            let value = '';
            const placeholderRegex = /\{\{\s*(\w+)\s*\}\}/;
            const formatString = format || window.theme?.moneyFormat || "${{amount}}";

            function formatWithDelimiters(number, precision, thousands, decimal) {
                precision = isNaN(precision) ? 2 : precision;
                thousands = thousands || ',';
                decimal = decimal || '.';

                if (isNaN(number) || number == null) return 0;

                number = (number / 100.0).toFixed(precision);

                const parts = number.split('.');
                const dollarsAmount = parts[0].replace(/(\d)(?=(\d\d\d)+(?!\d))/g, '$1' + thousands);
                const centsAmount = parts[1] ? decimal + parts[1] : '';

                return dollarsAmount + centsAmount;
            }

            switch (formatString.match(placeholderRegex)[1]) {
                case 'amount':
                    value = formatWithDelimiters(cents, 2);
                    break;
                case 'amount_no_decimals':
                    value = formatWithDelimiters(cents, 0);
                    break;
                case 'amount_with_comma_separator':
                    value = formatWithDelimiters(cents, 2, '.', ',');
                    break;
                case 'amount_no_decimals_with_comma_separator':
                    value = formatWithDelimiters(cents, 0, '.', ',');
                    break;
                case 'amount_no_decimals_with_space_separator':
                    value = formatWithDelimiters(cents, 0, ' ', ',');
                    break;
            }

            return formatString.replace(placeholderRegex, value);
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
            if (!card) return;
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
                const newComparePrice = selectedOption.dataset.comparePrice;
                const newVariantId = select.value;
                const newSku = selectedOption.dataset.sku;

                if (card) {
                    card.dataset.price = newPrice;
                    card.dataset.variantId = newVariantId;

                    const priceElement = card.querySelector('[data-item-price]');
                    const compareElement = card.querySelector('[data-item-compare-price]');

                    if (priceElement) {
                        priceElement.textContent = this.formatMoney(newPrice);
                        const isSale = newComparePrice && parseInt(newComparePrice) > parseInt(newPrice);
                        priceElement.classList.toggle('on-sale', !!isSale);
                    }

                    if (compareElement) {
                        const isSale = newComparePrice && parseInt(newComparePrice) > parseInt(newPrice);
                        if (isSale) {
                            compareElement.style.display = 'inline';
                            compareElement.textContent = this.formatMoney(newComparePrice);
                        } else {
                            compareElement.style.display = 'none';
                        }
                    }

                    const skuElement = card.querySelector('[data-sku-display]');
                    if (skuElement) {
                        skuElement.textContent = newSku || '';
                    }

                    const checkbox = card.querySelector('input[type="checkbox"]');
                    if (checkbox) checkbox.value = newVariantId;
                }
            }
            this.updateTotal();
        }

        updateTotal() {
            let total = 0;
            let count = 0;

            const checkedBoxes = this.querySelectorAll('input[type="checkbox"]:checked');
            checkedBoxes.forEach(checkbox => {
                const card = checkbox.closest('.bundle-card');
                if (card && card.dataset.price) {
                    const priceInCents = parseInt(card.dataset.price);
                    if (!isNaN(priceInCents)) {
                        total += priceInCents;
                        count++;
                    }
                }

                // Sync visual state if not synced
                if (card && !card.classList.contains('is-selected')) {
                    card.classList.add('is-selected');
                }
            });

            // Handle unselected cards visual state
            this.querySelectorAll('input[type="checkbox"]:not(:checked)').forEach(checkbox => {
                const card = checkbox.closest('.bundle-card');
                if (card) card.classList.remove('is-selected');
            });

            if (this.totalPriceElement) {
                this.totalPriceElement.textContent = this.formatMoney(total);
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



