import { ID } from 'utils/constants';
import Synchronizer from 'utils/synchronizer';

const PLAYERS = {};
let SYNCHRONIZER = null;

const player = {
  get primary() {
    return this.webcams;
  },
  get screenshare() {
    return PLAYERS[ID.SCREENSHARE];
  },
  get exernal_videos() {
    return PLAYERS[ID.EXTERNAL_VIDEOS];
  },
  get synchronizer() {
    return SYNCHRONIZER;
  },
  get webcams() {
    return PLAYERS[ID.WEBCAMS];
  },
  set screenshare(value) {
    if (!PLAYERS[ID.SCREENSHARE]) PLAYERS[ID.SCREENSHARE] = value;

    if (this.external_videos.length === 0) {
      if (this.webcams) {
        this.synchronizer = new Synchronizer(this.webcams, this.screenshare);
      }
    } else {
      if (this.webcams) {
        if (this.webcams && this.screenshare && this.external_videos) {
          this.synchronizer = new Synchronizer(this.webcams, this.screenshare, this.external_videos);
        } 
      } else {
        this.synchronizer = new Synchronizer(this.screenshare, this.external_videos);
      }
    }
  },
  set synchronizer(value) {
    if (!SYNCHRONIZER) SYNCHRONIZER = value;
  },
  set webcams(value) {
    if (!PLAYERS[ID.WEBCAMS]) PLAYERS[ID.WEBCAMS] = value;

    if (this.external_videos.length === 0) {
      if (this.screenshare) {
        this.synchronizer = new Synchronizer(this.webcams, this.screenshare);
      }
    } else {
      if (this.screenshare) {
        if (this.webcams && this.screenshare && this.external_videos) {
          this.synchronizer = new Synchronizer(this.webcams, this.screenshare, this.external_videos);
        } 
      } else {
        this.synchronizer = new Synchronizer(this.webcams, this.external_videos);
      }
    }
  },
};

export default player;
