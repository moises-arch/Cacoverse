/**
 * Product Video Hub JS
 * Handles specialized video lightbox and playlist.
 */

(function () {
    class ProductVideoHub {
        constructor() {
            this.modal = document.getElementById('productVideoLightbox');
            if (!this.modal) return;

            this.opener = document.querySelector('[data-video-hub-opener]');
            this.closeBtn = document.querySelector('[data-video-lightbox-close]');
            this.playlistItems = document.querySelectorAll('.video-playlist-item');
            this.playerContainer = document.getElementById('videoMainPlayer');
            this.displayTitle = document.getElementById('videoDisplayTitle');
            this.backdrop = this.modal.querySelector('.video-lightbox__backdrop');

            this.activeVideo = null;
            this.init();
        }

        init() {
            if (this.opener) {
                this.opener.addEventListener('click', () => this.open());
            }

            if (this.closeBtn) {
                this.closeBtn.addEventListener('click', () => this.close());
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
            document.addEventListener('keydown', (e) => {
                if (e.key === 'Escape' && !this.modal.hasAttribute('hidden')) {
                    this.close();
                }
            });
        }

        open() {
            this.modal.removeAttribute('hidden');
            document.body.classList.add('video-lock-scroll');

            // Load the first (set as active) video if not already loaded
            const activeItem = document.querySelector('.video-playlist-item.is-active');
            if (activeItem) {
                this.switchVideo(activeItem, false); // false = don't force autoplay on first open if preferred
            }

            // focus trap
            this.closeBtn.focus();
        }

        close() {
            this.modal.setAttribute('hidden', '');
            document.body.classList.remove('video-lock-scroll');

            // Stop and clear the player to release memory/bandwidth
            this.playerContainer.innerHTML = `
        <div class="video-lightbox__loading-indicator">
          <div class="video-player-loader"></div>
        </div>`;
            this.activeVideo = null;
        }

        switchVideo(item, autoplay = true) {
            const videoUrl = item.dataset.videoUrl;
            const videoType = item.dataset.videoType;
            const videoTitle = item.dataset.videoTitle;
            const videoIndex = item.dataset.videoIndex;

            if (this.activeVideo === videoIndex) return;

            // UI Updates
            this.playlistItems.forEach(i => {
                i.classList.remove('is-active');
                i.setAttribute('aria-selected', 'false');
            });
            item.classList.add('is-active');
            item.setAttribute('aria-selected', 'true');

            if (this.displayTitle) {
                this.displayTitle.textContent = videoTitle;
            }

            this.activeVideo = videoIndex;
            this.renderPlayer(videoUrl, videoType, autoplay);
        }

        renderPlayer(url, type, autoplay) {
            let html = '';
            const autoParam = autoplay ? 'autoplay=1' : 'autoplay=0';

            if (type === 'youtube') {
                const id = this.getYouTubeId(url);
                html = `<iframe src="https://www.youtube.com/embed/${id}?${autoParam}&rel=0&modestbranding=1" 
                frameborder="0" allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture" 
                allowfullscreen></iframe>`;
            } else if (type === 'vimeo') {
                const id = this.getVimeoId(url);
                html = `<iframe src="https://player.vimeo.com/video/${id}?${autoParam}&transparent=0" 
                frameborder="0" allow="autoplay; fullscreen; picture-in-picture" 
                allowfullscreen></iframe>`;
            } else {
                // Native Shopify Video or Direct URL
                html = `<video controls ${autoplay ? 'autoplay' : ''} playsinline controlslist="nodownload">
                  <source src="${url}" type="video/mp4">
                  Your browser does not support the video tag.
                </video>`;
            }

            this.playerContainer.innerHTML = html;
        }

        getYouTubeId(url) {
            if (url.length === 11 && !url.includes('/') && !url.includes('.')) return url;
            const regExp = /^.*(youtu.be\/|v\/|u\/\w\/|embed\/|watch\?v=|\&v=)([^#\&\?]*).*/;
            const match = url.match(regExp);
            return (match && match[2].length === 11) ? match[2] : null;
        }

        getVimeoId(url) {
            if (/^\d+$/.test(url)) return url;
            const regExp = /vimeo\.com\/(?:channels\/(?:\w+\/)?|groups\/(?:[^\/]*)\/videos\/|album\/(?:\d+)\/video\/|video\/|)(\d+)(?:$|\/|\?)/;
            const match = url.match(regExp);
            return match ? match[1] : null;
        }
    }

    // Initialize
    document.addEventListener('DOMContentLoaded', () => {
        new ProductVideoHub();
    });

    // Also re-init on Shopify Section Load (Theme Editor)
    document.addEventListener('shopify:section:load', () => {
        new ProductVideoHub();
    });
})();
