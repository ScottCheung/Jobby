import { cn } from '@/lib/utils';
import { motion } from 'framer-motion';
import React, { ReactNode, useEffect, useRef, useState, useCallback } from 'react';

export interface WaterfallLayoutProps {
    children: ReactNode[];
    gap?: number | { sm?: number; md?: number; lg?: number; xl?: number };
    className?: string;
    itemClassName?: string;
    minColumnWidth?: number | { sm?: number; md?: number; lg?: number; xl?: number };
    padding?: boolean;
    itemScale?: number;
}

export const WaterfallLayout: React.FC<WaterfallLayoutProps> = ({
    children,
    gap = { sm: 12, md: 16, lg: 20, xl: 24 },
    className = '',
    itemClassName = '',
    minColumnWidth = { sm: 250, md: 250, lg: 280, xl: 300 },
    padding = false,
    itemScale = 1,
}) => {
    const containerRef = useRef<HTMLDivElement>(null);
    const itemRefs = useRef<(HTMLDivElement | null)[]>([]);

    // 只需要记录容器的高度来撑开父容器，不需要记录每个 item 的 style
    const [containerHeight, setContainerHeight] = useState(0);

    // 用于防抖的 timer refs
    const resizeTimer = useRef<NodeJS.Timeout | null>(null);

    // 计算列配置 (纯函数，提取出来避免依赖)
    const getColumnConfig = useCallback((width: number) => {
        const numericGap = typeof gap === 'number' ? gap :
            width >= 1280 ? (gap as any).xl || 24 :
                width >= 1024 ? (gap as any).lg || 20 :
                    width >= 768 ? (gap as any).md || 16 :
                        (gap as any).sm || 12;

        const numericMinWidth = typeof minColumnWidth === 'number' ? minColumnWidth :
            width >= 1280 ? (minColumnWidth as any).xl || 300 :
                width >= 1024 ? (minColumnWidth as any).lg || 280 :
                    width >= 768 ? (minColumnWidth as any).md || 250 :
                        (minColumnWidth as any).sm || 200;

        const availableWidth = padding ? width - 2 * numericGap : width;
        const columnCount = Math.max(1, Math.floor((availableWidth + numericGap) / (numericMinWidth + numericGap)));
        const columnWidth = (availableWidth - (columnCount - 1) * numericGap) / columnCount;

        return { columnCount, numericGap, columnWidth };
    }, [gap, minColumnWidth, padding]);

    // 核心布局逻辑 - 直接操作 DOM，不触发 React Render
    const positionItems = useCallback(() => {
        if (!containerRef.current) return;

        const containerWidth = containerRef.current.offsetWidth;
        const { columnCount, numericGap, columnWidth } = getColumnConfig(containerWidth);

        // 记录每一列当前的堆叠高度
        const columnHeights = new Array(columnCount).fill(0);

        // 遍历所有子元素 DOM
        itemRefs.current.forEach((item) => {
            if (!item) return;

            // 1. 设置宽度 (必须先设置宽度，否则 offsetHeight 可能不准)
            // 如果有缩放，实际上我们希望内部渲染的宽度更大，然后缩小放入 columnWidth 的槽位
            // 比如 slot=200px, scale=0.8 => renderWidth = 250px
            item.style.width = `${columnWidth / itemScale}px`;

            // 2. 找到当前高度最小的那一列
            const minHeight = Math.min(...columnHeights);
            const columnIndex = columnHeights.indexOf(minHeight);

            // 3. 计算坐标
            const x = (padding ? numericGap : 0) + columnIndex * (columnWidth + numericGap);
            const y = minHeight + (minHeight > 0 ? numericGap : (padding ? numericGap : 0));

            // 4. 直接应用样式 (GPU 加速)
            // 使用 transform 代替 top/left，性能提升关键
            item.style.transform = `translate3d(${x}px, ${y}px, 0) scale(${itemScale})`;
            item.style.transformOrigin = '0 0'; // 左上角对齐
            item.style.position = 'absolute';
            item.style.top = '0'; // 重置 top
            item.style.left = '0'; // 重置 left
            // Apply proper transition here to ensure it's set even if re-renders happened differently
            // Add width to transition to smooth out scale mode changes
            item.style.transition = 'transform 1.2s cubic-bezier(0.22, 1.1, 0.36, 1), width 1.2s cubic-bezier(0.22, 1.1, 0.36, 1), opacity 1.2s ease';

            // 此时 item 已经有了宽度，读取高度 (Layout Thrashing 依然存在但被限制在必要的范围内)
            // 计算由于缩放而实际占用的高度
            const currentItemHeight = item.offsetHeight * itemScale;

            // 5. 更新列高
            columnHeights[columnIndex] = y + currentItemHeight;
        });

        // 更新容器总高度，这是唯一会触发 Re-render 的地方
        // 但我们做一个判断，只有高度变化很大时才更新，或者接受这是必要的
        const maxContentHeight = Math.max(...columnHeights) + (padding ? numericGap : 0);
        setContainerHeight(maxContentHeight);

    }, [getColumnConfig, padding, itemScale]);

    // 监听 Resize 和 Children 变化
    useEffect(() => {
        // 初始化布局
        // 使用 requestAnimationFrame 确保在下一帧渲染前执行，避免布局闪烁
        const initFrame = requestAnimationFrame(() => {
            positionItems();
        });

        const handleResize = () => {
            if (resizeTimer.current) clearTimeout(resizeTimer.current);
            resizeTimer.current = setTimeout(() => {
                positionItems();
            }, 100); // 100ms 防抖，稍微加快响应速度
        };

        const ro = new ResizeObserver(handleResize);

        // 1. 监听容器宽度变化
        if (containerRef.current) {
            ro.observe(containerRef.current);
        }

        // 2. 监听所有子元素的高度变化 (关键优化)
        itemRefs.current.forEach((item) => {
            if (item) {
                ro.observe(item);
            }
        });

        const images = containerRef.current?.getElementsByTagName('img');
        if (images) {
            Array.from(images).forEach(img => {
                if (!img.complete) {
                    img.addEventListener('load', handleResize);
                }
            });
        }

        return () => {
            cancelAnimationFrame(initFrame);
            if (resizeTimer.current) clearTimeout(resizeTimer.current);
            ro.disconnect();
            if (images) {
                Array.from(images).forEach(img => img.removeEventListener('load', handleResize));
            }
        };
    }, [children, positionItems]); // 依赖 children 变化重新布局

    return (
        <div
            ref={containerRef}
            className={cn('w-full relative', className)}
            style={{
                height: containerHeight,
                transition: 'height 1.2s cubic-bezier(0.22, 1.05, 0.36, 1)'
            }}
        >
            {React.Children.map(children, (child, index) => {
                return (
                    <div
                        ref={(el) => { itemRefs.current[index] = el }}
                        className={cn('absolute relative left-0 top-0', itemClassName)}>
                        <motion.div
                            initial={{ opacity: 0, scale: 0.95 }}
                            animate={{ opacity: 1, scale: 1 }}
                            transition={{ duration: 1, delay: 0.44 + 0.04 * (index % 30), ease: [0.22, 1.1, 0.36, 1] }}
                            className='z-10
                            '
                        >
                            {child}
                        </motion.div>
                        <motion.div
                            initial={{ opacity: 1, scale: 1 }}
                            animate={{ opacity: 0, scale: 0.95 }}
                            transition={{ duration: 3, delay: 0.44 + 0.04 * (index % 30), ease: [0.22, 1.1, 0.36, 1] }}
                            className='absolute top-0 left-0 w-full h-full rounded-card bg-panel -z-10'
                        > </motion.div>

                    </div>
                );
            })}
        </div >
    );
};
