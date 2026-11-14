"use client";

import { twoFactorClient } from "better-auth/client/plugins";
import { createAuthClient } from "better-auth/react";

export const authClient = createAuthClient({
  plugins: [
    twoFactorClient({
      onTwoFactorRedirect() {
        // Recarga completa de propósito: troca de cookie de sessão parcial para a etapa do 2FA.
        // eslint-disable-next-line @next/next/no-location-assign-relative-destination
        window.location.href = "/login/2fa";
      },
    }),
  ],
});
