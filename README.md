# 第三條路（讀書會試跑）decision-pilot

[![All rights reserved](https://img.shields.io/badge/license-All%20rights%20reserved-lightgrey.svg)](LICENSE)
[![GitHub Pages](https://img.shields.io/badge/site-GitHub%20Pages-blue.svg)](https://albertckchien.github.io/decision-pilot/)

> 卡在兩條路之間的決策報告：寫下你卡住的事，拿到一份比較 A、B 和第三條路的報告，再看每條路走下去的人生模擬。目前只開放讀書會試跑，要邀請碼。

🌐 **[網站](https://albertckchien.github.io/decision-pilot/)**

---

## 功能

- **填表**：寫下卡住的事、個人檔案，可以上傳附件（要讀書會的邀請碼）。
- **案件頁**：看進度、確認問題卡、回答追問、看報告、填回饋，用寄到信箱的專屬連結進來。
- **人生模擬**：每個選項各跑 500 次人生，國家的景氣、匯率、天災照 200 國資料擲骰，壽命照生命表；挑運氣好、運氣差各一段，8-bit 像素場景並排播放，每年 5～15 件有名字的事，播完可以回頭看每一年，最後出現三句話。示意，不是預測，也不是理財建議。

## 結構

```text
decision-pilot/
├── index.html、start.html、case.html   ← 首頁、填表、案件頁
├── assets/      ← 樣式、表單、案件頁、像素場景（pixel.js）、人生模擬播放器（sim.js）
├── backend/     ← Google Apps Script 後台（資料放在私人的 Google Drive 資料夾）
├── engine/      ← 人生模擬引擎（Node，本機跑，讀 200 國資料；不在網站上執行）
└── docs/        ← 部署說明、人生模擬設計、示意頁、嚴審紀錄
```

報告是工作人員照另一套流程製作的，不在這個 repo 裡。

## 授權

版權所有，未經同意不得使用，詳見 [LICENSE](LICENSE)。

## 作者

**albertckchien**（[@albertckchien](https://github.com/albertckchien)）
