import { describe, it, expect, vi, beforeEach } from 'vitest';
import { createTransportService } from './transportService';

const { mockTransport } = vi.hoisted(() => ({
  mockTransport: {
    start: vi.fn(),
    pause: vi.fn(),
    stop: vi.fn(),
    seconds: 0,
    loop: false,
    loopStart: 0,
    loopEnd: '0:0:0',
    bpm: { value: 120 },
  },
}));

vi.mock('tone', () => ({
  getTransport: vi.fn(() => mockTransport),
}));

describe('createTransportService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockTransport.seconds = 0;
    mockTransport.loop = false;
    mockTransport.bpm.value = 120;
  });

  it('getSnapshot returns stopped state with initial bpm on creation', () => {
    const service = createTransportService(130);
    const snap = service.getSnapshot();
    expect(snap.isPlaying).toBe(false);
    expect(snap.bpm).toBe(130);
    expect(snap.currentStep).toBe(-1);
  });

  it('play() updates snapshot isPlaying to true and calls transport.start', () => {
    const service = createTransportService();
    service.play();
    expect(service.getSnapshot().isPlaying).toBe(true);
    expect(mockTransport.start).toHaveBeenCalledOnce();
  });

  it('pause() updates snapshot isPlaying to false and calls transport.pause', () => {
    const service = createTransportService();
    service.play();
    service.pause();
    const snap = service.getSnapshot();
    expect(snap.isPlaying).toBe(false);
    expect(mockTransport.pause).toHaveBeenCalledOnce();
  });

  it('stop() resets isPlaying and currentStep', () => {
    const service = createTransportService();
    service.play();
    service.updateCurrentStep(3);
    service.stop();
    const snap = service.getSnapshot();
    expect(snap.isPlaying).toBe(false);
    expect(snap.currentStep).toBe(-1);
    expect(mockTransport.stop).toHaveBeenCalledOnce();
  });

  it('stop() resets positionSeconds to Tone transport seconds (0 after stop)', () => {
    const service = createTransportService();
    service.play();
    mockTransport.seconds = 1.5;
    // After stop, seconds is still read from Tone.getTransport().seconds
    // (the actual reset to 0 happens inside Tone, here mock is still at 1.5)
    service.stop();
    mockTransport.seconds = 0; // simulate Tone resetting position
    const snap = service.getSnapshot();
    expect(snap.positionSeconds).toBe(0);
  });

  it('setBpm() updates snapshot bpm and calls transport bpm.value', () => {
    const service = createTransportService();
    service.setBpm(140);
    expect(service.getSnapshot().bpm).toBe(140);
    expect(mockTransport.bpm.value).toBe(140);
  });

  it('updateCurrentStep() updates snapshot currentStep', () => {
    const service = createTransportService();
    service.updateCurrentStep(5);
    expect(service.getSnapshot().currentStep).toBe(5);
  });

  it('subscribe listener is called on play', () => {
    const service = createTransportService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.play();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('subscribe returns unsubscribe function that stops notifications', () => {
    const service = createTransportService();
    const listener = vi.fn();
    const unsub = service.subscribe(listener);
    unsub();
    service.play();
    expect(listener).not.toHaveBeenCalled();
  });

  it('subscribe listener is called on pause', () => {
    const service = createTransportService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.pause();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('subscribe listener is called on stop', () => {
    const service = createTransportService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.stop();
    expect(listener).toHaveBeenCalledOnce();
  });

  it('subscribe listener is called on setBpm', () => {
    const service = createTransportService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.setBpm(150);
    expect(listener).toHaveBeenCalledOnce();
  });

  it('setLoopConfig configures transport loop', () => {
    const service = createTransportService();
    service.setLoopConfig(true, '1m');
    expect(mockTransport.loop).toBe(true);
    expect(mockTransport.loopStart).toBe(0);
    expect(mockTransport.loopEnd).toBe('1m');
  });

  it('dispose clears all listeners', () => {
    const service = createTransportService();
    const listener = vi.fn();
    service.subscribe(listener);
    service.dispose();
    service.play();
    expect(listener).not.toHaveBeenCalled();
  });

  it('play/pause/stop sequence updates snapshot correctly', () => {
    const service = createTransportService();
    service.play();
    expect(service.getSnapshot().isPlaying).toBe(true);

    service.pause();
    expect(service.getSnapshot().isPlaying).toBe(false);

    service.play();
    expect(service.getSnapshot().isPlaying).toBe(true);

    service.stop();
    expect(service.getSnapshot().isPlaying).toBe(false);
    expect(service.getSnapshot().currentStep).toBe(-1);
  });

  it('getSnapshot positionSeconds reads from Tone.getTransport().seconds', () => {
    const service = createTransportService();
    service.play();
    mockTransport.seconds = 2.5;
    expect(service.getSnapshot().positionSeconds).toBe(2.5);
  });
});
