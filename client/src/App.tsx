import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';

import { Alert, AlertDescription } from '@/components/ui/alert';
import { Separator } from '@/components/ui/separator';
import { TopicAnalytics } from '@/components/TopicAnalytics';
import { PaperHighlights } from '@/components/PaperHighlights';
import { StatusIndicator } from '@/components/StatusIndicator';
import { QuickStats } from '@/components/QuickStats';
import { trpc } from '@/utils/trpc';
import { useState, useEffect, useCallback } from 'react';
import { Loader2, Play, Mail, TrendingUp, FileText, Calendar } from 'lucide-react';
import type { 
  IngestionRunResult, 
  ReportResult, 
  LatestReportResponse,
  HealthCheck 
} from '../../server/src/schema';

function App() {
  const [healthStatus, setHealthStatus] = useState<HealthCheck | null>(null);
  const [latestReport, setLatestReport] = useState<LatestReportResponse | null>(null);
  const [isRunning, setIsRunning] = useState(false);
  const [isGeneratingReport, setIsGeneratingReport] = useState(false);
  const [lastRunResult, setLastRunResult] = useState<IngestionRunResult | null>(null);
  const [lastReportResult, setLastReportResult] = useState<ReportResult | null>(null);
  const [error, setError] = useState<string | null>(null);

  const loadHealthStatus = useCallback(async () => {
    try {
      const result = await trpc.healthz.query();
      setHealthStatus(result);
      setError(null);
    } catch (error) {
      console.error('Failed to load health status:', error);
      setError('Failed to connect to server');
    }
  }, []);

  const loadLatestReport = useCallback(async () => {
    try {
      const result = await trpc.reportsLatest.query();
      setLatestReport(result);
    } catch (error) {
      console.error('Failed to load latest report:', error);
      setError('Failed to load latest report');
    }
  }, []);

  useEffect(() => {
    loadHealthStatus();
    loadLatestReport();
  }, [loadHealthStatus, loadLatestReport]);

  const handleRunIngestion = async () => {
    setIsRunning(true);
    setError(null);
    try {
      const result = await trpc.ingestRun.mutate();
      setLastRunResult(result);
      // Reload latest report after successful ingestion
      await loadLatestReport();
    } catch (error) {
      console.error('Failed to run ingestion:', error);
      setError('Failed to run paper ingestion. Please try again.');
    } finally {
      setIsRunning(false);
    }
  };

  const handleGenerateReport = async (previewOnly: boolean = false) => {
    if (!lastRunResult?.run_id) {
      setError('No recent ingestion run found. Please run ingestion first.');
      return;
    }

    setIsGeneratingReport(true);
    setError(null);
    try {
      const result = await trpc.reportRun.mutate({
        run_id: lastRunResult.run_id,
        preview_only: previewOnly
      });
      setLastReportResult(result);
      // Reload latest report after successful generation
      await loadLatestReport();
    } catch (error) {
      console.error('Failed to generate report:', error);
      setError('Failed to generate report. Please try again.');
    } finally {
      setIsGeneratingReport(false);
    }
  };



  return (
    <div className="min-h-screen bg-gradient-to-br from-blue-50 to-indigo-100 p-4">
      <div className="container mx-auto max-w-6xl space-y-6">
        {/* Header */}
        <div className="text-center space-y-2">
          <h1 className="text-4xl font-bold text-gray-900 flex items-center justify-center gap-2">
            🔬 ArXiv ML Weekly Trend Alerter
          </h1>
          <p className="text-gray-600">
            Track and summarize the latest machine learning research papers
          </p>
          <div className="flex justify-center">
            <StatusIndicator 
              status={healthStatus?.status === 'ok' ? 'healthy' : 'offline'} 
            />
          </div>
        </div>

        {/* Error Alert */}
        {error && (
          <Alert className="border-red-200 bg-red-50">
            <AlertDescription className="text-red-800">
              {error}
            </AlertDescription>
          </Alert>
        )}

        {/* Action Buttons */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Play className="h-5 w-5" />
              Manual Controls
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex flex-wrap gap-4">
              <Button
                onClick={handleRunIngestion}
                disabled={isRunning || healthStatus?.status !== 'ok'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Running Ingestion...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Run Paper Ingestion
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleGenerateReport(true)}
                disabled={isGeneratingReport || !lastRunResult?.run_id}
                variant="outline"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <FileText className="mr-2 h-4 w-4" />
                    Preview Report
                  </>
                )}
              </Button>

              <Button
                onClick={() => handleGenerateReport(false)}
                disabled={isGeneratingReport || !lastRunResult?.run_id}
                className="bg-green-600 hover:bg-green-700"
              >
                {isGeneratingReport ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Generating...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send Report Email
                  </>
                )}
              </Button>
            </div>

            {lastRunResult && (
              <div className="text-sm text-gray-600">
                Last run: {lastRunResult.total_new} new papers processed
              </div>
            )}
          </CardContent>
        </Card>

        {/* Quick Stats Overview */}
        <QuickStats 
          lastRunResult={lastRunResult}
          latestReport={latestReport}
        />

        <div className="space-y-6">
          {/* Topic Analytics and Paper Highlights */}
          {lastRunResult && (
            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
              <TopicAnalytics topicCounts={lastRunResult.topic_counts} />
              <PaperHighlights topicCounts={lastRunResult.topic_counts} />
            </div>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {/* Latest Run Summary */}
            {lastRunResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <TrendingUp className="h-5 w-5" />
                    Latest Ingestion Summary
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid grid-cols-2 gap-4">
                    <div className="text-center">
                      <div className="text-3xl font-bold text-blue-600">
                        {lastRunResult.total_new}
                      </div>
                      <div className="text-sm text-gray-500">New Papers</div>
                    </div>
                    <div className="text-center">
                      <div className="text-3xl font-bold text-green-600">
                        {Object.keys(lastRunResult.topic_counts).length}
                      </div>
                      <div className="text-sm text-gray-500">Categories</div>
                    </div>
                  </div>

                  <Separator />

                  <div className="text-center">
                    <div className="text-lg font-semibold text-gray-700">
                      Run ID: <span className="font-mono text-sm">{lastRunResult.run_id.slice(0, 8)}...</span>
                    </div>
                    <div className="text-xs text-gray-500 mt-1">
                      Ready for report generation
                    </div>
                  </div>
                </CardContent>
              </Card>
            )}

            {/* Latest Report */}
            {latestReport && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <Mail className="h-5 w-5" />
                    Latest Report
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2">
                    <div className="flex items-center gap-2 text-sm text-gray-500">
                      <Calendar className="h-4 w-4" />
                      {latestReport.created_at.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                      })}
                    </div>
                    <h3 className="font-medium text-lg">{latestReport.subject}</h3>
                  </div>

                  <Separator />

                  <div 
                    className="prose prose-sm max-w-none text-gray-700 max-h-48 overflow-y-auto"
                    dangerouslySetInnerHTML={{ __html: latestReport.body_html }}
                  />
                </CardContent>
              </Card>
            )}

            {/* Last Report Generation Result */}
            {lastReportResult && (
              <Card>
                <CardHeader>
                  <CardTitle className="flex items-center gap-2">
                    <FileText className="h-5 w-5" />
                    Report Generation Status
                  </CardTitle>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2">
                    <div className={`w-3 h-3 rounded-full ${lastReportResult.emailed ? 'bg-green-500' : 'bg-yellow-500'}`} />
                    <span className="text-sm">
                      {lastReportResult.emailed ? 'Successfully emailed' : 'Preview generated (not emailed)'}
                    </span>
                  </div>
                  
                  <div>
                    <h4 className="font-medium text-sm">Subject:</h4>
                    <p className="text-sm text-gray-600">{lastReportResult.subject}</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Getting Started */}
        {!lastRunResult && !latestReport && (
          <Card className="border-dashed border-2 border-gray-200">
            <CardContent className="text-center py-8 space-y-4">
              <div className="text-6xl">🚀</div>
              <h3 className="text-xl font-semibold">Welcome to ArXiv ML Trend Alerter!</h3>
              <p className="text-gray-600 max-w-md mx-auto">
                Get started by running your first paper ingestion to discover the latest ML research trends.
              </p>
              <Button
                onClick={handleRunIngestion}
                disabled={isRunning || healthStatus?.status !== 'ok'}
                className="bg-blue-600 hover:bg-blue-700"
              >
                {isRunning ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Starting...
                  </>
                ) : (
                  <>
                    <TrendingUp className="mr-2 h-4 w-4" />
                    Run First Ingestion
                  </>
                )}
              </Button>
            </CardContent>
          </Card>
        )}

        {/* Footer */}
        <div className="text-center text-sm text-gray-500 space-y-1">
          <p>🤖 Powered by AI-driven research analysis</p>
          <p>📊 Weekly automated trend reports</p>
        </div>
      </div>
    </div>
  );
}

export default App;