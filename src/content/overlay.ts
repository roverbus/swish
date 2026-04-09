const FUNNY_MESSAGES = [
  'Eye-roll detected. Advancing the slop.',
  'Judgment registered.',
  'Too cringe. Next.',
  'Your retinas have spoken.',
  'Optical dismissal confirmed.',
  'Swipe by ocular motion.',
  '*sigh* Next.',
  'Content rejected by committee of one.',
];

export class Overlay {
  private container: HTMLDivElement | null = null;
  private videoPreview: HTMLVideoElement | null = null;
  private statusDot: HTMLDivElement | null = null;
  private toast: HTMLDivElement | null = null;
  private toastTimeout: number | null = null;

  create(): void {
    if (this.container) return;

    // Main container
    this.container = document.createElement('div');
    this.container.id = 'swish-overlay';
    this.container.innerHTML = `
      <style>
        #swish-overlay {
          position: fixed;
          bottom: 20px;
          right: 20px;
          z-index: 999999;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        }
        #swish-preview-container {
          width: 120px;
          height: 90px;
          border-radius: 12px;
          overflow: hidden;
          background: #1a1a2e;
          border: 2px solid #8b5cf6;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.3);
          position: relative;
        }
        #swish-video {
          width: 100%;
          height: 100%;
          object-fit: cover;
          transform: scaleX(-1);
        }
        #swish-status {
          position: absolute;
          top: 8px;
          right: 8px;
          width: 12px;
          height: 12px;
          border-radius: 50%;
          background: #fbbf24;
          box-shadow: 0 0 8px rgba(251, 191, 36, 0.5);
          transition: background 0.2s, box-shadow 0.2s;
        }
        #retinaskip-status.active {
          background: #4ade80;
          box-shadow: 0 0 8px rgba(74, 222, 128, 0.5);
        }
        #retinaskip-status.detecting {
          animation: pulse 1s infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); }
          50% { transform: scale(1.2); }
        }
        #swish-toast {
          position: fixed;
          bottom: 130px;
          right: 20px;
          background: linear-gradient(135deg, #8b5cf6 0%, #6366f1 100%);
          color: white;
          padding: 12px 20px;
          border-radius: 8px;
          font-size: 14px;
          font-weight: 500;
          box-shadow: 0 4px 20px rgba(139, 92, 246, 0.4);
          opacity: 0;
          transform: translateY(10px);
          transition: opacity 0.3s, transform 0.3s;
          max-width: 280px;
          z-index: 999999;
        }
        #retinaskip-toast.show {
          opacity: 1;
          transform: translateY(0);
        }
        #retinaskip-overlay.hidden {
          display: none;
        }
      </style>
      <div id="swish-preview-container">
        <video id="swish-video" playsinline muted></video>
        <div id="swish-status"></div>
      </div>
    `;

    // Toast element (separate for positioning)
    this.toast = document.createElement('div');
    this.toast.id = 'swish-toast';
    document.body.appendChild(this.toast);

    document.body.appendChild(this.container);

    this.videoPreview = this.container.querySelector('#swish-video');
    this.statusDot = this.container.querySelector('#swish-status');
  }

  setVideoSource(video: HTMLVideoElement): void {
    if (this.videoPreview && video.srcObject) {
      this.videoPreview.srcObject = video.srcObject;
      this.videoPreview.play().catch(() => {});
    }
  }

  setStatus(status: 'inactive' | 'waiting' | 'active'): void {
    if (!this.statusDot) return;

    this.statusDot.classList.remove('active', 'detecting');

    switch (status) {
      case 'active':
        this.statusDot.classList.add('active', 'detecting');
        break;
      case 'waiting':
        // Yellow default
        break;
      case 'inactive':
        this.statusDot.style.background = '#f87171';
        break;
    }
  }

  showToast(message?: string): void {
    if (!this.toast) return;

    const text = message || FUNNY_MESSAGES[Math.floor(Math.random() * FUNNY_MESSAGES.length)];
    this.toast.textContent = text;
    this.toast.classList.add('show');

    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }

    this.toastTimeout = window.setTimeout(() => {
      this.toast?.classList.remove('show');
    }, 2500);
  }

  setVisible(visible: boolean): void {
    if (this.container) {
      this.container.classList.toggle('hidden', !visible);
    }
    if (this.toast && !visible) {
      this.toast.classList.remove('show');
    }
  }

  destroy(): void {
    if (this.toastTimeout) {
      clearTimeout(this.toastTimeout);
    }
    this.container?.remove();
    this.toast?.remove();
    this.container = null;
    this.toast = null;
    this.videoPreview = null;
    this.statusDot = null;
  }
}
