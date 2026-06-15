<!-- @format -->

import { Canvas, Meta, Story } from '@storybook/blocks';
import * as AvatarStories from './Avatar.stories';

<Meta of={AvatarStories} />

# Avatar

A highly customizable avatar component with multiple display modes, status indicators, and extensive styling options. Built with Framer Motion for smooth animations and fully compatible with React applications.

<Canvas of={AvatarStories.Default} />

## Features

- **Multiple Display Modes**

  - Display user images with automatic alt text generation
  - Show user initials with auto-generated background colors
  - Fallback to a default user icon when no image or name is provided

- **Sizing Options**
  - Predefined sizes: `sm`, `md`, `lg`, `xl`
  - Fully customizable dimensions using Tailwind classes
  - Responsive sizing with breakpoints

<Canvas>
  <Story of={AvatarStories.DifferentSizeAvatar} />
</Canvas>

- **Status Indicators**
  - Online: `Green` dot indicator
  - Offline: `Gray` dot indicator
  - Away: `Yellow` dot indicator
  - Busy: `Red` dot indicator
  - Customizable position and size

<Canvas>
  <Story of={AvatarStories.AvatarWithDifferentStatuses} />
</Canvas>

- **Message Badge**
  - Display message count with automatic 99+ truncation
  - Gradient background
  - Customizable position and styling
  - White border for better contrast

<Canvas>
  <Story of={AvatarStories.AvatarWithDifferentMessage} />
</Canvas>

- **Styling & Customization**
  - Background Colors
    - Auto-generated from user name
    - Custom background color support
  - Ring Effects
    - Customizable ring color
    - Configurable ring width
  - Border Options
    - Toggleable border
    - Custom border color support

<Canvas>
  <Story of={AvatarStories.WithRing} />
</Canvas>

## Usage

### Basic Usage

```tsx
import { Avatar } from './UI/Components/Avatar';

function App() {
  return <Avatar name='John Doe' src='/path/to/image.jpg' />;
}
```

### With Status Indicator

```tsx
function App() {
  return (
    <div className='flex gap-4'>
      <Avatar name='Online User' status='online' />
      <Avatar name='Away User' status='away' />
      <Avatar name='Busy User' status='busy' />
      <Avatar name='Offline User' status='offline' />
    </div>
  );
}
```

### With Message Badge

```tsx
function App() {
  return (
    <Avatar
      name='John Doe'
      src='/path/to/image.jpg'
      message={5}
      status='online'
    />
  );
}
```

## Props

| Prop          | Type                                        | Default              | Description                                                 |
| ------------- | ------------------------------------------- | -------------------- | ----------------------------------------------------------- |
| `name`        | `string`                                    | -                    | The name used for generating initials and alt text          |
| `src`         | `string`                                    | -                    | The image source URL                                        |
| `alt`         | `string`                                    | -                    | Alt text for the image (falls back to name if not provided) |
| `size`        | `'sm' \| 'md' \| 'lg' \| 'xl'`              | `'md'`               | Predefined size of the avatar                               |
| `customSize`  | `string`                                    | -                    | Custom size using Tailwind classes (e.g., `'w-12 h-12'`)    |
| `status`      | `'online' \| 'offline' \| 'away' \| 'busy'` | -                    | Status indicator                                            |
| `bordered`    | `boolean`                                   | `false`              | Add a white border around the avatar                        |
| `ring`        | `boolean`                                   | `false`              | Add a colored ring around the avatar                        |
| `ringColor`   | `string`                                    | `'ring-primary-500'` | Custom ring color                                           |
| `borderColor` | `string`                                    | `'border-gray-400'`  | Custom border color                                         |
| `bgColor`     | `string`                                    | -                    | Custom background color                                     |
| `message`     | `number`                                    | -                    | Message count to display as a badge                         |
| `className`   | `string`                                    | -                    | Additional CSS classes for the root element                 |

## Examples

### Different Sizes

<Canvas>
  <Story of={AvatarStories.Small} />
  <Story of={AvatarStories.Default} />
  <Story of={AvatarStories.Large} />
</Canvas>

### With Border

<Canvas of={AvatarStories.WithBorder} />

### Without Image (Auto Background)

<Canvas of={AvatarStories.WithAutoBackground} />

## Accessibility

The Avatar component is built with accessibility in mind:

- Automatically generates alt text from the name prop
- Includes proper ARIA attributes
- Supports keyboard navigation
- Ensures proper color contrast for text and status indicators

## Styling

You can customize the appearance using the following props:

- `className`: Style the root element
- `bgColor`: Set a custom background color
- `ringColor`: Customize the ring color
- `borderColor`: Set a custom border color
- `customSize`: Apply custom dimensions using Tailwind classes

### Customizing with CSS

```tsx
<Avatar
  className="custom-avatar"
  name="John Doe"
/>

// In your CSS:
.custom-avatar {
  --avatar-ring-color: theme('colors.blue.500');
  --avatar-border-color: theme('colors.gray.200');
}
```

## Best Practices

1. **Always provide a name** for better accessibility and fallback content
2. **Use appropriate image sizes** for optimal performance
3. **Consider the context** when choosing between different status indicators
4. **Test with different background colors** to ensure text remains readable
5. **Use the message badge sparingly** to avoid overwhelming the user
6. **Provide alt text** for better accessibility when using images

## Browser Support

The Avatar component works in all modern browsers and includes proper fallbacks:

- Chrome (latest)
- Firefox (latest)
- Safari (latest)
- Edge (latest)
- Mobile Safari (iOS)
- Chrome for Android

## Contributing

If you'd like to contribute to this component, please follow these steps:

1. Fork the repository
2. Create a new branch for your feature
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request

## License

This component is open source and available under the [MIT License](https://opensource.org/licenses/MIT).

---

If you like my Avatar component, please give me a star on [GitHub](https://github.com/xianzhezhang/xianzhe.site).
