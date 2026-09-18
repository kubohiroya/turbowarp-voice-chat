/**
 * Composition API: voice chat without TurboWarp block definitions.
 *
 * Wires one shared set of named functions into the Realtime composition (as tools) and combines it
 * with Web Speech. Importing this module does not register a TurboWarp extension.
 */
import {createNamedFunctions, type NamedFunctions, type RuntimeLike} from '@kubohiroya/turbowarp-named-functions/composition';
import {
  createRealtimeComposition,
  type RealtimeComposition,
  type RealtimeCompositionOptions
} from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import {createWebSpeech, type WebSpeech} from '@kubohiroya/turbowarp-web-speech/composition';
import {VoiceChat} from './voice-chat.js';

export type {
  CoffeeBreakSettings,
  ConversationStatus,
  SpeechInput,
  SpeechOutput,
  VoiceChatEvent,
  VoiceChatListener
} from './voice-chat.js';
export {VoiceChat} from './voice-chat.js';

export interface VoiceChatCompositionOptions {
  runtime: RuntimeLike;
  /** Opcode of the consumer extension's `define function` hat. */
  functionHatOpcode: string;
  /** Substitutes for the upstream compositions, for example in tests. */
  functions?: NamedFunctions;
  realtime?: RealtimeComposition;
  speech?: WebSpeech;
  realtimeOptions?: Omit<RealtimeCompositionOptions, 'runtime' | 'functionHatOpcode' | 'functions'>;
  now?: () => number;
  setTimer?: (callback: () => void, ms: number) => unknown;
  clearTimer?: (handle: unknown) => void;
}

export interface VoiceChatComposition {
  readonly functions: NamedFunctions;
  readonly realtime: RealtimeComposition;
  readonly speech: WebSpeech;
  readonly chat: VoiceChat;
  release(): void;
}

export function createVoiceChat(options: VoiceChatCompositionOptions): VoiceChatComposition {
  const functions =
    options.functions ?? createNamedFunctions({runtime: options.runtime, functionHatOpcode: options.functionHatOpcode});
  const realtime =
    options.realtime ??
    createRealtimeComposition({
      ...options.realtimeOptions,
      runtime: options.runtime,
      functionHatOpcode: options.functionHatOpcode,
      functions
    });
  const speech = options.speech ?? createWebSpeech();
  const chat = new VoiceChat({
    realtime,
    speech,
    ...(options.now ? {now: options.now} : {}),
    ...(options.setTimer ? {setTimer: options.setTimer} : {}),
    ...(options.clearTimer ? {clearTimer: options.clearTimer} : {})
  });
  return {
    functions,
    realtime,
    speech,
    chat,
    release: () => {
      chat.release();
      realtime.release();
      speech.release();
      functions.release();
    }
  };
}
