@echo off

REM 检测是否安装了Python
python --version >nul 2>&1
if %errorlevel% equ 0 (
    echo 使用Python启动HTTP服务器...
    python -m http.server 8000
) else (
    REM 检测是否安装了Node.js
    node --version >nul 2>&1
    if %errorlevel% equ 0 (
        echo 使用Node.js启动HTTP服务器...
        npx http-server -p 8000
    ) else (
        echo 未检测到Python或Node.js，请手动安装其中一个以运行本地服务器。
        echo 或者，您可以使用VS Code的Live Server扩展来启动项目。
        pause
    )
)