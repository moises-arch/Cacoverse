/**
 * Product Video Hub JS
 * Lightweight player bound to playlist data attributes.
 */

class ProductVideoHub {
  constructor(sectionId) {
    this.sectionId = sectionId;
    this.modal = document.getElementById(`VideoLightbox-${sectionId}`);
    if (!this.modal) return;

    this.closeBtn = this.modal.querySelector('.video-lightbox__close');
    this.playlistItems = Array.from(this.modal.querySelectorAll('.video-playlist-item'));
    this.playerContainer = this.modal.querySelector('.video-lightbox__player');
    this.backdrop = this.modal.querySelector('.video-lightbox__backdrop');

    this.activeVideo = null;
    this.isOpen = false;

    this.videoData = this.buildVideoDataFromPlaylist();
    this.init();
  }

  init() {
    if (this.closeBtn) {
      this.closeBtn.replaceWith(this.closeBtn.cloneNode(true));
      this.closeBtn = this.modal.querySelector('.video-lightbox__close');

      this.closeBtn.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
        this.close();
      });
    }

    if (this.backdrop) {
      this.backdrop.addEventListener('click', () => {
        this.close();
      });
    }

    this.playlistItems.forEach((item) => {
      item.addEventListener('click', (e) => {
        e.preventDefault();
        this.switchVideo(item);
      });
    });

    if (this.keyHandler) document.removeEventListener('keydown', this.keyHandler);
    this.keyHandler = (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
    };
    document.addEventListener('keydown', this.keyHandler);
  }

  open(startIndex = 0) {
    this.modal.removeAttribute('hidden');
    this.modal.style.display = 'flex';
    this.modal.offsetHeight;
    this.modal.classList.add('is-active');

    document.body.classList.add('video-lock-scroll');
    this.isOpen = true;

    if (this.playlistItems.length > 0) {
      const targetIndex = Math.max(0, Math.min(startIndex, this.playlistItems.length - 1));
      const targetItem = this.playlistItems[targetIndex];
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

    if (this.playerContainer) {
      this.playerContainer.innerHTML = '';
    }
    this.activeVideo = null;
  }

  switchVideo(item, autoplay = true) {
    if (!item) return;
    const index = parseInt(item.dataset.index, 10);
    console.log("CacoAmerica: switchVideo called", index, item);

    if (this.activeVideo === index) return;

    this.playlistItems.forEach((entry) => {
      entry.classList.remove('is-active');
      entry.setAttribute('aria-selected', 'false');
    });
    item.classList.add('is-active');
    item.setAttribute('aria-selected', 'true');

    const video = this.videoData[index];
    console.log("CacoAmerica: video data", video);

    if (video && video.video_url) {
      this.renderPlayer(video.video_url, video.type, autoplay);
    } else {
      console.warn("CacoAmerica: No video URL found for index", index);
      this.playerContainer.innerHTML = '<div style="color:white; padding:20px;">No video URL available</div>';
    }

    this.activeVideo = index;
  }

  renderPlayer(url, type, autoplay) {
    console.log("CacoAmerica: renderPlayer", url, type, autoplay);
    if (!this.playerContainer || !url) return;

    const autoParam = autoplay ? 'autoplay=1' : 'autoplay=0';
    const playsInline = 'playsinline';
    let html = '';

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
        // Fallback for generic iframe usage
        html = `<iframe src="${url}" frameborder="0" allowfullscreen class="video-hub-iframe"></iframe>`;
      }
    } else {
      html = `<video controls ${autoplay ? 'autoplay' : ''} ${playsInline} controlslist="nodownload" class="video-hub-native">
        <source src="${url}" type="video/mp4">
        Your browser does not support the video tag.
      </video>`;
    }

    this.playerContainer.innerHTML = html;
  }

  buildVideoDataFromPlaylist() {
    return this.playlistItems.map((item) => {
      const url = item.dataset.videoUrl;
      let type = item.dataset.videoType || 'native';

      if (url && (url.includes('youtube') || url.includes('youtu.be') || url.includes('vimeo'))) {
        type = 'external';
      }

      return {
        video_url: url,
        type
      };
    });
  }

  destroy() {
    document.removeEventListener('keydown', this.keyHandler);
  }
}

window.ProductVideoHub = ProductVideoHub;
