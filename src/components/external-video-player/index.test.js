import ExternalVideoPlayer from './index';
import player from 'utils/player';

jest.mock('utils/player', () => ({ __esModule: true, default: { primary: null } }));
jest.mock('react-player', () => () => null);

let component;
let time;
let paused;
let rate;
let videoTime;
let primary;
const video = { timestamp: 10, clear: 100, url: 'https://www.youtube.com/watch?v=example', events: [] };
beforeEach(() => {
  jest.useFakeTimers();
  time = 30; paused = false; rate = 1; videoTime = 20;
  primary = {
    currentTime: () => time, paused: () => paused, ended: () => false,
    seeking: () => false, playbackRate: () => rate, volume: () => 1,
    muted: () => false, on: jest.fn(), off: jest.fn(),
  };
  player.primary = primary;
  component = new ExternalVideoPlayer({ videos: [video] });
  component.setState = (next, done) => { Object.assign(component.state, next); if (done) done(); };
  component.player = { getCurrentTime: () => videoTime, seekTo: jest.fn() };
  component.sync();
  component.handleReady();
});
afterEach(() => {
  component.componentWillUnmount();
  jest.useRealTimers();
});
it('does not mistake an unchanged media clock for pause', () => {
  component.sync(); component.sync();
  expect(component.state.playing).toBe(true);
});
it('updates a paused seek immediately and resumes at the viewer speed', () => {
  paused = true; time = 15;
  component.handlePrimaryEvent({ type: 'seeked' });
  expect(component.player.seekTo).toHaveBeenLastCalledWith(5, 'seconds', false);
  expect(component.state.playing).toBe(false);
  rate = 2; paused = false;
  component.handlePrimaryEvent({ type: 'play' });
  expect(component.state).toMatchObject({ playbackRate: 2, playing: true });
  time = 20; videoTime = 10; component.sync();
  expect(component.state.playbackRate).toBe(2);
});
it('does not treat ready as successful playback', () => {
  jest.advanceTimersByTime(5000);
  expect(component.state.autoPlayBlocked).toBe(true);
  component.handlePlay();
  expect(component.state.autoPlayBlocked).toBe(false);
});
it('suppresses routine seeks during buffering and throttles later corrections', () => {
  component.handlePlay();
  component.player.seekTo.mockClear();
  component.handleBuffer(); time = 50;
  jest.advanceTimersByTime(1100); component.sync();
  expect(component.player.seekTo).not.toHaveBeenCalled();
  component.handleBufferEnd();
  expect(component.player.seekTo).toHaveBeenCalledTimes(1);
  component.sync(); component.sync();
  expect(component.player.seekTo).toHaveBeenCalledTimes(1);
});
it('resets readiness when re-entering a shared video interval', () => {
  time = 5; component.sync();
  expect(component.state.video).toBeNull();
  time = 40; component.sync();
  expect(component.ready).toBe(false);
  component.handleReady();
  expect(component.player.seekTo).toHaveBeenLastCalledWith(30, 'seconds', true);
});
it('resets when the same URL appears in a different interval', () => {
  const second = { ...video, timestamp: 100, clear: 130 };
  component.props = { videos: [video, second] };
  time = 105; component.sync();
  expect(component.state.video).toBe(second);
  expect(component.ready).toBe(false);
  component.handleReady();
  expect(component.player.seekTo).toHaveBeenLastCalledWith(5, 'seconds', true);
});
it('pauses for primary buffering and resumes when playback returns', () => {
  component.handlePrimaryEvent({ type: 'waiting' });
  expect(component.state.playing).toBe(false);
  component.handlePrimaryEvent({ type: 'playing' });
  expect(component.state.playing).toBe(true);
});
it('removes primary listeners and the pending playback warning on unmount', () => {
  component.componentWillUnmount();
  expect(primary.off).toHaveBeenCalledTimes(primary.on.mock.calls.length);
  expect(jest.getTimerCount()).toBe(0);
});
it('does not keep seeking or show a start warning after the external video ends', () => {
  component.handlePlay();
  component.handleEnded();
  component.player.seekTo.mockClear();
  time = 80; component.sync();
  jest.advanceTimersByTime(6000); component.sync();
  expect(component.player.seekTo).not.toHaveBeenCalled();
  expect(component.state.autoPlayBlocked).toBe(false);
  time = 15;
  component.handlePrimaryEvent({ type: 'seeked' });
  expect(component.player.seekTo).toHaveBeenLastCalledWith(5, 'seconds', true);
});
it('multiplies meeting and viewer speeds and restores them on rewind', () => {
  component.props = { videos: [{ ...video, events: [
    { timestamp: 20, type: 'playbackRateChange', rate: 2, time: 10, playing: true },
    { timestamp: 40, type: 'playbackRateChange', rate: 0.5, time: 50, playing: true },
  ] }] };
  rate = 2; time = 30; component.sync(); component.handleReady();
  expect(component.state.playbackRate).toBe(4);
  expect(component.player.seekTo).toHaveBeenLastCalledWith(30, 'seconds', true);
  time = 50; component.handlePrimaryEvent({ type: 'seeked' });
  expect(component.state.playbackRate).toBe(1);
  expect(component.player.seekTo).toHaveBeenLastCalledWith(55, 'seconds', true);
  paused = true; time = 15; component.handlePrimaryEvent({ type: 'seeked' });
  expect(component.state.playbackRate).toBe(2);
  expect(component.player.seekTo).toHaveBeenLastCalledWith(5, 'seconds', false);
});
it('seeks to the URL offset before the first recorded play', () => {
  component.props = { videos: [{ ...video, url: `${video.url}&t=60s`, events: [
    { timestamp: 12, type: 'play', time: 62, rate: 1, playing: true },
  ] }] };
  time = 10; paused = true; component.sync(); component.handleReady();
  expect(component.player.seekTo).toHaveBeenLastCalledWith(60, 'seconds', false);
});
