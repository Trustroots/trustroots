#!/usr/bin/env ruby
# frozen_string_literal: true

require "fileutils"
require "xcodeproj"

ROOT = File.expand_path("..", __dir__)
PROJECT_PATH = File.join(ROOT, "Trustroots.xcodeproj")
IOS_VERSION = "17.0"
NOSTR_SDK_REVISION = "e5855cbd3bdabf44075fd2abdf76f63bac4cbd5f"

def relative_to(path, base_dir)
  path.sub("#{base_dir}/", "")
end

def configure_app_target(target)
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["PRODUCT_NAME"] = "Trustroots"
    settings["PRODUCT_MODULE_NAME"] = "Trustroots"
    settings["PRODUCT_BUNDLE_IDENTIFIER"] = "org.trustroots.ios"
    settings["INFOPLIST_FILE"] = "TrustrootsApp/Info.plist"
    settings["SWIFT_VERSION"] = "5.0"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
    settings["TARGETED_DEVICE_FAMILY"] = "1"
    settings["CODE_SIGNING_ALLOWED"] = "NO"
    settings["CODE_SIGNING_REQUIRED"] = "NO"
    settings["CODE_SIGN_IDENTITY"] = ""
    settings["GENERATE_INFOPLIST_FILE"] = "NO"
    settings["ASSETCATALOG_COMPILER_APPICON_NAME"] = "AppIcon"
    settings["ASSETCATALOG_COMPILER_GLOBAL_ACCENT_COLOR_NAME"] = ""
  end
end

def configure_test_target(target)
  target.build_configurations.each do |config|
    settings = config.build_settings
    settings["SWIFT_VERSION"] = "5.0"
    settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
    settings["TARGETED_DEVICE_FAMILY"] = "1"
    settings["CODE_SIGNING_ALLOWED"] = "NO"
    settings["CODE_SIGNING_REQUIRED"] = "NO"
    settings["CODE_SIGN_IDENTITY"] = ""
    settings["GENERATE_INFOPLIST_FILE"] = "YES"
    settings["TEST_HOST"] = "$(BUILT_PRODUCTS_DIR)/Trustroots.app/Trustroots"
    settings["BUNDLE_LOADER"] = "$(TEST_HOST)"
  end
end

def add_nostr_sdk_package(project, targets)
  package = project.new(Xcodeproj::Project::Object::XCRemoteSwiftPackageReference)
  package.repositoryURL = "https://github.com/nostr-sdk/nostr-sdk-ios.git"
  package.requirement = {
    "kind" => "revision",
    "revision" => NOSTR_SDK_REVISION
  }
  project.root_object.package_references << package

  targets.each do |target|
    product = project.new(Xcodeproj::Project::Object::XCSwiftPackageProductDependency)
    product.package = package
    product.product_name = "NostrSDK"
    target.package_product_dependencies << product

    build_file = project.new(Xcodeproj::Project::Object::PBXBuildFile)
    build_file.product_ref = product
    target.frameworks_build_phase.files << build_file
  end
end

FileUtils.rm_rf(PROJECT_PATH)
project = Xcodeproj::Project.new(PROJECT_PATH)
project.build_configurations.each do |config|
  config.build_settings["SWIFT_VERSION"] = "5.0"
  config.build_settings["IPHONEOS_DEPLOYMENT_TARGET"] = IOS_VERSION
end

main_group = project.main_group
app_group = main_group.new_group("TrustrootsApp", "TrustrootsApp")
tests_group = main_group.new_group("TrustrootsTests", "TrustrootsTests")

app_target = project.new_target(:application, "Trustroots", :ios, IOS_VERSION)
tests_target = project.new_target(:unit_test_bundle, "TrustrootsTests", :ios, IOS_VERSION)
configure_app_target(app_target)
configure_test_target(tests_target)
tests_target.add_dependency(app_target)
add_nostr_sdk_package(project, [app_target, tests_target])

app_sources = Dir.glob(File.join(ROOT, "TrustrootsApp/**/*.swift")).sort
test_sources = Dir.glob(File.join(ROOT, "TrustrootsTests/**/*.swift")).sort
app_refs = app_sources.map { |path| app_group.new_file(relative_to(path, File.join(ROOT, "TrustrootsApp"))) }
test_refs = test_sources.map { |path| tests_group.new_file(relative_to(path, File.join(ROOT, "TrustrootsTests"))) }
asset_catalogs = Dir.glob(File.join(ROOT, "TrustrootsApp/**/*.xcassets")).sort
asset_refs = asset_catalogs.map { |path| app_group.new_file(relative_to(path, File.join(ROOT, "TrustrootsApp"))) }

app_target.add_file_references(app_refs)
asset_refs.each { |reference| app_target.resources_build_phase.add_file_reference(reference) }
tests_target.add_file_references(test_refs)
project.save

app_scheme = Xcodeproj::XCScheme.new
app_scheme.add_build_target(app_target)
app_scheme.set_launch_target(app_target)
app_scheme.save_as(PROJECT_PATH, "Trustroots", true)

tests_scheme = Xcodeproj::XCScheme.new
tests_scheme.add_build_target(app_target)
tests_scheme.add_build_target(tests_target)
tests_scheme.add_test_target(tests_target)
tests_scheme.set_launch_target(app_target)
tests_scheme.save_as(PROJECT_PATH, "TrustrootsTests", true)

puts "Generated #{PROJECT_PATH}"
