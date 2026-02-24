# 筋トレ機能拡張 - 実装計画

## データモデル拡張

### 1. strengthGoals（新規）
```js
state.strengthGoals = [
  { text: 'ベンチプレス 100kg' },
  { text: 'チンニング 15回' }
]
```

### 2. strengthPatterns（拡張 — exercises追加）
```js
state.strengthPatterns = [
  {
    id: 'sp_xxx',
    name: '背中トレ',
    exercises: [
      { name: 'チンニング' },
      { name: 'シーテッドロー' },
      { name: 'ルーマニアンデッドリフト' }
    ]
  }
]
```

### 3. strengthRecords（新規 — セット単位記録）
```js
state.strengthRecords = {
  '2026-02-24': {
    patternId: 'sp_xxx',
    exercises: [
      // exercise index 0: チンニング
      [
        { weight: 0, reps: 10 },  // set 1
        { weight: 0, reps: 8 }    // set 2
      ],
      // exercise index 1: シーテッドロー
      [
        { weight: 60, reps: 10 },
        { weight: 65, reps: 8 }
      ]
    ]
  }
}
```

## UI変更

### Step 1: パターンにエクササイズ追加
- パターン編集モーダルの各パターン内にエクササイズのリストを追加
- 各パターン展開で「+ 種目を追加」ボタン
- 既存パターン（名前だけ）は自動マイグレーション（exercises: [] で初期化）

### Step 2: 完了時のセット記録UI
- 筋トレ完了タップ → 記録モーダル表示
- パターン内の各エクササイズごとにセット追加可能
- 各セット: 重さ(kg) × 回数(reps)
- 「+ セット追加」ボタン
- 前回の記録をデフォルト値として表示（便利）
- 保存 → strengthRecords に格納

### Step 3: 筋トレ目標
- Goalタブに「筋トレの目標」セクション追加
- 自由テキストで複数登録（+ 追加 / ✕ 削除）
- Planタブ筋トレビュー上部に目標を表示

### Step 4: ランメニュー連携表示
- 筋トレPlanの各日の横に、前日・当日・翌日のランメニューを小さく表示
- type + dist をコンパクトに表示（例: 「🏃 インターバル 10km」）

### Step 5: Firebase同期 & sw.js
- syncToCloud に strengthGoals, strengthRecords を追加
- sw.js キャッシュバージョン インクリメント
