#!/usr/bin/env python3
"""Generate the dependency-free Xcode project. No signing account is stored here."""
from pathlib import Path
import hashlib
import plistlib

root = Path(__file__).resolve().parents[1]
objects = {}


def add(name, value):
    identifier = hashlib.sha256(name.encode()).hexdigest()[:24].upper()
    objects[identifier] = value
    return identifier


sources, resources, children = [], [], []
for filename in ['AppDelegate.swift', 'AppPolicy.swift', 'WorkspaceController.swift',
                 'WebScreenController.swift', 'AttachmentStore.swift', 'Info.plist', 'Assets.xcassets']:
    file_type = 'sourcecode.swift' if filename.endswith('.swift') else (
        'folder.assetcatalog' if filename.endswith('.xcassets') else 'text.plist.xml')
    ref = add(filename, {'isa': 'PBXFileReference', 'lastKnownFileType': file_type,
                         'path': filename, 'sourceTree': '<group>'})
    children.append(ref)
    if filename.endswith(('.swift', '.xcassets')):
        build = add(filename + '-build', {'isa': 'PBXBuildFile', 'fileRef': ref})
        (sources if filename.endswith('.swift') else resources).append(build)

app_group = add('app-group', {'isa': 'PBXGroup', 'children': children,
                            'path': 'TailoredAgents', 'sourceTree': '<group>'})
product = add('product', {'isa': 'PBXFileReference', 'explicitFileType': 'wrapper.application',
                          'includeInIndex': '0', 'path': 'TailoredAgents.app', 'sourceTree': 'BUILT_PRODUCTS_DIR'})
products = add('products', {'isa': 'PBXGroup', 'children': [product], 'name': 'Products', 'sourceTree': '<group>'})
main = add('main', {'isa': 'PBXGroup', 'children': [app_group, products], 'sourceTree': '<group>'})
phases = [add(kind, {'isa': kind, 'buildActionMask': '2147483647', 'files': files,
                    'runOnlyForDeploymentPostprocessing': '0'}) for kind, files in [
    ('PBXSourcesBuildPhase', sources), ('PBXFrameworksBuildPhase', []), ('PBXResourcesBuildPhase', resources)]]

project_configs, target_configs = [], []
for config in ['Debug', 'Release']:
    project_configs.append(add('project-' + config, {
        'isa': 'XCBuildConfiguration', 'name': config, 'buildSettings': {
            'SDKROOT': 'iphoneos', 'IPHONEOS_DEPLOYMENT_TARGET': '17.0', 'SWIFT_VERSION': '5.0',
            'CLANG_ENABLE_MODULES': 'YES', 'CLANG_ENABLE_OBJC_ARC': 'YES',
            'SWIFT_OPTIMIZATION_LEVEL': '-Onone' if config == 'Debug' else '-O',
            'DEBUG_INFORMATION_FORMAT': 'dwarf', 'ENABLE_TESTABILITY': 'YES' if config == 'Debug' else 'NO',
            'SWIFT_ACTIVE_COMPILATION_CONDITIONS': 'DEBUG' if config == 'Debug' else '',
            'ENABLE_USER_SCRIPT_SANDBOXING': 'YES',
        }}))
    target_configs.append(add('target-' + config, {
        'isa': 'XCBuildConfiguration', 'name': config, 'buildSettings': {
            'PRODUCT_NAME': '$(TARGET_NAME)', 'PRODUCT_BUNDLE_IDENTIFIER': 'com.tailoredagents.workspace',
            'INFOPLIST_FILE': 'TailoredAgents/Info.plist', 'GENERATE_INFOPLIST_FILE': 'NO',
            'ASSETCATALOG_COMPILER_APPICON_NAME': 'AppIcon', 'CODE_SIGN_STYLE': 'Automatic',
            'CURRENT_PROJECT_VERSION': '1', 'MARKETING_VERSION': '1.0.0',
            'TARGETED_DEVICE_FAMILY': '1', 'SUPPORTED_PLATFORMS': 'iphoneos iphonesimulator',
            'SUPPORTS_MACCATALYST': 'NO', 'SUPPORTS_MAC_DESIGNED_FOR_IPHONE_IPAD': 'NO',
            'LD_RUNPATH_SEARCH_PATHS': ['$(inherited)', '@executable_path/Frameworks'],
        }}))

def configurations(name, configs):
    return add(name, {'isa': 'XCConfigurationList', 'buildConfigurations': configs,
                     'defaultConfigurationIsVisible': '0', 'defaultConfigurationName': 'Release'})

target = add('target', {'isa': 'PBXNativeTarget', 'name': 'TailoredAgents', 'productName': 'TailoredAgents',
    'buildConfigurationList': configurations('target-configurations', target_configs), 'buildPhases': phases,
    'buildRules': [], 'dependencies': [], 'productReference': product,
    'productType': 'com.apple.product-type.application'})

test_file = add('ui-test-file', {'isa': 'PBXFileReference', 'lastKnownFileType': 'sourcecode.swift',
                                'path': 'WorkspaceUITests.swift', 'sourceTree': '<group>'})
test_group = add('ui-test-group', {'isa': 'PBXGroup', 'children': [test_file],
                                  'path': 'UITests', 'sourceTree': '<group>'})
objects[main]['children'].append(test_group)
test_build = add('ui-test-build', {'isa': 'PBXBuildFile', 'fileRef': test_file})
test_phases = [add('test-' + kind, {'isa': kind, 'buildActionMask': '2147483647', 'files': files,
                                   'runOnlyForDeploymentPostprocessing': '0'}) for kind, files in [
    ('PBXSourcesBuildPhase', [test_build]), ('PBXFrameworksBuildPhase', []), ('PBXResourcesBuildPhase', [])]]
test_configs = [add('ui-test-' + config, {'isa': 'XCBuildConfiguration', 'name': config, 'buildSettings': {
    'PRODUCT_NAME': '$(TARGET_NAME)', 'PRODUCT_BUNDLE_IDENTIFIER': 'com.tailoredagents.workspace.uitests',
    'GENERATE_INFOPLIST_FILE': 'YES', 'TEST_TARGET_NAME': 'TailoredAgents', 'TARGETED_DEVICE_FAMILY': '1',
    'CODE_SIGN_STYLE': 'Automatic', 'LD_RUNPATH_SEARCH_PATHS': ['$(inherited)', '@executable_path/Frameworks', '@loader_path/Frameworks'],
}}) for config in ['Debug', 'Release']]
test_product = add('ui-test-product', {'isa': 'PBXFileReference', 'explicitFileType': 'wrapper.cfbundle',
                                      'path': 'WorkspaceUITests.xctest', 'sourceTree': 'BUILT_PRODUCTS_DIR'})
objects[products]['children'].append(test_product)
dependency = add('ui-test-dependency', {'isa': 'PBXTargetDependency', 'target': target})
test_target = add('ui-test-target', {'isa': 'PBXNativeTarget', 'name': 'WorkspaceUITests',
    'productName': 'WorkspaceUITests', 'productReference': test_product,
    'productType': 'com.apple.product-type.bundle.ui-testing',
    'buildConfigurationList': configurations('test-configurations', test_configs),
    'buildPhases': test_phases, 'buildRules': [], 'dependencies': [dependency]})
project = add('project', {'isa': 'PBXProject', 'attributes': {'LastUpgradeCheck': '2630'},
    'buildConfigurationList': configurations('project-configurations', project_configs),
    'compatibilityVersion': 'Xcode 15.0', 'developmentRegion': 'en', 'hasScannedForEncodings': '0',
    'knownRegions': ['en', 'Base'], 'mainGroup': main, 'productRefGroup': products,
    'projectDirPath': '', 'projectRoot': '', 'targets': [target, test_target]})
project_dir = root / 'TailoredAgents.xcodeproj'
project_dir.mkdir(exist_ok=True)
with (project_dir / 'project.pbxproj').open('wb') as file:
    plistlib.dump({'archiveVersion': '1', 'classes': {}, 'objectVersion': '60',
                  'objects': objects, 'rootObject': project}, file, sort_keys=False)

scheme_dir = project_dir / 'xcshareddata' / 'xcschemes'
scheme_dir.mkdir(parents=True, exist_ok=True)
reference = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{target}" BuildableName="TailoredAgents.app" BlueprintName="TailoredAgents" ReferencedContainer="container:TailoredAgents.xcodeproj"/>'
test_reference = f'<BuildableReference BuildableIdentifier="primary" BlueprintIdentifier="{test_target}" BuildableName="WorkspaceUITests.xctest" BlueprintName="WorkspaceUITests" ReferencedContainer="container:TailoredAgents.xcodeproj"/>'
(scheme_dir / 'TailoredAgents.xcscheme').write_text(f'''<?xml version="1.0" encoding="UTF-8"?>
<Scheme LastUpgradeVersion="2630" version="1.3">
  <BuildAction parallelizeBuildables="YES" buildImplicitDependencies="YES">
    <BuildActionEntries><BuildActionEntry buildForTesting="YES" buildForRunning="YES" buildForProfiling="YES" buildForArchiving="YES" buildForAnalyzing="YES">{reference}</BuildActionEntry></BuildActionEntries>
  </BuildAction>
  <TestAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" shouldUseLaunchSchemeArgsEnv="YES"><Testables><TestableReference skipped="NO">{test_reference}</TestableReference></Testables></TestAction>
  <LaunchAction buildConfiguration="Debug" selectedDebuggerIdentifier="Xcode.DebuggerFoundation.Debugger.LLDB" selectedLauncherIdentifier="Xcode.IDEFoundation.Launcher.LLDB" launchStyle="0" useCustomWorkingDirectory="NO" ignoresPersistentStateOnLaunch="NO" debugDocumentVersioning="YES" allowLocationSimulation="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></LaunchAction>
  <ProfileAction buildConfiguration="Release" shouldUseLaunchSchemeArgsEnv="YES" savedToolIdentifier="" useCustomWorkingDirectory="NO" debugDocumentVersioning="YES"><BuildableProductRunnable runnableDebuggingMode="0">{reference}</BuildableProductRunnable></ProfileAction>
  <AnalyzeAction buildConfiguration="Debug"/>
  <ArchiveAction buildConfiguration="Release" revealArchiveInOrganizer="YES"/>
</Scheme>
''')
print(project_dir)
