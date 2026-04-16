; ==========================================================================
; Inno Setup Script for AI GM Assistant
;
; Creates a Windows installer that:
;   - Installs the PyInstaller-bundled application
;   - Prompts for the Gemini API Key during install
;   - Sets the API key as a user environment variable
;   - Creates Start Menu and optional Desktop shortcuts
;   - Registers an uninstaller
; ==========================================================================

#define MyAppName "AI GM Assistant"
#define MyAppVersion "1.0.0"
#define MyAppPublisher "AI GM Assistant"
#define MyAppURL "https://github.com/blinkus2000/ai-gm-assistant"
#define MyAppExeName "AIGMAssistant.exe"

[Setup]
; NOTE: Generate a new GUID using Tools -> Generate GUID in Inno Setup
AppId={{A1B2C3D4-E5F6-7890-ABCD-EF1234567890}
AppName={#MyAppName}
AppVersion={#MyAppVersion}
AppPublisher={#MyAppPublisher}
AppPublisherURL={#MyAppURL}
AppSupportURL={#MyAppURL}
AppUpdatesURL={#MyAppURL}
DefaultDirName={autopf}\{#MyAppName}
DefaultGroupName={#MyAppName}
OutputDir=output
OutputBaseFilename=AIGMAssistantSetup
Compression=lzma2/ultra64
SolidCompression=yes
PrivilegesRequired=lowest
SetupIconFile=icon.ico
WizardStyle=modern
LicenseFile=
DisableProgramGroupPage=yes
UninstallDisplayIcon={app}\{#MyAppExeName}

[Languages]
Name: "english"; MessagesFile: "compiler:Default.isl"

[Tasks]
Name: "desktopicon"; Description: "{cm:CreateDesktopIcon}"; GroupDescription: "{cm:AdditionalIcons}"; Flags: unchecked

[Files]
; Include the entire PyInstaller onedir output
Source: "build\dist\AIGMAssistant\*"; DestDir: "{app}"; Flags: ignoreversion recursesubdirs createallsubdirs

[Icons]
Name: "{group}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"
Name: "{group}\{cm:UninstallProgram,{#MyAppName}}"; Filename: "{uninstallexe}"
Name: "{autodesktop}\{#MyAppName}"; Filename: "{app}\{#MyAppExeName}"; Tasks: desktopicon

[Run]
; Launch the app after installation
Filename: "{app}\{#MyAppExeName}"; Description: "{cm:LaunchProgram,{#StringChange(MyAppName, '&', '&&')}}"; Flags: nowait postinstall skipifsilent

[Code]
var
  ApiKeyPage: TInputQueryWizardPage;

procedure InitializeWizard;
begin
  { Create a custom page to collect the Gemini API Key }
  ApiKeyPage := CreateInputQueryPage(
    wpSelectTasks,
    'Gemini API Key Configuration',
    'Enter your Google Gemini API Key to enable AI features.',
    'You can get a free API key from https://aistudio.google.com/apikey' + #13#10 + #13#10 + 'If you already have the GEMINI_API_KEY environment variable set, you can leave this blank.'
  );
  ApiKeyPage.Add('Gemini API Key:', False);

  { Pre-fill with existing env var if present }
  ApiKeyPage.Values[0] := GetEnv('GEMINI_API_KEY');
end;

function NextButtonClick(CurPageID: Integer): Boolean;
begin
  Result := True;
end;

procedure CurStepChanged(CurStep: TSetupStep);
var
  ApiKey: String;
  ResultCode: Integer;
begin
  if CurStep = ssPostInstall then
  begin
    ApiKey := Trim(ApiKeyPage.Values[0]);
    if ApiKey <> '' then
    begin
      { Set GEMINI_API_KEY as a persistent user environment variable }
      Exec(
        ExpandConstant('{sys}\setx.exe'),
        'GEMINI_API_KEY "' + ApiKey + '"',
        '', SW_HIDE, ewWaitUntilTerminated, ResultCode
      );
    end;
  end;
end;
