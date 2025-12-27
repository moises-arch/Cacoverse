(function () {
  const formatMoney = (value, moneyFormat) => {
    if (window.Shopify && typeof Shopify.formatMoney === 'function') {
      return Shopify.formatMoney(value, moneyFormat);
    }
    return (value / 100).toFixed(2);
  };

  const initMedia = (root) => {
    const viewer = root.querySelector('[data-media-viewer]');
    const thumbs = root.querySelectorAll('[data-media-thumb]');

    const setActiveThumb = (id) => {
      thumbs.forEach((thumb) => {
        thumb.classList.toggle('is-active', thumb.dataset.mediaId === String(id));
      });
    };

    const swapMedia = (thumb) => {
      if (!viewer || !thumb) return;
      const type = thumb.dataset.mediaType;
      const src = thumb.dataset.mediaSrc;
      const alt = thumb.querySelector('img')?.getAttribute('alt') || '';
      viewer.innerHTML = '';
      if (type === 'video') {
        const video = document.createElement('video');
        video.src = src;
        video.controls = true;
        video.playsInline = true;
        viewer.appendChild(video);
      } else {
        const img = document.createElement('img');
        img.src = src;
        img.alt = alt;
        img.loading = 'lazy';
        viewer.appendChild(img);
      }
      setActiveThumb(thumb.dataset.mediaId);
    };

    thumbs.forEach((thumb) => {
      thumb.addEventListener('click', () => swapMedia(thumb));
      thumb.addEventListener('keydown', (event) => {
        if (event.key === 'Enter' || event.key === ' ') {
          event.preventDefault();
          swapMedia(thumb);
        }
      });
    });

    const active = root.querySelector('[data-media-thumb].is-active');
    if (active) swapMedia(active);
  };

  const initVariants = (root) => {
    const productJson = root.querySelector(`#pdp-product-${root.dataset.sectionId}`);
    if (!productJson) return;
    const product = JSON.parse(productJson.textContent || '{}');
    const moneyFormat = root.dataset.moneyFormat;

    const variantInputs = Array.from(root.querySelectorAll('.pdp__choices input[type="radio"]'));
    const hiddenVariantId = root.querySelector('input[name="id"]');
    const priceCurrent = root.querySelector('[data-price-current]');
    const priceCompare = root.querySelector('[data-price-compare]');
    const saleBadge = root.querySelector('[data-price-sale]');
    const soldBadge = root.querySelector('[data-price-soldout]');
    const stock = root.querySelector('[data-stock]');
    const addToCart = root.querySelector('[data-add-to-cart]');
    const addToCartText = root.querySelector('[data-add-to-cart-text]');
    const quantityInput = root.querySelector('input[name="quantity"]');
    const optionValueEls = root.querySelectorAll('[data-option-value]');
    const skuEl = root.querySelector('[data-sku]');

    const texts = {
      add: root.dataset.textAdd || 'Add to cart',
      sold: root.dataset.textSoldout || 'Sold out',
      inStock: root.dataset.textInstock || 'In stock',
      lowStockTemplate: root.dataset.textLowstock || '%d in stock'
    };

    const findVariant = () => {
      const selectedOptions = [];
      root.querySelectorAll('.pdp__option').forEach((wrapper, index) => {
        const checked = wrapper.querySelector('input[type="radio"]:checked');
        selectedOptions[index] = checked ? checked.value : null;
      });
      return product.variants.find((variant) => {
        return variant.options.every((opt, idx) => opt === selectedOptions[idx]);
      });
    };

    const setStockState = (variant) => {
      if (!stock) return;
      const isAvailable = variant?.available;
      stock.classList.toggle('is-soldout', !isAvailable);
      if (!isAvailable) {
        stock.textContent = texts.sold;
        return;
      }
      const qty = variant.inventory_quantity;
      if (variant.inventory_management === 'shopify' && qty !== null && qty !== undefined && qty <= 5) {
        stock.textContent = texts.lowStockTemplate.replace('%d', qty);
      } else {
        stock.textContent = texts.inStock;
      }
    };

    const setAddToCartState = (variant) => {
      if (!addToCart || !addToCartText) return;
      const available = Boolean(variant?.available);
      addToCart.disabled = !available;
      addToCart.setAttribute('aria-disabled', String(!available));
      addToCartText.textContent = available ? texts.add : texts.sold;
    };

    const updatePrice = (variant) => {
      if (!variant || !priceCurrent) return;
      priceCurrent.textContent = formatMoney(variant.price, moneyFormat);
      if (priceCompare) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          priceCompare.textContent = formatMoney(variant.compare_at_price, moneyFormat);
          priceCompare.style.display = '';
        } else {
          priceCompare.style.display = 'none';
        }
      }
      if (saleBadge) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          const diff = variant.compare_at_price - variant.price;
          const pct = Math.round((diff / variant.compare_at_price) * 100);
          saleBadge.textContent = `-${pct}%`;
          saleBadge.style.display = '';
        } else {
          saleBadge.style.display = 'none';
        }
      }
      if (soldBadge) {
        soldBadge.style.display = variant.available ? 'none' : '';
      }
    };

    const filterThumbsForVariant = (variantId) => {
      const thumbs = root.querySelectorAll('[data-media-thumb]');
      let firstVisible = null;
      thumbs.forEach((thumb) => {
        const variants = (thumb.dataset.variantIds || '').split(',').filter(Boolean);
        const match = variants.length === 0 || variants.includes(String(variantId));
        thumb.style.display = match ? '' : 'none';
        if (match && !firstVisible) firstVisible = thumb;
      });
      return firstVisible;
    };

    const setVariant = (variant) => {
      if (!variant || !hiddenVariantId) return;
      hiddenVariantId.value = variant.id;
      updatePrice(variant);
      setStockState(variant);
      setAddToCartState(variant);
      if (skuEl) {
        skuEl.textContent = variant.sku || '';
        skuEl.style.display = variant.sku ? '' : 'none';
      }

      const firstVisibleThumb = filterThumbsForVariant(variant.id);
      const targetThumb =
        (variant.featured_media &&
          root.querySelector(`[data-media-thumb][data-media-id="${variant.featured_media.id}"]`)) ||
        firstVisibleThumb;
      if (targetThumb) targetThumb.click();

      if (quantityInput) {
        quantityInput.min = variant.quantity_rule?.min ?? 1;
        quantityInput.step = variant.quantity_rule?.increment ?? 1;
        if (variant.quantity_rule?.max > 0) {
          quantityInput.max = variant.quantity_rule.max;
        } else {
          quantityInput.removeAttribute('max');
        }
      }
      optionValueEls.forEach((el) => {
        const index = Number(el.dataset.optionValue);
        if (!Number.isNaN(index) && variant.options[index]) {
          el.textContent = variant.options[index];
        }
      });
    };

    variantInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const match = findVariant();
        if (match) setVariant(match);
      });
    });

    const initialVariant = product.variants.find((v) => v.id === Number(hiddenVariantId?.value)) || product.variants[0];
    if (initialVariant) setVariant(initialVariant);

    const stepper = (dir) => {
      if (!quantityInput) return;
      const min = Number(quantityInput.min) || 1;
      const max = quantityInput.max ? Number(quantityInput.max) : Infinity;
      const step = Number(quantityInput.step) || 1;
      let next = Number(quantityInput.value) || min;
      next = dir === 'up' ? next + step : next - step;
      if (next < min) next = min;
      if (next > max) next = max;
      quantityInput.value = next;
    };
    root.querySelector('[data-qty-plus]')?.addEventListener('click', () => stepper('up'));
    root.querySelector('[data-qty-minus]')?.addEventListener('click', () => stepper('down'));
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pdp').forEach((root) => {
      initMedia(root);
      initVariants(root);
    });
  });
})();
