import { Badge } from '@/components/ui/badge';
import { CheckCircle, XCircle, AlertCircle, Clock } from 'lucide-react';

type StatusType = 'healthy' | 'offline' | 'warning' | 'loading';

interface StatusIndicatorProps {
  status: StatusType;
  label?: string;
  className?: string;
}

export function StatusIndicator({ status, label, className }: StatusIndicatorProps) {
  const getStatusConfig = (status: StatusType) => {
    switch (status) {
      case 'healthy':
        return {
          icon: CheckCircle,
          color: 'bg-green-100 text-green-800 border-green-200',
          dot: 'bg-green-500',
          text: 'System Healthy'
        };
      case 'offline':
        return {
          icon: XCircle,
          color: 'bg-red-100 text-red-800 border-red-200',
          dot: 'bg-red-500',
          text: 'System Offline'
        };
      case 'warning':
        return {
          icon: AlertCircle,
          color: 'bg-yellow-100 text-yellow-800 border-yellow-200',
          dot: 'bg-yellow-500',
          text: 'System Warning'
        };
      case 'loading':
        return {
          icon: Clock,
          color: 'bg-blue-100 text-blue-800 border-blue-200',
          dot: 'bg-blue-500 animate-pulse',
          text: 'Checking Status'
        };
      default:
        return {
          icon: AlertCircle,
          color: 'bg-gray-100 text-gray-800 border-gray-200',
          dot: 'bg-gray-500',
          text: 'Unknown Status'
        };
    }
  };

  const config = getStatusConfig(status);
  const Icon = config.icon;
  const displayText = label || config.text;

  return (
    <div className={`flex items-center gap-2 ${className}`}>
      <div className={`w-2 h-2 rounded-full ${config.dot}`} />
      <Badge 
        variant="secondary" 
        className={`${config.color} border`}
      >
        <Icon className="h-3 w-3 mr-1" />
        {displayText}
      </Badge>
    </div>
  );
}