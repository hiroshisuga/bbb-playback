import logger from './logger';

const STATUSES = [
  'canplay',
  'seeking',
  'waiting',
];

const EVENTS = [
  'abort',
  'canplay',
  'canplaythrough',
  'durationchange',
  'emptied',
  'encrypted',
  'ended',
  'error',
  'interruptbegin',
  'interruptend',
  'loadeddata',
  'loadedmetadata',
  'loadstart',
  'mozaudioavailable',
  'pause',
  'play',
  'playing',
  'progress',
  'ratechange',
  'seeked',
  'seeking',
  'stalled',
  'suspend',
  //'timeupdate',
  'volumechange',
  'waiting',
];

export default class Synchronizer {
  constructor(primary, secondary, externalVideos = null) {
    this.primary = primary;
    this.secondary = secondary;

    if (externalVideos) {
      this.externalVideos = externalVideos;  
    }

    this.status = {
      primary: 'waiting',
      secondary: 'waiting',
    }

    this.synching = false;

    this.init();
  }
/*
  syncVolume() {
    const volume = this.primary.volume();
    const muted = this.primary.muted();

    if (this.externalVideos) {
      this.externalVideos.handleVolumeChange(volume,muted);
    }
  }
*/
   handleUpdateTime() {
    const currentTime = this.primary.currentTime();

    if (this.externalVideos && this.externalVideos.time !== currentTime) {
      // only this one works, but volume, muted, rate are not tractable from here by this way..
      this.externalVideos.time = currentTime;
    }
  }

  init() {
    STATUSES.forEach(status => {
      this.primary.on(status, () => this.status.primary = status);
      if (this.secondary) {
        this.secondary.on(status, () => this.status.secondary = status);
      }
    });

    if (this.secondary) {
      this.primary.on('play', () => this.secondary.play());
      this.primary.on('pause', () => this.secondary.pause());
    }

    this.primary.on('seeking', () => {
      const currentTime = this.primary.currentTime();
      if (this.secondary) {
        this.secondary.currentTime(currentTime);
      }
    });

    this.primary.on('ratechange', () => {
      const playbackRate = this.primary.playbackRate();
      if (this.secondary) {
        this.secondary.playbackRate(playbackRate);
      }
    });

    //do this at external_video-player/index.js
    // (not by passing props but by getting the values from primary player directly (dirty..)
    //this.primary.on('volumechange', () => this.syncVolume());

    // Actually this does not work at all..
    //this.primary.on('timeupdate', () => this.handleUpdateTime());

    this.primary.on('waiting', () => {
      if (!this.synching && this.status.secondary === 'canplay') {
        this.synching = true;
        this.primary.pause();
      }
    });

    this.primary.on('canplay', () => {
      if (this.synching) {
        this.synching = false;
        this.primary.play();
      }
    });

    if (this.secondary) {
      this.secondary.on('waiting', () => {
        if (!this.synching && this.status.primary === 'canplay') {
          this.synching = true;
         this.primary.pause();
        }
      });

      this.secondary.on('canplay', () => {
        if (this.synching) {
          this.synching = false;
          this.primary.play();
        }
      });
    }

    // IMPORTANT: Blink holds the secondary media down while the document
    // page is not visible
    // Force medias to sync on visibility change and document is visible
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        const currentTime = this.primary.currentTime();
        if (this.secondary) {
          this.secondary.currentTime(currentTime);
        }
      }
    });

    EVENTS.forEach(event => {
      this.primary.on(event, () => logger.debug(`primary ${event} ${this.status.primary}`));
      if (this.secondary) {
        this.secondary.on(event, () => logger.debug(`secondary ${event} ${this.status.secondary}`));
      }
    });
  }
}
