const electronInstaller = require('electron-winstaller');

async function build() {
  try {
    console.log('Creating Windows Installer...');
    await electronInstaller.createWindowsInstaller({
      appDirectory: './dist-desktop/Market Minds Scanner-win32-x64',
      outputDirectory: './dist-desktop/Installer',
      authors: 'Market Minds',
      exe: 'Market Minds Scanner.exe',
      setupExe: 'MarketMinds_Setup.exe',
      noMsi: true
    });
    console.log('Installer created successfully at dist-desktop/Installer/MarketMinds_Setup.exe!');
  } catch (e) {
    console.log('Error creating installer:', e.message);
  }
}

build();
