// lib/nav.js
export function safeBack(router, fallback = "/(tabs)") {
    if (router?.canGoBack?.()) router.back();
    else router.replace(fallback);
  }
  