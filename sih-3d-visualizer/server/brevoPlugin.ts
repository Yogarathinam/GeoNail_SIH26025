import type { Plugin, ViteDevServer } from 'vite';
import fs from 'node:fs';
import path from 'node:path';
import https from 'node:https';
import nodemailer from 'nodemailer';

interface AlertEmailPayload {
  recipient: string;
  subject?: string;
  alertType?: string;
  nodeId?: string;
  location?: string;
  severity?: 'CRITICAL' | 'WARNING' | 'INFO';
  reason?: string;
  telemetry?: {
    roll?: number;
    pitch?: number;
    yaw?: number;
    vibrationRms?: number;
    shockPeakG?: number;
    displacementMm?: number;
    temperatureC?: number;
    humidityPercent?: number;
    soilPercent?: number;
    mq7Ppm?: number;
    overallStatus?: string;
  };
  healthScore?: number;
  timestamp?: number;
}

// In-memory rate limiting and alert logging
let lastEmailSentTime = 0;
const MIN_COOLDOWN_MS = 3000;
const alertDispatchLogs: Array<{
  id: string;
  timestamp: number;
  recipient: string;
  severity: string;
  reason: string;
  status: 'SENT' | 'FAILED';
  error?: string;
}> = [];

function loadEnvFile(rootPath: string): Record<string, string> {
  const env: Record<string, string> = {};
  const envPath = path.resolve(rootPath, '.env');
  if (fs.existsSync(envPath)) {
    try {
      const content = fs.readFileSync(envPath, 'utf-8');
      for (const line of content.split(/\r?\n/)) {
        const trimmed = line.trim();
        if (!trimmed || trimmed.startsWith('#')) continue;
        const eqIdx = trimmed.indexOf('=');
        if (eqIdx > 0) {
          const key = trimmed.slice(0, eqIdx).trim();
          let val = trimmed.slice(eqIdx + 1).trim();
          if ((val.startsWith('"') && val.endsWith('"')) || (val.startsWith("'") && val.endsWith("'"))) {
            val = val.slice(1, -1);
          }
          env[key] = val;
        }
      }
    } catch {
      // ignore
    }
  }
  return env;
}

function generateAlertHtml(data: AlertEmailPayload): string {
  const timeStr = new Date(data.timestamp || Date.now()).toUTCString();
  const severity = data.severity || 'WARNING';
  const isCritical = severity === 'CRITICAL';
  const isWarning = severity === 'WARNING';

  const themeGradient = isCritical
    ? 'linear-gradient(135deg, #991b1b 0%, #dc2626 100%)'
    : isWarning
    ? 'linear-gradient(135deg, #92400e 0%, #d97706 100%)'
    : 'linear-gradient(135deg, #0369a1 0%, #0284c7 100%)';

  const badgeColor = isCritical ? '#ef4444' : isWarning ? '#f59e0b' : '#38bdf8';
  const badgeBg = isCritical ? '#fee2e2' : isWarning ? '#fef3c7' : '#e0f2fe';
  const t = data.telemetry || {};

  return `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>GeoNail™ Telemetry Incident Alert</title>
</head>
<body style="margin: 0; padding: 0; background-color: #0b0f19; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, 'Helvetica Neue', Arial, sans-serif; color: #0f172a;">
  <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #0b0f19; padding: 32px 12px;">
    <tr>
      <td align="center">
        <!-- Main Container Card -->
        <table role="presentation" width="620" cellspacing="0" cellpadding="0" style="max-width: 620px; width: 100%; background-color: #ffffff; border-radius: 16px; overflow: hidden; box-shadow: 0 20px 40px rgba(0,0,0,0.45); border: 1px solid #1e293b;">
          
          <!-- Top Brand Header Bar -->
          <tr>
            <td style="background: ${themeGradient}; padding: 26px 30px; text-align: left; color: #ffffff;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <div style="display: inline-block; padding: 4px 12px; border-radius: 999px; background: rgba(255,255,255,0.22); font-size: 11px; font-weight: 800; letter-spacing: 0.08em; text-transform: uppercase; margin-bottom: 8px;">
                      ● ${severity} INCIDENT NOTIFICATION
                    </div>
                    <h1 style="margin: 0; font-size: 22px; font-weight: 900; letter-spacing: -0.02em; color: #ffffff;">
                      GeoNail™ Subterranean Monitoring System
                    </h1>
                    <div style="font-size: 13px; opacity: 0.92; margin-top: 4px; font-weight: 500;">
                      Intelligent Sub-Surface Rock Anchor Telemetry • Enterprise Observability Suite
                    </div>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Sub-header metadata bar -->
          <tr>
            <td style="background-color: #0f172a; padding: 12px 30px; color: #94a3b8; font-size: 12px; border-bottom: 1px solid #1e293b;">
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                <tr>
                  <td>
                    <strong style="color: #f1f5f9;">Anchor Node:</strong> ${data.nodeId || 'GN-001'} &nbsp;|&nbsp;
                    <strong style="color: #f1f5f9;">Location:</strong> ${data.location || 'Zone A - Slope Face'} &nbsp;|&nbsp;
                    <strong style="color: #f1f5f9;">Status:</strong> <span style="color: ${badgeColor}; font-weight: 800;">${t.overallStatus || severity}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>

          <!-- Incident Briefing Content Area -->
          <tr>
            <td style="padding: 28px 30px;">

              <!-- Trigger Reason Callout Box -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: ${badgeBg}; border: 1.5px solid ${badgeColor}; border-radius: 10px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 16px 20px;">
                    <div style="font-size: 11px; text-transform: uppercase; font-weight: 800; color: #0f172a; letter-spacing: 0.05em; margin-bottom: 4px;">
                      Trigger Condition Event
                    </div>
                    <div style="font-size: 15px; font-weight: 700; color: #0f172a; line-height: 1.45;">
                      ${data.reason || 'Configured geotechnical threshold exceeded on subterranean rock anchor.'}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- 4-Tile High Impact Key Metrics Grid -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="margin-bottom: 24px;">
                <tr>
                  <!-- Metric 1: Incline Tilt -->
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      3D Tilt (Roll / Pitch)
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: #0f172a; margin-top: 4px;">
                      ${(t.roll ?? 0).toFixed(1)}° <span style="font-size: 14px; color: #94a3b8;">/</span> ${(t.pitch ?? 0).toFixed(1)}°
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Safety Limit: ±5.0° Crit
                    </div>
                  </td>
                  <td width="4%"></td>
                  <!-- Metric 2: Vibration RMS -->
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Vibration Dynamics
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: ${(t.vibrationRms ?? 0) > 0.05 ? '#d97706' : '#0f172a'}; margin-top: 4px;">
                      ${(t.vibrationRms ?? 0).toFixed(3)} <span style="font-size: 13px; font-weight: 700; color: #64748b;">g RMS</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Shock Peak: ${(t.shockPeakG ?? 1.0).toFixed(2)} g
                    </div>
                  </td>
                </tr>
                <tr><td height="12"></td></tr>
                <tr>
                  <!-- Metric 3: Displacement -->
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      Spike Extension (Est.)
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: #b45309; margin-top: 4px;">
                      ${(t.displacementMm ?? 0).toFixed(2)} <span style="font-size: 13px; font-weight: 700;">mm</span>
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      ${((t.displacementMm ?? 0) / 10).toFixed(2)} cm Bedrock Penetration
                    </div>
                  </td>
                  <td width="4%"></td>
                  <!-- Metric 4: Health Score -->
                  <td width="48%" style="background-color: #f8fafc; border: 1px solid #e2e8f0; border-radius: 10px; padding: 14px 16px; vertical-align: top;">
                    <div style="font-size: 11px; font-weight: 700; color: #64748b; text-transform: uppercase;">
                      System Health Score
                    </div>
                    <div style="font-size: 20px; font-weight: 900; color: ${(data.healthScore ?? 100) < 80 ? '#dc2626' : '#10b981'}; margin-top: 4px;">
                      ${data.healthScore ?? 100}%
                    </div>
                    <div style="font-size: 11px; color: #64748b; margin-top: 2px;">
                      Anomaly: ${data.alertType || 'THRESHOLD_EVENT'}
                    </div>
                  </td>
                </tr>
              </table>

              <!-- Detailed Subsystem Telemetry Table -->
              <div style="font-size: 13px; font-weight: 800; color: #0f172a; text-transform: uppercase; letter-spacing: 0.04em; margin-bottom: 8px;">
                Comprehensive Transducer Readings
              </div>
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="border-collapse: collapse; font-size: 12px; margin-bottom: 24px;">
                <thead>
                  <tr style="background-color: #f1f5f9; border-bottom: 1.5px solid #cbd5e1;">
                    <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Transducer Signal</th>
                    <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Current Value</th>
                    <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Nominal Reference</th>
                    <th align="left" style="padding: 9px 12px; font-size: 11px; text-transform: uppercase; color: #475569;">Status</th>
                  </tr>
                </thead>
                <tbody>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 9px 12px; font-weight: 700;">MPU-6050 6-DOF IMU</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.roll ?? 0).toFixed(1)}° / ${(t.pitch ?? 0).toFixed(1)}°</td>
                    <td style="padding: 9px 12px; color: #64748b;">0.0° Resting Baseline</td>
                    <td style="padding: 9px 12px; color: ${Math.abs(t.roll ?? 0) > 5 ? '#dc2626' : '#10b981'}; font-weight: 700;">
                      ${Math.abs(t.roll ?? 0) > 5 ? 'EXCEEDED' : 'NOMINAL'}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fafafa;">
                    <td style="padding: 9px 12px; font-weight: 700;">HMC5883L Magnetic Flux</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.displacementMm ?? 0).toFixed(2)} mm</td>
                    <td style="padding: 9px 12px; color: #64748b;">47.60 μT Seated Datum</td>
                    <td style="padding: 9px 12px; color: ${(t.displacementMm ?? 0) > 15 ? '#dc2626' : '#10b981'}; font-weight: 700;">
                      ${(t.displacementMm ?? 0) > 15 ? 'CRITICAL SHIFT' : 'TRACKING'}
                    </td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 9px 12px; font-weight: 700;">DHT11 Subsurface Temp</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.temperatureC ?? 24).toFixed(1)} °C</td>
                    <td style="padding: 9px 12px; color: #64748b;">15.0 - 35.0 °C Safe Range</td>
                    <td style="padding: 9px 12px; color: #10b981; font-weight: 700;">HEALTHY</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fafafa;">
                    <td style="padding: 9px 12px; font-weight: 700;">Subsurface Relative Humidity</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.humidityPercent ?? 50).toFixed(0)} % RH</td>
                    <td style="padding: 9px 12px; color: #64748b;">&lt; 85% RH Dewpoint</td>
                    <td style="padding: 9px 12px; color: #10b981; font-weight: 700;">HEALTHY</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0;">
                    <td style="padding: 9px 12px; font-weight: 700;">Soil Saturation (Probe ADC)</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.soilPercent ?? 30).toFixed(1)} %</td>
                    <td style="padding: 9px 12px; color: #64748b;">&lt; 70% Liquefaction Threshold</td>
                    <td style="padding: 9px 12px; color: #10b981; font-weight: 700;">HEALTHY</td>
                  </tr>
                  <tr style="border-bottom: 1px solid #e2e8f0; background-color: #fafafa;">
                    <td style="padding: 9px 12px; font-weight: 700;">MQ-7 Mine Gas Concentration</td>
                    <td style="padding: 9px 12px; font-weight: 700; color: #0f172a;">${(t.mq7Ppm ?? 0).toFixed(1)} PPM CO</td>
                    <td style="padding: 9px 12px; color: #64748b;">Threshold: 25.0 PPM</td>
                    <td style="padding: 9px 12px; color: ${(t.mq7Ppm ?? 0) > 25 ? '#dc2626' : '#10b981'}; font-weight: 700;">
                      ${(t.mq7Ppm ?? 0) > 25 ? 'GAS WARNING' : 'NORMAL'}
                    </td>
                  </tr>
                </tbody>
              </table>

              <!-- Recommended Engineering Response Protocols -->
              <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f8fafc; border-left: 4px solid #0284c7; border-radius: 4px; margin-bottom: 24px;">
                <tr>
                  <td style="padding: 14px 18px;">
                    <div style="font-size: 12px; font-weight: 800; color: #0284c7; text-transform: uppercase; margin-bottom: 6px;">
                      Recommended Geotechnical Protocol
                    </div>
                    <ol style="margin: 0; padding-left: 18px; font-size: 12px; color: #334155; line-height: 1.6;">
                      <li><strong>Physical Anchor Inspection:</strong> Verify Level-2 captive bayonet locking gate on anchor <code>${data.nodeId || 'GN-001'}</code>.</li>
                      <li><strong>Minefield Spatial Drift Review:</strong> Inspect real-time open-pit bench slope elevation on the GeoNail 3D Digital Twin.</li>
                      <li><strong>Acoustic Verification:</strong> Assess micro-seismic fracture frequency around <code>${data.location || 'Zone A'}</code>.</li>
                    </ol>
                  </td>
                </tr>
              </table>

              <!-- Timestamp and Node Dispatch Meta -->
              <div style="font-size: 11px; color: #64748b; border-top: 1px solid #e2e8f0; padding-top: 14px;">
                <strong>Incident Dispatch Time (UTC):</strong> ${timeStr}<br>
                <strong>Originating Telemetry Node:</strong> ${data.nodeId || 'GN-001'} (${data.location || 'Zone A - Slope Face'})<br>
                <strong>Default Notification Recipient:</strong> <code>23104177@rmd.ac.in</code>
              </div>

            </td>
          </tr>

          <!-- Professional Footer -->
          <tr>
            <td style="background-color: #0f172a; padding: 22px 30px; text-align: center; color: #64748b; font-size: 11px; border-top: 1px solid #1e293b;">
              <div style="font-weight: 800; color: #f1f5f9; font-size: 13px; margin-bottom: 4px;">
                Team XLR8 • Department of ECE • R.M.D. Engineering College
              </div>
              <div style="color: #94a3b8; font-size: 11px; margin-bottom: 10px;">
                Advanced Sub-Surface Geotechnical Sensor Network &amp; Digital Twin System
              </div>
              <div style="font-size: 10px; color: #64748b; line-height: 1.4;">
                This is an automated engineering incident dispatch from the GeoNail Subterranean Rock Anchor Monitoring Platform.<br>
                Production Deployment: <a href="https://geonail.vercel.app/" style="color: #38bdf8; text-decoration: none;">geonail.vercel.app</a>
              </div>
            </td>
          </tr>

        </table>
      </td>
    </tr>
  </table>
</body>
</html>
  `;
}

export function brevoApiPlugin(): Plugin {
  return {
    name: 'brevo-api-plugin',
    configureServer(server: ViteDevServer) {
      server.middlewares.use(async (req, res, next) => {
        const url = req.url?.split('?')[0];

        // 1. GET /api/alert/status
        if (url === '/api/alert/status' && req.method === 'GET') {
          const env = { ...process.env, ...loadEnvFile(process.cwd()) };
          const hasSmtpKey = Boolean(env.BREVO_SMTP_KEY);
          const hasSmtpUser = Boolean(env.BREVO_SMTP_USER);
          const hasApiKey = Boolean(env.BREVO_API_KEY);
          const senderEmail = env.BREVO_SENDER_EMAIL || env.BREVO_SMTP_USER || '';

          const configured = (hasSmtpKey && hasSmtpUser) || hasApiKey;
          const transport = hasApiKey ? 'api' : hasSmtpKey ? 'smtp' : 'none';

          res.setHeader('Content-Type', 'application/json');
          res.end(
            JSON.stringify({
              configured,
              userConfigured: hasSmtpUser,
              keyConfigured: hasSmtpKey || hasApiKey,
              transport,
              senderEmail,
              logsCount: alertDispatchLogs.length,
            })
          );
          return;
        }

        // 2. GET /api/alert/logs
        if (url === '/api/alert/logs' && req.method === 'GET') {
          res.setHeader('Content-Type', 'application/json');
          res.end(JSON.stringify({ logs: alertDispatchLogs.slice(0, 25) }));
          return;
        }

        // 3. POST /api/alert/send-email
        if (url === '/api/alert/send-email' && req.method === 'POST') {
          let body = '';
          req.on('data', (chunk) => {
            body += chunk;
          });

          req.on('end', async () => {
            res.setHeader('Content-Type', 'application/json');

            // Rate limit check
            const now = Date.now();
            if (now - lastEmailSentTime < MIN_COOLDOWN_MS) {
              res.statusCode = 429;
              res.end(JSON.stringify({ success: false, error: 'Rate limit: Please wait 3 seconds between alert emails.' }));
              return;
            }

            let payload: AlertEmailPayload;
            try {
              payload = JSON.parse(body);
            } catch {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Invalid JSON payload.' }));
              return;
            }

            const env = { ...process.env, ...loadEnvFile(process.cwd()) };
            const defaultRecipient = env.DEFAULT_ALERT_RECIPIENT || '23104177@rmd.ac.in';
            const recipient = (payload.recipient || defaultRecipient).trim();
            if (!recipient || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(recipient)) {
              res.statusCode = 400;
              res.end(JSON.stringify({ success: false, error: 'Valid recipient email address is required.' }));
              return;
            }

            const smtpKey = env.BREVO_SMTP_KEY || '';
            const smtpUser = env.BREVO_SMTP_USER || '';
            const smtpHost = env.BREVO_SMTP_HOST || 'smtp-relay.brevo.com';
            const smtpPort = Number.parseInt(env.BREVO_SMTP_PORT || '587', 10);
            const apiKey = env.BREVO_API_KEY || '';
            const senderEmail = env.BREVO_SENDER_EMAIL || smtpUser || 'geonail.monitor@gmail.com';

            const subject = payload.subject || `[${payload.severity || 'ALERT'}] GeoNail Node ${payload.nodeId || 'GN-001'}: ${payload.reason || 'Threshold Event'}`;
            const htmlContent = generateAlertHtml(payload);
            const textContent = `GeoNail Alert Notification\nNode: ${payload.nodeId || 'GN-001'}\nSeverity: ${payload.severity || 'WARNING'}\nReason: ${payload.reason || 'Threshold breach'}\nTime: ${new Date(payload.timestamp || now).toISOString()}`;

            // Priority 1: If Brevo v3 API key is configured
            if (apiKey) {
              try {
                const apiData = JSON.stringify({
                  sender: { name: 'GeoNail Subterranean Monitor', email: senderEmail },
                  to: [{ email: recipient }],
                  subject,
                  htmlContent,
                  textContent,
                });

                const apiReq = https.request(
                  {
                    hostname: 'api.brevo.com',
                    path: '/v3/smtp/email',
                    method: 'POST',
                    headers: {
                      accept: 'application/json',
                      'api-key': apiKey,
                      'content-type': 'application/json',
                      'content-length': Buffer.byteLength(apiData),
                    },
                  },
                  (apiRes) => {
                    let resBody = '';
                    apiRes.on('data', (c) => (resBody += c));
                    apiRes.on('end', () => {
                      if (apiRes.statusCode && apiRes.statusCode >= 200 && apiRes.statusCode < 300) {
                        lastEmailSentTime = Date.now();
                        const result = JSON.parse(resBody || '{}');
                        alertDispatchLogs.unshift({
                          id: result.messageId || String(now),
                          timestamp: now,
                          recipient,
                          severity: payload.severity || 'WARNING',
                          reason: payload.reason || 'Triggered alert',
                          status: 'SENT',
                        });
                        res.statusCode = 200;
                        res.end(JSON.stringify({ success: true, messageId: result.messageId, timestamp: now }));
                      } else {
                        const errMsg = `Brevo API HTTP ${apiRes.statusCode}: ${resBody}`;
                        alertDispatchLogs.unshift({
                          id: String(now),
                          timestamp: now,
                          recipient,
                          severity: payload.severity || 'WARNING',
                          reason: payload.reason || 'Triggered alert',
                          status: 'FAILED',
                          error: errMsg,
                        });
                        res.statusCode = 502;
                        res.end(JSON.stringify({ success: false, error: errMsg }));
                      }
                    });
                  }
                );

                apiReq.on('error', (err) => {
                  res.statusCode = 500;
                  res.end(JSON.stringify({ success: false, error: `Brevo API Network Error: ${err.message}` }));
                });

                apiReq.write(apiData);
                apiReq.end();
                return;
              } catch (e: any) {
                res.statusCode = 500;
                res.end(JSON.stringify({ success: false, error: e.message }));
                return;
              }
            }

            // Priority 2: Brevo SMTP Relay via nodemailer
            if (smtpKey) {
              if (!smtpUser) {
                res.statusCode = 422;
                res.end(
                  JSON.stringify({
                    success: false,
                    error:
                      'Brevo SMTP user account email is required. Please set BREVO_SMTP_USER in .env to your registered Brevo login email.',
                  })
                );
                return;
              }

              try {
                const transporter = nodemailer.createTransport({
                  host: smtpHost,
                  port: smtpPort,
                  secure: false, // TLS via STARTTLS on 587
                  auth: {
                    user: smtpUser,
                    pass: smtpKey,
                  },
                });

                const info = await transporter.sendMail({
                  from: `"GeoNail Subterranean Monitor" <${senderEmail}>`,
                  to: recipient,
                  subject,
                  text: textContent,
                  html: htmlContent,
                });

                lastEmailSentTime = Date.now();
                alertDispatchLogs.unshift({
                  id: info.messageId || String(now),
                  timestamp: now,
                  recipient,
                  severity: payload.severity || 'WARNING',
                  reason: payload.reason || 'Triggered alert',
                  status: 'SENT',
                });

                res.statusCode = 200;
                res.end(JSON.stringify({ success: true, messageId: info.messageId, timestamp: now }));
                return;
              } catch (smtpErr: any) {
                const errMsg = smtpErr.message || 'SMTP transmission failure';
                alertDispatchLogs.unshift({
                  id: String(now),
                  timestamp: now,
                  recipient,
                  severity: payload.severity || 'WARNING',
                  reason: payload.reason || 'Triggered alert',
                  status: 'FAILED',
                  error: errMsg,
                });

                res.statusCode = 502;
                res.end(
                  JSON.stringify({
                    success: false,
                    error: `Brevo SMTP Relay Error: ${errMsg}. Ensure BREVO_SMTP_USER matches your Brevo registered email and BREVO_SENDER_EMAIL is verified in Brevo.`,
                  })
                );
                return;
              }
            }

            // If neither is configured
            res.statusCode = 503;
            res.end(
              JSON.stringify({
                success: false,
                error: 'Brevo credentials are not configured on the server. Please populate .env with BREVO_SMTP_USER and BREVO_SMTP_KEY.',
              })
            );
          });
          return;
        }

        next();
      });
    },
  };
}
