# TurboWarp-Voice-Chat

[English](README.md) | [日本語](README.ja.md)

AIと声で会話するためのTurboWarp機能拡張です。OpenAI Realtime API、ブラウザ自身の音声認識と音声合成、AIから呼び出せるブロックの関数、そして会話を短く保って料金を抑える「強制コーヒーブレイク」を組み合わせています。

**利用ガイド:** [English](https://kubohiroya.github.io/turbowarp-voice-chat/)

## できること

- OpenAIのAPIキーをlocalhostに置いたままにする[`@kubohiroya/capability-proxy`](https://github.com/kubohiroya/capability-proxy)を通じて、AIと会話する
- 声の聞き取り方と応答の話し方を選べる（会話の自然さと料金のどちらを優先するか）

  | 声の聞き取り（hear my voice with） | 応答の話し方（speak replies with） | 使い心地 | 料金 |
  |---|---|---|---|
  | `realtime` | `realtime` | 最も自然 | 最も高い |
  | `realtime` | `browser`または`text` | 聞き取りは自然、応答はブラウザの声か声なし | 安め |
  | `browser` | `browser` | 交互に話す | 最も安い（AIとはテキストだけでやり取り） |
  | `browser` | `text` | 交互に話す、声なし | 最も安い |
  | `browser` | `realtime` | 使えない（音声認識がAIの声を聞き取ってしまうため） | ― |

- `define function ... export as tool`のスクリプトを、AIが呼べるツールにする
- 強制コーヒーブレイク：決めた時間が経つと会話を休憩にし、新しいセッションで再開する（セッションごとの料金も抑えられる）
- 使用量と料金の概算を表示する

[`@kubohiroya/turbowarp-openai-realtime-api`](https://github.com/kubohiroya/turbowarp-openai-realtime-api)、[`@kubohiroya/turbowarp-web-speech`](https://github.com/kubohiroya/turbowarp-web-speech)、[`@kubohiroya/turbowarp-named-functions`](https://github.com/kubohiroya/turbowarp-named-functions)のComposition APIを組み合わせて作られています。含んでいるのはこれらのロジックで、ブロックではありません。[上流の機能拡張との関係](#上流の機能拡張との関係)を参照してください。

## 動作条件と安全上の注意

- `browser`の音声入力には、Chrome、Edge、SafariでTurboWarp Webを使います。TurboWarp Desktopでは、`realtime`の音声入力と`browser`の読み上げは使えますが、`browser`の音声入力は通常使えません。
- `openai` providerを設定して`127.0.0.1`で起動した`capability-proxy`

> [!IMPORTANT]
> この機能拡張は、マイク、WebRTC、ブラウザの音声API、localhostの中継、VMランタイムを使うため、サンドボックスなしで実行する必要があります。
> 信頼できる配布元の機能拡張だけを読み込んでください。

- 中継のtokenと一時キーはメモリだけに保持し、プロジェクトには保存しません。
- ChromeとEdgeでの`browser`の音声入力は、マイクの音声をブラウザ提供元のクラウドサービスに送ります。`realtime`の音声入力はOpenAIに送ります。話し始める前に利用者に説明してください。
- ツールとして公開した関数の引数はAIが決めます。信頼できない入力として扱ってください。
- 停止ボタンを押すと会話が終了します。つなぎっぱなしで料金がかかり続けることを防ぐためです。

## インストール

1. [`dist/turbowarp-voice-chat.js`](dist/turbowarp-voice-chat.js?raw=1)をダウンロードします。
2. TurboWarpで**機能拡張**を開きます。
3. **カスタム機能拡張**からfileを読み込みます。
4. **サンドボックスなしで実行する**を有効にします。

npm packageとして使う場合は、検証済みのversionをexact pinします。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-voice-chat@0.1.0
```

## 上流の機能拡張との関係

この機能拡張がimportしているのは、上流の各packageの`/composition`エントリポイントです。これは何も登録しない素のTypeScript
ライブラリです。したがってビルド後のfileは`Scratch.extensions.register`を1回だけ呼び、宣言する拡張IDは
`kubohiroyavoicechat`のみで、下記のブロックだけを持ちます。`kubohiroyaopenairealtime`、`kubohiroyawebspeech`、
`kubohiroyanamedfunctions`という機能拡張は含まれていません。

ここから2つの帰結があります。

- **上流の3つと同時に読み込まないでください。** 仕組み上は妨げられませんが、2つの機能拡張がマイク、ブラウザの音声API、
  中継のペアリング、`define function`ハットを取り合い、realtimeのセッションはそれぞれ別に課金されます。
- **上流のブロックで保存したプロジェクトは引き継げません。** SB3は各ブロックを`<extensionId>_<opcode>`として保存するため、
  たとえば`kubohiroyawebspeech_speak`で組んだスクリプトはこの機能拡張では解決できません。ブロック集合も上流の上位集合には
  なっておらず、`speak`、`startListening`、`callFunction`、`connect`などに対応するブロックはありません。上流の機能拡張を
  そのまま使い続けるか、スクリプトを書き直して
  [`sb3-toolchain extensions migrate-id`](https://github.com/kubohiroya/sb3-toolchain/blob/main/docs/ja/extension-id-migration.md)
  でIDを移行してください。

複数の機能拡張を1つの許可単位として読み込みたい場合は、ある機能拡張が別の機能拡張を内包することを期待するのではなく、
プロジェクト側でまとめます。[SB3プロジェクトでの利用](#sb3プロジェクトでの利用)を参照してください。

## SB3プロジェクトでの利用

[`@kubohiroya/sb3-toolchain`](https://github.com/kubohiroya/sb3-toolchain)は、SB3をgitで差分の見えるソースとして管理し、
その中にこの機能拡張をpin留めしておけます。埋め込んだJavaScriptの由来としてnpm packageを記録し、このリポジトリが公開する
API manifestを明示的に有効にすると、更新時にfileを置き換える前にブロック単位の破壊的変更が報告されます。
このAPI manifestの仕様は[`@kubohiroya/turbowarp-extension-manifest`](https://github.com/kubohiroya/turbowarp-extension-manifest)
が定めています。

```jsonc
// app/embedded-extensions.jsonの"extensions"配列の1要素
{
  "id": "kubohiroyavoicechat",
  "path": "extensions/kubohiroyavoicechat.js",
  "mediaType": "text/javascript",
  "parameters": [],
  "encoding": "base64",
  "source": {
    "provider": "npm",
    "package": "@kubohiroya/turbowarp-voice-chat",
    "version": "0.1.0",
    "artifact": "dist/turbowarp-voice-chat.js",
    "integrity": "sha256-<インストールされたdist/turbowarp-voice-chat.jsのSHA-256>",
    "apiManifest": {
      "artifact": "dist/extension-manifest.json",
      "path": "extensions/kubohiroyavoicechat.manifest.json",
      "formatVersion": 1,
      "integrity": "sha256-<インストールされたdist/extension-manifest.jsonのSHA-256>"
    }
  }
}
```

`sb3-toolchain extensions update`が、インストール済みのpackageから2つの`integrity`値を記録し、以降の`check`と`build`で
ネットワークを使わずに検証します。新しいexact versionをインストールしたら、pinを更新してビルドし直します。

```bash
pnpm add --save-exact @kubohiroya/turbowarp-voice-chat@0.1.0
sb3-toolchain extensions update app kubohiroyavoicechat --yes
sb3-toolchain check app
sb3-toolchain build app --output dist/project.sb3
```

プロジェクトがこの機能拡張を他のものと一緒に埋め込んでいて、TurboWarpの確認を機能拡張ごとではなく1回にしたい場合は、
生成されるSB3の中でまとめます。展開したソースには個々の機能拡張が残り、まとめた1つの機能拡張として見えるのは
ビルドされたSB3だけです。

```bash
sb3-toolchain extensions bundle app --id projectbundle --name 'Project Extension Bundle' \
  kubohiroyavoicechat kubohiroyawebspeech --yes
```

これが変えるのは読み込みの境界であって、安全性の判断そのものではありません。利用者はサンドボックスなしのJavaScriptを、
1回にまとめて許可します。詳細は
[`docs/ja/extension-bundles.md`](https://github.com/kubohiroya/sb3-toolchain/blob/main/docs/ja/extension-bundles.md)
を参照してください。

## クイックスタート

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
say [休憩しましょう！]
```

## ブロックリファレンス

ブロックリファレンスは[`src/block-definitions.json`](src/block-definitions.json)から生成しています。生成された部分は手で編集しないでください。ブロックの表示文言はTurboWarp上の英語表記のままです。

<!-- BEGIN GENERATED BLOCKS -->

### `configure local relay [ENDPOINT]`

localhostで動くcapability-proxy中継のループバックoriginを設定します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `configureRelay` |
| `ENDPOINT` | 文字列, 既定値: `http://127.0.0.1:8787` |

### `pair local relay with one-time code [CODE]`

中継が表示した8桁のコードを、メモリだけに保持するtokenと交換します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `pairRelay` |
| `CODE` | 文字列, 既定値: `00000000` |

### `local relay paired?`

有効期限内の中継のtokenを保持しているかを返します。

| 項目 | 値 |
|---|---|
| 種類 | 真偽値ブロック |
| Opcode | `isRelayPaired` |

### `set AI model to [MODEL]`

次の会話で使うモデルを選びます。miniのほうがかなり安価です。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setModel` |
| `MODEL` | 文字列, 既定値: `gpt-realtime-2.1-mini`, 選択肢: `gpt-realtime-2.1-mini`, `gpt-realtime-2.1` |

### `set AI instructions to [TEXT]`

次の会話で使うシステムへの指示を設定します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setInstructions` |
| `TEXT` | 文字列, 既定値: `You are a friendly character in a game. Answer in one or two short sentences.` |

### `hear my voice with [INPUT]`

realtimeはマイクの音声をモデルに送ります。browserはブラウザで音声認識して文字列を送ります（安価）。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setSpeechInput` |
| `INPUT` | 文字列, 既定値: `realtime`, 選択肢: `realtime`, `browser` |

### `speak replies with [OUTPUT]`

realtimeはモデルの声で話します。browserは応答の文字列をブラウザの声で読み上げます（安価）。textは読み上げません。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setSpeechOutput` |
| `OUTPUT` | 文字列, 既定値: `realtime`, 選択肢: `realtime`, `browser`, `text` |

### `set browser speech language to [LANG]`

ブラウザの音声認識と読み上げの言語を設定します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setLanguage` |
| `LANG` | 文字列, 既定値: `ja-JP`, 選択肢: `ja-JP`, `en-US`, `en-GB`, `zh-CN`, `ko-KR`, `fr-FR`, `de-DE`, `es-ES` |

### `set AI voice to [VOICE]`

realtimeの音声出力で使うモデルの声を設定します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setRealtimeVoice` |
| `VOICE` | 文字列, 既定値: `marin`, 選択肢: `alloy`, `ash`, `ballad`, `cedar`, `coral`, `echo`, `marin`, `sage`, `shimmer`, `verse` |

### `allow interrupting the AI [ONOFF]`

ブラウザの音声入力と読み上げを使う場合、onにすると応答の読み上げ中に話しかけて止められます（ヘッドセット推奨）。offでは読み上げ中は聞き取りを止めます。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setAllowInterruptions` |
| `ONOFF` | 文字列, 既定値: `off`, 選択肢: `off`, `on` |

### `force a coffee break every [TALK] minutes for [BREAK] minutes, then [AFTER]`

TALK分ごとに会話を区切り、BREAK分休んだあと、新しいセッションで再開するか終了します。TALKを0にすると強制的な休憩をしません。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `setCoffeeBreak` |
| `TALK` | 数値, 既定値: `10` |
| `BREAK` | 数値, 既定値: `5` |
| `AFTER` | 文字列, 既定値: `resume`, 選択肢: `resume`, `stop` |

### `take a coffee break now`

すぐに休憩を始めます。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `takeBreakNow` |

### `end the coffee break now`

休憩を早めに終えます。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `endBreakNow` |

### `when coffee break starts`

休憩が始まったときに起動します。

| 項目 | 値 |
|---|---|
| 種類 | ハット |
| Opcode | `whenBreakStarts` |

### `when coffee break ends`

休憩が終わったときに起動します。

| 項目 | 値 |
|---|---|
| 種類 | ハット |
| Opcode | `whenBreakEnds` |

### `on coffee break?`

休憩中かを返します。

| 項目 | 値 |
|---|---|
| 種類 | 真偽値ブロック |
| Opcode | `isOnBreak` |

### `coffee break seconds left`

今の休憩の残り秒数を返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `breakSecondsLeft` |

### `start conversation`

現在の設定で接続し、聞き取りを始めます。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `startConversation` |

### `end conversation`

切断し、聞き取りと読み上げを止め、休憩も取り消します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `endConversation` |

### `in conversation?`

会話中か（休憩中も含む）を返します。

| 項目 | 値 |
|---|---|
| 種類 | 真偽値ブロック |
| Opcode | `isActive` |

### `conversation status`

idle、connecting、listening、thinking、speaking、breakのいずれかを返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `conversationStatus` |

### `say [TEXT] to the AI`

話しかけたのと同じように、文字列をAIに送ります。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `sendText` |
| `TEXT` | 文字列, 既定値: `Hello!` |

### `when I say something`

ブラウザの音声認識があなたの発話を聞き取ったときに起動します（browserの音声入力のときだけ）。

| 項目 | 値 |
|---|---|
| 種類 | ハット |
| Opcode | `whenUserSays` |

### `what I said`

直近に認識されたあなたの発話を返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `userSaid` |

### `when the AI replies`

応答（文字列または音声の書き起こし）が届いたときに起動します。

| 項目 | 値 |
|---|---|
| 種類 | ハット |
| Opcode | `whenAiReplies` |

### `AI reply`

直近の応答の文字列、または音声の書き起こしを返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `aiReply` |

### `define function [NAME] description [DESCRIPTION] args schema [SCHEMA] export as [EXPORT]`

関数を定義します。export asをtoolにすると、AIから呼べるようになります。NAME、DESCRIPTION、SCHEMAには文字列を直接書く必要があります。

| 項目 | 値 |
|---|---|
| 種類 | ハット |
| Opcode | `defineFunction` |
| `NAME` | 文字列, 既定値: `get_score` |
| `DESCRIPTION` | 文字列, 既定値: `Returns the player's current score.` |
| `SCHEMA` | 文字列, 既定値: `{"type":"object","properties":{}}` |
| `EXPORT` | 文字列, 既定値: `tool`, 選択肢: `tool`, `none` |

### `function argument [PATH]`

関数の中で、ドット区切りのパスにある引数を返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `functionArgument` |
| `PATH` | 文字列, 既定値: `city` |

### `function arguments JSON`

関数の中で、すべての引数をJSONテキストとして返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `functionArgumentsJson` |

### `return [VALUE]`

関数の中で値を返し、スクリプトを終了します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `returnValue` |
| `VALUE` | 文字列, 既定値: `{"score":10}` |

### `AI usage [FIELD]`

最後にリセットしてからの使用量を返します。costUSDは概算で、正確な請求額はOpenAIの管理画面で確認してください。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `usageValue` |
| `FIELD` | 文字列, 既定値: `costUSD`, 選択肢: `costUSD`, `responses`, `inputTokens`, `outputTokens`, `cachedInputTokens`, `textInputTokens`, `audioInputTokens`, `textOutputTokens`, `audioOutputTokens` |

### `reset AI usage`

使用量の合計を0に戻します。

| 項目 | 値 |
|---|---|
| 種類 | コマンド |
| Opcode | `resetUsage` |

### `last voice chat error`

直近のエラーを返します。エラーがなければ空文字列を返します。

| 項目 | 値 |
|---|---|
| 種類 | 値ブロック |
| Opcode | `lastError` |

<!-- END GENERATED BLOCKS -->

## 重要な動作

| 状況 | 動作 |
|---|---|
| `browser`の音声入力と`browser`の読み上げ | AIが話している間は聞き取りを止め、AIの声を聞き取らないようにする。`allow interrupting the AI [on]`にすると聞き取りを続け、応答の途中で話しかけると読み上げが止まる（ヘッドセット推奨） |
| 強制コーヒーブレイク | TALK分経つとセッションを終える（`when coffee break starts`）。BREAK分経つと、`resume`なら新しいセッションを始め（`when coffee break ends`）、`stop`なら会話を終える。BREAKを0にすると、`end the coffee break now`まで休憩が続く |
| 休憩中 | AIには何も送らず、応答も無視する。マイクは解放する |
| 休憩後の新しいセッション | AIはそれまでの会話を覚えていない。覚えておいてほしいことは指示（instructions）に書く |
| 会話中に設定を変えた | モデル、指示、声、音声の入出力は、次のセッションから反映される |
| プロジェクトの停止 | 会話を終了し、セッションを閉じる |
| 料金 | `AI usage [costUSD]`は公開価格からの概算で、正確な請求額はOpenAIの管理画面で確認する。`browser`の入出力では音声のトークンがまったくかからない |

## Composition API

Composition APIをimportしても、単独のTurboWarp機能拡張は登録されません。使い方は[英語版README](README.md#composition-api)を参照してください。

## 開発

Node.js 22.18.0以上と、`packageManager`で指定したpnpmを使います。

```bash
corepack enable
pnpm install --frozen-lockfile
pnpm check
```

## ライセンス

[Mozilla Public License 2.0](LICENSE) (SPDX: `MPL-2.0`).
