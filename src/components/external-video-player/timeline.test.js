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

const rateRecording = [{ timestamp: 21.743, clear: 189.042, url: video.url, events: [
  { timestamp: 24.626, rate: 1, time: 2.699, type: 'play', playing: true },
  { timestamp: 56.143, rate: 1, time: 60.2817420743866, type: 'seek', playing: true },
  { timestamp: 71.824, rate: 2, time: 76.12244632806396, type: 'playbackRateChange', playing: true },
  { timestamp: 72.152, rate: 2, time: 76.64562928610229, type: 'seek', playing: true },
  { timestamp: 104.46, rate: 2, time: 187.00891384741212, type: 'seek', playing: true },
  { timestamp: 133.225, rate: 2, time: 64.16978392370606, type: 'seek', playing: true },
  { timestamp: 147.805, rate: 0.5, time: 93.12334400953674, type: 'playbackRateChange', playing: true },
  { timestamp: 176.352, rate: 1, time: 107.77771790653992, type: 'playbackRateChange', playing: true },
] }];
it('restores the supplied rate/seek recording in arbitrary order', () => {
  for (const [time, position, rate] of [
    [180, 111.42571790653992, 1],
    [150, 94.22084400953674, 0.5],
    [140, 77.71978392370606, 2],
    [110, 198.08891384741212, 2],
    [80, 92.34162928610229, 2],
    [70, 74.1387420743866, 1],
    [71.824, 76.12244632806396, 2],
  ]) {
    const state = getVideoState(rateRecording, time);
    expect(state.position).toBeCloseTo(position, 8);
    expect(state.rate).toBe(rate);
  }
});
it('uses the URL before the initial play and recorded anchors thereafter', () => {
  const videos = [{ timestamp: 25.001, clear: 61.893,
    url: 'https://www.youtube.com/watch?v=EUCHLBqFsRM&t=60s', events: [
      { timestamp: 26.955, rate: 1, time: 61.92, type: 'play', playing: true },
      { timestamp: 49.464, rate: 1, time: 83.510715, type: 'stop', playing: false },
      { timestamp: 52.962, rate: 1, time: 119.56919092752075, type: 'play', playing: true },
    ] }];
  expect(getVideoState(videos, 25.001).position).toBe(60);
  expect(getVideoState(videos, 26).position).toBeCloseTo(60.999);
  expect(getVideoState(videos, 26.955).position).toBe(61.92);
  expect(getVideoState(videos, 51)).toMatchObject({ position: 83.510715, playing: false });
  expect(getVideoState(videos, 60).position).toBeCloseTo(126.60719092752075);
  expect(getVideoState(videos, 25.001).position).toBe(60);
});
it.each([['?t=60', 60], ['?t=60s', 60], ['?t=1m30s', 90], ['?start=90', 90],
  ['#t=1h2m3s', 3723], ['?t=invalid', 0], ['?t=-10', 0]])('reads start offset %s', (suffix, offset) => {
  expect(getVideoState([{ ...video, url: `https://youtu.be/example${suffix}` }], 10).position).toBe(offset);
});
it('keeps the prior rate for elapsed time, including rate changes while paused', () => {
  const videos = [{ ...video, events: [
    { timestamp: 20, type: 'playbackRateChange', rate: 2 },
    { timestamp: 30, type: 'stop', playing: false },
    { timestamp: 35, type: 'playbackRateChange', rate: 0.5, playing: false },
    { timestamp: 40, type: 'play', playing: true },
  ] }];
  expect(getVideoState(videos, 36)).toMatchObject({ position: 30, rate: 0.5, playing: false });
  expect(getVideoState(videos, 44)).toMatchObject({ position: 32, rate: 0.5, playing: true });
});
