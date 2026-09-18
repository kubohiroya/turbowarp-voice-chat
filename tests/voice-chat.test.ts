import type {RealtimeComposition, RealtimeCompositionEvent} from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import {createWebSpeech} from '@kubohiroya/turbowarp-web-speech/composition';
import {describe, expect, it} from 'vitest';
import {VoiceChat, type VoiceChatEvent} from '../src/voice-chat.js';
import {fakeEnvironment} from './helpers/fake-speech.js';

/** The slice of the Realtime composition that VoiceChat uses, with controllable events. */
class FakeRealtime {
  public outputMode = '';
  public timeLimit = -1;
  public connects: Array<{microphone: boolean}> = [];
  public disconnects = 0;
  public sent: string[] = [];
  public failNextConnect: Error | null = null;
  private readonly listeners = new Set<(event: RealtimeCompositionEvent) => void>();

  public setOutputMode(mode: string): void {
    this.outputMode = mode;
  }
  public setSessionTimeLimit(seconds: number): void {
    this.timeLimit = seconds;
  }
  public async connect(options: {microphone: boolean}): Promise<void> {
    if (this.failNextConnect) {
      const error = this.failNextConnect;
      this.failNextConnect = null;
      throw error;
    }
    this.connects.push(options);
  }
  public disconnect(): void {
    this.disconnects += 1;
  }
  public sendText(text: string): void {
    this.sent.push(text);
  }
  public subscribe(listener: (event: RealtimeCompositionEvent) => void): () => void {
    this.listeners.add(listener);
    return () => this.listeners.delete(listener);
  }
  public emit(event: RealtimeCompositionEvent): void {
    for (const listener of this.listeners) listener(event);
  }
}

function setup() {
  let now = 0;
  const realtime = new FakeRealtime();
  const fake = fakeEnvironment();
  const speech = createWebSpeech({environment: fake.environment});
  const timers: Array<{callback: () => void; ms: number; cleared: boolean}> = [];
  const chat = new VoiceChat({
    realtime: realtime as unknown as RealtimeComposition,
    speech,
    now: () => now,
    setTimer: (callback, ms) => {
      const timer = {callback, ms, cleared: false};
      timers.push(timer);
      return timer;
    },
    clearTimer: (handle) => {
      (handle as {cleared: boolean}).cleared = true;
    }
  });
  const events: VoiceChatEvent[] = [];
  chat.subscribe((event) => events.push(event));
  const advance = (ms: number) => {
    now += ms;
  };
  return {realtime, speech, chat, timers, events, advance, ...fake};
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));
const statuses = (events: VoiceChatEvent[]) =>
  events.flatMap((event) => (event.type === 'status' ? [event.status] : []));

describe('VoiceChat', () => {
  it('uses Realtime audio both ways by default', async () => {
    const {chat, realtime, events} = setup();
    await chat.start();
    expect(realtime.outputMode).toBe('audio');
    expect(realtime.connects).toEqual([{microphone: true}]);
    realtime.emit({type: 'response', text: 'Hi!'});
    expect(chat.replyText).toBe('Hi!');
    expect(statuses(events)).toEqual(['connecting', 'listening']);
  });

  it('refuses browser input with Realtime audio output', async () => {
    const {chat, realtime} = setup();
    chat.setInput('browser');
    await expect(chat.start()).rejects.toThrow('cannot be combined');
    expect(realtime.connects).toEqual([]);
    expect(chat.isActive).toBe(false);
  });

  it('turns recognized speech into text and speaks replies, pausing listening while speaking', async () => {
    const {chat, realtime, speech, synthesis, current, events} = setup();
    chat.setInput('browser');
    chat.setOutput('browser');
    await chat.start();
    expect(realtime.outputMode).toBe('text');
    expect(realtime.connects).toEqual([{microphone: false}]);
    expect(speech.listening).toBe(true);

    current()?.result([['こんにちは', true]]);
    expect(realtime.sent).toEqual(['こんにちは']);
    expect(chat.userText).toBe('こんにちは');
    expect(chat.status).toBe('thinking');

    realtime.emit({type: 'response', text: 'やあ'});
    expect(chat.status).toBe('speaking');
    expect(speech.listening).toBe(false);
    expect(synthesis.spoken[0]?.text).toBe('やあ');

    synthesis.finish();
    await flush();
    expect(chat.status).toBe('listening');
    expect(speech.listening).toBe(true);
    expect(events.filter((event) => event.type === 'userSaid' || event.type === 'reply')).toEqual([
      {type: 'userSaid', text: 'こんにちは'},
      {type: 'reply', text: 'やあ'}
    ]);
  });

  it('lets the user interrupt a spoken reply when interruptions are allowed', async () => {
    const {chat, realtime, speech, synthesis, current} = setup();
    chat.setInput('browser');
    chat.setOutput('browser');
    chat.setAllowInterruptions(true);
    await chat.start();
    realtime.emit({type: 'response', text: 'a long answer'});
    expect(speech.listening).toBe(true);
    current()?.onspeechstart?.();
    expect(synthesis.spoken).toHaveLength(0);
    await flush();
    expect(chat.status).toBe('listening');
  });

  it('speaks replies of Realtime input with the browser voice', async () => {
    const {chat, realtime, synthesis} = setup();
    chat.setOutput('browser');
    await chat.start();
    expect(realtime.connects).toEqual([{microphone: true}]);
    realtime.emit({type: 'response', text: 'text reply'});
    expect(synthesis.spoken[0]?.text).toBe('text reply');
  });

  it('forces a coffee break at the session time limit and resumes with a fresh session', async () => {
    const {chat, realtime, timers, events, advance} = setup();
    chat.setCoffeeBreak({talkSeconds: 600, breakSeconds: 300, autoResume: true});
    await chat.start();
    expect(realtime.timeLimit).toBe(600);

    realtime.emit({type: 'sessionTimeLimitReached'});
    expect(chat.isOnBreak).toBe(true);
    expect(chat.status).toBe('break');
    expect(timers.map((timer) => timer.ms)).toEqual([300_000]);
    advance(120_000);
    expect(chat.breakSecondsLeft()).toBe(180);
    realtime.emit({type: 'response', text: 'ignored during the break'});
    expect(chat.replyText).toBe('');

    timers[0]?.callback();
    await flush();
    expect(chat.isOnBreak).toBe(false);
    expect(realtime.connects).toHaveLength(2);
    expect(chat.status).toBe('listening');
    expect(events.filter((event) => event.type === 'breakStart' || event.type === 'breakEnd').map((event) => event.type)).toEqual([
      'breakStart',
      'breakEnd'
    ]);
  });

  it('stops after the break when autoResume is off', async () => {
    const {chat, realtime, timers} = setup();
    chat.setCoffeeBreak({talkSeconds: 60, breakSeconds: 30, autoResume: false});
    await chat.start();
    chat.takeBreak();
    expect(realtime.disconnects).toBe(1);
    timers[0]?.callback();
    expect(chat.isActive).toBe(false);
    expect(chat.status).toBe('idle');
    expect(realtime.connects).toHaveLength(1);
  });

  it('keeps an open-ended break until endBreak, and ends everything on end()', async () => {
    const {chat, timers, speech} = setup();
    chat.setInput('browser');
    chat.setOutput('text');
    chat.setCoffeeBreak({talkSeconds: 60, breakSeconds: 0, autoResume: true});
    await chat.start();
    chat.takeBreak();
    expect(timers).toHaveLength(0);
    expect(speech.listening).toBe(false);
    chat.end();
    expect(chat.isOnBreak).toBe(false);
    expect(chat.isActive).toBe(false);
    chat.endBreak();
    expect(chat.status).toBe('idle');
  });

  it('refuses text while idle or on break, and validates break settings', async () => {
    const {chat} = setup();
    expect(() => chat.sendText('hi')).toThrow('Start the conversation first');
    expect(() => chat.setCoffeeBreak({talkSeconds: -1, breakSeconds: 0, autoResume: true})).toThrow('Talk time');
  });

  it('returns to idle when connecting fails or the session fails', async () => {
    const {chat, realtime} = setup();
    realtime.failNextConnect = new Error('Pair with the local relay first.');
    await expect(chat.start()).rejects.toThrow('Pair with the local relay first.');
    expect(chat.status).toBe('idle');
    await chat.start();
    realtime.emit({type: 'state', state: 'failed'});
    expect(chat.isActive).toBe(false);
    expect(chat.status).toBe('idle');
  });
});
