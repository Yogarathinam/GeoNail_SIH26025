import React, { useState } from 'react';
import type { ViewportSettings } from './CanvasViewport';
import type { DashboardSection } from './dashboard/types';
import { useTelemetryManager } from './dashboard/useTelemetryManager';
import { DashboardSidebar } from './dashboard/DashboardSidebar';
import { DashboardHeader } from './dashboard/DashboardHeader';
import { OverviewView } from './dashboard/views/OverviewView';
import { LiveTelemetryView } from './dashboard/views/LiveTelemetryView';
import { AnalyticsView } from './dashboard/views/AnalyticsView';
import { SensorHealthView } from './dashboard/views/SensorHealthView';
import { AlertsEmailView } from './dashboard/views/AlertsEmailView';
import { DeviceSettingsView } from './dashboard/views/DeviceSettingsView';
import './dashboard/dashboard.css';

interface MCUTelemetryDashboardProps {
  settings: ViewportSettings;
  setSettings?: React.Dispatch<React.SetStateAction<ViewportSettings>>;
}

export const MCUTelemetryDashboard: React.FC<MCUTelemetryDashboardProps> = () => {
  const [currentSection, setCurrentSection] = useState<DashboardSection>('overview');
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState<boolean>(false);

  // Single consistent source of truth for telemetry and transport connections
  const {
    connectionSource,
    connectionState,
    errorMessage,
    lastReceivedTimestamp,
    currentSample,
    history,
    isPaused,
    togglePause,
    thresholds,
    setThresholds,
    alertLogs,
    handleSourceChange,
    triggerIMUCalibrate,
    triggerHardwareDemo,
    exportHistoryCsv,
  } = useTelemetryManager();

  return (
    <div className="industrial-dashboard-container">
      {/* 1. PERSISTENT LEFT SIDEBAR */}
      <DashboardSidebar
        currentSection={currentSection}
        onSelectSection={setCurrentSection}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapse={() => setIsSidebarCollapsed((prev) => !prev)}
        nodeId={currentSample.nodeId}
        overallStatus={currentSample.overallStatus}
        connectionState={connectionState}
      />

      {/* 2. MAIN WORKSPACE AREA */}
      <div className="industrial-main-content">
        {/* Top Header */}
        <DashboardHeader
          currentSection={currentSection}
          connectionSource={connectionSource}
          connectionState={connectionState}
          errorMessage={errorMessage}
          onSelectSource={handleSourceChange}
          lastReceivedTimestamp={lastReceivedTimestamp}
          nodeId={currentSample.nodeId}
          location={currentSample.location}
          isPaused={isPaused}
          onTogglePause={togglePause}
        />

        {/* Dynamic Section Content */}
        <main className="industrial-content-scrollable">
          {currentSection === 'overview' && (
            <OverviewView
              currentSample={currentSample}
              history={history}
              connectionSource={connectionSource}
              connectionState={connectionState}
            />
          )}

          {currentSection === 'telemetry' && (
            <LiveTelemetryView
              currentSample={currentSample}
              history={history}
              connectionState={connectionState}
              isPaused={isPaused}
              onTogglePause={togglePause}
              onExportCsv={exportHistoryCsv}
            />
          )}

          {currentSection === 'analytics' && (
            <AnalyticsView
              history={history}
              thresholds={thresholds}
            />
          )}

          {currentSection === 'sensors' && (
            <SensorHealthView currentSample={currentSample} />
          )}

          {currentSection === 'alerts' && (
            <AlertsEmailView
              currentSample={currentSample}
              thresholds={thresholds}
              setThresholds={setThresholds}
              alertLogs={alertLogs}
            />
          )}

          {currentSection === 'settings' && (
            <DeviceSettingsView
              currentSample={currentSample}
              connectionSource={connectionSource}
              connectionState={connectionState}
              onTriggerCalibrate={triggerIMUCalibrate}
              onTriggerDemo={triggerHardwareDemo}
              onExportCsv={exportHistoryCsv}
            />
          )}
        </main>
      </div>
    </div>
  );
};
