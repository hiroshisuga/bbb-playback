// BBB 3.x does not reliably record positions after meeting-time rate changes
// (bigbluebutton/bigbluebutton#24050). Supported recordings start at zero and
// use 1x in the meeting. The viewer may still seek and change playback speed.
export const getVideoState = (videos = [], recordingTime) => {
  const video = videos.find(item => item.timestamp <= recordingTime && recordingTime < item.clear);
  if (!video) return null;

  let position = 0;
  let anchor = video.timestamp;
  let playing = true; // BBB 3.x may omit the initial play event.
  let eventIndex = -1;
  (video.events || []).forEach((event, index) => {
    if (event.timestamp > recordingTime) return;
    if (!['play', 'stop', 'pause', 'seek', 'playerUpdate', 'presenterReady',
      'setPlaybackRate', 'playbackRateChange'].includes(event.type)) return;
    position += playing ? event.timestamp - anchor : 0;
    const eventPosition = Number.parseFloat(event.time);
    if (Number.isFinite(eventPosition)) position = eventPosition;
    anchor = event.timestamp;
    if (event.type === 'play') playing = true;
    else if (event.type === 'stop' || event.type === 'pause') playing = false;
    else if (typeof event.playing === 'boolean') playing = event.playing;
    eventIndex = index;
  });

  return {
    video,
    eventIndex,
    position: Math.max(0, position + (playing ? recordingTime - anchor : 0)),
    playing,
  };
};
