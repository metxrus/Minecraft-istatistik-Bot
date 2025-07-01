@echo off
title Rivoles Discord Bot Kurulum Başlatıldı
color 0A
cls

echo ==============================================
echo        Rivoles Discord Bot Kurulum Aracı
echo ==============================================
echo.
echo   Proje bağımlılıkları kuruluyor, lutfen bekleyin...
echo.

:: npm install komutunu çalıştır ve sonucu kontrol et
npm install
if errorlevel 1 (
    echo.
    echo [!] HATA: Paket kurulumu sırasında bir sorun oluştu!
    echo Lütfen hata mesajlarını kontrol edin ve tekrar deneyin.
    pause
    exit /b 1
)

echo.
echo [+] Paketler başarıyla kuruldu!
echo Kurulum tamamlandi, botun hazir!
echo.
pause
exit /b 0
