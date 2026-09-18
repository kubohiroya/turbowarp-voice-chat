# TurboWarp-Voice-Chat

[English](README.md) | [日本語](README.ja.md)

A TurboWarp extension for talking with an AI by voice. It combines the OpenAI Realtime API, the browser's own speech recognition and speech synthesis, functions written in blocks that the AI can call, and a forced coffee break that keeps conversations short and costs low.

**User guide:** [English](https://kubohiroya.github.io/turbowarp-voice-chat/)

## What it does

- Talks with an AI through [`@kubohiroya/capability-proxy`](https://github.com/kubohiroya/capability-proxy), which keeps the OpenAI API key on localhost.
- Lets you choose how your voice is heard and how replies are spoken, trading naturalness for cost:

  | Hear my voice with | Speak replies with | Feels | Cost |
  |---|---|---|---|
  | `realtime` | `realtime` | Most natural | Highest |
  | `realtime` | `browser` or `text` | Natural input, browser voice or no voice | Lower |
  | `browser` | `browser` | Turn-based | Lowest (text only to the AI) |
  | `browser` | `text` | Turn-based, no voice | Lowest |
  | `browser` | `realtime` | Not allowed (recognition would hear the AI) | — |

- Turns `define function ... export as tool` scripts into tools the AI can call.
- Forces a coffee break: after a set number of minutes the conversation pauses, and it resumes with a fresh session, which also keeps each session's cost down.
- Reports estimated usage and cost.

Built from [`@kubohiroya/turbowarp-openai-realtime-api`](https://github.com/kubohiroya/turbowarp-openai-realtime-api), [`@kubohiroya/turbowarp-web-speech`](https://github.com/kubohiroya/turbowarp-web-speech), and [`@kubohiroya/turbowarp-named-functions`](https://github.com/kubohiroya/turbowarp-named-functions). Load only this extension; it contains the others.

## Requirements and safety

- TurboWarp Web in Chrome, Edge, or Safari for `browser` speech input. TurboWarp Desktop can use `realtime` input and `browser` output, but usually not `browser` input.
- `capability-proxy` running on `127.0.0.1` with the `openai` provider.

> [!IMPORTANT]
> This extension must run unsandboxed. It uses the microphone, WebRTC, the browser's speech APIs, the localhost relay, and the VM runtime.
> Load extensions only from sources you trust.

- The relay token and ephemeral keys stay in memory; they are never saved in the project.
- `browser` speech input in Chrome and Edge sends microphone audio to the browser vendor's cloud service. `realtime` input sends it to OpenAI. Tell users before they speak.
- The AI chooses the arguments of exported functions. Treat them as untrusted input.
- Pressing the stop button ends the conversation, so a forgotten session does not keep costing money.

## Installation

### Built JavaScript

1. Download [`dist/turbowarp-voice-chat.js`](dist/turbowarp-voice-chat.js?raw=1).
2. Open **Extensions** in TurboWarp.
3. Choose **Custom Extension** and load the file.
4. Enable **Run without sandbox**.

### npm package

```bash
pnpm add --save-exact @kubohiroya/turbowarp-voice-chat@0.1.0
```

Standalone bundle:

```text
node_modules/@kubohiroya/turbowarp-voice-chat/dist/turbowarp-voice-chat.js
```

## Quick start

```text
when green flag clicked
configure local relay [http://127.0.0.1:8787]
pair local relay with one-time code [12345678]
set AI model to [gpt-realtime-2.1-mini]
hear my voice with [browser]
speak replies with [browser]
set browser speech language to [ja-JP]
force a coffee break every (10) minutes for (5) minutes, then [resume]
start conversation

when the AI replies
say (AI reply)

when coffee break starts
say [Coffee break!]
```

## Block reference

The block reference is generated from
[`src/block-definitions.json`](src/block-definitions.json). Do not edit the
generated section manually.

<!-- BEGIN GENERATED BLOCKS -->

### `configure local relay [ENDPOINT]`

Sets the loopback origin of the local capability-proxy relay.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `configureRelay` |
| `ENDPOINT` | String, default: `http://127.0.0.1:8787` |

### `pair local relay with one-time code [CODE]`

Exchanges the eight-digit code printed by the relay for a token kept only in memory.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `pairRelay` |
| `CODE` | String, default: `00000000` |

### `local relay paired?`

Reports whether an unexpired relay token is held in memory.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isRelayPaired` |

### `set AI model to [MODEL]`

Chooses the model for the next conversation. mini is much cheaper.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setModel` |
| `MODEL` | String, default: `gpt-realtime-2.1-mini`, choices: `gpt-realtime-2.1-mini`, `gpt-realtime-2.1` |

### `set AI instructions to [TEXT]`

Sets the system instructions for the next conversation.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setInstructions` |
| `TEXT` | String, default: `You are a friendly character in a game. Answer in one or two short sentences.` |

### `hear my voice with [INPUT]`

realtime sends microphone audio to the model; browser recognizes speech in the browser and sends text (cheaper).

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpeechInput` |
| `INPUT` | String, default: `realtime`, choices: `realtime`, `browser` |

### `speak replies with [OUTPUT]`

realtime plays the model's voice; browser reads the text with the browser's voice (cheaper); text does not speak.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setSpeechOutput` |
| `OUTPUT` | String, default: `realtime`, choices: `realtime`, `browser`, `text` |

### `set browser speech language to [LANG]`

Sets the language of browser speech recognition and speech output.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setLanguage` |
| `LANG` | String, default: `ja-JP`, choices: `ja-JP`, `en-US`, `en-GB`, `zh-CN`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES` |

### `set AI voice to [VOICE]`

Sets the model's voice used with realtime speech output.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setRealtimeVoice` |
| `VOICE` | String, default: `marin`, choices: `alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `marin`, `sage`, `shimmer`, `verse` |

### `allow interrupting the AI [ONOFF]`

With browser input and output, on lets you talk over a reply to stop it (use a headset). off pauses listening while the AI speaks.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setAllowInterruptions` |
| `ONOFF` | String, default: `off`, choices: `off`, `on` |

### `force a coffee break every [TALK] minutes for [BREAK] minutes, then [AFTER]`

Ends the conversation after TALK minutes, waits BREAK minutes, then resumes with a fresh session or stops. TALK 0 turns forced breaks off.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `setCoffeeBreak` |
| `TALK` | Number, default: `10` |
| `BREAK` | Number, default: `5` |
| `AFTER` | String, default: `resume`, choices: `resume`, `stop` |

### `take a coffee break now`

Starts a coffee break immediately.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `takeBreakNow` |

### `end the coffee break now`

Ends the coffee break early.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `endBreakNow` |

### `when coffee break starts`

Starts when a coffee break begins.

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `whenBreakStarts` |

### `when coffee break ends`

Starts when a coffee break ends.

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `whenBreakEnds` |

### `on coffee break?`

Reports whether a coffee break is in progress.

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isOnBreak` |

### `coffee break seconds left`

Reports the seconds left in the current coffee break.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `breakSecondsLeft` |

### `start conversation`

Connects and starts listening with the current settings.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `startConversation` |

### `end conversation`

Disconnects, stops listening and speaking, and cancels any coffee break.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `endConversation` |

### `in conversation?`

Reports whether a conversation is running (including its coffee breaks).

| Property | Value |
|---|---|
| Type | Boolean |
| Opcode | `isActive` |

### `conversation status`

Reports idle, connecting, listening, thinking, speaking, or break.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `conversationStatus` |

### `say [TEXT] to the AI`

Sends typed text as if you had said it.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `sendText` |
| `TEXT` | String, default: `Hello!` |

### `when I say something`

Starts when browser speech recognition hears you (browser input only).

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `whenUserSays` |

### `what I said`

Reports your most recent recognized utterance.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `userSaid` |

### `when the AI replies`

Starts when a reply with text or a transcript arrives.

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `whenAiReplies` |

### `AI reply`

Reports the most recent reply text or transcript.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `aiReply` |

### `define function [NAME] description [DESCRIPTION] args schema [SCHEMA] export as [EXPORT]`

Defines a function. With export as tool, the AI can call it. NAME, DESCRIPTION, and SCHEMA must be literal text.

| Property | Value |
|---|---|
| Type | Hat |
| Opcode | `defineFunction` |
| `NAME` | String, default: `get_score` |
| `DESCRIPTION` | String, default: `Returns the player's current score.` |
| `SCHEMA` | String, default: `{"type":"object","properties":{}}` |
| `EXPORT` | String, default: `tool`, choices: `tool`, `none` |

### `function argument [PATH]`

Inside a function, reports the argument at a dotted path.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `functionArgument` |
| `PATH` | String, default: `city` |

### `function arguments JSON`

Inside a function, reports all arguments as JSON text.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `functionArgumentsJson` |

### `return [VALUE]`

Inside a function, returns a value and ends the script.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `returnValue` |
| `VALUE` | String, default: `{"score":10}` |

### `AI usage [FIELD]`

Reports usage totals since the last reset. costUSD is an estimate; the OpenAI dashboard is authoritative.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `usageValue` |
| `FIELD` | String, default: `costUSD`, choices: `costUSD`, `responses`, `inputTokens`, `outputTokens`, `cachedInputTokens`, `textInputTokens`, `audioInputTokens`, `textOutputTokens`, `audioOutputTokens` |

### `reset AI usage`

Clears the usage totals.

| Property | Value |
|---|---|
| Type | Command |
| Opcode | `resetUsage` |

### `last voice chat error`

Reports the most recent error, or an empty string.

| Property | Value |
|---|---|
| Type | Reporter |
| Opcode | `lastError` |

<!-- END GENERATED BLOCKS -->

## Important behavior

| Situation | Behavior |
|---|---|
| `browser` input and `browser` output | Listening pauses while the AI speaks, so recognition does not hear the AI. With `allow interrupting the AI [on]`, listening continues and talking over a reply stops it; use a headset. |
| Forced coffee break | The session ends after TALK minutes (`when coffee break starts`). After BREAK minutes, `resume` starts a fresh session (`when coffee break ends`); `stop` ends the conversation. BREAK 0 keeps the break until `end the coffee break now`. |
| During a break | Nothing is sent to the AI and replies are ignored; the microphone is released. |
| A fresh session after a break | The AI does not remember the earlier conversation. Put anything it must remember into the instructions. |
| Settings changed while talking | Model, instructions, voice, and speech input/output apply from the next session. |
| Project stop | The conversation ends and the session closes. |
| Costs | `AI usage [costUSD]` is an estimate from published prices; the OpenAI dashboard is authoritative. `browser` input and output avoid audio tokens entirely. |

## Composition API

Importing the Composition API does not register the standalone TurboWarp extension.

```ts
import {createVoiceChat} from '@kubohiroya/turbowarp-voice-chat/composition';

const voice = createVoiceChat({
  runtime: Scratch.vm.runtime,
  functionHatOpcode: 'myextension_defineFunction'
});
voice.realtime.configureRelay('http://127.0.0.1:8787');
await voice.realtime.pairRelay('12345678');
voice.chat.setInput('browser');
voice.chat.setOutput('browser');
voice.chat.setCoffeeBreak({talkSeconds: 600, breakSeconds: 300, autoResume: true});
voice.chat.subscribe((event) => console.log(event));
await voice.chat.start();

voice.release();
```

`voice.functions`, `voice.realtime`, and `voice.speech` are the upstream compositions; `voice.chat`
orchestrates them.

## Compatibility

| Identifier | Value | Stability |
|---|---|---|
| Product name | `TurboWarp-Voice-Chat` | Human-facing |
| Repository | `kubohiroya/turbowarp-voice-chat` | Current source location |
| npm package | `@kubohiroya/turbowarp-voice-chat` | Public package contract |
| Extension ID | `kubohiroyavoicechat` | Stored in SB3; migration required to change |
| Composition API | `@kubohiroya/turbowarp-voice-chat/composition` | Public package contract |

## Development

Use Node.js 22.18.0 or newer and the pnpm version declared by `packageManager`.

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

## License

[Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`).
