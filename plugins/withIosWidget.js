/**
 * plugins/withIosWidget.js
 *
 * Corrected version fixing the "Section is not a function" errors.
 */

const {
  withXcodeProject,
  withEntitlementsPlist,
} = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const APP_GROUP = 'group.com.beforeitbills.app';
const EXTENSION_NAME = 'SubsWidget';
const EXTENSION_BUNDLE_ID = 'com.beforeitbills.app.SubsWidget';
const DEPLOYMENT_TARGET = '16.0';
const SWIFT_VERSION = '5.0';

module.exports = function withIosWidget(config) {
  config = withAppGroupEntitlement(config);
  config = withWidgetExtensionTarget(config);
  return config;
};

function withAppGroupEntitlement(config) {
  return withEntitlementsPlist(config, (c) => {
    const key = 'com.apple.security.application-groups';
    const groups = c.modResults[key];
    if (Array.isArray(groups)) {
      if (!groups.includes(APP_GROUP)) {
        c.modResults[key] = [...groups, APP_GROUP];
      }
    } else {
      c.modResults[key] = [APP_GROUP];
    }
    return c;
  });
}

function withWidgetExtensionTarget(config) {
  return withXcodeProject(config, (c) => {
    const { modResults: project, modRequest } = c;
    const { projectName, platformProjectRoot } = modRequest;

    const extDir = path.join(platformProjectRoot, EXTENSION_NAME);
    ensureExtensionFiles(extDir);

    // FIXED: Use property access
    const nativeTargets = project.pbxNativeTargetSection();
    if (Object.values(nativeTargets).some((t) => t && t.name === EXTENSION_NAME)) {
      return c;
    }

    const extTarget = project.addTarget(
      EXTENSION_NAME,
      'app_extension',
      EXTENSION_NAME,
      EXTENSION_BUNDLE_ID
    );
    const extTargetUuid = extTarget.uuid;

    const srcFiles = [
      `${EXTENSION_NAME}/SubsWidget.swift`,
      `${EXTENSION_NAME}/SubsWidgetBundle.swift`,
    ];
    project.addBuildPhase(srcFiles, 'PBXSourcesBuildPhase', 'Sources', extTargetUuid);

    project.addFramework('WidgetKit.framework', { target: extTargetUuid });
    project.addFramework('SwiftUI.framework', { target: extTargetUuid });

    setBuildSettings(project, extTargetUuid);
    embedExtension(project, projectName, extTargetUuid);

    return c;
  });
}

function ensureExtensionFiles(extDir) {
  if (!fs.existsSync(extDir)) {
    fs.mkdirSync(extDir, { recursive: true });
  }

  const srcDir = path.join(__dirname, '../ios-widget');
  if (fs.existsSync(srcDir)) {
    for (const file of fs.readdirSync(srcDir)) {
      fs.copyFileSync(path.join(srcDir, file), path.join(extDir, file));
    }
  }

  const infoPlistPath = path.join(extDir, 'Info.plist');
  if (!fs.existsSync(infoPlistPath)) {
    fs.writeFileSync(infoPlistPath, getInfoPlist());
  }

  const entitlementsPath = path.join(extDir, `${EXTENSION_NAME}.entitlements`);
  if (!fs.existsSync(entitlementsPath)) {
    fs.writeFileSync(entitlementsPath, getEntitlements());
  }
}

function setBuildSettings(project, extTargetUuid) {
  const target = project.pbxNativeTargetSection()[extTargetUuid];
  if (!target) return;

  const configListUuid = target.buildConfigurationList;
  // FIXED: Accessing XCConfigurationList directly via hash
  const configList = project.hash.project.objects.XCConfigurationList[configListUuid];
  if (!configList) return;

  const configUuids = configList.buildConfigurations.map((c) => c.value);
  const buildConfigs = project.pbxXCBuildConfigurationSection();

  const common = {
    DEVELOPMENT_TEAM: '4RWRT2WU2H',
    CODE_SIGN_STYLE: 'Automatic',
    PRODUCT_BUNDLE_IDENTIFIER: '"com.beforeitbills.app.SubsWidget"',
    PRODUCT_NAME: '"SubsWidget"',
    CODE_SIGN_ENTITLEMENTS: '"SubsWidget/SubsWidget.entitlements"',
    INFOPLIST_FILE: '"SubsWidget/Info.plist"',
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

function embedExtension(project, mainProjectName, extTargetUuid) {
  const mainTarget = project.pbxTargetByName(mainProjectName);
  if (!mainTarget) return;

  const mainTargetUuid = mainTarget.uuid;
  project.addTargetDependency(mainTargetUuid, [extTargetUuid]);

  const nativeTarget = project.pbxNativeTargetSection()[extTargetUuid];
  const productRef = nativeTarget?.productReference;
  if (!productRef) return;

  // 1. Find or Create the "Embed App Extensions" phase
  // Look up via the main target's own buildPhases list to avoid cross-plugin name-match failures
  const allCopyPhases = project.hash.project.objects.PBXCopyFilesBuildPhase || {};
  const mainTargetPhaseUuids = (mainTarget.buildPhases || []).map(bp => bp.value || bp);
  let embedPhaseUuid = null;

  for (const phaseUuid of mainTargetPhaseUuids) {
    const phase = allCopyPhases[phaseUuid];
    if (phase && (
      phase.name === '"Embed App Extensions"' ||
      phase.name === 'Embed App Extensions' ||
      phase.dstSubfolderSpec === 13
    )) {
      embedPhaseUuid = phaseUuid;
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

    if (pbxBuildPhase.dstSubfolderSpec !== 13) {
      pbxBuildPhase.dstSubfolderSpec = 13;
    }

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
function getInfoPlist() {
  return `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0">
<dict>
  <key>CFBundleIdentifier</key>
  <string>$(PRODUCT_BUNDLE_IDENTIFIER)</string>
  <key>CFBundleExecutable</key>
  <string>$(EXECUTABLE_NAME)</string>
  <key>CFBundleName</key>
  <string>$(PRODUCT_NAME)</string>
  <key>CFBundleDisplayName</key>
  <string>BeforeItBills</string>
  <key>CFBundleInfoDictionaryVersion</key>
  <string>6.0</string>
  <key>CFBundlePackageType</key>
  <string>XPC!</string>
  <key>CFBundleShortVersionString</key>
  <string>$(MARKETING_VERSION)</string>
  <key>CFBundleVersion</key>
  <string>$(CURRENT_PROJECT_VERSION)</string>
  <key>NSExtension</key>
  <dict>
    <key>NSExtensionPointIdentifier</key>
    <string>com.apple.widgetkit-extension</string>
  </dict>
</dict>
</plist>`;
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
</plist>`;
}