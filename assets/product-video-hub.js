/**
 * Product Video Hub JS
 * Handles specialized video lightbox and playlist.
 * Refactored to work with MediaGallery web component.
 */

class ProductVideoHub {
    constructor(sectionId) {
        this.sectionId = sectionId;
        this.modal = document.getElementById(`VideoLightbox-${sectionId}`);
        if (!this.modal) return;

        this.closeBtn = this.modal.querySelector('.video-lightbox__close');
        this.playlistItems = this.modal.querySelectorAll('.video-playlist-item');
        this.playerContainer = this.modal.querySelector('.video-lightbox__player');
        this.displayTitle = this.modal.querySelector('.video-lightbox__title');
        this.backdrop = this.modal.querySelector('.video-lightbox__backdrop');

        this.videoData = [];
        this.activeVideo = null;
        this.isOpen = false;

        // Parse data from script tag
        const dataEl = document.getElementById(`VideoData-${sectionId}`);
        if (dataEl) {
            try {
                this.videoData = JSON.parse(dataEl.textContent);
            } catch (e) {
                console.error('Video Hub: Invalid JSON data');
            }
        }

        this.init();
    }

    init() {
        if (this.closeBtn) {
            this.closeBtn.addEventListener('click', (e) => {
                e.stopPropagation();
                this.close();
            });
        }

        if (this.backdrop) {
            this.backdrop.addEventListener('click', () => this.close());
        }

        this.playlistItems.forEach(item => {
            item.addEventListener('click', () => {
                this.switchVideo(item);
            });
        });

        // Handle Keyboard ESC
        this.keyHandler = (e) => {
            if (e.key === 'Escape' && this.isOpen) {
                this.close();
            }
        };
        document.addEventListener('keydown', this.keyHandler);
    }

    open(startIndex = 0) {
        this.modal.removeAttribute('hidden');
        this.modal.style.display = 'flex'; // Ensure flex display
        // Force reflow
        this.modal.offsetHeight;
        this.modal.classList.add('is-active'); // Matching CSS class

        document.body.classList.add('video-lock-scroll');
        this.isOpen = true;

        // Initialize with specific video or first one
        if (this.playlistItems.length > 0) {
            const targetIndex = (startIndex >= 0 && startIndex < this.playlistItems.length) ? startIndex : 0;
            const targetItem = this.playlistItems.item(targetIndex);

            if (targetItem) {
                this.switchVideo(targetItem, true);
            }
        }
    }

    close() {
        this.modal.classList.remove('is-active');
        this.modal.setAttribute('hidden', '');

        document.body.classList.remove('video-lock-scroll');
        this.isOpen = false;

        // Stop playback
        if (this.playerContainer) {
            this.playerContainer.innerHTML = '';
        }
        this.activeVideo = null;
    }

    switchVideo(item, autoplay = true) {
        if (!item) return;
        const index = parseInt(item.dataset.index); // Changed to match standard dataset.index
        if (this.activeVideo === index) return;

        // UI Updates
        this.playlistItems.forEach(i => {
            i.classList.remove('is-active');
            i.setAttribute('aria-selected', 'false');
        });
        item.classList.add('is-active');
        item.setAttribute('aria-selected', 'true');

        // Find video data
        const video = this.videoData[index];
        if (video) {
            this.renderPlayer(video.video_url, video.type, autoplay);
        }

        this.activeVideo = index;
    }

    renderPlayer(url, type, autoplay) {
        if (!this.playerContainer) return;

        let html = '';
        const autoParam = autoplay ? 'autoplay=1' : 'autoplay=0';
        const playsInline = 'playsinline';

        if (type === 'external') {
            const ytMatch = url.match(/(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/);
            const vimeoMatch = url.match(/(?:vimeo\.com\/|player\.vimeo\.com\/video\/)([0-9]+)/);

            if (ytMatch) {
                html = `<iframe src="https://www.youtube.com/embed/${ytMatch[1]}?${autoParam}&rel=0&modestbranding=1&enablejsapi=1" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen class="video-hub-iframe"></iframe>`;
            } else if (vimeoMatch) {
                html = `<iframe src="https://player.vimeo.com/video/${vimeoMatch[1]}?${autoParam}&transparent=0" 
                frameborder="0" allow="autoplay; fullscreen; picture-in-picture" 
                allowfullscreen class="video-hub-iframe"></iframe>`;
            } else {
                // Fallback iframe
                html = `<iframe src="${url}" frameborder="0" allowfullscreen class="video-hub-iframe"></iframe>`;
            }
        } else {
            // Native Shopify Video
            html = `<video controls ${autoplay ? 'autoplay' : ''} ${playsInline} controlslist="nodownload" class="video-hub-native">
              <source src="${url}" type="video/mp4">
              Your browser does not support the video tag.
            </video>`;
        }

        this.playerContainer.innerHTML = html;
    }

    destroy() {
        document.removeEventListener('keydown', this.keyHandler);
    }
}

// Expose to window
window.ProductVideoHub = ProductVideoHub;
