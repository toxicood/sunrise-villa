@echo off
REM Sunrise Villa - firewall allow (run once, as administrator)
netsh advfirewall firewall add rule name="Sunrise Villa Server" dir=in action=allow protocol=TCP localport=3000
echo.
echo Done! Ab phone se http://192.168.137.1:3000 kholo.
pause
