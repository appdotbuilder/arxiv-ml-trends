import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Progress } from '@/components/ui/progress';
import { TrendingUp, TrendingDown, Minus } from 'lucide-react';

interface TopicData {
  topic: string;
  count: number;
  percentage: number;
  trend: 'up' | 'down' | 'stable';
}

interface TopicAnalyticsProps {
  topicCounts: Record<string, number>;
  className?: string;
}

export function TopicAnalytics({ topicCounts, className }: TopicAnalyticsProps) {
  const totalPapers = Object.values(topicCounts).reduce((sum, count) => sum + count, 0);
  
  const topicData: TopicData[] = Object.entries(topicCounts)
    .map(([topic, count]) => ({
      topic,
      count,
      percentage: totalPapers > 0 ? (count / totalPapers) * 100 : 0,
      trend: 'stable' as const // For now, we don't have historical data to determine trend
    }))
    .sort((a, b) => b.count - a.count);

  const getTopicEmoji = (topic: string): string => {
    const emojiMap: Record<string, string> = {
      'Foundation Models': '🏗️',
      'LLM Fine-tuning': '🔧',
      'Parameter-Efficient Fine-tuning (PEFT)': '⚡',
      'Retrieval-Augmented Generation (RAG)': '🔍',
      'Model Quantization': '📏',
      'Agentic AI / AI Agents': '🤖',
      'Multimodality': '🎭',
      'Reinforcement Learning': '🎮',
      'Computer Vision (Specific Techniques)': '👁️',
      'Natural Language Processing (Specific Techniques)': '💬',
      'Ethical AI / AI Safety': '🛡️',
      'Efficient AI / AI Optimization': '🚀',
      'Data-centric AI': '📊',
      'Other': '🔬'
    };
    return emojiMap[topic] || '📄';
  };

  const getTrendIcon = (trend: TopicData['trend']) => {
    switch (trend) {
      case 'up':
        return <TrendingUp className="h-3 w-3 text-green-500" />;
      case 'down':
        return <TrendingDown className="h-3 w-3 text-red-500" />;
      default:
        return <Minus className="h-3 w-3 text-gray-400" />;
    }
  };



  if (totalPapers === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            📊 Topic Analytics
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No data available yet. Run an ingestion to see topic analytics.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          📊 Topic Analytics
          <Badge variant="secondary" className="ml-auto">
            {totalPapers} total papers
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Top Topics Summary */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          {topicData.slice(0, 4).map((data) => (
            <div key={data.topic} className="text-center">
              <div className="text-lg font-bold text-gray-900">
                {data.count}
              </div>
              <div className="text-xs text-gray-500 truncate" title={data.topic}>
                {getTopicEmoji(data.topic)} {data.topic.split(' ')[0]}
              </div>
            </div>
          ))}
        </div>

        {/* Detailed Topic Breakdown */}
        <div className="space-y-3 max-h-64 overflow-y-auto">
          {topicData.map((data) => (
            <div key={data.topic} className="space-y-2">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2 flex-1 min-w-0">
                  <span className="text-sm">{getTopicEmoji(data.topic)}</span>
                  <span 
                    className="text-sm font-medium truncate flex-1" 
                    title={data.topic}
                  >
                    {data.topic}
                  </span>
                  {getTrendIcon(data.trend)}
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  <Badge 
                    variant="secondary" 
                    className="text-xs bg-gray-100 text-gray-800"
                  >
                    {data.count}
                  </Badge>
                  <span className="text-xs text-gray-500 w-8 text-right">
                    {data.percentage.toFixed(0)}%
                  </span>
                </div>
              </div>
              <Progress 
                value={data.percentage} 
                className="h-1.5"
              />
            </div>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="mt-4 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="text-sm font-medium text-gray-900">
                {topicData.length}
              </div>
              <div className="text-xs text-gray-500">Categories</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {Math.round(totalPapers / topicData.length)}
              </div>
              <div className="text-xs text-gray-500">Avg/Topic</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {topicData[0]?.topic.split(' ')[0] || 'N/A'}
              </div>
              <div className="text-xs text-gray-500">Top Area</div>
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}