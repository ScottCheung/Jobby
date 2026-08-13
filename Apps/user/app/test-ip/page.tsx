'use client';
import { EmptyPlaceHolder, IPEmotion } from '@jobby/ui';

import React, { useState } from 'react';

const EMOTION_LABELS = [
  '0: 招呼简历 (Hello)',
  '1: 放大镜搜索 (Search)',
  '2: 满屏文件 (Busy)',
  '3: 爱心/特别关注 (Love)',
  '4: 耳机/客服沟通 (Support)',
  '5: 加油/看简历 (Cheer)',
  '6: 满分A+ (Success)',
  '7: 获得RESUME (Resume Got)',
  '8: 正在书写 (Writing)',
  '9: 电话沟通 (Call)',
  '10: 思考/指向 (Point)',
  '11: 摇铃通知 (Notice)',
  '12: 戴眼镜图表 (Analytics)',
  '13: 绑头带举旗 (Goal)',
  '14: 举奖杯庆祝 (Trophy)',
  '15: 托腮思考齿轮 (Settings)',
];

export default function TestIPPage() {
  const [selectedId, setSelectedId] = useState<number>(1);
  const [size, setSize] = useState<number>(160);

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 md:p-10 font-sans">
      <div className="max-w-6xl mx-auto space-y-8">
        {/* Header */}
        <div className="border-b border-slate-800 pb-6 flex flex-col md:flex-row justify-between items-start md:items-center gap-4">
          <div>
            <h1 className="text-2xl font-bold text-white tracking-wide flex items-center gap-3">
              <span>🐻</span> IP 表情 (IPEmotion) 测试与预览
            </h1>
            <p className="text-sm text-slate-400 mt-1">
              测试 16 个 SVG Sprite 网格表情以及在 EmptyPlaceHolder 中的渲染效果
            </p>
          </div>
        </div>

        {/* Selected Highlight & Playground */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {/* Card 1: 实时调试 / 单独预览 */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col items-center justify-between shadow-xl">
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 bg-indigo-500/20 text-indigo-300 rounded-lg border border-indigo-500/30">
                单个表情预览 (ID: {selectedId})
              </span>
              <span className="text-xs text-slate-400">{EMOTION_LABELS[selectedId]}</span>
            </div>

            <div
              className="flex items-center justify-center p-6 rounded-xl bg-slate-950/80 border border-slate-800 transition-all overflow-hidden"
              style={{ width: `${size + 40}px`, height: `${size + 40}px` }}
            >
              <IPEmotion
                emotionId={selectedId}
                style={{ width: `${size}px`, height: `${size}px` }}
                className="transition-transform hover:scale-105"
              />
            </div>

            <div className="w-full mt-6 space-y-3">
              <div className="flex items-center justify-between text-xs text-slate-400">
                <span>尺寸调节: {size}px</span>
                <input
                  type="range"
                  min="48"
                  max="240"
                  value={size}
                  onChange={(e) => setSize(Number(e.target.value))}
                  className="w-40 accent-indigo-500 cursor-pointer"
                />
              </div>
            </div>
          </div>

          {/* Card 2: 在 EmptyPlaceHolder 中测试 */}
          <div className="bg-slate-900 rounded-2xl border border-slate-800 p-6 flex flex-col justify-between shadow-xl">
            <div className="w-full flex justify-between items-center mb-4">
              <span className="text-xs font-semibold px-2.5 py-1 bg-emerald-500/20 text-emerald-300 rounded-lg border border-emerald-500/30">
                EmptyPlaceHolder 真实应用组件效果
              </span>
            </div>

            <div className="bg-slate-950 rounded-xl p-4 border border-slate-800">
              <EmptyPlaceHolder
                icon={(props) => (
                  <IPEmotion emotionId={selectedId} {...props} />
                )}
                title={`当前占位表情: ID ${selectedId}`}
                description="这是一个在 EmptyPlaceHolder 中组合使用 IPEmotion 的实时演示。"
              />
            </div>

            <div className="text-xs text-slate-500 mt-4 text-center">
              使用: <code className="text-indigo-300 bg-slate-950 px-1.5 py-0.5 rounded">&lt;IPEmotion emotionId=&#123;{selectedId}&#125; /&gt;</code>
            </div>
          </div>
        </div>

        {/* Grid of All 16 Emotions */}
        <div className="space-y-4">
          <h2 className="text-lg font-semibold text-white flex items-center gap-2">
            <span>🎨</span> 全部 16 个表情网格 (点击切换)
          </h2>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            {EMOTION_LABELS.map((label, index) => {
              const isSelected = selectedId === index;
              return (
                <button
                  key={index}
                  onClick={() => setSelectedId(index)}
                  className={`group relative p-4 rounded-xl border text-left transition-all flex flex-col items-center justify-between gap-3 overflow-hidden ${
                    isSelected
                      ? 'bg-indigo-600/20 border-indigo-500 shadow-lg shadow-indigo-500/10 ring-2 ring-indigo-500/30'
                      : 'bg-slate-900 border-slate-800 hover:bg-slate-850 hover:border-slate-700'
                  }`}
                >
                  <div className="absolute top-2 left-2 text-[10px] font-mono px-1.5 py-0.5 rounded bg-slate-950 text-slate-400 border border-slate-800">
                    ID: {index}
                  </div>

                  <div className="pt-4 pb-2 flex items-center justify-center">
                    <IPEmotion
                      emotionId={index}
                      className={`w-20 h-20 transition-transform group-hover:scale-110 ${
                        isSelected ? 'scale-105' : ''
                      }`}
                    />
                  </div>

                  <span className="text-xs text-slate-300 font-medium text-center truncate w-full">
                    {label.split(' ')[1] || label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
