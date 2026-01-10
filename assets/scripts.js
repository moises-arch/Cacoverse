const initSwipers = () => {
  if (!window.jQuery || !window.Swiper) {
    return;
  }

  const swiperInstances = [];
  const $swiperSelector = $('.swiper-container');

  if (!$swiperSelector.length) {
    return;
  }

  $swiperSelector.each(function (index) {
    const $this = $(this);
    const uniqueClass = `swiper-slider-${index}`;
    $this.addClass(uniqueClass);

    const dragSize = $this.data('drag-size') || 50;
    const freeMode = $this.data('free-mode') || false;
    const loop = $this.data('loop') || false;
    const slidesDesktop = $this.data('slides-desktop') || 4;
    const slidesTablet = $this.data('slides-tablet') || 3;
    const slidesMobile = $this.data('slides-mobile') || 1.5;
    const spaceBetween = $this.data('space-between') || 60;
    const autoPlay = $this.data('auto-play') ? true : false;

    // Assign unique elements inside each swiper container
    const paginationEl = $this.find('.swiper-pagination')[0];
    const scrollbarEl = $this.find('.swiper-scrollbar')[0];
    const nextEl = $this.find('.swiper-button-next')[0];
    const prevEl = $this.find('.swiper-button-prev')[0];

    const swiper = new Swiper(`.${uniqueClass}`, {
      direction: 'horizontal',
      loop: loop,
      freeMode: freeMode,
      spaceBetween: spaceBetween,
      ...(autoPlay && {
        autoplay: {
          delay: 5000,
          disableOnInteraction: false,
        },
      }),
      breakpoints: {
        1280: { slidesPerView: slidesDesktop },
        767: { slidesPerView: slidesTablet, spaceBetween: 30 },
        320: { slidesPerView: slidesMobile, spaceBetween: 30 },
      },
      navigation: {
        nextEl: nextEl,
        prevEl: prevEl,
      },
      scrollbar: {
        el: scrollbarEl,
        draggable: true,
        dragSize: dragSize,
      },
      pagination: {
        el: paginationEl,
        clickable: true,
        dynamicBullets: true,
      },
    });

    swiperInstances.push(swiper);
  });

  $('.nav-tabs a').on('click', function () {
    $swiperSelector.each(function (index) {
      swiperInstances[index].update();
    });
  });
};

// Button Hover Effect (Handled via CSS for better performance)



const initFaqs = () => {
  if (!window.jQuery) {
    return;
  }

  $('.faq-question').on('click', function () {
    const $question = $(this);
    const $item = $question.parent();
    const $answer = $question.next('.faq-answer');
    const willOpen = !$item.hasClass('active');

    $('.faq-item').not($item).removeClass('active').find('.faq-question').attr('aria-expanded', 'false');
    $('.faq-item').not($item).find('.faq-answer').attr('aria-hidden', 'true').slideUp();

    if (willOpen) {
      $item.addClass('active');
      $question.attr('aria-expanded', 'true');
      $answer.attr('aria-hidden', 'false').slideDown();
    } else {
      $item.removeClass('active');
      $question.attr('aria-expanded', 'false');
      $answer.attr('aria-hidden', 'true').slideUp();
    }
  });
};

const initActiveButtonGroup = (selector) => {
  const buttons = document.querySelectorAll(selector);
  if (!buttons.length) {
    return;
  }
  buttons.forEach((button) => {
    button.addEventListener('click', function () {
      buttons.forEach((btn) => btn.classList.remove('active'));
      this.classList.add('active');
    });
  });
};

const initDropdownHover = () => {
  if (!window.matchMedia('(min-width: 993px)').matches) {
    return;
  }

  const dropdowns = document.querySelectorAll('.nav-item.dropdown');

  dropdowns.forEach((dropdown) => {
    let timer;
    const menu = dropdown.querySelector('.dropdown-menu');
    if (!menu) {
      return;
    }

    dropdown.addEventListener('mouseenter', () => {
      clearTimeout(timer);
      dropdown.classList.add('show');
      menu.classList.add('show');
    });

    dropdown.addEventListener('mouseleave', () => {
      timer = setTimeout(() => {
        dropdown.classList.remove('show');
        menu.classList.remove('show');
      }, 150);
    });
  });
};

document.addEventListener('DOMContentLoaded', function () {
  initSwipers();
  initFaqs();
  initActiveButtonGroup('.series-button');
  initActiveButtonGroup('.size-button');
  initDropdownHover();
});


const parsePriceRange = (priceRange) =>
  priceRange.split('-').map((value) => value.trim().replace('$', ''));

document.body.addEventListener('click', function (event) {
  // Check if the clicked element is a checkbox within the custom-price-filter-ul
  if (event.target.matches('.custom-price-filter-ul input[type="checkbox"]')) {
    const input = event.target;

    // Get references to the GTE and LTE inputs
    const gteInput = document.getElementById('Filter-Price-GTE');
    const lteInput = document.getElementById('Filter-Price-LTE');
    if (!gteInput || !lteInput) {
      return;
    }

    if (input.checked) {
      // If the checkbox is checked, update the values
      const priceRange = input.dataset.priceRange;
      const [gte, lte] = parsePriceRange(priceRange);
      gteInput.value = gte || '';
      lteInput.value = lte || '';
    } else {
      // If the checkbox is unchecked, check if any other checkboxes are still checked
      const checkedCheckboxes = document.querySelectorAll('.custom-price-filter-ul input[type="checkbox"]:checked');

      if (checkedCheckboxes.length > 0) {
        // Get the price range of the first checked checkbox
        const firstChecked = checkedCheckboxes[0];
        const priceRange = firstChecked.dataset.priceRange;
        const [gte, lte] = parsePriceRange(priceRange);
        gteInput.value = gte || '';
        lteInput.value = lte || '';
      } else {
        // If no checkboxes are checked, clear the input values
        gteInput.value = '';
        lteInput.value = '';
      }
    }
  }
});




// document.querySelectorAll('.nav-item.dropdown > a').forEach(function(anchor) {
//   anchor.addEventListener('click', function(event) {
//     event.preventDefault(); // Prevent the default behavior

//     const dropdown = anchor.closest('.nav-item.dropdown');
//     const dropdownMenu = dropdown.querySelector('.dropdown-menu');
//     const caretIcon = dropdown.querySelector('.icon-caret');

//     // Close all other dropdowns
//     document.querySelectorAll('.section-header .nav-item.dropdown').forEach(function(otherDropdown) {
//       const otherDropdownMenu = otherDropdown.querySelector('.dropdown-menu');
//       const otherCaretIcon = otherDropdown.querySelector('.icon-caret');

//       // Close the other dropdowns and reset their icons
//       if (otherDropdownMenu !== dropdownMenu) {
//         otherDropdownMenu.classList.remove('show1');
//         otherCaretIcon.classList.remove('rotated');
//       }
//     });

//     // Toggle the dropdown menu and caret icon
//     dropdownMenu.classList.toggle('show1');
//     caretIcon.classList.toggle('rotated');
//   });
// });


// Detect when the page is scrolled past the header
let isStickyScrollTicking = false;
window.addEventListener('scroll', function () {
  if (isStickyScrollTicking) {
    return;
  }

  isStickyScrollTicking = true;
  requestAnimationFrame(() => {
    const navbarCollapse = document.querySelector('.navbar-collapse');
    const header = document.querySelector('.page-width');

    // Check if elements exist before accessing properties
    if (header && navbarCollapse) {
      // Check if the header has reached the sticky state
      if (window.scrollY > header.offsetHeight) {
        // If the header is sticky, change the `top` value for navbar-collapse
        navbarCollapse.classList.add('sticky-header');
      } else {
        // If the header is not sticky, reset the `top` value for navbar-collapse
        navbarCollapse.classList.remove('sticky-header');
      }
    }

    isStickyScrollTicking = false;
  });
}, { passive: true });


// Select all anchor tags within the #navbarNav element
document.querySelectorAll('#navbarNav a').forEach(anchor => {
  // Check if the href attribute contains '%3F'
  if (anchor.href.includes('%3F')) {
    // Replace '%3F' with '?'
    anchor.href = anchor.href.replace('%3F', '?');
  }
});


/******* SMOOTH SCROLLING ***********/
// document.querySelectorAll('.scroll-link').forEach(link => {
//   link.addEventListener('click', function(e) {
//     e.preventDefault(); // Prevent default anchor behavior
//     const target = document.querySelector(this.getAttribute('href')); // Get the target element
//     const headerOffset = 80; // Adjust this value according to the header height or any fixed element
//     const elementPosition = target.getBoundingClientRect().top; // Get the position of the target
//     const offsetPosition = elementPosition + window.pageYOffset - headerOffset; // Adjust by the header offset

//     window.scrollTo({
//       top: offsetPosition,
//       behavior: 'smooth'
//     });
//   });
// });


function normalizeColorToken(color) {
  return color?.toLowerCase().trim().replace(/\s+/g, '-');
}

function filterImagesByColor() {
  // Get the checked radio button's value
  const selectedColor = normalizeColorToken(document.querySelector('.color-options input[name="color"]:checked')?.value);

  // Get all images in the swiper slider
  const swiperImages = document.querySelectorAll('.swiper-slide img');

  // Variable to track if any image matches the selected color
  let matchFound = false;

  if (selectedColor) {
    // Loop through all images and check the data-color attribute
    swiperImages.forEach(image => {
      const imageColors = (image.dataset.colorList || image.dataset.color || '')
        .split(/[\|,\/]/)
        .map(normalizeColorToken)
        .filter(Boolean);

      if (imageColors.includes(selectedColor) || imageColors.includes('all-show') || imageColors.includes('all')) {
        // Show images that match the selected color or are generic
        image.closest('.swiper-slide').style.display = '';
        matchFound = true;
      } else {
        // Hide images that don't match
        image.closest('.swiper-slide').style.display = 'none';
      }
    });

    // If no match is found, show all images (fallback)
    if (!matchFound) {
      swiperImages.forEach(image => {
        image.closest('.swiper-slide').style.display = '';
      });
    }
  } else {
    // If no color is selected, show all images
    swiperImages.forEach(image => {
      image.closest('.swiper-slide').style.display = '';
    });
  }

  // Notify Swiper instances to update
  document.dispatchEvent(new CustomEvent('media:filtered'));
}

// Initial call on page load
document.addEventListener('DOMContentLoaded', filterImagesByColor);

// Reapply the logic after AJAX content is loaded
document.body.addEventListener('ajaxComplete', filterImagesByColor);

// Optionally handle dynamic user interactions (e.g., radio button changes)
document.body.addEventListener('change', (event) => {
  if (event.target.matches('.color-options input[name="color"]')) {
    document.getElementById('loader').style.display = 'block';
    filterImagesByColor();
    setTimeout(function () {
      document.getElementById('loader').style.display = 'none';
    }, 500);

  }
});

document.addEventListener('DOMContentLoaded', () => {
  const currentUrl = window.location.pathname;
  const filterButtons = document.querySelectorAll('.product-types-filter-buttons a');

  filterButtons.forEach(button => {
    button.classList.remove('active'); // Remove active class from all buttons

    if (button.getAttribute('href') === currentUrl) {
      button.classList.add('active'); // Add active class to the matching button
    }
  });
});
