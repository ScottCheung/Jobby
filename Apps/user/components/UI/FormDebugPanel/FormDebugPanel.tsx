'use client';

import React, { useState } from 'react';
import { useWatch } from 'react-hook-form';
import { motion, AnimatePresence } from 'framer-motion';
import { Eye, X, Copy, Check, Bug } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FormDebugPanelProps {
  control: any;
  className?: string;
}

export const FormDebugPanel: React.FC<FormDebugPanelProps> = ({
  control,
  className,
}) => {
  const [isVisible, setIsVisible] = useState(true);
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [copied, setCopied] = useState(false);

  const watchedData = useWatch({ control });

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(JSON.stringify(watchedData, null, 2));
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy:', error);
    }
  };

  const formatValue = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (typeof value === 'object') {
      if (Array.isArray(value)) {
        return `[${value.length} items]`;
      }
      return `{${Object.keys(value).length} keys}`;
    }
    if (typeof value === 'string' && value.length > 50) {
      return `"${value.substring(0, 50)}..."`;
    }
    return String(value);
  };

  const getValueType = (value: any): string => {
    if (value === null) return 'null';
    if (value === undefined) return 'undefined';
    if (Array.isArray(value)) return 'array';
    return typeof value;
  };

  const renderField = (key: string, value: any, depth: number = 0) => {
    const indent = '  '.repeat(depth);
    const formattedValue = formatValue(value);
    const valueType = getValueType(value);

    return (
      <div key={key} className='mb-1 hover:bg-gray-50 p-1 rounded'>
        <span className='text-blue-600 font-mono text-xs font-semibold'>
          {indent}
          {key}
        </span>
        <span className='text-gray-500 text-xs ml-1'>({valueType})</span>
        <span className='text-green-700 font-mono text-xs ml-2'>
          {formattedValue}
        </span>
      </div>
    );
  };

  const renderObject = (obj: any, depth: number = 0): React.ReactNode => {
    return Object.entries(obj).map(([key, value]) => {
      if (value && typeof value === 'object' && !Array.isArray(value)) {
        return (
          <div key={key} className='ml-2 border-l border-gray-200 pl-2'>
            {renderField(key, value, depth)}
            <div className='ml-4'>{renderObject(value, depth + 1)}</div>
          </div>
        );
      }
      return renderField(key, value, depth);
    });
  };

  if (!isVisible) {
    return (
      <motion.button
        initial={{ opacity: 0, scale: 0.8 }}
        animate={{ opacity: 1, scale: 1 }}
        className={cn(
          'fixed bottom-4 right-4 z-50 p-3 bg-orange-500 text-white rounded-full shadow-lg hover:bg-orange-600 transition-colors',
          className
        )}
        onClick={() => setIsVisible(true)}
        title='显示调试面板'
      >
        <Bug className='w-5 h-5' />
      </motion.button>
    );
  }

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0, x: 300 }}
        animate={{ opacity: 1, x: 0 }}
        exit={{ opacity: 0, x: 300 }}
        className={cn(
          'fixed top-4 right-4 z-50 bg-white border border-gray-200 rounded-lg shadow-xl',
          isCollapsed ? 'w-12' : 'w-80',
          className
        )}
      >
        {/* Header */}
        <div className='flex items-center justify-between p-3 border-b border-gray-200 bg-orange-50 rounded-t-lg'>
          <div className='flex items-center gap-2'>
            <Bug className='w-4 h-4 text-orange-600' />
            <span className='text-sm font-semibold text-gray-700'>
              调试面板
            </span>
            <span className='text-xs text-gray-500'>
              ({Object.keys(watchedData).length} 字段)
            </span>
          </div>
          <div className='flex items-center gap-1'>
            <button
              onClick={handleCopy}
              className='p-1 text-gray-500 hover:text-gray-700 transition-colors'
              title='复制数据'
            >
              {copied ? (
                <Check className='w-4 h-4 text-green-600' />
              ) : (
                <Copy className='w-4 h-4' />
              )}
            </button>
            <button
              onClick={() => setIsCollapsed(!isCollapsed)}
              className='p-1 text-gray-500 hover:text-gray-700 transition-colors'
              title={isCollapsed ? '展开' : '折叠'}
            >
              <div
                className={cn(
                  'w-4 h-4 border-2 border-gray-400 border-t-transparent border-l-transparent transition-transform',
                  isCollapsed ? 'rotate-45' : '-rotate-45'
                )}
              />
            </button>
            <button
              onClick={() => setIsVisible(false)}
              className='p-1 text-gray-500 hover:text-red-600 transition-colors'
              title='隐藏面板'
            >
              <X className='w-4 h-4' />
            </button>
          </div>
        </div>

        {/* Content */}
        <AnimatePresence>
          {!isCollapsed && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: 'auto', opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              className='overflow-hidden'
            >
              <div className='p-3 max-h-96 overflow-y-auto'>
                <div className='space-y-1'>
                  {Object.keys(watchedData).length === 0 ? (
                    <div className='text-gray-500 text-sm text-center py-4'>
                      暂无表单数据
                    </div>
                  ) : (
                    <div className='font-mono text-xs'>
                      {renderObject(watchedData)}
                    </div>
                  )}
                </div>
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </motion.div>
    </AnimatePresence>
  );
};
