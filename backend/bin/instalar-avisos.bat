@echo off
rem Crea la tarea "CanchasYa avisos" en el Programador de tareas de Windows:
rem corre bin\avisos.php cada minuto, sin abrir ventana (php-win.exe), mientras la sesion este iniciada.
rem Para quitarla: schtasks /delete /tn "CanchasYa avisos" /f

set PHP=C:\xampp\php\php-win.exe
schtasks /create /tn "CanchasYa avisos" /sc minute /mo 1 /f /tr "\"%PHP%\" \"%~dp0avisos.php\""
