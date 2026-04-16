# AI Game Master Assistant 🎲🤖

The AI GM Assistant is an intelligent, deeply integrated tool for Tabletop Role-Playing Game (TTRPG) Game Masters. Designed to assist with campaign management, encounter generation, and rule lookups, it serves as a co-pilot for prep work.

What sets this assistant apart is its **verified, rules-grounded generation engine** powered by the Gemini File Search API. By uploading your campaign's specific PDF rulesets, the AI reads your rulebooks and utilizes Retrieval-Augmented Generation (RAG) to ensure generated stats, abilities, and mechanics are completely accurate to your game system—no hallucinations.

## ✨ Key Features

- **📖 Campaign Management:** Track your campaign world with dedicated organizers for Sessions, NPCs, Locations, Factions, and active Plot Threads.
- **📚 Grounded Ruleset Knowledge:** Upload official or homebrew PDF rulesets. The assistant indexes these PDFs directly, reading actual pages to prevent rule hallucinations.
- **⚡ AI Content Generation:** 
  - **Dynamic Sessions:** Draft sessions based on current plot threads.
  - **Verified Encounters:** Generate balanced encounters complete with perfectly accurate stat blocks pulled directly from your rulebook.
  - **Rich NPCs & Locations:** Flesh out narrative details, along with generated roleplay guidelines and adventure hooks.
- **⚖️ Rules Q&A:** Can't remember how grappling works? Ask the GM Assistant. It will search your uploaded handbooks and provide an answer with exact source citations (book name and page/section references).
- **🎨 Illustrated Module Export:** Compile your campaign elements into a beautifully stylized, printable PDF adventure module. Background logic automatically prompts Gemini's image generation API for fantasy illustrations to embed seamlessly into the document.
- **💾 Portable JSON Storage:** All campaign data is stored locally as straightforward JSON files, ensuring you own your structured prep work.

## 🛠️ Tech Stack

- **Backend:** Python 3, FastAPI, Uvicorn, Pydantic
- **AI Engine:** Google GenAI SDK (`google-genai`)
  - *Reasoning & RAG:* Gemini 3 Flash Preview
  - *Image Generation:* Gemini 3 Pro Image Preview
  - *Vector/Document RAG:* Gemini File Search Stores
- **PDF Generation:** `fpdf2`
- **Frontend:** Vanilla HTML, CSS, JavaScript (Single Page Application architecture)

---

## 🚀 Quick Install (Recommended)

The easiest way to get started is to download the pre-built Windows installer. **No Python or developer setup required.**

### Step 1: Get a Gemini API Key
1. Go to [Google AI Studio](https://aistudio.google.com/apikey)
2. Create a free API key
3. Copy it — you'll need it during installation

### Step 2: Install
1. Download **`AIGMAssistantSetup.exe`** from the [latest release](https://github.com/blinkus2000/ai-gm-assistant/releases)
2. Run the installer
3. Paste your Gemini API Key when prompted
4. Click **Finish** — the app will open in your browser automatically

### Step 3: Use It
The assistant runs as a local web server. When you launch **AI GM Assistant** from the Start Menu:
- A small console window opens showing the server status
- Your browser opens to `http://127.0.0.1:8000`
- To stop the server, simply close the console window

> **Where is my data stored?**  
> Campaign data, uploaded rulesets, and generated images are stored in:  
> `%LOCALAPPDATA%\AIGMAssistant\data\`  
> This location is preserved when you update or reinstall the app.

---

## 🛠️ Developer Setup (From Source)

If you want to run from source, contribute to the project, or build the installer yourself:

### Prerequisites
- **Python 3.10+**
- **A valid Gemini API Key** (Accessible via [Google AI Studio](https://aistudio.google.com/apikey))

### Installation

1. **Clone the repository** and navigate to the project directory:
   ```bash
   git clone https://github.com/blinkus2000/ai-gm-assistant.git
   cd ai-gm-assistant
   ```

2. **Create a virtual environment (recommended):**
   ```bash
   python -m venv venv
   # Windows:
   venv\Scripts\activate
   # macOS/Linux:
   source venv/bin/activate
   ```

3. **Install dependencies:**
   ```bash
   pip install -r requirements.txt
   ```

4. **Configure Environment Variables:**
   Create a `.env` file in the root directory and add your Gemini API Key:
   ```env
   GEMINI_API_KEY=your_gemini_api_key_here
   ```

### Starting the Server
Launch the FastAPI development server:
```bash
python run.py
```
Alternatively, run as a background service using the included PowerShell script:
```powershell
.\service.ps1 start
.\service.ps1 status
.\service.ps1 stop
```
*Note: Using the service script will detach the process and log output to `service.log`.*

Open your browser and navigate to `http://127.0.0.1:8000`.

---

## 📦 Building the Installer

To build the Windows installer from source, you need:
- **Python 3.10+** (for PyInstaller)
- **[Inno Setup 6](https://jrsoftware.org/isdl.php)** (free, for creating the installer — optional, can be skipped)

### Build Steps

```powershell
# From the project root:
.\installer\build.ps1
```

This will:
1. Create a clean virtual environment in `installer/build/venv/`
2. Install all dependencies + PyInstaller
3. Bundle the application into a standalone executable
4. Compile the Inno Setup installer (if Inno Setup is installed)

**Output:**
- **Standalone exe:** `installer/build/dist/AIGMAssistant/AIGMAssistant.exe`
- **Windows installer:** `installer/output/AIGMAssistantSetup.exe`

To build only the standalone executable (no Inno Setup required):
```powershell
.\installer\build.ps1 -SkipInstaller
```

---

## 🎮 Usage

### 1. Create a Campaign
Start by creating a new Campaign in the UI. Specify your "Game System" (e.g., D&D 5e, Pathfinder 2e, Mörk Borg) and your setting context.

### 2. Upload Rulesets (Crucial)
Once inside the campaign, navigate to the Rulesets tab. Upload your TTRPG PDF rulebooks. **This relies on the Gemini File Search API**. The PDFs are processed, chunked, and indexed by Google Gen AI. Allow some time for indexing. Once indexed, the GM assistant will pull mechanical truth from these books.

### 3. Generate Content
Use the prompt windows to instruct the AI. For instance:
> *"Create a level 3 encounter with a group of goblins ambushing the party in a narrow ravine."* 

The backend automatically searches your indexed ruleset, pulls accurate goblin stats, determines difficulty, and formats the output.

### 4. Export adventure modules
When you've generated your core locations, encounters, and hooks, you can compile them into a PDF module. Simply request the generation, and wait for the `fpdf2` engine to assemble textual content alongside newly generated Gemini artwork. Your PDFs will be saved to the data directory and available for download.

## 📁 Project Structure

```text
ai-gm-assistant/
├── data/                    # Generated at runtime (or %LOCALAPPDATA% when installed)
│   ├── campaigns/           # JSON files representing your campaigns
│   ├── images/              # AI-generated character & location art
│   ├── modules/             # Generated PDF exports
│   └── rulesets/            # Local copies of uploaded PDF rulesets
├── installer/               # Windows installer build files
│   ├── build.ps1            # Build orchestration script
│   ├── ai-gm-assistant.spec # PyInstaller configuration
│   ├── setup.iss            # Inno Setup installer script
│   └── icon.ico             # Application icon
├── sample rulesets/         # Directory containing sample PDFs for testing
├── src/
│   ├── generator.py         # Google GenAI model calls, RAG logic & prompt construction
│   ├── models.py            # Pydantic schema schemas
│   ├── paths.py             # Path resolution (dev vs installed mode)
│   ├── pdf_builder.py       # fpdf2 module construction engine
│   ├── ruleset_manager.py   # Code for Gemini File Search API ingestion
│   ├── server.py            # FastAPI routing & HTTP logic
│   └── storage.py           # Local JSON Database CRUD actions
├── static/                  # Frontend UI files (app.js, index.html, styles.css)
├── templates/               # HTML templates for module rendering
├── requirements.txt         # Python dependencies
├── run.py                   # Entry point for the uvicorn web server
└── service.ps1              # PowerShell script to start/stop the background service
```

## ⚠️ Disclaimer
While the RAG mechanics drastically reduce hallucinations regarding game rules, LLMs can still make errors or misinterpret complex rules interactions. *Always double-check generated stats and rules mechanics for critical game moments.*
