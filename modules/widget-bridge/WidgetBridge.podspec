require 'json'
package = JSON.parse(File.read(File.join(__dir__, 'package.json')))

Pod::Spec.new do |s|
  s.name           = 'WidgetBridge'
  s.version        = package['version']
  s.summary        = package['description']
  s.description    = package['description']
  s.homepage       = 'https://github.com/dvalenzu17/sublytics'
  s.license        = 'MIT'
  s.author         = 'BeforeItBills'
  s.source         = { :git => '' }
  s.platforms      = { :ios => '15.1' }
  s.swift_versions = ['5.4']

  s.pod_target_xcconfig = {
    'DEFINES_MODULE' => 'YES',
    'SWIFT_COMPILATION_MODE' => 'wholemodule'
  }

  s.source_files = 'ios/**/*.{h,m,mm,swift}'

  s.dependency 'ExpoModulesCore'
  s.weak_framework = 'WidgetKit'
end
