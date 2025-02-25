# Building without Metro Bundler

This guide explains how to build the iOS app using a pre-bundled JavaScript bundle instead of requiring the Metro bundler to be running.

## Setup Instructions

1. Open the Xcode project:
   ```bash
   open smartcalendarmobile.xcworkspace
   ```

2. In Xcode's Project Navigator, right-click on the project root and select "Add Files to 'smartcalendarmobile'"
   - Navigate to `main.jsbundle` directory
   - Select the `main.jsbundle` file and the `assets` directory
   - Make sure "Copy items if needed" is checked
   - Add to targets: select "smartcalendarmobile"
   - Click "Add"

3. In Xcode, select your project in the navigator, then:
   - Select the "smartcalendarmobile" target
   - Select "Build Phases"
   - Expand "Bundle React Native code and images"
   - Comment out or remove the existing script
   - The app will now use the pre-bundled files instead of bundling during build

4. Build and run the project in Xcode as normal

## Updating the Bundle

If you make changes to the JavaScript code, you'll need to regenerate the bundle:

```bash
./bundle-ios.sh
```

Then rebuild the project in Xcode.

## Troubleshooting

If you encounter any issues:
1. Clean the build folder (Xcode -> Product -> Clean Build Folder)
2. Delete the app from the simulator/device
3. Rebuild the project
