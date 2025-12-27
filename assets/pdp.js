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
    const priceRegular = root.querySelector('[data-price-regular]');
    const priceCompare = root.querySelector('[data-price-compare]');
    const stock = root.querySelector('[data-stock]');
    const addToCart = root.querySelector('[data-add-to-cart]');
    const addToCartText = root.querySelector('[data-add-to-cart-text]');
    const quantityInput = root.querySelector('input[name="quantity"]');

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
      if (!variant || !priceRegular) return;
      priceRegular.textContent = formatMoney(variant.price, moneyFormat);
      if (priceCompare) {
        if (variant.compare_at_price && variant.compare_at_price > variant.price) {
          priceCompare.textContent = formatMoney(variant.compare_at_price, moneyFormat);
          priceCompare.style.display = '';
        } else {
          priceCompare.style.display = 'none';
        }
      }
    };

    const setVariant = (variant) => {
      if (!variant || !hiddenVariantId) return;
      hiddenVariantId.value = variant.id;
      updatePrice(variant);
      setStockState(variant);
      setAddToCartState(variant);

      if (variant.featured_media && variant.featured_media.id) {
        const thumb = root.querySelector(`[data-media-thumb][data-media-id="${variant.featured_media.id}"]`);
        if (thumb) thumb.click();
      }
      if (quantityInput) {
        quantityInput.min = variant.quantity_rule?.min ?? 1;
        quantityInput.step = variant.quantity_rule?.increment ?? 1;
        if (variant.quantity_rule?.max > 0) {
          quantityInput.max = variant.quantity_rule.max;
        } else {
          quantityInput.removeAttribute('max');
        }
      }
    };

    variantInputs.forEach((input) => {
      input.addEventListener('change', () => {
        const match = findVariant();
        if (match) setVariant(match);
      });
    });

    const initialVariant = product.variants.find((v) => v.id === Number(hiddenVariantId?.value)) || product.variants[0];
    if (initialVariant) setVariant(initialVariant);
  };

  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('.pdp').forEach((root) => {
      initMedia(root);
      initVariants(root);
    });
  });
})();
