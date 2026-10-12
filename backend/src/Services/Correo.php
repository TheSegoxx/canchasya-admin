<?php

declare(strict_types=1);

namespace App\Services;

use PHPMailer\PHPMailer\PHPMailer;
use RuntimeException;

/**
 * Envío de correos por SMTP (Gmail con contraseña de aplicación, Brevo u otro).
 * La cuenta se configura en el .env: MAIL_HOST, MAIL_PUERTO, MAIL_USUARIO, MAIL_CLAVE y MAIL_REMITENTE.
 */
final class Correo
{
    public static function configurado(): bool
    {
        return ($_ENV['MAIL_USUARIO'] ?? '') !== '' && ($_ENV['MAIL_CLAVE'] ?? '') !== '';
    }

    public function enviar(string $para, string $nombre, string $asunto, string $html, string $texto): void
    {
        if (!self::configurado()) {
            if (($_ENV['APP_ENV'] ?? '') !== 'desarrollo') {
                throw new RuntimeException('Falta configurar MAIL_USUARIO y MAIL_CLAVE en el .env');
            }
            // En desarrollo, sin cuenta de correo, el mensaje queda en storage/correos.log para poder probar
            $registro = sprintf("[%s] Para: %s\nAsunto: %s\n%s\n\n", date('Y-m-d H:i:s'), $para, $asunto, $texto);
            file_put_contents(dirname(__DIR__, 2) . '/storage/correos.log', $registro, FILE_APPEND | LOCK_EX);
            return;
        }

        $puerto = (int) (($_ENV['MAIL_PUERTO'] ?? '') ?: 587);
        $mail = new PHPMailer(true);
        $mail->isSMTP();
        $mail->Host = ($_ENV['MAIL_HOST'] ?? '') ?: 'smtp.gmail.com';
        $mail->Port = $puerto;
        // 465: conexión cifrada desde el inicio; 587: se cifra con STARTTLS
        $mail->SMTPSecure = $puerto === 465 ? PHPMailer::ENCRYPTION_SMTPS : PHPMailer::ENCRYPTION_STARTTLS;
        $mail->SMTPAuth = true;
        $mail->Username = $_ENV['MAIL_USUARIO'];
        $mail->Password = $_ENV['MAIL_CLAVE'];
        $mail->Timeout = 15;
        $mail->CharSet = PHPMailer::CHARSET_UTF8;

        // Con Brevo el remitente es una dirección verificada distinta del usuario SMTP
        $mail->setFrom(($_ENV['MAIL_REMITENTE'] ?? '') ?: $_ENV['MAIL_USUARIO'], 'CanchasYa Admin');
        $mail->addAddress($para, $nombre);
        $mail->isHTML(true);
        $mail->Subject = $asunto;
        $mail->Body = $html;
        $mail->AltBody = $texto;
        $mail->send();
    }
}
