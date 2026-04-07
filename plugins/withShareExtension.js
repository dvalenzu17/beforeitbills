/**
 * plugins/withShareExtension.js
 *
 * Expo config plugin — adds a Share Extension target to the iOS Xcode project.
 * Applied during `expo prebuild`.
 *
 * What it does:
 *  1. Creates ios-share-extension/ShareExtension/ with Swift source + plists
 *  2. Adds a new "ShareExtension" app-extension target to the Xcode project
 *  3. Configures build settings (Swift 5, deployment target, bundle ID)
 *  4. Embeds the extension in the main app
 *  5. App Group entitlement is already handled by withIosWidget — this plugin
 *     adds the entitlement file for the extension target itself.
 */

const { withXcodeProject, withEntitlementsPlist } = require('@expo/config-plugins');
const path = require('path');
const fs   = require('fs');

const APP_GROUP        = 'group.com.beforeitbills.app';
const EXTENSION_NAME   = 'ShareExtension';
const EXTENSION_BUNDLE = 'com.beforeitbills.app.ShareExtension';
const DEPLOY_TARGET    = '16.0';
const SWIFT_VERSION    = '5.0';

// ── Entry point ────────────────────────────────────────────────────────────

module.exports = function withShareExtension(config) {
  config = withShareExtensionTarget(config);
  return config;
};

// ── Xcode project modification ─────────────────────────────────────────────

function withShareExtensionTarget(config) {
  return withXcodeProject(config, (c) => {
    const { modResults: project, modRequest } = c;
    const { projectName, platformProjectRoot } = modRequest;

    const extDir = path.join(platformProjectRoot, EXTENSION_NAME);
    ensureExtensionFiles(extDir);

    // Idempotent: skip if target already present
    const nativeTargets = project.pbxNativeTargetSection();
    if (Object.values(nativeTargets).some((t) => t && t.name === EXTENSION_NAME)) {
      return c;
    }

    // 1. Add the extension target
    const extTarget = project.addTarget(
      EXTENSION_NAME,
      'app_extension',
      EXTENSION_NAME,
      EXTENSION_BUNDLE
    );
    const extTargetUuid = extTarget.uuid;

    // 2. Add Swift source file to Sources build phase
    project.addBuildPhase(
      [`${EXTENSION_NAME}/ShareViewController.swift`],
      'PBXSourcesBuildPhase',
      'Sources',
      extTargetUuid
    );

    // 3. Build settings
    setBuildSettings(project, extTargetUuid);

    // 4. Embed extension into the main app
    embedExtension(project, projectName, extTargetUuid);

    return c;
  });
}

// ── File generation ────────────────────────────────────────────────────────

function ensureExtensionFiles(extDir) {
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  // Copy ShareViewController.swift from source directory
  const srcFile = path.join(__dirname, '../ios-share-extension/ShareViewController.swift');
  const dstFile = path.join(extDir, 'ShareViewController.swift');
  if (fs.existsSync(srcFile)) {
    fs.copyFileSync(srcFile, dstFile);
  }

  // Info.plist
  const infoPlistPath = path.join(extDir, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    fs.writeFileSync(infoPlistPath, getInfoPlist());
  }

  // Entitlements (App Group access)
  const entitlementsPath = path.join(extDir, `${EXTENSION_NAME}.entitlements`);
  if (!fs.existsSync(entitlementsPath)) {
    fs.writeFileSync(entitlementsPath, getEntitlements());
  }
}

// ── Build settings ─────────────────────────────────────────────────────────

function setBuildSettings(project, extTargetUuid) {
  const target = project.pbxNativeTargetSection()[extTargetUuid];
  if (!target) return;

  const configListUuid = target.buildConfigurationList;

  // ✅ NEW WAY (compatible with latest Expo)
  const configList =
    project.hash?.project?.objects?.XCConfigurationList?.[configListUuid];

  if (!configList || !configList.buildConfigurations) return;

  const configUuids = configList.buildConfigurations.map((c) => c.value);

  const buildConfigs = project.pbxXCBuildConfigurationSection();

  const common = {
    // 1. SIGNING (The fix for the previous Exit 65 error)
    DEVELOPMENT_TEAM: '4RWRT2WU2H', 
    CODE_SIGN_STYLE: 'Automatic',
  
    // 2. IDENTIFIERS (Hardcoded to avoid ReferenceErrors)
    PRODUCT_BUNDLE_IDENTIFIER: '"com.beforeitbills.app.ShareExtension"',
    PRODUCT_NAME: '"ShareExtension"',
    
    // 3. PATHS
    CODE_SIGN_ENTITLEMENTS: '"ShareExtension/ShareExtension.entitlements"',
    INFOPLIST_FILE: '"ShareExtension/Info.plist"',
    
    // 4. STANDARDS
    ALWAYS_EMBED_SWIFT_STANDARD_LIBRARIES: 'NO',
    APPLICATION_EXTENSION_API_ONLY: 'YES',
    IPHONEOS_DEPLOYMENT_TARGET: '"16.0"',
    MARKETING_VERSION: '"1.0.0"',
    CURRENT_PROJECT_VERSION: '"1"',
    SKIP_INSTALL: 'YES',
    SWIFT_VERSION: '"5.0"',
    TARGETED_DEVICE_FAMILY: '"1,2"',
    LD_RUNPATH_SEARCH_PATHS: '"$(inherited) @executable_path/Frameworks @executable_path/../../Frameworks"',
  };

  for (const uuid of configUuids) {
    if (buildConfigs[uuid]) {
      buildConfigs[uuid].buildSettings = {
        ...buildConfigs[uuid].buildSettings,
        ...common,
      };
    }
  }
}

// ── Embed into main app ────────────────────────────────────────────────────
function embedExtension(project, mainProjectName, extTargetUuid) {
  const mainTarget = project.pbxTargetByName(mainProjectName);
  if (!mainTarget) return;

  const mainTargetUuid = mainTarget.uuid;
  project.addTargetDependency(mainTargetUuid, [extTargetUuid]);

  const nativeTarget = project.pbxNativeTargetSection()[extTargetUuid];
  const productRef = nativeTarget?.productReference;
  if (!productRef) return;

  // 1. Find or Create the "Embed App Extensions" phase
  const buildPhases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  let embedPhaseUuid = null;

  for (const [uuid, phase] of Object.entries(buildPhases)) {
    if (typeof phase === 'object' && phase.name === '"Embed App Extensions"') {
      embedPhaseUuid = uuid;
      break;
    }
  }

  if (!embedPhaseUuid) {
    const newPhase = project.addBuildPhase(
      [],
      'PBXCopyFilesBuildPhase',
      'Embed App Extensions',
      mainTargetUuid,
      'plugins'
    );
    embedPhaseUuid = newPhase?.buildPhase?.uuid;
  }

  if (embedPhaseUuid) {
    const pbxBuildPhase = project.hash.project.objects.PBXCopyFilesBuildPhase[embedPhaseUuid];

    // Ensure the phase is in PlugIns (13), not PrivateHeaders (16) or elsewhere
    if (pbxBuildPhase.dstSubfolderSpec !== 13) {
      pbxBuildPhase.dstSubfolderSpec = 13;
    }

    // Check by fileRef, not buildFile UUID — files[] holds PBXBuildFile UUIDs, not product refs
    const buildFiles = project.hash.project.objects.PBXBuildFile || {};
    const isAlreadyInPhase = pbxBuildPhase.files.some(f => {
      const bf = buildFiles[f.value];
      return bf && bf.fileRef === productRef;
    });

    if (!isAlreadyInPhase) {
      const buildFileUuid = project.generateUuid();
      const comment = `${EXTENSION_NAME}.appex in Embed App Extensions`;

      project.hash.project.objects.PBXBuildFile[buildFileUuid] = {
        isa: 'PBXBuildFile',
        fileRef: productRef,
        fileRef_comment: `${EXTENSION_NAME}.appex`,
        settings: { ATTRIBUTES: ['RemoveHeadersOnCopy'] }
      };
      project.hash.project.objects.PBXBuildFile[buildFileUuid + '_comment'] = comment;

      pbxBuildPhase.files.push({
        value: buildFileUuid,
        comment: comment
      });
    }
  }
}
// ── Static file content ────────────────────────────────────────────────────

function getInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleDevelopmentRegion</key>
  <string>en</string>
  <key>CFBundleDisplayName</key>
  <string>BeforeItBills</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionAttributes</key>
    <dict>
      <key>NSExtensionActivationRule</key>
      <dict>
        <key>NSExtensionActivationSupportsText</key>
        <true/>
        <key>NSExtensionActivationSupportsWebURLWithMaxCount</key>
        <integer>1</integer>
        <key>NSExtensionActivationSupportsWebPageWithMaxCount</key>
        <integer>1</integer>
        <key>NSExtensionActivationSupportsAttachmentsWithMaxCount</key>
        <integer>1</integer>
      </dict>
    </dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.share-services</string>
    <key>NSExtensionPrincipalClass</key>
    <string>$(PRODUCT_MODULE_NAME).ShareViewController</string>
  </dict>
</dict>
</plist>
`;
}

function getEntitlements() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>com.apple.security.application-groups</key>
  <array>
    <string>${APP_GROUP}</string>
  </array>
</dict>
</plist>
`;
}
