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

            // Restore previous selection
            this.restoreFromStorage();

            // Initial calculation
            setTimeout(() => this.updateTotal(), 0);
        }

        getStorageKey() {
            const pagePath = window.location.pathname;
            return `bundle_selection_${pagePath.replace(/\//g, '_')}`;
        }

        saveToStorage() {
            const selection = {};
            this.querySelectorAll('.bundle-card').forEach((card, index) => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                const select = card.querySelector('select');
                selection[index] = {
                    checked: checkbox ? checkbox.checked : false,
                    variantId: select ? select.value : card.dataset.variantId
                };
            });
            localStorage.setItem(this.getStorageKey(), JSON.stringify(selection));
        }

        restoreFromStorage() {
            try {
                const saved = localStorage.getItem(this.getStorageKey());
                if (!saved) return;
                const selection = JSON.parse(saved);

                this.querySelectorAll('.bundle-card').forEach((card, index) => {
                    const data = selection[index];
                    if (!data) return;

                    const checkbox = card.querySelector('input[type="checkbox"]');
                    const select = card.querySelector('select');

                    if (checkbox) checkbox.checked = data.checked;

                    if (select && data.variantId) {
                        select.value = data.variantId;
                        // Trigger the visual update for the select change
                        this.handleSelectChange({ target: select });
                    }

                    this.updateCardState(card, data.checked);
                });
            } catch (e) {
                console.warn('Failed to restore bundle selection:', e);
            }
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

            // Clear All Action
            const clearBtn = event.target.closest('[data-clear-all]');
            if (clearBtn) {
                this.querySelectorAll('input[type="checkbox"]:checked').forEach(checkbox => {
                    checkbox.checked = false;
                    const card = checkbox.closest('.bundle-card');
                    this.updateCardState(card, false);
                });
                this.updateTotal();
                this.saveToStorage();
                return;
            }

            // Show More Action
            const showMoreBtn = event.target.closest('[data-show-more]');
            if (showMoreBtn) {
                this.querySelectorAll('.bundle-card.is-hidden').forEach(card => {
                    card.classList.remove('is-hidden');
                });
                showMoreBtn.remove();
                return;
            }

            // Card Toggle Action
            const card = event.target.closest('.bundle-card');
            const checkbox = card?.querySelector('input[type="checkbox"]');

            // If click was on the checkbox itself or its label box, the browser will toggle it.
            // We just need to catch the change and update UI.
            if (event.target.type === 'checkbox') {
                this.updateCardState(card, event.target.checked);
                this.updateTotal();
                this.saveToStorage();
                return;
            }

            // If click was on the card but NOT on a control (select, checkbox label box, config button)
            const isControl = event.target.closest('select') ||
                event.target.closest('.bundle-card__checkbox-label') ||
                event.target.closest('.bundle-card__config-button');

            if (card && !isControl) {
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.updateCardState(card, checkbox.checked);
                    this.updateTotal();
                    this.saveToStorage();
                }
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
            this.saveToStorage();
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

            // Sync Visibility: items that are checked MUST NOT be hidden
            this.querySelectorAll('.bundle-card.is-hidden').forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    card.classList.remove('is-hidden');
                }
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
                        sections: 'cart-drawer,cart-icon-bubble,cart-icon-bubble1'
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



