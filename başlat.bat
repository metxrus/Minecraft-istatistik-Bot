@echo off
title Discord Botu Başlatılıyor...
color 0B

echo.
echo ===================================
echo       Discord Botu Başlatılıyor...
echo ===================================
echo.

node .

if %errorlevel% neq 0 (
    echo.
    echo HATA: Bot başlatılırken bir sorun oluştu!
    echo Konsol hatalarını kontrol edin.
    pause
    exit /b 1
)

echo.
echo Bot başarıyla kapandı veya durdu.
pause
exit /b 0
