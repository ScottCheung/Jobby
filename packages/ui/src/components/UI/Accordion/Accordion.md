<!-- @format -->

## Accordion

A highly customizable and accessible accordion component with smooth animations, keyboard navigation, and extensive styling options. Built with Framer Motion for buttery-smooth transitions and fully compatible with React applications.

## Features

- **Accessibility First**

  - Full keyboard navigation support
  - ARIA attributes for screen readers
  - Reduced motion support for users with motion sensitivity
  - Focus management for better keyboard interaction

- **Animation & Transitions**

  - Smooth height and opacity animations
  - Customizable animation duration
  - Reduced motion support
  - Optimized performance with `will-change`

- **Customization Options**

  - **Header**
    - Custom title text
    - Fully customizable styling
    - Hover and focus states
  - **Content**
    - Supports any React node as content
    - Custom content styling
    - Smooth expand/collapse transitions
  - **Icons**
    - Default chevron icon (customizable)
    - Custom icon support
    - Animated rotation on toggle

- **Interactive Features**

  - Click anywhere on header to toggle (standard mode)
  - Quick open/close mode (click anywhere on the card)
  - Disabled state support
  - Controlled and uncontrolled modes

- **Styling & Theming**
  - Uses Tailwind CSS for styling
  - Custom class names for all elements
  - Responsive design
  - Dark mode compatible

## Usage

### Basic Usage

```tsx
import { Accordion } from './UI/Components/Accordion';
// Ensure you import the Accordion component from the correct path

function App() {
  return (
    <Accordion title='Click to expand'>
      // The content to be displayed when expanded // You can put any valid
      React node as content
      <p>This is the content that will be shown when expanded.</p>
    </Accordion>
  );
}
```

### Controlled Component

```tsx
function App() {
  const [isOpen, setIsOpen] = React.useState(false);

  return (
    <Accordion
      title='Controlled Accordion'
      isOpen={isOpen}
      onChange={setIsOpen}
    >
      <p>This accordion is controlled by the parent component.</p>
    </Accordion>
  );
}
```

### With Custom Icon

```tsx
import { Settings } from 'lucide-react';

function App() {
  return (
    <Accordion title='Custom Icon' icon={<Settings className='w-4 h-4' />}>
      <p>This accordion uses a custom icon.</p>
    </Accordion>
  );
}
```

## Props

| Prop                     | Type                        | Default           | Description                                                 |
| ------------------------ | --------------------------- | ----------------- | ----------------------------------------------------------- |
| `title`                  | `string`                    | -                 | The title of the accordion header (required)                |
| `children`               | `ReactNode`                 | -                 | The content to be displayed when expanded (required)        |
| `defaultOpen`            | `boolean`                   | `false`           | Whether the accordion is open by default                    |
| `isOpen`                 | `boolean`                   | -                 | Controlled open state                                       |
| `onChange`               | `(isOpen: boolean) => void` | -                 | Callback when the open state changes                        |
| `disabled`               | `boolean`                   | `false`           | Whether the accordion is disabled                           |
| `icon`                   | `ReactNode`                 | `<ChevronDown />` | Custom icon to replace the default chevron                  |
| `quickOpenClose`         | `boolean`                   | `false`           | Whether clicking anywhere on the card toggles the accordion |
| `duration`               | `number`                    | `0.7`             | Custom transition duration in seconds                       |
| `headerClassName`        | `string`                    | -                 | Custom class for the header                                 |
| `contentClassName`       | `string`                    | -                 | Custom class for the content                                |
| `iconContainerClassName` | `string`                    | -                 | Custom class for the icon container                         |
| `className`              | `string`                    | -                 | Custom class for the root element                           |

## Accessibility

The Accordion component is built with accessibility in mind:

- Uses proper ARIA attributes (`aria-expanded`, `aria-controls`, `aria-labelledby`)
- Full keyboard navigation (Enter/Space to toggle)
- Reduced motion support
- Focus management
- Screen reader friendly
- Disabled state handling

## Styling

You can customize the appearance using the following props:

- `headerClassName`: Style the header container
- `contentClassName`: Style the content container
- `iconContainerClassName`: Style the icon container
- `className`: Style the root element

## Best Practices

1. **Use clear and concise titles** that describe the content that will be revealed.
2. **Group related accordions** together when displaying multiple items.
3. **Consider the content length** - very long content might be better suited for a separate page.
4. **Use the disabled state** when the content is not currently available.
5. **Test keyboard navigation** to ensure all interactive elements are reachable.

## Browser Support

The Accordion component works in all modern browsers and includes polyfills for:

- Edge 79+
- Firefox 70+
- Chrome 76+
- Safari 13.1+
- Opera 63+

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

If you like my Accordion component, please give me a star on [GitHub](https://github.com/xianzhezhang/xianzhe.site).

<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" data-supported-dps="24x24" fill="currentColor" class="mercado-match" width="24" height="24" focusable="false" ><path d="M20.5 2h-17A1.5 1.5 0 002 3.5v17A1.5 1.5 0 003.5 22h17a1.5 1.5 0 001.5-1.5v-17A1.5 1.5 0 0020.5 2zM8 19H5v-9h3zM6.5 8.25A1.75 1.75 0 118.3 6.5a1.78 1.78 0 01-1.8 1.75zM19 19h-3v-4.74c0-1.42-.6-1.93-1.38-1.93A1.74 1.74 0 0013 14.19a.66.66 0 000 .14V19h-3v-9h2.9v1.3a3.11 3.11 0 012.7-1.4c1.55 0 3.36.86 3.36 3.66z"></path>
