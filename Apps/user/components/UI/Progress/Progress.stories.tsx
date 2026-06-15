import type { Meta, StoryObj } from '@storybook/react';
import { useEffect, useState } from 'react';
import { CircularProgress } from './CircularProgress';
import { ProgressBar } from './ProgressBar';

const meta: Meta = {
  title: 'Components/Progress',
  tags: ['autodocs'],
};

export default meta;

// ProgressBar Stories
export const BasicProgressBar: StoryObj<typeof ProgressBar> = {
  render: () => (
    <div className='space-y-4'>
      <ProgressBar value={75} />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        showValue
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        label='Loading...'
        showValue
      />
    </div>
  ),
};

export const ProgressBarSizes: StoryObj<typeof ProgressBar> = {
  render: () => (
    <div className='space-y-4'>
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        size='xs'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        size='sm'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        size='md'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        size='lg'
      />
    </div>
  ),
};

export const ProgressBarColors: StoryObj<typeof ProgressBar> = {
  render: () => (
    <div className='space-y-4'>
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        color='primary'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        color='success'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        color='warning'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        color='danger'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        color='info'
      />
    </div>
  ),
};

export const ProgressBarVariants: StoryObj<typeof ProgressBar> = {
  render: () => (
    <div className='space-y-4'>
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        variant='solid'
      />
      <ProgressBar
        value={Math.floor(Math.random() * 100)}
        variant='gradient'
      />
    </div>
  ),
};

export const IndeterminateProgressBar: StoryObj<typeof ProgressBar> = {
  render: () => (
    <div className='space-y-4'>
      <ProgressBar
        value={0}
        isIndeterminate
      />
      <ProgressBar
        value={0}
        isIndeterminate
        label='Loading...'
      />
    </div>
  ),
};

// CircularProgress Stories
export const BasicCircularProgress: StoryObj<typeof CircularProgress> = {
  render: () => (
    <div className='grid grid-cols-2 gap-8'>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Solid</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress value={Math.floor(Math.random() * 100)} />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            showValue
          />
        </div>
      </div>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Gradient</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            variant='gradient'
            showValue
          />
        </div>
      </div>
    </div>
  ),
};

export const CircularProgressSizes: StoryObj<typeof CircularProgress> = {
  render: () => (
    <div className='space-y-8'>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Solid</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={4}
            size='xs'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={6}
            size='sm'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={8}
            size='md'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={12}
            size='xl'
          />
        </div>
      </div>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Gradient</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={4}
            size='xs'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={6}
            size='sm'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={8}
            size='md'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={12}
            size='xl'
            variant='gradient'
          />
        </div>
      </div>
    </div>
  ),
};

export const CircularProgressColors: StoryObj<typeof CircularProgress> = {
  render: () => (
    <div className='space-y-8'>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Solid</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='success'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='warning'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='danger'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='info'
          />
        </div>
      </div>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Gradient</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            color='primary'
            thickness={10}
            size='lg'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            color='success'
            thickness={10}
            size='lg'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            color='warning'
            thickness={10}
            size='lg'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            color='danger'
            thickness={10}
            size='lg'
            variant='gradient'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            color='info'
            thickness={10}
            size='lg'
            variant='gradient'
          />
        </div>
      </div>
    </div>
  ),
};

export const IndeterminateCircularProgress: StoryObj<typeof CircularProgress> =
  {
    render: () => (
      <div className='space-y-8'>
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Solid</h3>
          <div className='flex items-center space-x-4'>
            <CircularProgress
              value={0}
              isIndeterminate
            />
            <CircularProgress
              value={0}
              isIndeterminate
              showValue
            />
          </div>
        </div>
        <div className='space-y-4'>
          <h3 className='text-lg font-medium'>Gradient</h3>
          <div className='flex items-center space-x-4'>
            <CircularProgress
              value={0}
              isIndeterminate
              variant='gradient'
            />
            <CircularProgress
              value={0}
              isIndeterminate
              variant='gradient'
              showValue
            />
          </div>
        </div>
      </div>
    ),
  };

export const CustomThickness: StoryObj<typeof CircularProgress> = {
  render: () => (
    <div className='space-y-8'>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Solid</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={2}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={4}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={6}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={8}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={12}
            size='lg'
            color='primary'
          />
        </div>
      </div>
      <div className='space-y-4'>
        <h3 className='text-lg font-medium'>Gradient</h3>
        <div className='flex items-center space-x-4'>
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={2}
            size='lg'
            variant='gradient'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={4}
            size='lg'
            variant='gradient'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={6}
            size='lg'
            variant='gradient'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={8}
            size='lg'
            variant='gradient'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={10}
            size='lg'
            variant='gradient'
            color='primary'
          />
          <CircularProgress
            value={Math.floor(Math.random() * 100)}
            thickness={12}
            size='lg'
            variant='gradient'
            color='primary'
          />
        </div>
      </div>
    </div>
  ),
};

export const AutoProgress: StoryObj<typeof ProgressBar> = {
  render: () => {
    const [progress, setProgress] = useState(0);

    useEffect(() => {
      const timer = setInterval(() => {
        setProgress((prevProgress) => {
          if (prevProgress >= 100) {
            clearInterval(timer);
            return 100;
          }
          return prevProgress + 5;
        });
      }, 50); // 每50ms增加1%，总共需要5秒完成

      return () => clearInterval(timer);
    }, []);

    return (
      <div className='gap-4 w-full h-full grid grid-cols-2'>
        <ProgressBar
          value={progress}
          showValue
          label='自动进度'
        />
        <ProgressBar
          value={progress}
          variant='gradient'
          color='primary'
          showValue
          label='渐变自动进度'
        />
        <CircularProgress
          value={progress}
          showValue
          size='lg'
        />
        <CircularProgress
          value={progress}
          variant='gradient'
          color='primary'
          showValue
          size='lg'
        />
      </div>
    );
  },
};
