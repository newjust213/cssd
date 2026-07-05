# CSSD Level-Ⅰ

Computer Specialist in Spreadsheet & Database Level-1 — 컴퓨터활용능력 1급 4주 합격 플랜 학습 웹앱.

## 모듈

- **4주 플랜**: 주차별 체크리스트 + 진도율
- **필기 CBT**: 과목별 객관식 풀이, 타이머, 오답노트 (문제은행은 샘플 — 시나공 PDF 파싱으로 확장 예정)
- **암기카드**: 엑셀 함수 / Access 쿼리 SRS(Leitner) 반복
- **손순서**: 실기 조작 절차를 순서대로 맞추는 훈련

## 실행

```bash
npm install
npm run dev      # 개발 서버
npm run build    # dist/ 정적 빌드
```

## 진도 저장

기본은 localStorage 로컬 모드.
`src/firebase-config.js`에 Firebase 웹앱 config를 넣으면 Google 로그인 + Firestore 동기화가 활성화된다.

Firestore Security Rules:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/{document=**} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

## 데이터

`src/data/*.json` — plan(플랜) / quiz(필기 문제) / cards(암기카드) / procedures(손순서).
문제 데이터 소스·저작권 검토는 상위 폴더 `검토 문서.md` 참조.
