// AnimatedNumber.stories.tsx
import { Button } from '@/stories/Components/Button/Button';
import { Slider } from '@/stories/Components/Slider/Slider';
import { Meta, StoryObj } from '@storybook/react';
import { useCallback, useEffect, useState } from 'react';
import { Number } from './Number';

const meta: Meta<typeof Number> = {
  title: 'Components/Number',
  component: Number,
  tags: ['autodocs'],
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: `
## AnimatedNumber

A highly customizable animated number display component with multiple formatting options and smooth transitions.

### Features
- Supports currency, percentages, decimal and standard formats
- Multiple animation types: flip, slide, and fade effects
- Configurable size for different parts of the number display
- Short format option for large numbers (1.2M instead of 1,200,000)
- Scientific and engineering notation support
`,
      },
      source: {
        language: 'tsx',
        code: `
import { AnimatedNumber } from './AnimatedNumber';

// Basic usage
<AnimatedNumber value={1234.56} />

// Advanced customization
<AnimatedNumber
  value={value}
  format="decimal"
  useShortFormat={true}
  numberType="standard"
  animation="slide"
  duration={0.5}
  decimalPlaces={1}
  currencySymbolSize="0.8em"
  integerPartSize="1.2em"
  decimalPartSize="0.8em"
  suffixSize="0.8em"
/>
        `,
      },
    },
  },
  argTypes: {
    value: {
      control: { type: 'number', min: 0, max: 10000000, step: 1 },
      description: 'The numeric value to display',
      table: {
        type: { summary: 'number | string' },
        defaultValue: { summary: '0' },
        category: 'Data',
      },
    },
    prefix: {
      control: { type: 'text' },
      description: 'Prefix to be displayed before the number',
      table: {
        defaultValue: { summary: '' },
        category: 'Data',
      },
    },
    suffix: {
      control: { type: 'text' },
      description: 'Suffix to be displayed after the number',
      table: {
        defaultValue: { summary: '' },
        category: 'Data',
      },
    },
    locale: {
      control: { type: 'text' },
      description: 'Locale for number formatting',
      table: {
        defaultValue: { summary: 'en-US' },
        category: 'Data',
      },
    },
    format: {
      options: ['none', 'currency', 'percentage', 'decimal'],
      control: { type: 'radio' },
      description: 'Number formatting style',
      table: {
        defaultValue: { summary: 'none' },
        category: 'Formatting',
      },
    },
    animation: {
      options: ['flip', 'slide', 'fade', 'none'],
      control: { type: 'radio' },
      description: 'Animation type for number transitions',
      table: {
        defaultValue: { summary: 'slide' },
        category: 'Animation',
      },
    },
    duration: {
      control: { type: 'range', min: 0.1, max: 2, step: 0.1 },
      description: 'Animation duration in seconds',
      table: {
        defaultValue: { summary: '0.5' },
        category: 'Animation',
      },
    },
    delayPerChar: {
      control: { type: 'range', min: 0, max: 1, step: 0.01 },
      description: 'Delay per character in seconds',
      table: {
        defaultValue: { summary: '0.05' },
        category: 'Animation',
      },
    },
    decimalPlaces: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Number of decimal places',
      if: { arg: 'useShortFormat', eq: false },
      table: {
        defaultValue: { summary: '2' },
        category: 'Formatting',
      },
    },
    commaWidth: {
      control: { type: 'text' },
      description: 'Width of comma in em',
      table: {
        defaultValue: { summary: '0.4em' },
        category: 'Sizing',
      },
    },
    currencySymbolSize: {
      control: { type: 'text' },
      description: 'Size of currency symbol (CSS value)',
      table: {
        defaultValue: { summary: '0.8em' },
        category: 'Sizing',
      },
    },
    integerPartSize: {
      control: { type: 'text' },
      description: 'Size of integer part (CSS value)',
      table: {
        defaultValue: { summary: '1.2em' },
        category: 'Sizing',
      },
    },
    decimalPartSize: {
      control: { type: 'text' },
      description: 'Size of decimal part (CSS value)',
      table: {
        defaultValue: { summary: '0.8em' },
        category: 'Sizing',
      },
    },
    suffixSize: {
      control: { type: 'text' },
      description: 'Size of suffix (CSS value)',
      table: {
        defaultValue: { summary: '0.8em' },
        category: 'Sizing',
      },
    },
    useShortFormat: {
      control: 'boolean',
      description:
        'Use short format for large numbers (1.2M instead of 1,200,000)',
      table: {
        defaultValue: { summary: 'false' },
        category: 'Formatting',
      },
    },
    numberType: {
      options: ['standard', 'engineering', 'scientific'],
      control: { type: 'radio' },
      description: 'Number notation type for formatting',
      if: { arg: 'useShortFormat', eq: false },
      table: {
        defaultValue: { summary: 'standard' },
        category: 'Formatting',
      },
    },
    currencyType: {
      options: ['CNY', 'AUD', 'USD', 'EUR', 'GBP', 'JPY', 'NZD', 'VND'],
      control: { type: 'radio' },
      if: { arg: 'format', eq: 'currency' },
      description: 'Currency type for formatting',
      table: {
        defaultValue: { summary: 'AUD' },
        category: 'Formatting',
      },
    },
    maxNumberPlaces: {
      control: { type: 'range', min: 0, max: 10, step: 1 },
      description: 'Maximum number of decimal places',
      if: { arg: 'useShortFormat', eq: true },
      table: {
        defaultValue: { summary: '2' },
        category: 'Formatting',
      },
    },
  },
};

export default meta;

type Story = StoryObj<typeof Number>;

// 代码展示组件
const CodeBlock = ({
  code,
  language = 'tsx',
}: {
  code: string;
  language?: string;
}) => (
  <div className='relative bg-gray-800 rounded-md p-4 mt-4'>
    <pre className='text-gray-100 text-sm font-mono overflow-x-auto'>
      <code>{code}</code>
    </pre>
    <div className='absolute top-2 right-2'>
      {/* <CopyButton text={code} /> */}
    </div>
  </div>
);

// 交互式演示组件
const InteractiveDemo = (props: any) => {
  // 使用props.value作为初始值，确保从Storybook控件传入的值能被正确使用
  const [value, setValue] = useState(props.value || 1234567.89);
  const [inputValue, setInputValue] = useState(value.toString());

  // 当props.value从Storybook控件更新时，同步更新内部状态
  useEffect(() => {
    if (props.value !== undefined && props.value !== value) {
      setValue(props.value);
      setInputValue(props.value.toString());
    }
  }, [props.value]);

  const handleChange = useCallback((newValue: number) => {
    setValue(newValue);
    setInputValue(newValue.toString());
  }, []);

  // Generate formatted demo code
  const generateCode = (format: string) => {
    switch (format) {
      case 'react':
        return `
<AnimatedNumber
  value={${value}}
  format="${props.format || 'none'}"
  animation="${props.animation || 'slide'}"
  duration={${props.duration || 0.5}}
  decimalPlaces={${props.decimalPlaces || 2}}
  ${props.currencyType ? `currencyType="${props.currencyType}"` : ''}
  ${props.numberType !== 'standard' ? `numberType="${props.numberType}"` : ''}
  ${props.useShortFormat ? 'useShortFormat={true}' : 'useShortFormat={false}'}
/>`;
      case 'vue':
        return `
<animated-number
  :value="${value}"
  format="${props.format || 'none'}"
  animation="${props.animation || 'slide'}"
  :duration="${props.duration || 0.5}"
  :decimal-places="${props.decimalPlaces || 2}"
  ${props.currencyType ? `currency-type="${props.currencyType}"` : ''}
  ${props.numberType !== 'standard' ? `number-type="${props.numberType}"` : ''}
  ${
    props.useShortFormat
      ? ':use-short-format="true"'
      : ':use-short-format="false"'
  }
/>`;
      case 'angular':
        return `
<app-animated-number
  [value]="${value}"
  format="${props.format || 'none'}"
  animation="${props.animation || 'slide'}"
  [duration]="${props.duration || 0.5}"
  [decimalPlaces]="${props.decimalPlaces || 2}"
  ${props.currencyType ? `currencyType="${props.currencyType}"` : ''}
  ${props.numberType !== 'standard' ? `numberType="${props.numberType}"` : ''}
  ${
    props.useShortFormat
      ? '[useShortFormat]="true"'
      : '[useShortFormat]="false"'
  }
>
</app-animated-number>`;
      default:
        return '';
    }
  };

  return (
    <div className='space-y-8 min-w-[600px]'>
      {/* 组件展示 */}
      <div className='border p-[28px] space-y-8 rounded-[28px] bg-background text-center'>
        <div className='flex items-center justify-center'>
          <Number
            value={value}
            format={props.format}
            animation={props.animation}
            duration={props.duration}
            decimalPlaces={props.decimalPlaces}
            currencyType={props.currencyType}
            numberType={props.numberType}
            useShortFormat={props.useShortFormat}
            maxNumberPlaces={props.maxNumberPlaces}
            delayPerChar={props.delayPerChar}
            prefix={props.prefix}
            suffix={props.suffix}
            locale={props.locale}
            suffixSize={props.suffixSize || '1.5em'}
            integerPartSize={props.integerPartSize || '1.2em'}
            decimalPartSize={props.decimalPartSize || '1em'}
            currencySymbolSize={props.currencySymbolSize || '1em'}
            commaWidth={props.commaWidth || '0em'}
          />
        </div>

        <div className='mb-6 text-lg text-gray-500'>
          Current Value: {value.toLocaleString()}
        </div>
        <div className='grid grid-cols-2 md:grid-cols-4 gap-4'>
          <Button
            onClick={() => handleChange(value + 1)}
            variant='primary'
          >
            +1
          </Button>
          <Button
            onClick={() => handleChange(value - 1)}
            variant='primary'
          >
            -1
          </Button>
          <Button
            onClick={() => handleChange(value + 10)}
            variant='primary'
          >
            +10
          </Button>
          <Button
            onClick={() => handleChange(value - 10)}
            variant='primary'
          >
            -10
          </Button>

          <Button
            onClick={() => handleChange(value * 10)}
            variant='primary'
          >
            ×10
          </Button>
          <Button
            onClick={() => handleChange(value / 10)}
            variant='primary'
          >
            ÷10
          </Button>
          <Button
            onClick={() => handleChange(-value)}
            variant='primary'
          >
            ± Toggle
          </Button>
          <Button
            onClick={() => handleChange(499.45)}
            variant='primary'
          >
            Reset
          </Button>
        </div>

        <div className='flex items-center gap-4 w-full'>
          <Slider
            value={value}
            min={0}
            max={10000}
            step={1}
            // onChange={handleChange(value)}
            defaultValue={value}
            onValueChange={(value: number) => handleChange(value)}
            className='w-full'
          />
        </div>

        <div className='flex items-center gap-4 w-full'>
          <span className='text-sm text-gray-500 whitespace-nowrap'>
            Custom Value:
          </span>
          <input
            type='number'
            value={inputValue}
            onChange={(e) => {
              setInputValue(e.target.value);
              const parsed = parseFloat(e.target.value);
              if (!isNaN(parsed)) handleChange(parsed);
            }}
            className='text-lg rounded-[14px] w-full'
          />
        </div>
      </div>
    </div>
  );
};

// 基础示例
export const Interactive: Story = {
  render: (args) => <InteractiveDemo {...args} />,
  args: {
    value: 499,
    format: 'currency',
    animation: 'slide',
    duration: 2,
    decimalPlaces: 0,
    maxNumberPlaces: 0,
    useShortFormat: false,
    numberType: 'standard',
    currencyType: 'CNY',
    currencySymbolSize: '1.2em',
    commaWidth: '0.2em',
  },
};

export const Percentage: Story = {
  args: {
    value: 0.7532,
    format: 'percentage',
    animation: 'slide',
    duration: 0.5,
    decimalPlaces: 2,
    currencySymbolSize: '2em',
    integerPartSize: '2em',
    decimalPartSize: '2em',
    suffixSize: '2em',
    commaWidth: '0.2em',
    useShortFormat: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Display animated numbers with percentage formatting.',
      },
    },
  },
};

export const ShortFormat: Story = {
  args: {
    value: 1234,
    format: 'none',
    useShortFormat: true,
    animation: 'slide',
    duration: 0.5,
    decimalPlaces: 1,
    maxNumberPlaces: 3,
    currencySymbolSize: '2em',
    integerPartSize: '2em',
    decimalPartSize: '2em',
    suffixSize: '2em',
    commaWidth: '0.2em',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Display large numbers in a compact format (1.2M instead of 1,200,000).',
      },
    },
  },
};

export const Animation: Story = {
  args: {
    value: 22549.56,
    format: 'none',
    animation: 'slide',
    duration: 0.8,
    decimalPlaces: 2,
    currencySymbolSize: '2em',
    integerPartSize: '2em',
    decimalPartSize: '2em',
    suffixSize: '2em',
    commaWidth: '0.2em',
    delayPerChar: 0.07,
    useShortFormat: false,
    numberType: 'standard',
  },
  parameters: {
    docs: {
      description: {
        story: 'Display numbers with a flip animation effect.',
      },
    },
  },
  render: (args) => <Number {...args} />,
};

export const FadeAnimation: Story = {
  args: {
    value: 1234.56,
    format: 'none',
    animation: 'fade',
    duration: 0.5,
    decimalPlaces: 2,
  },
  parameters: {
    docs: {
      description: {
        story: 'Display numbers with a fade animation effect.',
      },
    },
  },
};

export const ScientificNotation: Story = {
  args: {
    value: 1234567,
    format: 'decimal',
    numberType: 'scientific',
    animation: 'slide',
    duration: 0.5,
    decimalPlaces: 2,
    currencySymbolSize: '2em',
    integerPartSize: '2em',
    decimalPartSize: '2em',
    suffixSize: '2em',
    commaWidth: '0.2em',
  },
  parameters: {
    docs: {
      description: {
        story: 'Display numbers in scientific notation (1.23e+6).',
      },
    },
  },
};

export const EngineeringNotation: Story = {
  args: {
    value: 1234567,
    format: 'decimal',
    numberType: 'engineering',
    animation: 'slide',
    duration: 0.5,
    decimalPlaces: 2,
    currencySymbolSize: '2em',
    integerPartSize: '2em',
    decimalPartSize: '2em',
    suffixSize: '2em',
    commaWidth: '0.2em',
  },
  parameters: {
    docs: {
      description: {
        story:
          'Display numbers in engineering notation with exponents in multiples of 3.',
      },
    },
  },
};

export const Currency: Story = {
  args: {
    value: 499.45,
    format: 'currency',
    animation: 'slide',
    duration: 0.5,
    decimalPlaces: 2,
    maxNumberPlaces: 3,
    useShortFormat: false,
    numberType: 'standard',
    currencyType: 'AUD',
    currencySymbolSize: '1.2em',
    commaWidth: '0.24em',
    integerPartSize: '1.6em',
    decimalPartSize: '1.2em',
    prefix: '',
    suffix: '/ pcs',
    suffixSize: '0.7em',
    delayPerChar: 0.05,
  },

  render: (args) => <InteractiveDemo {...args} />,
};
