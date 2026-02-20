// ============================================================
// Runner Coach — Firebase Configuration
// ============================================================
//
// === セットアップ手順 ===
//
// 1. Firebase プロジェクトを作成
//    https://console.firebase.google.com → 「プロジェクトを追加」
//
// 2. Authentication を有効化
//    左メニュー「Authentication」→「始める」→「Sign-in method」タブ
//    → 「Google」を有効にする → プロジェクトの公開名を入力 → 保存
//
// 3. Firestore データベースを作成
//    左メニュー「Firestore Database」→「データベースを作成」
//    → 「本番モード」→ ロケーション「asia-northeast1 (東京)」→ 作成
//
// 4. Firestore セキュリティルール設定
//    Firestore →「ルール」タブ → 以下を貼り付けて「公開」:
//
//    rules_version = '2';
//    service cloud.firestore {
//      match /databases/{database}/documents {
//        match /users/{uid} {
//          allow read: if request.auth != null;
//          allow write: if request.auth != null && request.auth.uid == uid;
//        }
//        match /friendRequests/{docId} {
//          allow read: if request.auth != null;
//          allow create: if request.auth != null;
//          allow update: if request.auth != null;
//        }
//      }
//    }
//
// 5. ウェブアプリを登録 & 設定値を取得
//    プロジェクト設定（歯車アイコン）→「全般」タブ
//    → 下の「マイアプリ」→「</>」(ウェブ) をクリック
//    → アプリのニックネームを入力 → 「アプリを登録」
//    → 表示される firebaseConfig の値を下にコピー
//
// 6. デプロイ先ドメインを許可
//    Authentication →「Settings」→「Authorized domains」
//    → デプロイ先のドメインを追加 (例: yourapp.web.app)
//
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "AIzaSyCxUXOA6dtxmONoc3IP0cwn4XDXCd2iwxE",
  authDomain: "runner-coach-a0366.firebaseapp.com",
  projectId: "runner-coach-a0366",
  storageBucket: "runner-coach-a0366.firebasestorage.app",
  messagingSenderId: "853785334128",
  appId: "1:853785334128:web:91e42669d0a78087f1ffb5"
};
