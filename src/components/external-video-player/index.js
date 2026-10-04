import React, { PureComponent } from 'react';
import ReactPlayer from 'react-player';
import { defineMessages } from 'react-intl';
import logger from 'utils/logger';
import player from 'utils/player';
import { getVideoState } from './timeline';
import './styles.css';

const messages = defineMessages({
  autoPlayWarning: {
    id: 'player.externalVideo.autoPlayWarning',
    defaultMessage: 'If the video does not start, press play in the video.',
  },
  error: {
    id: 'player.externalVideo.error',
    defaultMessage: 'The external video could not be played (error: {code}).',
  },
});

const SYNC_INTERVAL_MS = 250;
const DRIFT_SECONDS = 1;
const SEEK_COOLDOWN_MS = 1000;
const PLAY_START_TIMEOUT_MS = 5000;
const PRIMARY_EVENTS = ['play', 'pause', 'ended', 'seeking', 'seeked',
  'ratechange', 'volumechange', 'waiting', 'playing', 'canplay'];

export default class ExternalVideoPlayer extends PureComponent {
  state = {
    video: null,
    playing: false,
    playbackRate: 1,
    volume: 1,
    muted: false,
    autoPlayBlocked: false,
    error: null,
  };

  ready = false;
  buffering = false;
  actualPlaying = false;
  externalEnded = false;
  primaryWaiting = false;
  forceSeek = true;
  lastSeekAt = -Infinity;
  lastEventIndex = -1;

  config = {
    youtube: { playerVars: { autoplay: 0, controls: 1, enablejsapi: 1, rel: 0 } },
    file: { attributes: { playsInline: true } },
  };

  componentDidMount() {
    this.sync();
    this.timer = setInterval(this.sync, SYNC_INTERVAL_MS);
  }

  componentWillUnmount() {
    clearInterval(this.timer);
    this.clearPlayTimeout();
    this.detachPrimary();
  }

  detachPrimary = () => {
    if (this.primary) {
      PRIMARY_EVENTS.forEach(event => this.primary.off(event, this.handlePrimaryEvent));
    }
    this.primary = null;
  };

  handlePrimaryEvent = (event) => {
    if (event.type === 'waiting') this.primaryWaiting = true;
    if (['playing', 'canplay', 'seeked'].includes(event.type)) this.primaryWaiting = false;
    if (['seeking', 'seeked', 'play', 'pause', 'ended'].includes(event.type)) this.forceSeek = true;
    this.sync();
  };

  clearPlayTimeout = () => {
    clearTimeout(this.playTimeout);
    this.playTimeout = null;
  };

  // Readiness is not evidence of successful playback. Only onPlay clears
  // the playback-start warning; ordinary blocked telemetry is not onError.
  handleReady = () => {
    this.ready = true;
    this.forceSeek = true;
    this.sync();
  };

  handlePlay = () => {
    this.actualPlaying = true;
    this.externalEnded = false;
    this.buffering = false;
    this.clearPlayTimeout();
    this.setState({ autoPlayBlocked: false });
    this.sync();
  };

  handlePause = () => {
    this.actualPlaying = false;
  };

  handleEnded = () => {
    this.actualPlaying = false;
    this.externalEnded = true;
    this.clearPlayTimeout();
  };

  handleBuffer = () => {
    this.buffering = true;
    this.clearPlayTimeout();
  };

  handleBufferEnd = () => {
    this.buffering = false;
    this.sync();
  };

  handleError = (error) => {
    this.clearPlayTimeout();
    const code = error?.data ?? error?.code ?? error?.message ?? error;
    logger.error('external_video: playback failed', error);
    this.setState({ error: String(code), playing: false });
  };

  sync = () => {
    const primary = player.primary;
    if (!primary || primary.isDisposed?.()) return;
    if (primary !== this.primary) {
      this.detachPrimary();
      this.primary = primary;
      this.primaryWaiting = false;
      this.forceSeek = true;
      PRIMARY_EVENTS.forEach(event => primary.on(event, this.handlePrimaryEvent));
    }

    const target = getVideoState(this.props.videos, primary.currentTime());
    const video = target?.video || null;
    if (video !== this.state.video) {
      this.clearPlayTimeout();
      this.ready = false;
      this.actualPlaying = false;
      this.externalEnded = false;
      this.buffering = false;
      this.forceSeek = true;
      this.lastSeekAt = -Infinity;
      this.lastEventIndex = -1;
      // Remount even when the same URL is shared twice: these are separate
      // recording intervals with separate readiness and playback state.
      this.setState({ video, playing: false, error: null, autoPlayBlocked: false }, this.sync);
      return;
    }
    if (!target || this.state.error) return;

    const playing = this.ready && target.playing && !primary.paused()
      && !primary.ended() && !primary.seeking() && !this.primaryWaiting;
    // Timeline positions use recording seconds; actual playback also follows viewer speed.
    const playbackRate = target.rate * primary.playbackRate();
    const next = { playing, playbackRate, volume: primary.volume(), muted: primary.muted() };
    const changed = Object.keys(next).some(key => next[key] !== this.state[key]);
    if (changed) {
      this.setState(next, this.sync);
      return;
    }

    if (!playing) {
      this.clearPlayTimeout();
      if (this.state.autoPlayBlocked) this.setState({ autoPlayBlocked: false });
    } else if (!this.actualPlaying && !this.externalEnded && !this.buffering && !this.playTimeout && !this.state.autoPlayBlocked) {
      this.playTimeout = setTimeout(() => {
        this.playTimeout = null;
        if (this.state.playing && !this.actualPlaying && !this.buffering) {
          this.setState({ autoPlayBlocked: true });
        }
      }, PLAY_START_TIMEOUT_MS);
    }

    if (!this.ready || primary.seeking() || !this.player) return;
    const force = this.forceSeek || target.eventIndex !== this.lastEventIndex;
    const currentTime = this.player.getCurrentTime();
    const now = Date.now();
    // User seeks also work while paused. Routine drift correction waits for
    // actual playback and avoids repeatedly seeking a buffering iframe.
    if (force || (playing && this.actualPlaying && !this.buffering
      && Number.isFinite(currentTime) && Math.abs(currentTime - target.position) > DRIFT_SECONDS
      && now - this.lastSeekAt >= SEEK_COOLDOWN_MS)) {
      this.forceSeek = false;
      this.lastEventIndex = target.eventIndex;
      this.lastSeekAt = now;
      this.player.seekTo(target.position, 'seconds', playing);
    }
  };

  render() {
    const { intl } = this.props;
    const { video, playing, playbackRate, volume, muted, autoPlayBlocked, error } = this.state;
    if (!video) return null;
    return (
      <div className="externalVideos-wrapper">
        {(autoPlayBlocked || error) && (
          <p className="autoPlayWarning" role="status">
            {error ? intl.formatMessage(messages.error, { code: error })
              : intl.formatMessage(messages.autoPlayWarning)}
          </p>
        )}
        <ReactPlayer
          key={`${video.timestamp}:${video.clear}:${video.url}`}
          ref={ref => { this.player = ref; }}
          url={video.url}
          config={this.config}
          controls
          playsinline
          volume={volume}
          muted={muted}
          playing={playing}
          playbackRate={playbackRate}
          onReady={this.handleReady}
          onPlay={this.handlePlay}
          onPause={this.handlePause}
          onEnded={this.handleEnded}
          onBuffer={this.handleBuffer}
          onBufferEnd={this.handleBufferEnd}
          onError={this.handleError}
          width="100%"
          height="100%"
        />
      </div>
    );
  }
}
