if (!customElements.get("product-info")) {
  customElements.define(
    "product-info",
    class ProductInfo extends HTMLElement {
      quantityInput = undefined;
      quantityForm = undefined;
      onVariantChangeUnsubscriber = undefined;
      cartUpdateUnsubscriber = undefined;
      abortController = undefined;
      pendingRequestUrl = null;
      preProcessHtmlCallbacks = [];
      postProcessHtmlCallbacks = [];

      constructor() {
        super();

        this.quantityInput = this.querySelector(".quantity__input");
      }

      connectedCallback() {
        this.initializeProductSwapUtility();

        this.onVariantChangeUnsubscriber = subscribe(
          PUB_SUB_EVENTS.optionValueSelectionChange,
          this.handleOptionValueChange.bind(this)
        );

        this.initQuantityHandlers();
        this.initSubscriptionHandlers();
        this.dispatchEvent(
          new CustomEvent("product-info:loaded", { bubbles: true })
        );
      }

      addPreProcessCallback(callback) {
        this.preProcessHtmlCallbacks.push(callback);
      }

      initQuantityHandlers() {
        if (!this.quantityInput) return;

        this.quantityForm = this.querySelector(".product-form__quantity");
        if (!this.quantityForm) return;

        this.setQuantityBoundries();
        if (!this.dataset.originalSection) {
          this.cartUpdateUnsubscriber = subscribe(
            PUB_SUB_EVENTS.cartUpdate,
            this.fetchQuantityRules.bind(this)
          );
        }
      }

      disconnectedCallback() {
        this.onVariantChangeUnsubscriber();
        this.cartUpdateUnsubscriber?.();
      }

      initializeProductSwapUtility() {
        this.preProcessHtmlCallbacks.push((html) =>
          html
            .querySelectorAll(".scroll-trigger")
            .forEach((element) =>
              element.classList.add("scroll-trigger--cancel")
            )
        );
        this.postProcessHtmlCallbacks.push((newNode) => {
          window?.Shopify?.PaymentButton?.init();
          window?.ProductModel?.loadShopifyXR();
          this.initSubscriptionHandlers();
        });
      }

      handleOptionValueChange({
        data: { event, target, selectedOptionValues },
      }) {
        if (!this.contains(event.target)) return;

        this.resetProductFormState();

        const productUrl =
          target.dataset.productUrl ||
          this.pendingRequestUrl ||
          this.dataset.url;
        this.pendingRequestUrl = productUrl;
        const shouldSwapProduct = this.dataset.url !== productUrl;
        const shouldFetchFullPage =
          this.dataset.updateUrl === "true" && shouldSwapProduct;

        // Optimistic update
        const variant = this.findVariantByValues(selectedOptionValues);
        if (variant) {
          window.__lastSelectedVariant = variant;
          this.updateURL(productUrl, variant.id);
          this.updateVariantInputs(variant.id);
          this.filterMedia(variant);
          this.filterMediaGallery(variant);

          // Show loading state for price and dynamic elements
          const loadingSelectors = ["price", "Inventory", "Sku", "Price-Per-Item", "Volume"];
          loadingSelectors.forEach(id => {
            const el = document.getElementById(`${id}-${this.sectionId}`);
            if (el) el.style.opacity = '0.5';
          });
        } else {
          // Attempt to find a fallback if exact match doesn't exist optimistically
          const fallbackVariant = this.findFallbackVariant(selectedOptionValues);
          if (fallbackVariant && fallbackVariant.id !== (window.__lastSelectedVariant?.id)) {
            // We could apply fallback here, but it might be safer to let the server decide 
            // or just wait for the render loop to handle strict fallbacks.
            // For now, we mainly want to catch valid clicks fast.
          }
        }

        const sellingPlanSelect = this.querySelector('select[name="selling_plan"]');
        const purchaseOption = this.querySelector('input[name="purchase_option"]:checked')?.value;
        const sellingPlanId = purchaseOption === 'subscription' ? sellingPlanSelect?.value : null;

        if (variant) {
          this.updateSubscriptionCardsOptimistically(variant.id);
        }

        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithParams(
            productUrl,
            selectedOptionValues,
            shouldFetchFullPage,
            variant?.id,
            sellingPlanId
          ),
          targetId: target.id,
          callback: shouldSwapProduct
            ? this.handleSwapProduct(productUrl, shouldFetchFullPage)
            : this.handleUpdateProductInfo(productUrl),
        });
      }

      resetProductFormState() {
        const productForm = this.productForm;
        productForm?.toggleSubmitButton(true);
        productForm?.handleErrorMessage();
      }

      handleSwapProduct(productUrl, updateFullPage) {
        return (html) => {
          this.productModal?.remove();

          const selector = updateFullPage
            ? "product-info[id^='MainProduct']"
            : "product-info";
          const variant = this.getSelectedVariant(html.querySelector(selector));
          if (variant) window.__lastSelectedVariant = variant;
          this.updateURL(productUrl, variant?.id);


          if (updateFullPage) {
            document.querySelector("head title").innerHTML =
              html.querySelector("head title").innerHTML;

            HTMLUpdateUtility.viewTransition(
              document.querySelector("main"),
              html.querySelector("main"),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          } else {
            HTMLUpdateUtility.viewTransition(
              this,
              html.querySelector("product-info"),
              this.preProcessHtmlCallbacks,
              this.postProcessHtmlCallbacks
            );
          }
        };
      }

      renderProductInfo({ requestUrl, targetId, callback }) {
        this.abortController?.abort();
        this.abortController = new AbortController();

        fetch(requestUrl, { signal: this.abortController.signal })
          .then((response) => response.text())
          .then((responseText) => {
            this.pendingRequestUrl = null;
            const html = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );
            callback(html);
          })
          .then(() => {
            // set focus to last clicked option value
            document.querySelector(`#${targetId}`)?.focus();
          })
          .catch((error) => {
            if (error.name === "AbortError") {
              console.log("Fetch aborted by user");
            } else {
              console.error(error);
            }
          });
      }

      getSelectedVariant(productInfoNode) {


        //  setTimeout(() => {
        //     console.log('asd;iwesedqwew');
        //   const priceBox = document.querySelector(".price.price--show-badge");
        //   const discountedEls = document.querySelectorAll(".variant-price-discounted");

        //   if (!priceBox) return;

        //   if (priceBox.classList.contains("price--on-sale")) {
        //     discountedEls.forEach(el => el.classList.remove("hidden"));
        //   } else {
        //     discountedEls.forEach(el => el.classList.add("hidden"));
        //   }
        // }, 0); // adjust delay if needed

        const selectedVariant = productInfoNode.querySelector(
          "variant-selects [data-selected-variant]"
        )?.innerHTML;
        return !!selectedVariant ? JSON.parse(selectedVariant) : null;
      }

      buildRequestUrlWithParams(
        url,
        optionValues,
        shouldFetchFullPage = false,
        variantId = null,
        sellingPlanId = null
      ) {
        const params = [];

        !shouldFetchFullPage && params.push(`section_id=${this.sectionId}`);

        if (variantId) {
          params.push(`variant=${variantId}`);
        } else if (optionValues.length) {
          params.push(`option_values=${optionValues.join(",")}`);
        }

        if (sellingPlanId) {
          params.push(`selling_plan=${sellingPlanId}`);
        }

        return `${url}?${params.join("&")}`;
      }

      updateOptionValues(html) {
        const variantSelects = html.querySelector("variant-selects");
        if (variantSelects && this.variantSelectors) {
          this.variantSelectors.innerHTML = variantSelects.innerHTML;
        }
      }


      handleUpdateProductInfo(productUrl) {
        return (html) => {
          const requestedValues = this.currentOptionValues;
          const variant = this.getSelectedVariant(html);

          // If the server-side fallback gave us a variant that doesn't match our intended selection,
          // we try to find a better match in our client-side variants (prioritizing the clicked option).
          if (variant && !this.isMatchingVariant(variant, requestedValues)) {
            const betterMatch = this.findFallbackVariant(requestedValues);
            if (betterMatch && betterMatch.id !== variant.id) {
              this.applyVariantSelections(betterMatch);
              return;
            }
          }

          if (variant) window.__lastSelectedVariant = variant;

          this.pickupAvailability?.update(variant);
          this.updateOptionValues(html);
          this.updateURL(productUrl, variant?.id);
          this.updateVariantInputs(variant?.id);

          if (!variant) {
            const fallbackVariant = this.findFallbackVariant(requestedValues);
            if (fallbackVariant) {
              this.applyVariantSelections(fallbackVariant);
              return;
            }
            this.setUnavailable();
            return;
          }

          this.updateMedia(html, variant?.featured_media?.id);

          const updateSourceFromDestination = (
            id,
            shouldHide = (source) => false
          ) => {
            const source = html.getElementById(`${id}-${this.sectionId}`);
            const destination = this.querySelector(
              `#${id}-${this.dataset.section}`
            );
            if (source && destination) {
              destination.innerHTML = source.innerHTML;
              destination.classList.toggle("hidden", shouldHide(source));
            }
          };

          updateSourceFromDestination("price");
          updateSourceFromDestination("Sku", ({ classList }) =>
            classList.contains("hidden")
          );
          updateSourceFromDestination(
            "varilogo",
            ({ innerText }) => innerText === ""
          );
          updateSourceFromDestination(
            "Inventory",
            ({ innerText }) => innerText === ""
          );
          updateSourceFromDestination("Volume");
          updateSourceFromDestination("Price-Per-Item", ({ classList }) =>
            classList.contains("hidden")
          );

          // Remove loading state
          const loadingSelectors = ["price", "Inventory", "Sku", "Price-Per-Item", "Volume"];
          loadingSelectors.forEach(id => {
            const el = document.getElementById(`${id}-${this.sectionId}`);
            if (el) el.style.opacity = '';
          });

          this.updateQuantityRules(this.sectionId, html);
          this.querySelector(
            `#Quantity-Rules-${this.dataset.section}`
          )?.classList.remove("hidden");
          this.querySelector(
            `#Volume-Note-${this.dataset.section}`
          )?.classList.remove("hidden");

          // Explicit check for variant availability to force button state
          const submitButton = document.getElementById(`ProductSubmitButton-${this.dataset.section}`);
          if (variant && !variant.available) {
            this.productForm?.toggleSubmitButton(true, window.variantStrings.soldOut);
            if (submitButton) submitButton.disabled = true;
          } else if (variant && variant.available) {
            this.productForm?.toggleSubmitButton(false);
            if (submitButton) submitButton.disabled = false;
          } else {
            this.productForm?.toggleSubmitButton(true, window.variantStrings.unavailable);
            if (submitButton) submitButton.disabled = true;
          }


          publish(PUB_SUB_EVENTS.variantChange, {
            data: {
              sectionId: this.sectionId,
              html,
              variant,
            },
          });
          console.log(variant);
          this.filterMedia(variant);
          this.filterMediaGallery(variant);
        };
      }

      updateVariantInputs(variantId) {
        this.querySelectorAll(
          `#product-form-${this.dataset.section}, #product-form-installment-${this.dataset.section}`
        ).forEach((productForm) => {
          const input = productForm.querySelector('input[name="id"]');
          input.value = variantId ?? "";
          input.dispatchEvent(new Event("change", { bubbles: true }));
        });
      }

      updateURL(url, variantId) {
        this.querySelector("share-button")?.updateUrl(
          `${window.shopUrl}${url}${variantId ? `?variant=${variantId}` : ""}`
        );

        if (this.dataset.updateUrl === "false") return;
        window.history.replaceState(
          {},
          "",
          `${url}${variantId ? `?variant=${variantId}` : ""}`
        );
      }

      setUnavailable() {
        this.productForm?.toggleSubmitButton(
          true,
          window.variantStrings.unavailable
        );

        const selectors = [
          "price",
          "Inventory",
          "Sku",
          "Price-Per-Item",
          "Volume-Note",
          "Volume",
          "Quantity-Rules",
        ]
          .map((id) => `#${id}-${this.dataset.section}`)
          .join(", ");
        document
          .querySelectorAll(selectors)
          .forEach(({ classList }) => classList.add("hidden"));
      }

      updateMedia(html, variantFeaturedMediaId) {
        if (!variantFeaturedMediaId) return;

        const mediaGallerySource = this.querySelector("media-gallery ul");
        const mediaGalleryDestination = html.querySelector(`media-gallery ul`);

        const refreshSourceData = () => {
          if (this.hasAttribute("data-zoom-on-hover")) enableZoomOnHover(2);
          const mediaGallerySourceItems = Array.from(
            mediaGallerySource.querySelectorAll("li[data-media-id]")
          );
          const sourceSet = new Set(
            mediaGallerySourceItems.map((item) => item.dataset.mediaId)
          );
          const sourceMap = new Map(
            mediaGallerySourceItems.map((item, index) => [
              item.dataset.mediaId,
              { item, index },
            ])
          );
          return [mediaGallerySourceItems, sourceSet, sourceMap];
        };

        if (mediaGallerySource && mediaGalleryDestination) {
          let [mediaGallerySourceItems, sourceSet, sourceMap] =
            refreshSourceData();
          const mediaGalleryDestinationItems = Array.from(
            mediaGalleryDestination.querySelectorAll("li[data-media-id]")
          );
          const destinationSet = new Set(
            mediaGalleryDestinationItems.map(({ dataset }) => dataset.mediaId)
          );
          let shouldRefresh = false;

          // add items from new data not present in DOM
          for (let i = mediaGalleryDestinationItems.length - 1; i >= 0; i--) {
            if (
              !sourceSet.has(mediaGalleryDestinationItems[i].dataset.mediaId)
            ) {
              mediaGallerySource.prepend(mediaGalleryDestinationItems[i]);
              shouldRefresh = true;
            }
          }

          // remove items from DOM not present in new data
          for (let i = 0; i < mediaGallerySourceItems.length; i++) {
            if (
              !destinationSet.has(mediaGallerySourceItems[i].dataset.mediaId)
            ) {
              mediaGallerySourceItems[i].remove();
              shouldRefresh = true;
            }
          }

          // refresh
          if (shouldRefresh)
            [mediaGallerySourceItems, sourceSet, sourceMap] =
              refreshSourceData();

          // if media galleries don't match, sort to match new data order
          mediaGalleryDestinationItems.forEach(
            (destinationItem, destinationIndex) => {
              const sourceData = sourceMap.get(destinationItem.dataset.mediaId);

              if (sourceData && sourceData.index !== destinationIndex) {
                mediaGallerySource.insertBefore(
                  sourceData.item,
                  mediaGallerySource.querySelector(
                    `li:nth-of-type(${destinationIndex + 1})`
                  )
                );

                // refresh source now that it has been modified
                [mediaGallerySourceItems, sourceSet, sourceMap] =
                  refreshSourceData();
              }
            }
          );
        }

        // set featured media as active in the media gallery
        this.querySelector(`media-gallery`)?.setActiveMedia?.(
          `${this.dataset.section}-${variantFeaturedMediaId}`,
          true
        );

        // update media modal
        const modalContent = this.productModal?.querySelector(
          `.product-media-modal__content`
        );
        const newModalContent = html.querySelector(
          `product-modal .product-media-modal__content`
        );
        if (modalContent && newModalContent)
          modalContent.innerHTML = newModalContent.innerHTML;
      }

      setQuantityBoundries() {
        const data = {
          cartQuantity: this.quantityInput.dataset.cartQuantity
            ? parseInt(this.quantityInput.dataset.cartQuantity)
            : 0,
          min: this.quantityInput.dataset.min
            ? parseInt(this.quantityInput.dataset.min)
            : 1,
          max: this.quantityInput.dataset.max
            ? parseInt(this.quantityInput.dataset.max)
            : null,
          step: this.quantityInput.step ? parseInt(this.quantityInput.step) : 1,
        };

        let min = data.min;
        const max = data.max === null ? data.max : data.max - data.cartQuantity;
        if (max !== null) min = Math.min(min, max);
        if (data.cartQuantity >= data.min) min = Math.min(min, data.step);

        this.quantityInput.min = min;

        if (max) {
          this.quantityInput.max = max;
        } else {
          this.quantityInput.removeAttribute("max");
        }
        this.quantityInput.value = min;

        publish(PUB_SUB_EVENTS.quantityUpdate, undefined);
      }

      fetchQuantityRules() {
        const currentVariantId = this.productForm?.variantIdInput?.value;
        if (!currentVariantId) return;

        this.querySelector(
          ".quantity__rules-cart .loading__spinner"
        ).classList.remove("hidden");
        fetch(
          `${this.dataset.url}?variant=${currentVariantId}&section_id=${this.dataset.section}`
        )
          .then((response) => response.text())
          .then((responseText) => {
            const html = new DOMParser().parseFromString(
              responseText,
              "text/html"
            );
            this.updateQuantityRules(this.dataset.section, html);
          })
          .catch((e) => console.error(e))
          .finally(() =>
            this.querySelector(
              ".quantity__rules-cart .loading__spinner"
            ).classList.add("hidden")
          );
      }

      initSubscriptionHandlers() {
        const toggleButtons = this.querySelectorAll('input[name="purchase_option"]');
        const frequencySelector = this.querySelector('.subscription-frequencies');
        const sellingPlanSelect = this.querySelector('select[name="selling_plan"]');

        if (!toggleButtons.length) return;

        toggleButtons.forEach(input => {
          input.addEventListener('change', (e) => {
            const isSubscription = e.target.value === 'subscription';
            frequencySelector?.classList.toggle('hidden', !isSubscription);

            if (sellingPlanSelect) {
              sellingPlanSelect.disabled = !isSubscription;
            }

            // Sync price if allocation data is available or just rely on server update if needed
            // For now, we'll try to trigger a section update with selling_plan if possible
            if (isSubscription) {
              this.updateUrlWithSellingPlan(sellingPlanSelect?.value);
            } else {
              this.updateUrlWithSellingPlan(null);
            }

            // Sync main price optimistically on toggle
            const variant = this.getSelectedVariant(this);
            if (variant) {
              this.updateSubscriptionCardsOptimistically(variant.id);
            }
          });
        });

        // Initialize state
        const checked = this.querySelector('input[name="purchase_option"]:checked');
        const isSubscription = checked && checked.value === 'subscription';

        frequencySelector?.classList.toggle('hidden', !isSubscription);
        if (sellingPlanSelect) {
          sellingPlanSelect.disabled = !isSubscription;

          // Listen for frequency changes
          sellingPlanSelect.addEventListener('change', () => {
            if (!sellingPlanSelect.disabled) {
              this.updateUrlWithSellingPlan(sellingPlanSelect.value);
            }
          });
        }
      }

      updateUrlWithSellingPlan(sellingPlanId) {
        const productUrl = this.dataset.url;
        const variant = this.getSelectedVariant(this);
        const variantId = variant?.id;

        const params = new URLSearchParams(window.location.search);
        if (sellingPlanId) {
          params.set('selling_plan', sellingPlanId);
        } else {
          params.delete('selling_plan');
        }

        const newUrl = `${window.location.pathname}${params.toString() ? '?' + params.toString() : ''}`;

        // We trigger renderProductInfo to get the updated price and UI from server
        this.renderProductInfo({
          requestUrl: this.buildRequestUrlWithSellingPlan(productUrl, variantId, sellingPlanId),
          targetId: 'subscription-toggle', // dummy target
          callback: this.handleUpdateProductInfo(productUrl)
        });
      }

      buildRequestUrlWithSellingPlan(url, variantId, sellingPlanId) {
        const params = [`section_id=${this.sectionId}`];
        if (variantId) params.push(`variant=${variantId}`);
        if (sellingPlanId) params.push(`selling_plan=${sellingPlanId}`);
        return `${url}?${params.join("&")}`;
      }

      updateSubscriptionCardsOptimistically(variantId) {
        const script = this.querySelector(`#VariantSubscription-${this.sectionId}`);
        if (!script) return;

        try {
          const data = JSON.parse(script.textContent);
          const variantData = data[variantId];
          if (!variantData) return;

          const onetimePriceEl = this.querySelector('.subscription-option-card[data-type="onetime"] .price-onetime');
          const subscriptionPriceEl = this.querySelector('.subscription-option-card[data-type="subscription"] .price-subscription');
          const discountBadge = this.querySelector('.subscription-option-card[data-type="subscription"] .subscription-badge');
          const purchaseOptionInput = this.querySelector('input[name="purchase_option"]:checked');
          const mainPriceEl = document.getElementById(`price-${this.sectionId}`);

          if (onetimePriceEl) onetimePriceEl.textContent = variantData.onetime_formatted;
          if (subscriptionPriceEl) subscriptionPriceEl.textContent = variantData.subscription_formatted;

          if (discountBadge) {
            if (variantData.discount > 0) {
              discountBadge.textContent = `Save ${variantData.discount}%`;
              discountBadge.classList.remove('hidden');
            } else {
              discountBadge.classList.add('hidden');
            }
          }

          if (mainPriceEl) {
            const priceItem = mainPriceEl.querySelector('.price-item--regular, .price-item--sale');
            if (priceItem) {
              priceItem.textContent = purchaseOptionInput?.value === 'subscription'
                ? variantData.subscription_formatted
                : variantData.onetime_formatted;
              mainPriceEl.style.opacity = '1';
            }
          }

        } catch (e) {
          console.error('Error updating subscription cards optimistically:', e);
        }
      }

      updateQuantityRules(sectionId, html) {
        if (!this.quantityInput) return;
        this.setQuantityBoundries();

        const quantityFormUpdated = html.getElementById(
          `Quantity-Form-${sectionId}`
        );
        const selectors = [
          ".quantity__input",
          ".quantity__rules",
          ".quantity__label",
        ];
        for (let selector of selectors) {
          const current = this.quantityForm.querySelector(selector);
          const updated = quantityFormUpdated.querySelector(selector);
          if (!current || !updated) continue;
          if (selector === ".quantity__input") {
            const attributes = [
              "data-cart-quantity",
              "data-min",
              "data-max",
              "step",
            ];
            for (let attribute of attributes) {
              const valueUpdated = updated.getAttribute(attribute);
              if (valueUpdated !== null) {
                current.setAttribute(attribute, valueUpdated);
              } else {
                current.removeAttribute(attribute);
              }
            }
          } else {
            current.innerHTML = updated.innerHTML;
          }
        }
      }

      get productForm() {
        return this.querySelector(`product-form`);
      }

      get productModal() {
        return document.querySelector(`#ProductModal-${this.dataset.section}`);
      }

      get pickupAvailability() {
        return this.querySelector(`pickup-availability`);
      }

      get variantSelectors() {
        return this.querySelector("variant-selects");
      }

      get relatedProducts() {
        const relatedProductsSectionId = SectionId.getIdForSection(
          SectionId.parseId(this.sectionId),
          "related-products"
        );
        return document.querySelector(
          `product-recommendations[data-section-id^="${relatedProductsSectionId}"]`
        );
      }

      get quickOrderList() {
        const quickOrderListSectionId = SectionId.getIdForSection(
          SectionId.parseId(this.sectionId),
          "quick_order_list"
        );
        return document.querySelector(
          `quick-order-list[data-id^="${quickOrderListSectionId}"]`
        );
      }

      get sectionId() {
        return this.dataset.originalSection || this.dataset.section;
      }

      filterMedia(currentVariant) {
        const selectedTokens = this.tokensFromVariant(currentVariant);
        if (!selectedTokens.length) return;
        const allVariantsMedia = document.querySelectorAll('[thumbnail-color]');

        const requiresAllTokens = selectedTokens.length > 1;

        let matchFound = false;
        allVariantsMedia.forEach((mediaEl) => {
          const tokenList =
            mediaEl.getAttribute('thumbnail-color-list') ||
            mediaEl.getAttribute('thumbnail-color') ||
            '';
          const tokens = tokenList.split(',').filter(Boolean);

          const hasUniversalToken = tokens.some(
            (token) => token === 'all' || token === 'all-show'
          );
          const nonUniversalMatch = requiresAllTokens
            ? selectedTokens.every((token) => tokens.includes(token))
            : selectedTokens.some((token) => tokens.includes(token));
          const matchesSelection = hasUniversalToken || nonUniversalMatch;

          if (matchesSelection) {
            mediaEl.style.display = 'block';
            matchFound = matchFound || (nonUniversalMatch && !hasUniversalToken);
          } else {
            mediaEl.style.display = 'none';
          }
        });

        if (!matchFound) {
          allVariantsMedia.forEach((mediaEl) => {
            mediaEl.style.display = 'block';
          });
        }
      }


      handleize(str) {
        return str
          .toLowerCase()
          .trim()
          .replace(/['"]/g, '')            // remove quotes
          .replace(/[^a-z0-9]+/g, '-')     // replace non-alphanumerics with hyphen
          .replace(/^-+|-+$/g, '');        // remove leading/trailing hyphens
      }

      filterMediaGallery(currentVariant) {
        const selectedTokens = this.tokensFromVariant(currentVariant);
        if (!selectedTokens.length) return;
        const allVariantsMedia = document.querySelectorAll('[selected-color]');

        const requiresAllTokens = selectedTokens.length > 1;

        let matchFound = false;
        allVariantsMedia.forEach((mediaEl) => {
          const tokenList =
            mediaEl.getAttribute('selected-color-list') ||
            mediaEl.getAttribute('selected-color') ||
            '';
          const tokens = tokenList.split(',').filter(Boolean);

          const hasUniversalToken = tokens.some(
            (token) => token === 'all' || token === 'all-show'
          );
          const nonUniversalMatch = requiresAllTokens
            ? selectedTokens.every((token) => tokens.includes(token))
            : selectedTokens.some((token) => tokens.includes(token));
          const matchesSelection = hasUniversalToken || nonUniversalMatch;

          if (matchesSelection) {
            mediaEl.style.setProperty('display', 'flex', 'important');
            matchFound = matchFound || (nonUniversalMatch && !hasUniversalToken);
          } else {
            mediaEl.style.setProperty('display', 'none', 'important');
          }
        });

        if (!matchFound) {
          allVariantsMedia.forEach((mediaEl) => {
            mediaEl.style.setProperty('display', 'flex', 'important');
          });
        }
      }

      tokensFromOptionValue(optionValue) {
        if (!optionValue) return [];

        const rawTokens = optionValue
          .toLowerCase()
          .split(/[|,\\/]/)
          .map((token) => this.handleize(token))
          .filter(Boolean);

        return Array.from(new Set(rawTokens));
      }

      tokensFromVariant(variant) {
        if (!variant) return [];

        const optionValues = [
          variant.option1,
          variant.option2,
          variant.option3,
        ].filter(Boolean);

        if (!optionValues.length) return [];

        const tokens = optionValues.flatMap((value) =>
          this.tokensFromOptionValue(value)
        );

        return Array.from(new Set(tokens));
      }

      get currentOptionValues() {
        if (!this.variantSelectors) return [];

        const groups = Array.from(
          this.variantSelectors.querySelectorAll('.product-form__input')
        );

        return groups.map((group) => {
          const select = group.querySelector('select');
          if (select) return select.value;

          const checked = group.querySelector('input[type="radio"]:checked');
          return checked?.value;
        });
      }

      get allVariants() {
        const productId = Number(this.dataset.productId);
        return window.__productVariants?.[productId] || [];
      }

      isMatchingVariant(variant, selectedValues) {
        if (!variant || !selectedValues.length) return false;
        const normalize = (value) => this.handleize(value || '');
        return selectedValues.every((value, index) => {
          if (!value) return true;
          return normalize(variant[`option${index + 1}`]) === normalize(value);
        });
      }

      findVariantByValues(selectedValues) {
        if (!selectedValues || !selectedValues.length) return null;
        return this.allVariants.find(variant => this.isMatchingVariant(variant, selectedValues));
      }

      findFallbackVariant(selectedValues = []) {
        if (!this.allVariants.length) return null;

        const normalize = (value) => this.handleize(value || '');
        const normalizedSelected = selectedValues.map(normalize);

        // 1. Try to find a variant that matches everything AND is available
        const exactAvailableMatch = this.allVariants.find((variant) => {
          if (!variant.available) return false;
          return normalizedSelected.every((value, index) => {
            if (!value) return true;
            return normalize(variant[`option${index + 1}`]) === value;
          });
        });

        if (exactAvailableMatch) return exactAvailableMatch;

        // 2. Try to find a variant that matches everything (even if sold out)
        const exactMatch = this.allVariants.find((variant) => {
          return normalizedSelected.every((value, index) => {
            if (!value) return true;
            return normalize(variant[`option${index + 1}`]) === value;
          });
        });

        if (exactMatch) return exactMatch;

        // 3. Try to find first available variant that matches the FIRST option (usually the Pack)
        const firstOptionMatch = this.allVariants.find((variant) => {
          if (!variant.available) return false;
          return normalize(variant.option1) === normalizedSelected[0];
        });

        if (firstOptionMatch) return firstOptionMatch;

        // 4. Ultimate fallback: first available variant
        return this.allVariants.find((variant) => variant.available) || this.allVariants[0] || null;
      }

      applyVariantSelections(variant) {
        if (!variant || !this.variantSelectors) return;

        const optionValues = [
          variant.option1,
          variant.option2,
          variant.option3,
        ].filter(Boolean);

        const groups = Array.from(
          this.variantSelectors.querySelectorAll('.product-form__input')
        );

        optionValues.forEach((value, index) => {
          const group = groups[index];
          if (!group) return;

          const select = group.querySelector('select');
          if (select) {
            if (select.value !== value) {
              select.value = value;
            }
            select.dispatchEvent(new Event('change', { bubbles: true }));
            return;
          }

          const radios = Array.from(
            group.querySelectorAll('input[type="radio"]')
          );

          const match = radios.find(
            (radio) => this.handleize(radio.value) === this.handleize(value)
          );

          if (match && !match.checked) {
            match.checked = true;
          }

          if (match) {
            match.dispatchEvent(new Event('change', { bubbles: true }));
          }
        });
      }
    }
  );
}
