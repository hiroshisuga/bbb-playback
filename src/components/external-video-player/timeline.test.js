import { getVideoState } from './timeline';

const video = { timestamp: 10, clear: 100, url: 'https://www.youtube.com/watch?v=example', events: [] };
it('starts at zero without an initial play event and supports arbitrary seeks', () => {
  expect(getVideoState([video], 10).position).toBe(0);
  expect(getVideoState([video], 50).position).toBe(40);
  expect(getVideoState([video], 15).position).toBe(5);
  expect(getVideoState([video], 9)).toBeNull();
  expect(getVideoState([video], 100)).toBeNull();
});
it('restores play and pause history independently of seek order', () => {
  const events = [
    { timestamp: 20, type: 'stop', time: '10' },
    { timestamp: 40, type: 'play', time: '10' },
  ];
  const videos = [{ ...video, events }];
  expect(getVideoState(videos, 50)).toMatchObject({ position: 20, playing: true });
  expect(getVideoState(videos, 30)).toMatchObject({ position: 10, playing: false });
  expect(getVideoState(videos, 15)).toMatchObject({ position: 5, playing: true });
});
it('handles a recorded seek while paused, including distinct events at the same video time', () => {
  const videos = [{ ...video, events: [
    { timestamp: 20, type: 'seek', time: '30', playing: false },
    { timestamp: 40, type: 'play', time: '30' },
  ] }];
  expect(getVideoState(videos, 25)).toMatchObject({ position: 30, playing: false, eventIndex: 0 });
  expect(getVideoState(videos, 45)).toMatchObject({ position: 35, playing: true, eventIndex: 1 });
});
it('selects the next interval at a shared boundary even for the same URL', () => {
  const second = { ...video, timestamp: 100, clear: 130 };
  expect(getVideoState([video, second], 100)).toMatchObject({ video: second, position: 0 });
});
