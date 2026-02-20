// ============================================================
// Runner Coach — Firebase Configuration
// ============================================================
// セットアップ手順:
// 1. https://console.firebase.google.com でプロジェクトを作成
// 2. Authentication → Sign-in method → Google を有効化
// 3. Cloud Firestore → データベースを作成（本番モード）
// 4. プロジェクト設定 → ウェブアプリを追加 → 設定値を下に貼り付け
// 5. Authentication → Settings → Authorized domains にデプロイ先ドメインを追加
//
// Firestore セキュリティルール（推奨）:
// rules_version = '2';
// service cloud.firestore {
//   match /databases/{database}/documents {
//     match /users/{uid} {
//       allow read: if request.auth != null;
//       allow write: if request.auth != null && request.auth.uid == uid;
//     }
//     match /friendRequests/{docId} {
//       allow read: if request.auth != null;
//       allow create: if request.auth != null;
//       allow update, delete: if request.auth != null;
//     }
//   }
// }
// ============================================================

const FIREBASE_CONFIG = {
  apiKey: "",
  authDomain: "",
  projectId: "",
  storageBucket: "",
  messagingSenderId: "",
  appId: ""
};
