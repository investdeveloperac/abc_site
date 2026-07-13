<?php
/**
 * FromInvest AG - OTP Verification Mailer
 * Host this file on your traditional PHP hosting provider (e.g. cPanel, Hostinger, GoDaddy).
 * This will handle sending the 6-digit OTP codes securely and for free.
 */

// Allow CORS so Netlify domain can make POST requests here
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Headers: Content-Type");
header("Access-Control-Allow-Methods: POST, OPTIONS");

// Handle preflight requests
if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    exit(0);
}

// SECURITY KEY: Must match the PHP_MAILER_SECRET in js/auth.js
$security_secret = "FromInvestAGSecret2026";

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    // Sanitize and validate inputs
    $email = filter_var($_POST['email'] ?? '', FILTER_VALIDATE_EMAIL);
    $name = strip_tags($_POST['name'] ?? 'Kunde');
    $code = strip_tags($_POST['code'] ?? '');
    $secret = $_POST['secret'] ?? '';

    // Verify secret and parameters
    if (!$email || !$code || $secret !== $security_secret) {
        http_response_code(400);
        echo json_encode(["status" => "error", "message" => "Ungültige Parameter oder nicht autorisierte Anfrage."]);
        exit;
    }

    $to = $email;
    $subject = "FromInvest AG - Verifizierungscode: " . $code;

    // Premium HTML Email Template
    $message = '
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="UTF-8">
      <title>FromInvest AG</title>
    </head>
    <body style="margin: 0; padding: 0; font-family: \'Segoe UI\', Helvetica, Arial, sans-serif; background-color: #f8fafc; color: #1e293b;">
      <table align="center" border="0" cellpadding="0" cellspacing="0" width="100%" style="max-width: 600px; margin: 30px auto; background-color: #ffffff; border-radius: 12px; box-shadow: 0 4px 6px -1px rgba(0, 0, 0, 0.1), 0 2px 4px -1px rgba(0, 0, 0, 0.06); overflow: hidden; border: 1px solid #e2e8f0;">
        <!-- Header -->
        <tr>
          <td align="center" style="padding: 40px 20px; background-color: #0b192c; color: #ffffff;">
            <h1 style="margin: 0; font-size: 24px; font-weight: 700; letter-spacing: 1px;">FromInvest AG</h1>
            <p style="margin: 5px 0 0 0; font-size: 13px; color: #94a3b8; text-transform: uppercase; letter-spacing: 2px;">Festgeld-Portal</p>
          </td>
        </tr>
        
        <!-- Content -->
        <tr>
          <td style="padding: 40px 30px;">
            <h2 style="margin: 0 0 20px 0; font-size: 20px; font-weight: 600; color: #0f172a;">Hallo ' . htmlspecialchars($name) . ',</h2>
            <p style="margin: 0 0 30px 0; font-size: 15px; line-height: 1.6; color: #475569;">
              Sie versuchen sich in Ihr Festgeld-Portal bei der FromInvest AG einzuloggen. 
              Geben Sie bitte den folgenden 6-stelligen Verifizierungscode auf der Login-Seite ein, um Ihre Anmeldung abzuschließen:
            </p>
            
            <!-- Code Box -->
            <div style="text-align: center; margin: 30px 0;">
              <span style="display: inline-block; font-family: \'Courier New\', Courier, monospace; font-size: 32px; font-weight: 700; letter-spacing: 8px; color: #0f172a; background-color: #f1f5f9; padding: 15px 30px; border-radius: 8px; border: 1px solid #cbd5e1; text-align: center;">
                ' . htmlspecialchars($code) . '
              </span>
            </div>
            
            <p style="margin: 30px 0 0 0; font-size: 14px; line-height: 1.6; color: #64748b;">
              Dieser Code ist für die nächsten <strong>5 Minuten</strong> gültig. Wenn Sie diese Anmeldung nicht initiiert haben, ignorieren Sie diese E-Mail bitte.
            </p>
          </td>
        </tr>
        
        <!-- Footer -->
        <tr>
          <td style="padding: 30px; background-color: #f8fafc; border-top: 1px solid #e2e8f0; text-align: center; font-size: 12px; color: #94a3b8;">
            <p style="margin: 0 0 10px 0;">FromInvest AG • Moenchaltorf, Schweiz • Tel: +41 (44) 523 63 89</p>
            <p style="margin: 0;">Dies ist eine automatisch generierte E-Mail. Bitte antworten Sie nicht darauf.</p>
          </td>
        </tr>
      </table>
    </body>
    </html>
    ';

    // HTML Email Headers
    $headers = "MIME-Version: 1.0" . "\r\n";
    $headers .= "Content-type:text/html;charset=UTF-8" . "\r\n";
    $headers .= "From: FromInvest AG <noreply@frominvest-ag.com>" . "\r\n";
    $headers .= "Reply-To: info@frominvest-ag.com" . "\r\n";
    $headers .= "X-Mailer: PHP/" . phpversion();

    if (mail($to, $subject, $message, $headers, "-f noreply@frominvest-ag.com")) {
        header('Content-Type: application/json');
        echo json_encode(["status" => "success", "message" => "OTP-Code erfolgreich gesendet."]);
    } else {
        header('Content-Type: application/json');
        http_response_code(500);
        echo json_encode(["status" => "error", "message" => "E-Mail konnte nicht gesendet werden."]);
    }
} else {
    header('Content-Type: application/json');
    http_response_code(405);
    echo json_encode(["status" => "error", "message" => "Methode nicht erlaubt."]);
}
?>
