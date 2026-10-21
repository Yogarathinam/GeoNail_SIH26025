import React, { useState, useEffect } from 'react';
import type { TelemetrySample, ExperimentalThresholds, IncidentAlertLog } from '../types';
import {
  Mail,
  Send,
  AlertTriangle,
  CheckCircle2,
  XCircle,
  Clock,
  Sliders,
  RefreshCw,
  Info,
} from 'lucide-react';

interface AlertsEmailViewProps {
  currentSample: TelemetrySample;
  thresholds: ExperimentalThresholds;
  setThresholds: React.Dispatch<React.SetStateAction<ExperimentalThresholds>>;
  alertLogs: IncidentAlertLog[];
}

interface BrevoServerStatus {
  configured: boolean;
  userConfigured: boolean;
  keyConfigured: boolean;
  transport: 'smtp' | 'api' | 'none';
  senderEmail: string;
}

export const AlertsEmailView: React.FC<AlertsEmailViewProps> = ({
  currentSample,
  thresholds,
  setThresholds,
  alertLogs,
}) => {
  const [serverStatus, setServerStatus] = useState<BrevoServerStatus | null>(null);
  const [isCheckingStatus, setIsCheckingStatus] = useState(false);
  const [testEmailStatus, setTestEmailStatus] = useState<'idle' | 'sending' | 'success' | 'error'>('idle');
  const [testEmailMessage, setTestEmailMessage] = useState<string>('');

  const fetchStatus = async () => {
    setIsCheckingStatus(true);
    try {
      const res = await fetch('/api/alert/status');
      if (res.ok) {
        const data = await res.json();
        setServerStatus(data);
      }
    } catch {
      // ignore
    } finally {
      setIsCheckingStatus(false);
    }
  };

  useEffect(() => {
    fetchStatus();
  }, []);

  const handleSendTestEmail = async () => {
    if (!thresholds.recipientEmail || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(thresholds.recipientEmail)) {
      setTestEmailStatus('error');
      setTestEmailMessage('Please enter a valid recipient email address first.');
      return;
    }

    setTestEmailStatus('sending');
    setTestEmailMessage('');

    try {
      const res = await fetch('/api/alert/send-email', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          recipient: thresholds.recipientEmail,
          subject: '[TEST] GeoNail™ Subterranean Monitoring System - Verification Alert',
          severity: 'INFO',
          alertType: 'MANUAL_TEST_VERIFICATION',
          nodeId: currentSample.nodeId,
          location: currentSample.location,
          reason: 'Manual technical symposium verification test dispatched from the operator dashboard.',
          telemetry: {
            roll: currentSample.roll,
            pitch: currentSample.pitch,
            yaw: currentSample.yaw,
            vibrationRms: currentSample.vibrationRms,
            shockPeakG: currentSample.shockPeakG,
            displacementMm: currentSample.displacementMm,
            temperatureC: currentSample.temperatureC,
            humidityPercent: currentSample.humidityPercent,
            soilPercent: currentSample.soilPercent,
            mq7Ppm: currentSample.mq7Ppm,
            overallStatus: currentSample.overallStatus,
          },
          healthScore: currentSample.healthScore,
          timestamp: Date.now(),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        setTestEmailStatus('success');
        setTestEmailMessage(`Test email accepted by Brevo! Message ID: ${data.messageId || 'ACCEPTED'}`);
      } else {
        setTestEmailStatus('error');
        setTestEmailMessage(data.error || 'Failed to dispatch email.');
      }
    } catch (err: any) {
      setTestEmailStatus('error');
      setTestEmailMessage(err.message || 'Network error reaching backend email server.');
    }
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 20 }}>
      {/* 1. BREVO EMAIL SERVICE INTEGRATION STATUS */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12, marginBottom: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
            <Mail size={18} style={{ color: 'var(--accent-cyan)' }} />
            <div>
              <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)' }}>
                Brevo (Sendinblue) Transactional Alert Service
              </div>
              <div style={{ fontSize: '0.72rem', color: 'var(--text-muted)' }}>
                Server-side relay dispatch for critical geotechnical notifications. Credentials are strictly isolated on the backend.
              </div>
            </div>
          </div>

          <button
            onClick={fetchStatus}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 5,
              padding: '4px 10px',
              borderRadius: 6,
              background: 'var(--bg-card)',
              border: '1px solid var(--border-glass)',
              color: 'var(--text-muted)',
              fontSize: '0.72rem',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            <RefreshCw size={12} className={isCheckingStatus ? 'spin' : ''} />
            <span>Check Backend Status</span>
          </button>
        </div>

        {/* Status Indicators */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 12 }}>
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>BREVO KEY STATUS</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: serverStatus?.keyConfigured ? '#10b981' : '#f59e0b', marginTop: 4 }}>
              {serverStatus?.keyConfigured ? '✓ SMTP Key Detected' : '⚠ Key Missing'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Stored securely in server .env (never exposed)
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>BREVO USER ACCOUNT</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: serverStatus?.userConfigured ? '#10b981' : '#f59e0b', marginTop: 4 }}>
              {serverStatus?.userConfigured ? '✓ Account Configured' : '⚠ Set BREVO_SMTP_USER in .env'}
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Requires registered Brevo login email
            </div>
          </div>

          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', fontWeight: 700 }}>DISPATCH ARCHITECTURE</div>
            <div style={{ fontSize: '0.9rem', fontWeight: 800, color: 'var(--text-main)', marginTop: 4 }}>
              SMTP Relay (587 / STARTTLS)
            </div>
            <div style={{ fontSize: '0.6875rem', color: 'var(--text-muted)', marginTop: 2 }}>
              Endpoint: /api/alert/send-email (Rate-limited)
            </div>
          </div>
        </div>

        {/* Security & Setup notice */}
        {!serverStatus?.userConfigured && (
          <div
            style={{
              marginTop: 12,
              padding: '10px 14px',
              borderRadius: 6,
              background: '#f59e0b12',
              border: '1px solid #f59e0b44',
              fontSize: '0.75rem',
              color: 'var(--text-main)',
              lineHeight: 1.5,
              display: 'flex',
              gap: 10,
              alignItems: 'flex-start',
            }}
          >
            <Info size={16} style={{ color: '#f59e0b', flexShrink: 0, marginTop: 2 }} />
            <div>
              <strong>Quick Brevo Setup:</strong> Your Brevo SMTP key (<code>xsmtpsib-...</code>) is loaded in <code>.env</code> on the server. To enable live email delivery to your inbox, open <code>.env</code> and set <code>BREVO_SMTP_USER=your_brevo_account_email@domain.com</code> to match your registered Brevo account.
            </div>
          </div>
        )}
      </div>

      {/* 2. RECIPIENT & TEST EMAIL CONTROLS */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Sliders size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Alert Dispatch Configuration</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(280px, 1fr))', gap: 16 }}>
          {/* Email alerts toggle & Recipient input */}
          <div>
            <label style={{ display: 'flex', alignItems: 'center', gap: 8, cursor: 'pointer', marginBottom: 10 }}>
              <input
                type="checkbox"
                checked={thresholds.emailAlertsEnabled}
                onChange={(e) => setThresholds((t) => ({ ...t, emailAlertsEnabled: e.target.checked }))}
                style={{ width: 16, height: 16, accentColor: '#0284c7' }}
              />
              <span style={{ fontSize: '0.8125rem', fontWeight: 700, color: 'var(--text-main)' }}>
                Enable Automatic Incident Email Dispatch
              </span>
            </label>

            <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
              <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600 }}>
                RECIPIENT EMAIL ADDRESS
              </label>
              <div style={{ display: 'flex', gap: 8 }}>
                <input
                  type="email"
                  placeholder="engineer@mining-company.com"
                  value={thresholds.recipientEmail}
                  onChange={(e) => setThresholds((t) => ({ ...t, recipientEmail: e.target.value }))}
                  style={{
                    flex: 1,
                    padding: '8px 12px',
                    borderRadius: 6,
                    background: 'var(--bg-card)',
                    border: '1px solid var(--border-glass)',
                    color: 'var(--text-main)',
                    fontSize: '0.8125rem',
                  }}
                />
                <button
                  onClick={handleSendTestEmail}
                  disabled={testEmailStatus === 'sending'}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '8px 14px',
                    borderRadius: 6,
                    background: '#0284c7',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: 700,
                    fontSize: '0.78125rem',
                    cursor: testEmailStatus === 'sending' ? 'not-allowed' : 'pointer',
                    opacity: testEmailStatus === 'sending' ? 0.7 : 1,
                  }}
                >
                  <Send size={13} />
                  <span>{testEmailStatus === 'sending' ? 'Dispatching...' : 'Send Test'}</span>
                </button>
              </div>
            </div>

            {/* Test result message */}
            {testEmailMessage && (
              <div
                style={{
                  marginTop: 10,
                  padding: '8px 12px',
                  borderRadius: 6,
                  background: testEmailStatus === 'success' ? '#10b98115' : '#ef444415',
                  border: `1px solid ${testEmailStatus === 'success' ? '#10b98144' : '#ef444444'}`,
                  fontSize: '0.75rem',
                  color: testEmailStatus === 'success' ? '#10b981' : '#ef4444',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 8,
                }}
              >
                {testEmailStatus === 'success' ? <CheckCircle2 size={14} /> : <XCircle size={14} />}
                <span>{testEmailMessage}</span>
              </div>
            )}
          </div>

          {/* Alert Cooldown Period */}
          <div>
            <label style={{ fontSize: '0.72rem', color: 'var(--text-muted)', fontWeight: 600, display: 'block', marginBottom: 4 }}>
              ALERT COOLDOWN PERIOD (SECONDS)
            </label>
            <input
              type="number"
              min={15}
              max={600}
              value={thresholds.cooldownSeconds}
              onChange={(e) => setThresholds((t) => ({ ...t, cooldownSeconds: Number(e.target.value) || 60 }))}
              style={{
                width: '100%',
                padding: '8px 12px',
                borderRadius: 6,
                background: 'var(--bg-card)',
                border: '1px solid var(--border-glass)',
                color: 'var(--text-main)',
                fontSize: '0.8125rem',
              }}
            />
            <div style={{ fontSize: '0.7rem', color: 'var(--text-muted)', marginTop: 4 }}>
              Prevents duplicate notification flooding during ongoing seismic or displacement events.
            </div>
          </div>
        </div>
      </div>

      {/* 3. CONFIGURABLE EXPERIMENTAL SAFETY THRESHOLDS */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 14, display: 'flex', alignItems: 'center', gap: 8 }}>
          <AlertTriangle size={16} style={{ color: '#f59e0b' }} />
          <span>Configurable Prototype Safety Trigger Thresholds</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          {/* Tilt Warning */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>TILT WARNING (°)</label>
            <input
              type="number"
              step="0.5"
              value={thresholds.tiltWarning}
              onChange={(e) => setThresholds((t) => ({ ...t, tiltWarning: Number(e.target.value) || 2.0 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>

          {/* Tilt Critical */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>TILT CRITICAL (°)</label>
            <input
              type="number"
              step="0.5"
              value={thresholds.tiltCritical}
              onChange={(e) => setThresholds((t) => ({ ...t, tiltCritical: Number(e.target.value) || 5.0 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>

          {/* Vibration Warning */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>VIBRATION WARNING (g)</label>
            <input
              type="number"
              step="0.01"
              value={thresholds.vibrationWarning}
              onChange={(e) => setThresholds((t) => ({ ...t, vibrationWarning: Number(e.target.value) || 0.05 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>

          {/* Vibration Critical */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>VIBRATION CRITICAL (g)</label>
            <input
              type="number"
              step="0.01"
              value={thresholds.vibrationCritical}
              onChange={(e) => setThresholds((t) => ({ ...t, vibrationCritical: Number(e.target.value) || 0.15 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>

          {/* Displacement Warning */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: 'var(--text-muted)', fontWeight: 700 }}>DISPLACEMENT WARNING (mm)</label>
            <input
              type="number"
              step="1.0"
              value={thresholds.displacementWarning}
              onChange={(e) => setThresholds((t) => ({ ...t, displacementWarning: Number(e.target.value) || 5.0 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>

          {/* Displacement Critical */}
          <div style={{ padding: '10px 14px', background: 'var(--bg-card)', borderRadius: 8, border: '1px solid var(--border-glass)' }}>
            <label style={{ fontSize: '0.7rem', color: '#ef4444', fontWeight: 700 }}>DISPLACEMENT CRITICAL (mm)</label>
            <input
              type="number"
              step="1.0"
              value={thresholds.displacementCritical}
              onChange={(e) => setThresholds((t) => ({ ...t, displacementCritical: Number(e.target.value) || 15.0 }))}
              style={{ width: '100%', padding: '6px 8px', marginTop: 4, borderRadius: 4, border: '1px solid var(--border-glass)', background: 'var(--bg-surface)', color: 'var(--text-main)' }}
            />
          </div>
        </div>
      </div>

      {/* 4. RECENT INCIDENT ALERT LOG */}
      <div className="glass-panel" style={{ padding: '18px 20px', borderRadius: 12 }}>
        <div style={{ fontSize: '0.85rem', fontWeight: 800, color: 'var(--text-main)', marginBottom: 12, display: 'flex', alignItems: 'center', gap: 8 }}>
          <Clock size={16} style={{ color: 'var(--accent-cyan)' }} />
          <span>Recent Incident Alert History ({alertLogs.length} events logged)</span>
        </div>

        {alertLogs.length === 0 ? (
          <div style={{ padding: 24, textAlign: 'center', color: 'var(--text-muted)', fontSize: '0.75rem' }}>
            No incident alerts triggered yet. Readings are within configured nominal safety margins.
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '0.75rem' }}>
              <thead>
                <tr style={{ borderBottom: '1px solid var(--border-glass)', color: 'var(--text-muted)', textAlign: 'left' }}>
                  <th style={{ padding: '8px 10px' }}>Timestamp</th>
                  <th style={{ padding: '8px 10px' }}>Severity</th>
                  <th style={{ padding: '8px 10px' }}>Incident Reason</th>
                  <th style={{ padding: '8px 10px' }}>Snapshot Readings</th>
                  <th style={{ padding: '8px 10px' }}>Delivery Status</th>
                </tr>
              </thead>
              <tbody>
                {alertLogs.map((log) => (
                  <tr key={log.id} style={{ borderBottom: '1px solid var(--border-glass)' }}>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', whiteSpace: 'nowrap' }}>
                      {log.formattedTime}
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span
                        style={{
                          padding: '2px 8px',
                          borderRadius: 4,
                          fontSize: '0.6875rem',
                          fontWeight: 800,
                          background: log.severity === 'CRITICAL' ? '#ef444415' : log.severity === 'WARNING' ? '#f59e0b15' : '#0284c715',
                          color: log.severity === 'CRITICAL' ? '#ef4444' : log.severity === 'WARNING' ? '#f59e0b' : '#0284c7',
                          border: `1px solid ${log.severity === 'CRITICAL' ? '#ef444444' : log.severity === 'WARNING' ? '#f59e0b44' : '#0284c744'}`,
                        }}
                      >
                        {log.severity}
                      </span>
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-main)', fontWeight: 600 }}>
                      {log.reason}
                    </td>
                    <td style={{ padding: '10px 10px', color: 'var(--text-muted)', fontFamily: 'Consolas, monospace', fontSize: '0.7rem' }}>
                      Roll: {log.metricSnapshot.roll.toFixed(1)}° | Vib: {log.metricSnapshot.vibrationRms.toFixed(3)}g | Disp: {log.metricSnapshot.displacementMm.toFixed(1)}mm
                    </td>
                    <td style={{ padding: '10px 10px' }}>
                      <span
                        style={{
                          fontSize: '0.7rem',
                          fontWeight: 700,
                          color: log.deliveryStatus === 'SENT' ? '#10b981' : log.deliveryStatus === 'FAILED' ? '#ef4444' : '#94a3b8',
                        }}
                      >
                        {log.deliveryStatus} {log.errorMessage ? `(${log.errorMessage})` : ''}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
};
