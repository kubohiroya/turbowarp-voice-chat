import type {RealtimeEvent, RealtimeTransport, TransportConnectOptions} from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import {createWebSpeech} from '@kubohiroya/turbowarp-web-speech/composition';
import {afterEach, beforeEach, describe, expect, it, vi} from 'vitest';
import definitions from '../src/block-definitions.json';
import {DEFINE_FUNCTION_OPCODE, HATS, VoiceChatExtension} from '../src/extension.js';
import {fakeEnvironment} from './helpers/fake-speech.js';
import {FakeRuntime, targetWithFunctions} from './helpers/fake-runtime.js';

beforeEach(() => {
  vi.stubGlobal('Scratch', {
    BlockType: {COMMAND: 'command', REPORTER: 'reporter', BOOLEAN: 'Boolean', HAT: 'hat'},
    ArgumentType: {STRING: 'string', NUMBER: 'number', BOOLEAN: 'Boolean'},
    Cast: {toString: (value: unknown) => String(value), toNumber: (value: unknown) => Number(value)},
    translate: (message: string | {default: string}) => (typeof message === 'string' ? message : message.default)
  });
});

afterEach(() => {
  vi.unstubAllGlobals();
});

class FakeTransport implements RealtimeTransport {
  public readonly sent: RealtimeEvent[] = [];
  public options: TransportConnectOptions | null = null;
  public closed = 0;
  public async connect(options: TransportConnectOptions): Promise<void> {
    this.options = options;
  }
  public send(event: RealtimeEvent): void {
    this.sent.push(event);
  }
  public close(): void {
    this.closed += 1;
  }
}

function setup() {
  const now = Date.now();
  const runtime = new FakeRuntime();
  runtime.targets = [targetWithFunctions(DEFINE_FUNCTION_OPCODE, [{name: 'get_score', description: 'Returns the score.'}])];
  const transport = new FakeTransport();
  const requests: unknown[] = [];
  const fetcher = vi.fn(async (url: string, init?: RequestInit) => {
    if (url.endsWith('/v1/pair')) {
      return new Response(JSON.stringify({token: 'abcdefghijklmnopqrstuvwxyz012345', expiresAt: now + 3_600_000}));
    }
    requests.push(JSON.parse(String(init?.body)));
    return new Response(JSON.stringify({data: {value: 'ek_x', expiresAt: now + 60_000, model: 'gpt-realtime-2.1-mini'}}));
  });
  const fake = fakeEnvironment();
  const extension = new VoiceChatExtension({
    runtime,
    speech: createWebSpeech({environment: fake.environment}),
    realtimeOptions: {fetch: fetcher, createTransport: () => transport}
  });
  return {runtime, transport, requests, extension, ...fake};
}

const flush = () => new Promise((resolve) => setTimeout(resolve, 0));

describe('VoiceChatExtension', () => {
  it('describes every block and implements each opcode', () => {
    const {extension} = setup();
    const info = extension.getInfo() as {id: string; blocks: Array<{opcode: string; blockType: string; isEdgeActivated?: boolean}>};
    expect(info.id).toBe('kubohiroyavoicechat');
    expect(info.blocks).toHaveLength(definitions.blocks.length);
    for (const block of info.blocks) {
      expect(typeof (extension as unknown as Record<string, unknown>)[block.opcode]).toBe('function');
      if (block.blockType === 'hat') expect(block.isEdgeActivated).toBe(false);
    }
  });

  it('runs a browser-speech conversation with the voice-chat function hats as tools', async () => {
    const {extension, runtime, transport, requests, current, synthesis} = setup();
    await extension.pairRelay({CODE: '12345678'});
    extension.setModel({MODEL: 'gpt-realtime-2.1-mini'});
    extension.setSpeechInput({INPUT: 'browser'});
    extension.setSpeechOutput({OUTPUT: 'browser'});
    extension.setLanguage({LANG: 'ja-JP'});
    await extension.startConversation();
    expect(extension.lastError()).toBe('');
    expect(extension.conversationStatus()).toBe('listening');
    expect(requests[0]).toMatchObject({
      session: {model: 'gpt-realtime-2.1-mini', outputModalities: ['text'], tools: [{name: 'get_score'}]}
    });

    current()?.result([['スコアは？', true]]);
    expect(runtime.startedHats).toContain(HATS.userSays);
    expect(extension.userSaid()).toBe('スコアは？');

    // The model calls the tool; the voice-chat define function hat answers it.
    transport.options?.onEvent({
      type: 'response.done',
      response: {output: [{type: 'function_call', name: 'get_score', call_id: 'c1', arguments: '{}'}]}
    });
    await flush();
    const thread = runtime.spawnThread();
    expect(extension.defineFunction({NAME: 'get_score'}, {thread})).toBe(true);
    extension.returnValue({VALUE: '{"score":42}'}, {thread});
    await flush();
    expect(transport.sent.at(-2)).toEqual({
      type: 'conversation.item.create',
      item: {type: 'function_call_output', call_id: 'c1', output: '{"score":42}'}
    });

    transport.options?.onEvent({
      type: 'response.done',
      response: {output: [{type: 'message', content: [{type: 'output_text', text: '42点です'}]}]}
    });
    await flush();
    expect(runtime.startedHats).toContain(HATS.aiReplies);
    expect(extension.aiReply()).toBe('42点です');
    expect(synthesis.spoken[0]?.text).toBe('42点です');
  });

  it('forces a coffee break with the blocks', async () => {
    const {extension, runtime, transport} = setup();
    await extension.pairRelay({CODE: '12345678'});
    extension.setCoffeeBreak({TALK: '10', BREAK: '5', AFTER: 'stop'});
    await extension.startConversation();
    extension.takeBreakNow();
    expect(extension.isOnBreak()).toBe(true);
    expect(extension.breakSecondsLeft()).toBe(300);
    expect(runtime.startedHats).toContain(HATS.breakStarts);
    expect(transport.closed).toBeGreaterThan(0);
    extension.endBreakNow();
    expect(runtime.startedHats).toContain(HATS.breakEnds);
    expect(extension.isActive()).toBe(false);
  });

  it('ends the conversation when the project stops', async () => {
    const {extension, runtime, transport} = setup();
    await extension.pairRelay({CODE: '12345678'});
    await extension.startConversation();
    runtime.emit('PROJECT_STOP_ALL');
    expect(extension.isActive()).toBe(false);
    expect(transport.closed).toBeGreaterThan(0);
  });

  it('records errors such as starting before pairing or an invalid combination', async () => {
    const {extension} = setup();
    await extension.startConversation();
    expect(extension.lastError()).toContain('Pair with the local relay first');
    extension.setSpeechInput({INPUT: 'browser'});
    await extension.startConversation();
    expect(extension.lastError()).toContain('cannot be combined');
    extension.sendText({TEXT: 'hi'});
    expect(extension.lastError()).toContain('Start the conversation first');
  });
});
