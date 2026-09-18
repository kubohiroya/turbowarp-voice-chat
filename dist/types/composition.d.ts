/**
 * Composition API: voice chat without TurboWarp block definitions.
 *
 * Wires one shared set of named functions into the Realtime composition (as tools) and combines it
 * with Web Speech. Importing this module does not register a TurboWarp extension.
 */
import { type NamedFunctions, type RuntimeLike } from '@kubohiroya/turbowarp-named-functions/composition';
import { type RealtimeComposition, type RealtimeCompositionOptions } from '@kubohiroya/turbowarp-openai-realtime-api/composition';
import { type WebSpeech } from '@kubohiroya/turbowarp-web-speech/composition';
import { VoiceChat } from './voice-chat.js';
export type { CoffeeBreakSettings, ConversationStatus, SpeechInput, SpeechOutput, VoiceChatEvent, VoiceChatListener } from './voice-chat.js';
export { VoiceChat } from './voice-chat.js';
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
export declare function createVoiceChat(options: VoiceChatCompositionOptions): VoiceChatComposition;
