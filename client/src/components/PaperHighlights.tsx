import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { ExternalLink, TrendingUp, BarChart3 } from 'lucide-react';

interface PaperHighlightsProps {
  topicCounts: Record<string, number>;
  className?: string;
}

export function PaperHighlights({ topicCounts, className }: PaperHighlightsProps) {
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

  const getTopTopics = () => {
    return Object.entries(topicCounts)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 5); // Show top 5 topics
  };

  const topTopics = getTopTopics();
  const totalPapers = Object.values(topicCounts).reduce((sum, count) => sum + count, 0);

  if (topTopics.length === 0) {
    return (
      <Card className={className}>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            ⭐ Research Trends
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="text-center py-8 text-gray-500">
            No research trends available yet. Run an ingestion to see trending topics.
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className={className}>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          ⭐ Research Trends
          <Badge variant="secondary" className="ml-auto">
            Top {topTopics.length} areas
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Trending Topics List */}
        <div className="space-y-3">
          {topTopics.map(([topic, count], index) => {
            const percentage = totalPapers > 0 ? (count / totalPapers) * 100 : 0;
            
            return (
              <div key={topic} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <span className="text-lg">{getTopicEmoji(topic)}</span>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-sm truncate" title={topic}>
                        {topic}
                      </h3>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge 
                          variant={index === 0 ? "default" : "secondary"} 
                          className="text-xs"
                        >
                          #{index + 1}
                        </Badge>
                        <span className="text-xs text-gray-500">
                          {count} papers ({percentage.toFixed(1)}%)
                        </span>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2 shrink-0">
                    {index === 0 && (
                      <TrendingUp className="h-4 w-4 text-green-500" />
                    )}
                    <Button
                      size="sm"
                      variant="ghost"
                      className="h-6 px-2 text-xs"
                      onClick={() => window.open(`https://arxiv.org/search/?query=${encodeURIComponent(topic)}&searchtype=all&source=header`, '_blank')}
                    >
                      <ExternalLink className="h-3 w-3 mr-1" />
                      Search
                    </Button>
                  </div>
                </div>
                
                {/* Visual progress bar */}
                <div className="w-full bg-gray-200 rounded-full h-1.5">
                  <div 
                    className={`h-1.5 rounded-full transition-all duration-300 ${
                      index === 0 ? 'bg-blue-500' :
                      index === 1 ? 'bg-green-500' :
                      index === 2 ? 'bg-purple-500' :
                      index === 3 ? 'bg-orange-500' :
                      'bg-gray-400'
                    }`}
                    style={{ width: `${percentage}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>

        {/* Summary Statistics */}
        <div className="mt-6 pt-4 border-t border-gray-200">
          <div className="grid grid-cols-3 gap-4 text-center">
            <div>
              <div className="flex items-center justify-center mb-1">
                <BarChart3 className="h-4 w-4 text-blue-500 mr-1" />
                <span className="text-sm font-medium text-gray-900">
                  {totalPapers}
                </span>
              </div>
              <div className="text-xs text-gray-500">Total Papers</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {Object.keys(topicCounts).length}
              </div>
              <div className="text-xs text-gray-500">Categories</div>
            </div>
            <div>
              <div className="text-sm font-medium text-gray-900">
                {topTopics[0]?.[0].split(' ')[0] || 'N/A'}
              </div>
              <div className="text-xs text-gray-500">Leading</div>
            </div>
          </div>
        </div>

        {/* Research Areas Info */}
        <div className="text-xs text-gray-400 text-center pt-2 border-t border-gray-100">
          📈 Based on latest ingestion run classification results
        </div>
      </CardContent>
    </Card>
  );
}