import React, { PureComponent } from 'react';
import ReactPlayer from 'react-player';
import cx from 'classnames';
import { defineMessages } from 'react-intl';
import logger from 'utils/logger';
//import { ID } from 'utils/constants';
import { getCurrentDataIndex } from 'utils/data';
import player from 'utils/player';

import './styles.css';

const intlMessages = defineMessages({
  autoPlayWarning: {
    id: 'player.externalVideo.autoPlayWarning',
    description: 'Shown when user needs to interact with player to make it work',
  },

});


const SYNC_INTERVAL_SECOND = 1;
const AUTO_PLAY_BLOCK_DETECTION_TIMEOUT_SECONDS = 5;
//const ORCHESTRATOR_INTERVAL_MILLISECOND = 300;
const IGNORE_STOP_CLOSE_TO_START_SECOND = 0.5;

class ExternalVideoPlayer extends PureComponent {

  constructor(props) {
    super(props);

    this.player = null;

    this.autoPlayTimeout = null;

    this.hasPlayedBefore = false;
    this.playerIsReady = false;

    this.time = 0;
    this.buffering= false;
    this.lastTime = 0;
    this.playerUpdateTime = -1;
    this.primaryPlayerPlaying = false;
    this.lastEventPlaybackRate = 1;
    this.isOrchestrating = false;
    this.rafId = null;

    this.state = {
      muted: false,
      playing: false,
      autoPlayBlocked: false,
      errorPlaying: false,
      playbackRate: 1,
      volume: 1,
      urlPlayed: "",
    };

    this.opts = {
      // default option for all players, can be overwritten
      playerOptions: {
        autoplay: false,
        playsinline: true,
        controls: false,
      },
      file: {
        attributes: {
          controls: false,
          autoPlay: false,
          playsInline: true,
        },
      },
      youtube: {
        playerVars: {
          autoplay: 0,
          modestbranding: 1,
          autohide: 1,
          rel: 0,
          ecver: 2,
          controls: 1,
          enablejsapi: 0,
          showinfo: 0
        },
      },

     preload: true,
    };


    this.getCurrentTime = this.getCurrentTime.bind(this);
    this.setPlaybackRate = this.setPlaybackRate.bind(this);
    this.seekTo = this.seekTo.bind(this);

    this.handleFirstPlay = this.handleFirstPlay.bind(this);
    this.handleOnReady = this.handleOnReady.bind(this);
    this.handleOnPlay = this.handleOnPlay.bind(this);
    this.handleOnPause = this.handleOnPause.bind(this);
    this.handleVolumeChange = this.handleVolumeChange.bind(this);
    this.handleOnBuffer = this.handleOnBuffer.bind(this);
    this.handleOnBufferEnd = this.handleOnBufferEnd.bind(this);

    this.orchestrator = this.orchestrator.bind(this);
    this.startOrchestrator = this.startOrchestrator.bind(this);
    this.stopOrchestrator = this.stopOrchestrator.bind(this);

    this.autoPlayBlockDetected = this.autoPlayBlockDetected.bind(this);

    this.whichVideo = this.whichVideo.bind(this);
    //this.dispatchTimeUpdate = this.dispatchTimeUpdate.bind(this);
  }

  //dispatchTimeUpdate = (time) => {
  //  const event = new CustomEvent(EVENTS.TIME_UPDATE, { detail: { time }});
  //  document.dispatchEvent(event);
  //};

  autoPlayBlockDetected() {
    this.setState({ autoPlayBlocked: true });
  }

  handleFirstPlay() {
    const { hasPlayedBefore } = this;

    if (!hasPlayedBefore) {
      this.hasPlayedBefore = true;

      this.setState({ autoPlayBlocked: false });

      if (this.autoPlayTimeout) {
        clearTimeout(this.autoPlayTimeout);  
      }

    }
  }

  getCurrentTime() {
    const time = this.player?.getCurrentTime?.();
    return typeof time === 'number' ? time : 0;
  }

  setPlaybackRate(value) {
    //The original way to get the rate from props did not work,
    // because props will not be updated after the initial rendering.
    //const { primaryPlaybackRate } = this.props;

    // Rate depends on primary rate player
    const rate = value * this.lastEventPlaybackRate;

    const currentRate = this.state.playbackRate;

    if (currentRate === rate) {
      return;
    }

    logger.debug(`external_video: setPlaybackRate current=${currentRate} primary=${value} lastEventPlaybackRate=${this.lastEventPlaybackRate} rate=${rate}`);
    this.setState({ playbackRate: rate });

  }

  handleOnReady() {
    const { hasPlayedBefore, playerIsReady } = this;

    if (hasPlayedBefore || playerIsReady) {
      return;
    }

    this.playerIsReady = true;
    this.handleFirstPlay();

    //const { onPlayerReady } = this.props;

    //if (onPlayerReady) onPlayerReady(ID.EXTERNAL_VIDEOS, this);

    this.handleOnPlay();

  }

  handleOnPlay() {
    const { playing } = this.state;

    if (!playing && this.primaryPlayerPlaying) {
      this.setState({ playing: true });
      this.handleFirstPlay();
    }
  }

  handleOnPause() {
    const { playing } = this.state;

    if (playing) {
      this.setState({ playing: false });
      this.handleFirstPlay();
    }
  }

  handleOnBuffer() {
    this.buffering = true;
  }

  handleOnBufferEnd() {
    this.buffering = false;
  }

  handleVolumeChange = (value, isMuted) => {
    if (this.state.volume !== value ) {
      this.setState({ volume: parseFloat(value)});
      logger.debug(`external_video: VolumeChange CV=${this.state.volume.toFixed(2)} NV=${value.toFixed(2)}`);
    }
    if (this.state.muted !== isMuted) {
      this.setState({ muted: isMuted});
      logger.debug(`external_video: muteChange  CM=${this.state.muted} NM=${isMuted}`);
    }
  }


  seekTo(time) {
    const { player } = this;

    if (!player) {
      //return logger.error('No player on seek');
      return;
    }

    // Seek if viewer has drifted too far away from presenter
    if (Math.abs(this.getCurrentTime() - time) > SYNC_INTERVAL_SECOND) {
      logger.debug(`Video synchronised! ${(time - this.getCurrentTime()).toFixed(2)} `);
      player.seekTo(time, true);
    }
  }

  componentDidMount () {
    //this.timer = setInterval(() => this.orchestrator(), ORCHESTRATOR_INTERVAL_MILLISECOND);
    this.startOrchestrator();
  }

  componentWillUnmount () {
    //clearInterval(this.timer);
    this.stopOrchestrator();
  }

  startOrchestrator() {
    //logger.debug("startOrchestrator");
    if (this.isOrchestrating) return;
    this.isOrchestrating = true;
    const loop = () => {
      if (!this.isOrchestrating) return;
      this.orchestrator();
      this.rafId = requestAnimationFrame(loop);
    };
    this.rafId = requestAnimationFrame(loop);
  }

  stopOrchestrator() {
    //logger.debug("stopOrchestrator");
    this.isOrchestrating = false;
    if (this.rafId) cancelAnimationFrame(this.rafId);
    this.rafId = null;
  }
    
  whichVideo = (videos, time) => {
    const found = videos.find(video => video.timestamp <= time && video.clear >= time);
    return found ? found : {url: "", timestamp: 0, clear: 0};
  }

  orchestrator () {
    const { /*events, active, primaryPlaybackRate, primaryPlaybackVolume, primaryPlaybackMuted,*/ videos } = this.props;
    const { playing, playbackRate } = this.state;

    if (!player.primary) return;

    this.time = player.primary.currentTime();

    let primaryPlayerPlaying = true;
    if (this.time === this.lastTime) {
      primaryPlayerPlaying = false;
    }

    //this.handleVolumeChange(primaryPlaybackVolume, primaryPlaybackMuted); // did not work...?
    this.handleVolumeChange(player.primary.volume(), player.primary.muted());

    this.lastTime = this.time;
    this.primaryPlayerPlaying = primaryPlayerPlaying;

    if (/*active &&*/playing && !this.hasPlayedBefore && !this.autoPlayTimeout) {
       this.autoPlayTimeout = setTimeout(this.autoPlayBlockDetected, AUTO_PLAY_BLOCK_DETECTION_TIMEOUT_SECONDS * 1000);
    }

    const currentVideo = this.whichVideo(videos, this.time);
    const index = getCurrentDataIndex(currentVideo.events, this.time);
    if (index < 0 || currentVideo.clear < this.time) {
      // when the primary player rewinds before the start of external video or finishes the video play.
      this.lastEventPlaybackRate = 1;
    }

    //if (active) {
      if (currentVideo.url !== this.state.urlPlayed) {
        this.setState({ urlPlayed: currentVideo.url });
        logger.debug(`external_video URLchange ${currentVideo.url} -> ${this.state.urlPlayed}`);
        this.setState({ playing: false }); // When swapping to a different video.
      }
      // Check time consistency every ORCHESTRATOR_INTERVAL_MILLISECOND msec, and fix when drifted away too much
      if (playing) {
        let thisMovieTimeToBe;
        if (index > -1 && currentVideo.events && currentVideo.events[index]) {
          // thisMovieTimeToBe =            MovieTimeToBe +               (currentPlayerTime - eventTimeStamp) * playRate
          // [movie time after calibration] [from the start of the movie] [how much sec from the timestamp of a update event]
          thisMovieTimeToBe = parseFloat(currentVideo.events[index].time) + (this.time - currentVideo.events[index].timestamp) * currentVideo.events[index].rate;
          logger.debug(`eventTimeStamp=${currentVideo.events[index].timestamp.toFixed(2)} MovieTimeToBe=${parseFloat(currentVideo.events[index].time).toFixed(2)} currentPlayerTime=${this.time.toFixed(2)} currentMovieTime=${this.player.getCurrentTime().toFixed(2)} rate=${currentVideo.events[index].rate}`);
          logger.debug(`Calibrated movie time to be=${thisMovieTimeToBe.toFixed(2)} actual movie time=${this.player.getCurrentTime().toFixed(2)} inconsistency=${(thisMovieTimeToBe - this.player.getCurrentTime()).toFixed(2)} Type=${currentVideo.events[index].type}`);
        } else if (currentVideo.events && currentVideo.events.length === 0) {
          // Just a single video without pause, rate change, or whatever other events
          thisMovieTimeToBe = this.time - currentVideo.timestamp;
        }
        this.seekTo(thisMovieTimeToBe);
      }
    //}

    logger.debug(`external_video: player url=${this.state.urlPlayed} time=${this.time.toFixed(2)} Playing=${playing} primaryPlayerPlaying=${primaryPlayerPlaying} PlaybackRate=${playbackRate}, events=${currentVideo.events}`);

    if (!primaryPlayerPlaying /*|| !active*/) {
      this.handleOnPause();
      this.playerUpdateTime = -1;
      return
    }

    if (index > -1 && currentVideo.events && currentVideo.events[index] && currentVideo.events[index].type)
    {
        const {type, time, rate, playing}  = currentVideo.events[index];

        logger.debug(`External Video Event: type=${type} time=${time} rate=${rate} playing=${playing}`);
      
        const nextEvent = currentVideo.events[index+1];
        if (nextEvent && type === "stop" && nextEvent.type === "play" && (nextEvent.time - time) < IGNORE_STOP_CLOSE_TO_START_SECOND ){
          logger.debug(`external_video: player skipped "stop" event due to a close "play", interval=${nextEvent.time - time}`);
          return;
        }
      
        switch (type) {
          case "stop":
             this.handleOnPause();
             break;
          case "play":
             this.handleOnPlay();
             break;
          case "playerUpdate": case "setPlaybackRate": // befor v3
          case "seek": case "playbackRateChange": // from v3
              if (this.playerUpdateTime !== time) {
                this.seekTo(time);
                playing ? this.handleOnPlay() : this.handleOnPause()
                this.playerUpdateTime=time;
              } 
              break;
          default:
          ;
        }
        // Play rate being adjusted every time.
        this.lastEventPlaybackRate=rate;
    } else if (index === -1 && (currentVideo.events && currentVideo.events.length === 0)) {
      // start video without events, with the playing rate 1 (supposed to be)
      this.lastEventPlaybackRate = 1;
      this.handleOnPlay();
    }
    // multiply the primary player's playing rate
    this.setPlaybackRate(player.primary.playbackRate());
  }


  render() {

    const { /*videoUrl, active,*/ intl/*, video*/ } = this.props;
    const { playing, playbackRate, muted, autoPlayBlocked, volume, urlPlayed } = this.state;

    logger.debug(`Rendering ${urlPlayed}. Note this shouldn't be shown frequently!`);
    return (
      <div 
          className={cx('externalVideos-wrapper', { inactive: false })}
          ref={(ref) => { this.playerParent = ref; }}
      >
        {autoPlayBlocked
          ? (
            <p className="autoPlayWarning">
              {intl.formatMessage(intlMessages.autoPlayWarning)}
            </p>
          )
          : ''
        }

        <ReactPlayer
          url={urlPlayed}
          config={this.opts}
          volume={volume}
          muted={muted}
          playing={playing}
          playbackRate={playbackRate}
          onReady={this.handleOnReady}
          onPlay={this.handleOnPlay}
          onPause={this.handleOnPause}
          onBuffer={this.handleOnBuffer}
          onBufferEnd={this.handleOnBufferEnd}
          ref={(ref) => { this.player = ref; }}
          width="100%"
          height="100%"
        />

      </div>
    );

  }
}

export default (ExternalVideoPlayer);
