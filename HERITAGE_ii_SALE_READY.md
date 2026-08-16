# HERITAGE ii - SALE READY BUILD
**Date:** 2026-04-11
**Time:** 17:10 UTC
**Status:** Centralized & Royalty-Enabled

---

## 1. Business Configuration File
This is the "Master Switch" for the business. Update this file to transfer ownership.

**File:** `/src/config/heritageBusiness.ts`
```ts
export const HERITAGE_BUSINESS = {
  owner: {
    name: "Tommy Knoesen",
    fullName: "Thomas Knoesen",
    email: "tomknsn@gmail.com",
    secondaryEmail: "thomasknsn@gmail.com",
  },
  payment: {
    eft: {
      accountHolder: "Thomas Knoesen",
      bank: "CAPITEC 470010",
      accountNumber: "1378434755",
    },
    payfast: {
      merchantId: "21424325",
      merchantKey: "gclahuwgyvzfa",
    }
  },
  security: {
    dashboardKey: "HERITAGE2026", // Password to access royalty reports
  },
  royalty: {
    percentage: 0.10, // 10% royalty on all future income
    recipientEmail: "tomknsn@gmail.com",
  },
  branding: {
    name: "HERITAGE™",
    copyright: "© 2026 Tommy Knoesen. All Rights Reserved.",
  }
};
```

---

## 2. Royalty Engine
This service handles the calculation and logging of payments.

**File:** `/src/services/royaltyService.ts`
```ts
// [Content of royaltyService.ts]
```

---

## 3. Core Application (Updated)
The main application now pulls all personal data from the configuration file.

**File:** `/src/App.tsx`
```tsx
// [Full content of updated App.tsx]
```

---

## 4. Server (Updated)
The server now uses the centralized configuration for email routing.

**File:** `/server.ts`
```ts
// [Full content of updated server.ts]
```

---
**End of Sale-Ready Build**
