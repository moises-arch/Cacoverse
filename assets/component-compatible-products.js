if (!customElements.get('compatible-products-form')) {
    customElements.define('compatible-products-form', class CompatibleProductsForm extends HTMLElement {
        constructor() {
            super();

            this.checkboxes = this.querySelectorAll('input[type="checkbox"]');
            this.totalPriceElement = this.querySelector('[data-total-price]');
            this.countLabel = this.querySelector('[data-count-label]');
            this.addButton = this.querySelector('.compatible-products__add-btn');

            this.addEventListener('click', this.handleEvent.bind(this));
            this.addEventListener('change', this.handleCheckboxChange.bind(this));

            this.initializeState();
            this.updateTotal();
        }

        initializeState() {
            const cards = this.querySelectorAll('.compatible-product-card');
            cards.forEach(card => {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox && checkbox.checked) {
                    card.classList.add('is-selected');
                } else {
                    card.classList.remove('is-selected');
                }
            });
        }

        handleEvent(event) {
            // Handle Add to Cart
            const addBtn = event.target.closest('.compatible-products__add-btn');
            if (addBtn) {
                this.handleAddToCart(event);
                return;
            }

            // Handle Card Click (Toggle selection)
            const card = event.target.closest('.compatible-product-card');
            if (card && !event.target.closest('select') && !event.target.closest('.compatible-checkbox-label')) {
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) {
                    checkbox.checked = !checkbox.checked;
                    this.updateCardState(card, checkbox.checked);
                    this.updateTotal();
                }
            }
        }

        updateCardState(card, isSelected) {
            if (isSelected) {
                card.classList.add('is-selected');
            } else {
                card.classList.remove('is-selected');
            }
        }

        handleCheckboxChange(event) {
            if (event.target.classList.contains('compatible-checkbox')) {
                const card = event.target.closest('.compatible-product-card');
                this.updateCardState(card, event.target.checked);
                this.updateTotal();
                return;
            }

            if (event.target.tagName === 'SELECT') {
                const select = event.target;
                const card = select.closest('.compatible-product-card');
                const selectedOption = select.options[select.selectedIndex];
                const newPrice = selectedOption.dataset.price;
                const newVariantId = select.value;

                // Update card data
                card.dataset.price = newPrice;
                card.dataset.variantId = newVariantId;

                // Update UI text (Price)
                const priceElement = card.querySelector('.price-item');
                if (priceElement) {
                   const currencySymbol = window.Shopify ? (window.Shopify.currency.active === 'USD' ? '$' : '') : '$';
                   const formattedPrice = (parseFloat(newPrice) / 100).toFixed(2);
                   priceElement.textContent = `${currencySymbol}${formattedPrice}`;
                }

                // Update Checkbox value
                const checkbox = card.querySelector('input[type="checkbox"]');
                if (checkbox) checkbox.value = newVariantId;
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
            if (this.totalPriceElement) {
                this.totalPriceElement.textContent = `${currencySymbol}${formattedTotal}`;
            }

            // Update Label
            if (this.countLabel) {
                this.countLabel.textContent = count > 0 ? `${count} item${count !== 1 ? 's' : ''} selected` : 'Select items to bundle';
            }

            if (this.addButton) {
                if (count === 0) {
                    this.addButton.setAttribute('disabled', 'true');
                    this.addButton.textContent = 'Select items';
                } else {
                    this.addButton.removeAttribute('disabled');
                    this.addButton.textContent = count === 1 ? 'Add to Cart' : `Add all ${count} to Cart`;
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

