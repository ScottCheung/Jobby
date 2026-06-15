import type { Meta, StoryObj } from '@storybook/react';
import { SVGAnimation } from './StatusSVG';

const meta: Meta<typeof SVGAnimation> = {
  title: 'Components/Status SVG',
  component: SVGAnimation,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {
    icon: {
      control: {
        type: 'select',
        options: ['success', 'error', 'warning', 'info'],
      },
      description: 'The type of icon to display.',
    },
    message: {
      control: 'text',
      description: 'Optional message to display below the animation.',
    },
    withMessage: {
      control: 'boolean',
      description: 'Whether to show the message.',
    },
    withSound: {
      control: 'boolean',
      description: 'Whether to play a sound with the animation.',
    },
    className: {
      control: 'text',
      description: 'Additional CSS classes for styling the container.',
    },
  },
  args: {
    withMessage: true,
    withSound: false,
  },
};

export default meta;
type Story = StoryObj<typeof meta>;

export const Success: Story = {
  args: {
    icon: 'success',
    message: 'Payment Successful!',
  },
};

export const Error: Story = {
  args: {
    icon: 'error',
    message: 'Payment Failed!',
  },
};

export const Warning: Story = {
  args: {
    icon: 'warning',
    message: 'Please check your details.',
  },
};

export const Info: Story = {
  args: {
    icon: 'info',
    message: 'Your request is being processed.',
  },
};
