class CartRemoveButton extends HTMLElement {
  constructor() {
    super();

    this.addEventListener('click', (event) => {
      event.preventDefault();
      const cartItems = this.closest('cart-items') || this.closest('cart-drawer-items');
      cartItems.updateQuantity(this.dataset.index, 0);
    });
  }
}

customElements.define('cart-remove-button', CartRemoveButton);

class CartItems extends HTMLElement {
  constructor() {
    super();
    this.lineItemStatusElement =
      document.getElementById('shopping-cart-line-item-status') || document.getElementById('CartDrawer-LineItemStatus');

    const debouncedOnChange = debounce((event) => {
      this.onChange(event);
    }, ON_CHANGE_DEBOUNCE_TIMER);

    this.addEventListener('change', debouncedOnChange.bind(this));
  }

  cartUpdateUnsubscriber = undefined;

  connectedCallback() {
    this.cartUpdateUnsubscriber = subscribe(PUB_SUB_EVENTS.cartUpdate, (event) => {
      if (event.source === 'cart-items') {
        return;
      }
      this.onCartUpdate();
    });
  }

  disconnectedCallback() {
    if (this.cartUpdateUnsubscriber) {
      this.cartUpdateUnsubscriber();
    }
  }

  resetQuantityInput(id) {
    const input = this.querySelector(`#Quantity-${id}`);
    if (!input) return;
    input.value = input.getAttribute('value');
    this.isEnterPressed = false;
  }

  setValidity(event, index, message) {
    event.target.setCustomValidity(message);
    event.target.reportValidity();
    this.resetQuantityInput(index);
    event.target.select();
  }

  validateQuantity(event) {
    const inputValue = parseInt(event.target.value);
    const index = event.target.dataset.index;
    let message = '';

    if (inputValue < event.target.dataset.min) {
      message = window.quickOrderListStrings.min_error.replace('[min]', event.target.dataset.min);
    } else if (inputValue > parseInt(event.target.max)) {
      message = window.quickOrderListStrings.max_error.replace('[max]', event.target.max);
    } else if (inputValue % parseInt(event.target.step) !== 0) {
      message = window.quickOrderListStrings.step_error.replace('[step]', event.target.step);
    }

    if (message) {
      this.setValidity(event, index, message);
    } else {
      event.target.setCustomValidity('');
      event.target.reportValidity();
      this.updateQuantity(
        index,
        inputValue,
        document.activeElement.getAttribute('name'),
        event.target.dataset.quantityVariantId
      );
    }
  }

  onChange(event) {
    this.validateQuantity(event);
  }

  onCartUpdate() {
    if (this.tagName === 'CART-DRAWER-ITEMS') {
      fetch(`${routes.cart_url}?section_id=cart-drawer`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const selectors = ['cart-drawer-items', '.cart-drawer__footer'];
          for (const selector of selectors) {
            const targetElement = document.querySelector(selector);
            const sourceElement = html.querySelector(selector);
            if (targetElement && sourceElement) {
              targetElement.replaceWith(sourceElement);
            }
          }

          if (window.initDrawerRecommendations) {
            window.initDrawerRecommendations();
          }
        })
        .catch((e) => {
          console.error(e);
        });
    } else {
      fetch(`${routes.cart_url}?section_id=main-cart-items`)
        .then((response) => response.text())
        .then((responseText) => {
          const html = new DOMParser().parseFromString(responseText, 'text/html');
          const sourceQty = html.querySelector('cart-items');
          if (sourceQty) {
            this.innerHTML = sourceQty.innerHTML;
          }
        })
        .catch((e) => {
          console.error(e);
        });
    }
  }

  getSectionsToRender() {
    return [
      {
        id: 'main-cart-items',
        section: document.getElementById('main-cart-items').dataset.id,
        selector: '.js-contents',
      },
      {
        id: 'cart-icon-bubble',
        section: 'cart-icon-bubble',
        selector: '.shopify-section',
      },
      {
        id: 'cart-live-region-text',
        section: 'cart-live-region-text',
        selector: '.shopify-section',
      },
      {
        id: 'main-cart-footer',
        section: document.getElementById('main-cart-footer').dataset.id,
        selector: '.js-contents',
      },
    ];
  }

  updateQuantity(line, quantity, name, variantId) {
    this.enableLoading(line);

    const body = JSON.stringify({
      line,
      quantity,
      sections: this.getSectionsToRender().map((section) => section.section),
      sections_url: window.location.pathname,
    });

    fetch(`${routes.cart_change_url}`, { ...fetchConfig(), ...{ body } })
      .then((response) => {
        return response.text();
      })
      .then((state) => {
        const parsedState = JSON.parse(state);
        const quantityElement =
          document.getElementById(`Quantity-${line}`) || document.getElementById(`Drawer-quantity-${line}`);
        const items = document.querySelectorAll('.cart-item');

        if (parsedState.errors) {
          if (quantityElement) {
            quantityElement.value = quantityElement.getAttribute('value');
          }
          this.updateLiveRegions(line, parsedState.errors);
          return;
        }

        this.classList.toggle('is-empty', parsedState.item_count === 0);
        const cartDrawerWrapper = document.querySelector('cart-drawer');
        const cartFooter = document.getElementById('main-cart-footer');

        if (cartFooter) cartFooter.classList.toggle('is-empty', parsedState.item_count === 0);
        if (cartDrawerWrapper) cartDrawerWrapper.classList.toggle('is-empty', parsedState.item_count === 0);

        this.getSectionsToRender().forEach((section) => {
          const container = document.getElementById(section.id);
          if (!container) return;
          const elementToReplace =
            container.querySelector(section.selector) || container;
          elementToReplace.innerHTML = this.getSectionInnerHTML(
            parsedState.sections[section.section],
            section.selector
          );
        });
        const updatedValue = parsedState.items[line - 1] ? parsedState.items[line - 1].quantity : undefined;
        let message = '';
        if (items.length === parsedState.items.length && quantityElement && updatedValue !== parseInt(quantityElement.value)) {
          if (typeof updatedValue === 'undefined') {
            message = window.cartStrings.error;
          } else {
            message = window.cartStrings.quantityError.replace('[quantity]', updatedValue);
          }
        }
        this.updateLiveRegions(line, message);

        const lineItem =
          document.getElementById(`CartItem-${line}`) || document.getElementById(`CartDrawer-Item-${line}`);
        if (lineItem && lineItem.querySelector(`[name="${name}"]`)) {
          cartDrawerWrapper
            ? trapFocus(cartDrawerWrapper, lineItem.querySelector(`[name="${name}"]`))
            : lineItem.querySelector(`[name="${name}"]`).focus();
        } else if (parsedState.item_count === 0 && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper.querySelector('.drawer__inner-empty'), cartDrawerWrapper.querySelector('a'));
        } else if (document.querySelector('.cart-item') && cartDrawerWrapper) {
          trapFocus(cartDrawerWrapper, document.querySelector('.cart-item__name'));
        }

        publish(PUB_SUB_EVENTS.cartUpdate, { source: 'cart-items', cartData: parsedState, variantId: variantId });
      })
      .catch(() => {
        this.querySelectorAll('.loading__spinner').forEach((overlay) => overlay.classList.add('hidden'));
        const errors = document.getElementById('cart-errors') || document.getElementById('CartDrawer-CartErrors');
        if (errors) {
          errors.textContent = window.cartStrings.error;
        }
      })
      .finally(() => {
        this.disableLoading(line);
      });
  }

  updateLiveRegions(line, message) {
    const lineItemError =
      document.getElementById(`Line-item-error-${line}`) || document.getElementById(`CartDrawer-LineItemError-${line}`);
    if (lineItemError) lineItemError.querySelector('.cart-item__error-text').textContent = message;

    this.lineItemStatusElement.setAttribute('aria-hidden', true);

    const cartStatus =
      document.getElementById('cart-live-region-text') || document.getElementById('CartDrawer-LiveRegionText');
    cartStatus.setAttribute('aria-hidden', false);

    setTimeout(() => {
      cartStatus.setAttribute('aria-hidden', true);
    }, 1000);
  }

  getSectionInnerHTML(html, selector) {
    return new DOMParser().parseFromString(html, 'text/html').querySelector(selector).innerHTML;
  }

  enableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    if (mainCartItems) {
      mainCartItems.classList.add('cart__items--disabled');
    }

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    [...cartItemElements, ...cartDrawerItemElements].forEach((overlay) => overlay.classList.remove('hidden'));

    if (document.activeElement) document.activeElement.blur();
    this.lineItemStatusElement.setAttribute('aria-hidden', false);
  }

  disableLoading(line) {
    const mainCartItems = document.getElementById('main-cart-items') || document.getElementById('CartDrawer-CartItems');
    if (mainCartItems) {
      mainCartItems.classList.remove('cart__items--disabled');
    }

    const cartItemElements = this.querySelectorAll(`#CartItem-${line} .loading__spinner`);
    const cartDrawerItemElements = this.querySelectorAll(`#CartDrawer-Item-${line} .loading__spinner`);

    cartItemElements.forEach((overlay) => overlay.classList.add('hidden'));
    cartDrawerItemElements.forEach((overlay) => overlay.classList.add('hidden'));
  }
}

customElements.define('cart-items', CartItems);


if (!customElements.get('cart-note')) {
  customElements.define(
    'cart-note',
    class CartNote extends HTMLElement {
      constructor() {
        super();

        this.addEventListener(
          'input',
          debounce((event) => {
            const body = JSON.stringify({ note: event.target.value });
            fetch(`${routes.cart_update_url}`, { ...fetchConfig(), ...{ body } });
          }, ON_CHANGE_DEBOUNCE_TIMER)
        );
      }
    }
  );
}



// ===============================
// Cart drawer recommendations (único sistema)
// ===============================

async function loadCartDrawerRecommendations() {
  const drawer = document.querySelector('cart-drawer');
  if (!drawer) return;

  const recSection = drawer.querySelector('#CartDrawer-Recs');
  const list = recSection && recSection.querySelector('.scd-recs__list');
  const moreBtn = recSection && recSection.querySelector('.scd-recs__more-btn');

  if (!recSection || !list) return;

  const root =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  let productIds = [];

  // 1) Script embebido con los IDs
  const idsScript = drawer.querySelector('#CartDrawer-ProductIds');
  if (idsScript) {
    try {
      productIds = JSON.parse(idsScript.textContent || '[]') || [];
    } catch (e) {
      console.warn('Cart drawer recs: error parsing product ids', e);
    }
  }

  // 2) Fallback: /cart.js si lo anterior falla o viene vacío
  if (!productIds.length) {
    try {
      const cartRes = await fetch(`${root}cart.js`, {
        headers: { Accept: 'application/json' }
      });
      if (cartRes.ok) {
        const cartData = await cartRes.json();
        productIds = Array.from(
          new Set((cartData.items || []).map((item) => item.product_id))
        );
      }
    } catch (e) {
      console.warn('Cart drawer recs: error leyendo cart.js', e);
    }
  }

  if (!productIds.length) {
    recSection.classList.add('is-empty');
    list.innerHTML = '';
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  // Skeleton mientras carga
  recSection.classList.remove('is-empty');
  list.innerHTML = `
    <div class="scd-rec__skeleton"></div>
    <div class="scd-rec__skeleton"></div>
  `;
  if (moreBtn) moreBtn.hidden = true;

  // --- Multi-product recommendations para que no desaparezcan ---
  async function fetchRecommendationsForProductIds(ids) {
    const limited = ids.slice(0, 4); // hasta 4 productos del carrito
    const requests = limited.map((id) =>
      fetch(
        `${root}recommendations/products.json?product_id=${id}&limit=6&intent=related`
      )
        .then((res) => (res.ok ? res.json() : { products: [] }))
        .then((data) => data.products || [])
        .catch(() => [])
    );

    const results = await Promise.all(requests);
    const merged = [];
    const seen = new Set();

    results.flat().forEach((product) => {
      const pid = String(product.id);
      if (seen.has(pid)) return;
      seen.add(pid);
      merged.push(product);
    });

    return merged;
  }

  let products = [];
  try {
    products = await fetchRecommendationsForProductIds(productIds);
  } catch (e) {
    console.warn('Cart drawer recs: fetch multi-id failed', e);
  }

  if (!products.length) {
    recSection.classList.add('is-empty');
    list.innerHTML = '';
    if (moreBtn) moreBtn.hidden = true;
    return;
  }

  const currency =
    (window.Shopify &&
      window.Shopify.currency &&
      window.Shopify.currency.active) ||
    'USD';

  list.innerHTML = '';

  function buildCard(product) {
    const variant =
      product.variants && product.variants.length
        ? product.variants.find((v) => v.available) || product.variants[0]
        : null;
    if (!variant) return null;

    const price = (variant.price / 100).toLocaleString(undefined, {
      style: 'currency',
      currency
    });

    let imageUrl = '';
    let imageAlt = product.title;

    if (product.featured_image) {
      if (typeof product.featured_image === 'string') {
        imageUrl = product.featured_image;
      } else {
        imageUrl =
          product.featured_image.url || product.featured_image.src || '';
        imageAlt = product.featured_image.alt || imageAlt;
      }
    }

    if (!imageUrl && product.image) {
      if (typeof product.image === 'string') {
        imageUrl = product.image;
      } else {
        imageUrl = product.image.url || product.image.src || '';
        if (product.image.alt) imageAlt = product.image.alt;
      }
    }

    if (!imageUrl && Array.isArray(product.images) && product.images.length) {
      const img0 = product.images[0];
      if (typeof img0 === 'string') {
        imageUrl = img0;
      } else if (img0) {
        imageUrl = img0.url || img0.src || '';
        if (img0.alt) imageAlt = img0.alt;
      }
    }

    if (imageUrl && imageUrl.startsWith('//')) {
      imageUrl = 'https:' + imageUrl;
    }

    const card = document.createElement('article');
    card.className = 'scd-rec';
    card.innerHTML = `
      <a href="${product.url}" class="scd-rec__image-wrap" aria-hidden="true" tabindex="-1">
        <img class="scd-rec__image" src="${imageUrl}" alt="${imageAlt}">
      </a>
      <div class="scd-rec__body">
        <p class="scd-rec__name">${product.title}</p>
        <p class="scd-rec__price">${price}</p>
      </div>
      <div class="scd-rec__actions">
        <button
          type="button"
          class="scd-rec__btn"
          data-variant-id="${variant.id}"
          aria-label="Add ${product.title} to cart"
        >
          ADD
        </button>
      </div>
    `;
    return card;
  }

  const visibleProducts = products.slice(0, 3);
  const extraProducts = products.slice(3, 5);

  visibleProducts.forEach((p) => {
    const card = buildCard(p);
    if (card) list.appendChild(card);
  });

  if (moreBtn) {
    if (extraProducts.length) {
      moreBtn.hidden = false;
      moreBtn.onclick = () => {
        extraProducts.forEach((p) => {
          const card = buildCard(p);
          if (card) list.appendChild(card);
        });
        moreBtn.hidden = true;
      };
    } else {
      moreBtn.hidden = true;
    }
  }

  if (!list.children.length) {
    recSection.classList.add('is-empty');
  } else {
    recSection.classList.remove('is-empty');
  }

  // Delegación de click (solo una vez)
  if (!list.__scdRecsBound) {
    list.addEventListener('click', onCartDrawerRecClick);
    list.__scdRecsBound = true;
  }
}

async function onCartDrawerRecClick(event) {
  const addBtn = event.target.closest('.scd-rec__btn');
  if (!addBtn) return;

  event.preventDefault();
  event.stopPropagation();

  const root =
    (window.Shopify && window.Shopify.routes && window.Shopify.routes.root) || '/';

  const variantId = addBtn.dataset.variantId;
  if (!variantId) return;

  const addedVariantId = Number(variantId);
  addBtn.disabled = true;

  try {
    // 1) Agregar al carrito SIN cerrar el drawer
    await fetch(`${root}cart/add.js`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Accept: 'application/json'
      },
      body: JSON.stringify({
        id: addedVariantId,
        quantity: 1
      })
    });

    // 2) Disparar pub/sub nativo
    if (typeof publish === 'function' && window.PUB_SUB_EVENTS && PUB_SUB_EVENTS.cartUpdate) {
      publish(PUB_SUB_EVENTS.cartUpdate, {
        source: 'recommendations',
        variantId: addedVariantId
      });
    }

    // 3) Refrescar SOLO el contenido del cart drawer (items + footer)
    try {
      const res = await fetch(`${root}cart?section_id=cart-drawer`);
      if (res.ok) {
        const htmlText = await res.text();
        const doc = new DOMParser().parseFromString(htmlText, 'text/html');

        const newItems = doc.querySelector('cart-drawer-items');
        const newFooter = doc.querySelector('.cart-drawer__footer');

        const currentItems = document.querySelector('cart-drawer-items');
        const currentFooter = document.querySelector('.cart-drawer__footer');

        if (currentItems && newItems) {
          currentItems.replaceWith(newItems);
        }
        if (currentFooter && newFooter) {
          currentFooter.replaceWith(newFooter);
        }

        // 4) Marcar el ítem recién agregado con fade-in
        const drawerEl = document.querySelector('cart-drawer');
        if (drawerEl) {
          const highlightBtn = drawerEl.querySelector(
            `.scd-item__remove-btn[data-variant-id="${addedVariantId}"]`
          );
          if (highlightBtn) {
            const row = highlightBtn.closest('.cart-item');
            if (row) {
              row.classList.add('scd-cart-item--just-added');
              row.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
              setTimeout(() => {
                row.classList.remove('scd-cart-item--just-added');
              }, 500);
            }
          }
        }

        // 5) Re-inicializar recomendaciones con el nuevo estado del carrito
        if (window.initDrawerRecommendations) {
          window.initDrawerRecommendations();
        }
      }
    } catch (e) {
      console.error('Cart drawer recs: error refreshing drawer', e);
    }
  } catch (e) {
    console.error('Cart drawer recs: error adding item', e);
  } finally {
    addBtn.disabled = false;
  }
}

function initCartDrawerRecs() {
  if (window.__cartDrawerRecsTimeout) {
    clearTimeout(window.__cartDrawerRecsTimeout);
  }
  window.__cartDrawerRecsTimeout = setTimeout(loadCartDrawerRecommendations, 50);
}

function setupCartDrawerObserver() {
  if (window.__scdCartDrawerObserverInitialized) return;
  window.__scdCartDrawerObserverInitialized = true;

  const observer = new MutationObserver((mutations) => {
    for (const m of mutations) {
      for (const node of m.addedNodes) {
        if (
          node.nodeType === 1 &&
          node.tagName &&
          node.tagName.toLowerCase() === 'cart-drawer'
        ) {
          initCartDrawerRecs();
          return;
        }
      }
    }
  });
  // Permitir que otros scripts del tema llamen a las recomendaciones del drawer
  window.initDrawerRecommendations = initCartDrawerRecs;

  observer.observe(document.body, { childList: true, subtree: true });
}

// 🔔 NUEVO: hook global al pub/sub del carrito
if (typeof subscribe === 'function' && window.PUB_SUB_EVENTS && PUB_SUB_EVENTS.cartUpdate) {
  if (!window.__scdGlobalCartUpdateSub) {
    window.__scdGlobalCartUpdateSub = subscribe(PUB_SUB_EVENTS.cartUpdate, () => {
      // Cada vez que el carrito cambie (qty, remove, etc), re-sync recs del drawer
      initCartDrawerRecs();
    });
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initCartDrawerRecs();
  setupCartDrawerObserver();
});

document.addEventListener('cart:refresh', initCartDrawerRecs);
document.addEventListener('shopify:section:load', (event) => {
  if (
    event &&
    event.target &&
    event.target.querySelector &&
    event.target.querySelector('cart-drawer')
  ) {
    initCartDrawerRecs();
  }
});

// Bridge para el código que llama initDrawerRecommendations (como CartItems.onCartUpdate)
window.initDrawerRecommendations = initCartDrawerRecs;
