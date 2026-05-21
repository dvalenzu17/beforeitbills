/**
 * plugins/withTurboModuleIOS26Patch.js
 *
 * Root-cause fix for the iOS 26 void-TurboModule crash chain:
 *
 *   ObjCTurboModule::performVoidMethodInvocation  (GCD worker thread)
 *     → NSException thrown by a void native method
 *     → @catch block calls convertNSExceptionToJSError(exception, runtime)
 *     → convertNSArrayToJSIArray writes into a Hermes JSI Array on the GCD thread
 *     → races with Hermes Hades GC workers / JS thread
 *     → KERN_INVALID_ADDRESS / writeBarrierSlow crash
 *
 * The function is implemented in RCTTurboModule.mm (React pod).
 * We inject an iOS ≥ 26 early-return into the @catch block so the
 * Hermes heap is never touched from a GCD thread on iOS 26.
 *
 * This runs in the Podfile post_install hook - after `pod install`
 * downloads the source - so the file is compiled with the patch applied.
 */

const { withDangerousMod } = require('@expo/config-plugins');
const path = require('path');
const fs = require('fs');

const MARKER = 'BIB:ios26-void-patch';

// Ruby code injected into the Podfile post_install block.
// Uses Ruby's Dir.glob to find RCTTurboModule.mm regardless of pod layout.
// The patch inserts an `if (@available(iOS 26.0, *)) { return; }` guard
// immediately after any `@catch (NSException ...)` block whose next few lines
// contain `convertNSExceptionToJSError` (i.e. the void-invocation catch block).
const SNIPPET = `
  # ${MARKER}
  Dir.glob(File.join(installer.sandbox.root, '**', 'RCTTurboModule.mm')).each do |f|
    content = File.read(f)
    next if content.include?('${MARKER}')
    lines  = content.split("\\n")
    result = []
    i = 0
    while i < lines.length
      result << lines[i]
      if lines[i].include?('@catch') && lines[i, 8].any? { |l| l.include?('convertNSExceptionToJSError') }
        indent_match = (lines[i + 1] || '').match(/^(\\s*)/)
        indent = indent_match ? indent_match[1] : '      '
        result << "#{indent}if (@available(iOS 26.0, *)) { return; } // ${MARKER}"
      end
      i += 1
    end
    new_content = result.join("\\n")
    if new_content != content
      File.write(f, new_content)
      puts "BIB: Patched iOS 26 void-TurboModule crash guard into #{f}"
    end
  end`;

module.exports = function withTurboModuleIOS26Patch(config) {
  return withDangerousMod(config, [
    'ios',
    (cfg) => {
      const podfilePath = path.join(cfg.modRequest.platformProjectRoot, 'Podfile');
      let podfile = fs.readFileSync(podfilePath, 'utf8');

      if (podfile.includes(MARKER)) return cfg; // idempotent

      if (podfile.includes('post_install do |installer|')) {
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
