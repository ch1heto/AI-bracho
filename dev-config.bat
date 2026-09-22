@echo off

rem Development-only locations. Production code must not depend on these paths.
set "AI_BRACHO_PROJECT_DIR=%~dp0"
set "AI_BRACHO_LLAMA_SERVER_EXE=%~dp0runtime\llama-b11103-bin-win-cpu-x64\llama-server.exe"
set "AI_BRACHO_MODEL_PATH=M:\MiniCursor\model\MiniCPM5-2B-Q4_K_M.gguf"
set "AI_BRACHO_LLM_URL=http://127.0.0.1:8080"
set "AI_BRACHO_LLM_MODEL_ID=local-model"
set "AI_BRACHO_STARTUP_TIMEOUT_SECONDS=180"
