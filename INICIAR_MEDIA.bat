@echo off
title MeDIa-CONTABLE - Suite Administrativa y POS
cd /d "%~dp0"
echo ====================================================================
echo   INICIANDO MeDIa-CONTABLE
echo   Suite Administrativa Basica + Punto de Venta (SENIAT / BCV)
echo ====================================================================
echo.
echo Servidor Web y API iniciando en el puerto 3000...
echo Abriendo Dashboard en su navegador...
echo.

start http://localhost:3000/admin.html
node src/server.js

if %ERRORLEVEL% NEQ 0 (
    echo.
    echo Ocurrio un error al iniciar. Verifique que Node.js este instalado.
    pause
)
