
module.exports = {
  expo: {
    name: "BeforeItBills",
    slug: "sublytics",
    scheme: "beforeitbills",
    version: "1.0.0",
    orientation: "portrait",
    icon: "./assets/BeforeItBillsLogo.png",

    assetBundlePatterns: ["**/*"],

    ios: {
      bundleIdentifier: "com.beforeitbills.app",
      buildNumber: "58",
      userInterfaceStyle: "automatic",
      supportsTablet: false,
      config: {
        usesNonExemptEncryption: false,
      },

      infoPlist: {
        NSFaceIDUsageDescription: "BeforeItBills uses Face ID to keep your financial data private.",
        NSCameraUsageDescription: "BeforeItBills uses your camera to update your profile photo.",
        NSPhotoLibraryUsageDescription: "BeforeItBills accesses your photo library to let you choose a profile photo.",
        NSUserTrackingUsageDescription: "We use tracking data to improve the app experience and show relevant content.",
      },

      entitlements: {
        "aps-environment": "production",
        "com.apple.security.application-groups": ["group.com.beforeitbills.app"],
      },
    }, 

    android: {
      package: "com.beforeitbills.app",
      intentFilters: [
        {
          action: "VIEW",
          data: [{ scheme: "beforeitbills", host: "redirect" }],
          category: ["BROWSABLE", "DEFAULT"],
        },
      ],
    },

    web: {
      favicon: "./assets/BeforeItBillsLogo.png",
    },

    plugins: [
      [
        "expo-build-properties",
        {
          ios: {
            deploymentTarget: "16.0",
            appleTeamId: "4RWRT2WU2H",
            newArchEnabled: true,
          },
        },
      ],
      "expo-web-browser",
      [
        "@react-native-google-signin/google-signin",
        {
          iosUrlScheme: "com.googleusercontent.apps.577544895857-igb9t8cbphcfao6idjjot8u81h3nbp4t",
          scopes: ["https://www.googleapis.com/auth/gmail.readonly"],
        },
      ],
      "expo-localization",
      "expo-secure-store",
      [
        "expo-notifications",
        {
          icon: "./assets/notification-icon.png",
          color: "#7DD3FC",
          sounds: [],
        },
      ],
      "expo-font",
      "expo-router",
      "./plugins/withIosWidget",
      "expo-quick-actions",
      "expo-apple-authentication",
      "./plugins/withShareExtension",
      "./plugins/withPodfileDeploymentTarget",
      "./plugins/withTurboModuleIOS26Patch",
      "./plugins/withPrivacyManifest",
    ],

    extra: {
      eas: {
        projectId: "47e62a9c-3e47-4af7-90f3-1b5779fcc586",
        // ADD THIS BLOCK BELOW
        build: {
          experimental: {
            ios: {
              appExtensions: [
                {
                  targetName: "ShareExtension",
                  bundleIdentifier: "com.beforeitbills.app.ShareExtension",
                  entitlements: {
                    "com.apple.security.application-groups": ["group.com.beforeitbills.app"]
                  }
                },
                {
                  targetName: "SubsWidget",
                  bundleIdentifier: "com.beforeitbills.app.SubsWidget",
                  entitlements: {
                    "com.apple.security.application-groups": ["group.com.beforeitbills.app"]
                  }
                }
              ]
            }
          }
        }
      },
      // Env Vars
      EXPO_PUBLIC_SUPABASE_URL: process.env.EXPO_PUBLIC_SUPABASE_URL,
      EXPO_PUBLIC_SUPABASE_ANON_KEY: process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY,
      EXPO_PUBLIC_BACKEND_URL: process.env.EXPO_PUBLIC_BACKEND_URL,
      EXPO_PUBLIC_LOGO_DEV_TOKEN: process.env.EXPO_PUBLIC_LOGO_DEV_TOKEN,
      EXPO_PUBLIC_BRANDFETCH_API_KEY: process.env.EXPO_PUBLIC_BRANDFETCH_API_KEY,
      EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID: process.env.EXPO_PUBLIC_GOOGLE_IOS_CLIENT_ID,
      revenuecatIosApiKey: process.env.EXPO_PUBLIC_REVENUECAT_IOS_KEY,
      revenuecatAndroidApiKey: process.env.EXPO_PUBLIC_REVENUECAT_ANDROID_KEY,
    },
  },
};