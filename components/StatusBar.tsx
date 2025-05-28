
import React from 'react';
import { AppStatus } from '../types';
import { LoadingSpinner } from '../constants';

interface StatusBarProps {
  status: AppStatus;
  message: string | null;
}

export const StatusBar: React.FC<StatusBarProps> = ({ status, message }) => {
  const isProcessing = status !== AppStatus.IDLE && status !== AppStatus.DONE && status !== AppStatus.ERROR && status !== AppStatus.AWAITING_L1_OUTPUT;

  let statusColor = 'text-gray-400';
  if (status === AppStatus.DONE) statusColor = 'text-green-400';
  if (status === AppStatus.ERROR) statusColor = 'text-red-400';
  if (isProcessing) statusColor = 'text-yellow-400';


  return (
    <div className="fixed bottom-0 left-0 right-0 bg-gray-800 border-t border-gray-700 p-2 px-4 text-sm flex items-center justify-between shadow-lg">
      <div className="flex items-center">
        {isProcessing && <LoadingSpinner />}
        <span className={`font-semibold ${statusColor} ${isProcessing ? 'ml-2' : ''}`}>Status: {status}</span>
      </div>
      {message && (
        <span className={`truncate max-w-md ${status === AppStatus.ERROR ? 'text-red-400' : 'text-gray-300'}`}>
          {message}
        </span>
      )}
    </div>
  );
};
