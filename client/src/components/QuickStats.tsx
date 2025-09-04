import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { TrendingUp, FileText, Mail, Calendar } from 'lucide-react';
import type { IngestionRunResult, LatestReportResponse } from '../../../server/src/schema';

interface QuickStatsProps {
  lastRunResult?: IngestionRunResult | null;
  latestReport?: LatestReportResponse | null;
  className?: string;
}

export function QuickStats({ lastRunResult, latestReport, className }: QuickStatsProps) {
  const stats = [
    {
      icon: FileText,
      label: 'Latest Papers',
      value: lastRunResult?.total_new?.toString() || '0',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
      available: !!lastRunResult
    },
    {
      icon: TrendingUp,
      label: 'Categories',
      value: lastRunResult ? Object.keys(lastRunResult.topic_counts).length.toString() : '0',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
      available: !!lastRunResult
    },
    {
      icon: Mail,
      label: 'Last Report',
      value: latestReport ? 'Available' : 'None',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
      available: !!latestReport
    },
    {
      icon: Calendar,
      label: 'Report Date',
      value: latestReport 
        ? latestReport.created_at.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
        : 'N/A',
      color: 'text-orange-600',
      bgColor: 'bg-orange-50',
      available: !!latestReport
    }
  ];

  return (
    <div className={`grid grid-cols-2 md:grid-cols-4 gap-4 ${className}`}>
      {stats.map((stat, index) => {
        const Icon = stat.icon;
        return (
          <Card key={index} className="relative overflow-hidden">
            <CardContent className="p-4">
              <div className={`absolute top-2 right-2 p-1 rounded ${stat.bgColor}`}>
                <Icon className={`h-4 w-4 ${stat.color}`} />
              </div>
              <div className="space-y-1">
                <p className="text-xs text-gray-500 uppercase tracking-wide">
                  {stat.label}
                </p>
                <div className="flex items-center gap-2">
                  <p className="text-lg font-bold text-gray-900">
                    {stat.value}
                  </p>
                  {stat.available && (
                    <Badge variant="secondary" className="text-xs h-4 px-1">
                      ✓
                    </Badge>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        );
      })}
    </div>
  );
}