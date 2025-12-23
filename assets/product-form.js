/* assets/product-form.js — CacoAmerica fix
   - Hard-reset de swatches (evita que desaparezcan al volver)
   - Filtro suave opcional con JSON de variantes
   - Sincronización de galería con featured_media de la variante
*/
if (!customElements.get('product-form')) {
  customElements.define(
    'product-form',
    class ProductForm extends HTMLElement {
      constructor() {
        super();

        this.form = this.querySelector('form');
        this.variantIdInput.disabled = false;
        this.form.addEventListener('submit', this.onSubmitHandler.bind(this));
        this.cart = document.querySelector('cart-notification') || document.querySelector('cart-drawer');
        this.submitButton = this.querySelector('[type="submit"]');
        this.submitButtonText = this.submitButton.querySelector('span');
        if (document.querySelector('cart-drawer')) this.submitButton.setAttribute('aria-haspopup', 'dialog');
        this.hideErrors = this.dataset.hideErrors === 'true';

        // ===== NUEVO: referencias y hooks de variante =====
        this.productEl = this.closest('product-info') || document.querySelector('product-info');
        this._lastVariantId = this.variantIdInput?.value || null;

        this._onVariantEvent = (e) => {
          const v = e.detail?.variant || e.detail?.selectedVariant || null;
          if (v) window.__lastSelectedVariant = v;
          this._afterVariantChanged(v);
        };
        document.addEventListener('variant:change', this._onVariantEvent);
        document.addEventListener('variant:changed', this._onVariantEvent);
        document.addEventListener('product:variant-change', this._onVariantEvent);

        // Fallback: vigila cambios del hidden [name="id"] en caso de temas que no emiten eventos
        this._vidPoll = window.setInterval(() => {
          const cur = this.variantIdInput?.value || null;
          if (cur !== this._lastVariantId) {
            this._lastVariantId = cur;
            this._afterVariantChanged(window.__lastSelectedVariant || null);
          }
        }, 300);
      }

      disconnectedCallback() {
        document.removeEventListener('variant:change', this._onVariantEvent);
        document.removeEventListener('variant:changed', this._onVariantEvent);
        document.removeEventListener('product:variant-change', this._onVariantEvent);
        if (this._vidPoll) clearInterval(this._vidPoll);
      }

      // ========= HELPERS =========
      _norm(v) {
        return String(v ?? '')
          .trim()
          .toLowerCase()
          .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          .replace(/[\s_]+/g, '-')
          .replace(/[^a-z0-9-]/g, '');
      }

      _findQtyGroup() {
        const rootEl = this.productEl || document;
        const names = ['Quantity', 'Pack', 'Cantidad'];

        // 1) data-attrs
        for (const n of names) {
          const el = rootEl.querySelector(
            `[data-swatch-group][data-option-name="${n}"], [data-option-label="${n}"]`
          );
          if (el) return el.closest('.product-form__input') || el;
        }

        // 2) legend/label
        const legends = rootEl.querySelectorAll('legend, .form__label, .product-form__input legend');
        for (const lg of legends) {
          const t = (lg.textContent || '').trim().toLowerCase();
          if (t && names.some(n => t.includes(n.toLowerCase()))) {
            return lg.closest('.product-form__input') || lg.parentElement;
          }
        }

        // 3) fallback por contenido
        const groups = rootEl.querySelectorAll('.product-form__input, fieldset');
        for (const g of groups) {
          const txt = (g.textContent || '').toLowerCase();
          if (/(pack|cantidad|quantity)/.test(txt)) return g;
        }
        return null;
      }

      _hardResetSwatchGroup(groupEl) {
        if (!groupEl) return;
        const all = groupEl.querySelectorAll('*');
        all.forEach(el => {
          el.hidden = false;
          el.removeAttribute?.('hidden');
          el.classList?.remove('is-disabled', 'd-none', 'hidden');
          if (el.style) el.style.removeProperty?.('display');
          if (el.tagName === 'INPUT') el.disabled = false;
        });
        groupEl.hidden = false;
        groupEl.removeAttribute?.('hidden');
        groupEl.classList?.remove('d-none', 'hidden');
        groupEl.style && groupEl.style.removeProperty?.('display');
      }

      _getCurrentSelection() {
        const rootEl = this.productEl || document;
        const sel = { option1: null, option2: null, option3: null };
        const groups = rootEl.querySelectorAll('.product-form__input, fieldset');
        let i = 1;
        groups.forEach(g => {
          if (i > 3) return;
          const r = g.querySelector('input[type="radio"][name^="options["]:checked');
          if (r) { sel[`option${i++}`] = r.value; return; }
          const s = g.querySelector('select[name^="options["]');
          if (s && s.value) { sel[`option${i++}`] = s.value; }
        });
        return sel;
      }

      _softFilterAllowed(groupEl, variants, current) {
        if (!Array.isArray(variants) || !variants.length || !groupEl) return;

        // Detecta option key por label; si no, asume option2
        let optionKey = 'option2';
        const optIdxEls = document.querySelectorAll('[data-option-index][data-index]');
        optIdxEls.forEach(el => {
          const key = el.getAttribute('data-index'); // option1/2/3
          const label = el.getAttribute('data-option-label') || '';
          const ln = this._norm(label);
          if (ln === this._norm('Quantity') || ln === this._norm('Pack') || ln === this._norm('Cantidad')) {
            optionKey = key;
          }
        });

        const allowed = new Set();
        variants.forEach(v => {
          const ok = ['option1', 'option2', 'option3']
            .filter(k => k !== optionKey)
            .every(k => !current[k] || this._norm(v[k]) === this._norm(current[k]));
          if (ok && v.available !== false && v.unavailable !== true) {
            allowed.add(this._norm(v[optionKey]));
          }
        });

        // Oculta solo los no permitidos
        const widgets = groupEl.querySelectorAll('input[type="radio"], [data-swatch], label');
        widgets.forEach(el => {
          const raw = el.getAttribute?.('data-value') || (el.tagName === 'INPUT' ? el.value : el.textContent) || '';
          const val = this._norm(raw);
          const pass = val === 'all-show' || allowed.has(val);
          if (el.tagName === 'INPUT') {
            el.disabled = !pass; el.hidden = !pass;
          } else {
            el.classList.toggle('is-disabled', !pass);
            el.hidden = !pass;
            if (!pass) el.style.display = 'none';
          }
        });

        // Si el checked quedó oculto, selecciona el primero visible
        const chk = groupEl.querySelector('input[type="radio"]:checked');
        if (chk && (chk.disabled || chk.hidden)) {
          const first = groupEl.querySelector('input[type="radio"]:not([disabled]):not([hidden])');
          if (first) first.click();
        }
      }

      // ======= NUEVO: sincronización de galería/thumbnail con la variante =======
      _selectByMediaId(mediaId) {
        if (!mediaId) return false;
        const r = this.productEl || document;

        // Busca botón/thumbnail por aria-controls="Media-<id>"
        let pick =
          r.querySelector(`.thumbnail[aria-controls="Media-${mediaId}"]`) ||
          r.querySelector(`.thumbnail [aria-controls="Media-${mediaId}"]`) ||
          r.querySelector(`[data-media-id="Media-${mediaId}"]`) ||
          r.querySelector(`#Media-${mediaId}`);

        if (!pick) return false;

        const btn = pick.closest('button, .thumbnail, [data-media-id]') || pick;
        // En algunos temas el click en el anchor interno hace el cambio correcto
        const target = btn.querySelector('[aria-controls]') || btn;

        // Varios intentos porque el DOM del carrusel puede refrescar
        const tryClick = () => {
          try { target.click?.(); } catch(e) {}
          // Marca como activa y hace scroll al thumb si existe
          btn.classList?.add('is-active');
          btn.scrollIntoView?.({ behavior: 'smooth', block: 'nearest', inline: 'nearest' });
        };

        requestAnimationFrame(tryClick);
        setTimeout(tryClick, 0);
        setTimeout(tryClick, 200);

        return true;
      }

      _syncGalleryToVariant(variant) {
        const v = variant || window.__lastSelectedVariant || null;
        const mediaId = v?.featured_media?.id || null;
        if (mediaId) {
          if (this._selectByMediaId(mediaId)) return;

          // Fallback: si no encontró por ID, fuerza que haya al menos una imagen visible
          const list = (this.productEl || document).querySelector('.product__media-list');
          if (list) {
            const first = list.querySelector('.product__media-item, [id^="Media-"]');
            if (first) {
              try { first.scrollIntoView?.({ behavior: 'smooth', block: 'nearest' }); } catch(_) {}
            }
          }
        }
      }

      _afterVariantChanged(passedVariant = null) {
        // Re-emite unificado para otros scripts
        try {
          const detail = {
            productEl: this.productEl,
            variant: passedVariant || null,
            selectedVariant: passedVariant || null
          };
          document.dispatchEvent(new CustomEvent('variant:changed', { detail }));
        } catch (_) {}

        // 1) Hard reset agresivo del grupo Quantity/Pack
        const qtyGroup = this._findQtyGroup();
        if (qtyGroup) this._hardResetSwatchGroup(qtyGroup);

        // 2) Filtro suave si hay JSON de variantes global disponible
        const variants =
          window.__variants ||
          window?.theme?.productData?.variants ||
          [];
        if (qtyGroup && Array.isArray(variants) && variants.length) {
          this._softFilterAllowed(qtyGroup, variants, this._getCurrentSelection());
        }

        // 3) Botón Add to cart: habilita si hay variant id
        const vid = this.variantIdInput?.value;
        if (vid) this.toggleSubmitButton(false);

        // 4) NUEVO: sincroniza galería con el featured_media de la variante
        this._syncGalleryToVariant(passedVariant);
      }

      // ========= ENVÍO AL CARRITO (código original) =========
      async onSubmitHandler(evt) {
        evt.preventDefault();
        if (this.submitButton.getAttribute('aria-disabled') === 'true') return;

        this.handleErrorMessage();

        this.submitButton.setAttribute('aria-disabled', true);
        this.submitButton.classList.add('loading');
        this.querySelector('.loading__spinner').classList.remove('hidden');

        const config = fetchConfig('javascript');
        config.headers['X-Requested-With'] = 'XMLHttpRequest';
        delete config.headers['Content-Type'];

        const formData = new FormData(this.form);
        if (this.cart) {
          formData.append(
            'sections',
            this.cart.getSectionsToRender().map((section) => section.id)
          );
          formData.append('sections_url', window.location.pathname);
          this.cart.setActiveElement(document.activeElement);
        }
        config.body = formData;

        try {
          const response = await fetch(`${routes.cart_add_url}`, config).then((res) => res.json());
          const availabilityMessage = response?.description || response?.message || '';
          const normalizedMessage = String(availabilityMessage || '').toLowerCase();
          const limitedAvailability = normalizedMessage.includes('added to your cart due to availability');
          const maxQuantityLimit =
            normalizedMessage.includes('maximum quantity of this item is already in your cart') ||
            normalizedMessage.includes('maximum quantity');

          if (maxQuantityLimit) {
            this.error = false;
            this.handleErrorMessage(false);
            await this.renderDrawerAfterAvailabilityLimit(
              formData,
              availabilityMessage || 'The maximum quantity of this item is already in your cart.'
            );
            return;
          }

          if (response.status && !limitedAvailability && !maxQuantityLimit) {
            publish(PUB_SUB_EVENTS.cartError, {
              source: 'product-form',
              productVariantId: formData.get('id'),
              errors: response.errors || response.description,
              message: response.message,
            });
            this.handleErrorMessage(response.description);

            const soldOutMessage = this.submitButton.querySelector('.sold-out-message');
            if (!soldOutMessage) return;
            this.submitButton.setAttribute('aria-disabled', true);
            this.submitButtonText.classList.add('hidden');
            soldOutMessage.classList.remove('hidden');
            this.error = true;
            return;
          }

          if (!this.cart) {
            window.location = window.routes.cart_url;
            return;
          }

          if (limitedAvailability) {
            this.error = false;
            this.handleErrorMessage(false);
            await this.renderDrawerAfterAvailabilityLimit(formData, availabilityMessage);
            return;
          }

          if (!this.error)
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'product-form',
              productVariantId: formData.get('id'),
              cartData: response,
            });
          this.error = false;
          const quickAddModal = this.closest('quick-add-modal');
          if (quickAddModal) {
            document.body.addEventListener(
              'modalClosed',
              () => {
                setTimeout(() => {
                  this.cart.renderContents(response);
                });
              },
              { once: true }
            );
            quickAddModal.hide(true);
          } else {
            this.cart.renderContents(response);
          }
        } catch (e) {
          console.error(e);
        } finally {
          this.submitButton.classList.remove('loading');
          if (this.cart && this.cart.classList.contains('is-empty')) this.cart.classList.remove('is-empty');
          if (!this.error) this.submitButton.removeAttribute('aria-disabled');
          this.querySelector('.loading__spinner').classList.add('hidden');
        }
      }

      handleErrorMessage(errorMessage = false) {
        if (this.hideErrors) return;
        this.errorMessageWrapper =
          this.errorMessageWrapper || this.querySelector('.product-form__error-message-wrapper');
        if (!this.errorMessageWrapper) return;
        this.errorMessage = this.errorMessage || this.errorMessageWrapper.querySelector('.product-form__error-message');

        this.errorMessageWrapper.toggleAttribute('hidden', !errorMessage);
        if (errorMessage) this.errorMessage.textContent = errorMessage;
      }

      async renderDrawerAfterAvailabilityLimit(formData, message) {
        if (!this.cart) return;
        try {
          const sectionIds = this.cart.getSectionsToRender().map((section) => section.id);
          const sectionsUrl = `${routes.cart_url}?sections=${sectionIds.join(',')}`;
          const [sectionsResponse, cartDataResponse] = await Promise.all([
            fetch(sectionsUrl),
            fetch(`${routes.cart_url}.js`),
          ]);

          if (!sectionsResponse.ok) return;
          const sections = await sectionsResponse.json();
          const cartData = cartDataResponse.ok ? await cartDataResponse.json() : null;

          this.cart.renderContents({ sections, id: formData.get('id') });
          if (!this.error && cartData) {
            publish(PUB_SUB_EVENTS.cartUpdate, {
              source: 'product-form',
              productVariantId: formData.get('id'),
              cartData,
            });
          }

          requestAnimationFrame(() => this.showDrawerAvailabilityMessage(message));
        } catch (error) {
          console.error(error);
        }
      }

      showDrawerAvailabilityMessage(message) {
        const drawer = document.querySelector('cart-drawer');
        if (!drawer) return;

        const banner = drawer.querySelector('#CartDrawer-AvailabilityMessage');
        if (!banner) return;

        const textEl = banner.querySelector('.cart-drawer__notice-text');
        const barEl = banner.querySelector('.cart-drawer__notice-bar');
        const durationMs = 7000;

        if (textEl) textEl.textContent = message;
        banner.style.setProperty('--cart-notice-duration', `${durationMs}ms`);
        banner.classList.add('is-visible');

        if (barEl) {
          barEl.style.animation = 'none';
          // Force reflow to restart animation
          void barEl.offsetWidth;
          barEl.style.animation = '';
        }

        clearTimeout(this.drawerMessageTimer);
        this.drawerMessageTimer = setTimeout(() => {
          banner.classList.remove('is-visible');
          if (textEl) textEl.textContent = '';
        }, durationMs);
      }

      toggleSubmitButton(disable = true, text) {
        if (disable) {
          this.submitButton.setAttribute('disabled', 'disabled');
          if (text) this.submitButtonText.textContent = text;
        } else {
          this.submitButton.removeAttribute('disabled');
          this.submitButtonText.textContent = window.variantStrings.addToCart;
        }
      }

      get variantIdInput() {
        return this.form.querySelector('[name=id]');
      }
    }
  );
}
