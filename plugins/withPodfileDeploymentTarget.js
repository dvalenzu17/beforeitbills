/**
 * plugins/withPodfileDeploymentTarget.js
 *
 * Forces all CocoaPods targets with a deployment target below MIN_TARGET to
 * match it. Fixes Xcode 26 / iOS 26 runtime issues from transitive deps:
 *   Sentry-Sentry (11.0), SDWebImage (9.0), FBLPromises (9.0), GTMSessionFetcher (10.0)
 */
const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MIN_TARGET = '16.0';
const MARKER = '# BIB:pod-min-target';

const SNIPPET = `
  ${MARKER}
  installer.pods_project.targets.each do |target|
    target.build_configurations.each do |cfg|
      v = cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET']
      if v && v.to_f < ${MIN_TARGET}.to_f
        cfg.build_settings['IPHONEOS_DEPLOYMENT_TARGET'] = '${MIN_TARGET}'
      end
    end
  end`;

module.exports = function withPodfileDeploymentTarget(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) return cfg; // idempotent

      if (podfile.includes('post_install do |installer|')) {
        // Inject right after the opening line of the first post_install block
        podfile = podfile.replace(
          'post_install do |installer|',
          `post_install do |installer|${SNIPPET}`
        );
      } else {
        podfile += `\npost_install do |installer|${SNIPPET}\nend\n`;
      }

      fs.writeFileSync(podfilePath, podfile);
      return cfg;
    },
  ]);
};
