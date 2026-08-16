/**
 * HERITAGE FAMILY ARTIFACTS - Business Configuration
 * Centralized file for all personal and financial information.
 * Update this file to transfer ownership or change payment details.
 */

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
    yoco: {
      link: "https://pay.yoco.com/heritage-family-artifacts",
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
