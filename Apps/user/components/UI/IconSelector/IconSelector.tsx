'use client';

import React, { useState, useMemo } from 'react';
import { Search, X } from 'lucide-react';
import * as LucideIcons from 'lucide-react';

// Icon categories
const iconCategories = {
  Common: [
    'home',
    'user',
    'settings',
    'search',
    'plus',
    'minus',
    'edit',
    'trash',
    'check',
    'x',
    'arrow-left',
    'arrow-right',
    'arrow-up',
    'arrow-down',
    'chevron-left',
    'chevron-right',
    'menu',
    'close',
    'heart',
    'star',
    'eye',
    'eye-off',
    'lock',
    'unlock',
    'download',
    'upload',
  ],
  Business: [
    'store',
    'shopping-cart',
    'credit-card',
    'dollar-sign',
    'trending-up',
    'trending-down',
    'bar-chart',
    'pie-chart',
    'target',
    'award',
    'gift',
    'tag',
    'ticket',
    'receipt',
    'package',
  ],
  Food: [
    'coffee',
    'utensils',
    'cake-slice',
    'pizza',
    'hamburger',
    'ice-cream',
    'wine',
    'beer',
    'milk',
    'bread',
    'apple',
    'carrot',
    'fish',
    'egg',
    'chef-hat',
    'restaurant',
  ],
  Services: [
    'wifi',
    'parking',
    'wheelchair',
    'baby',
    'dog',
    'cat',
    'smoking',
    'no-smoking',
    'air-conditioning',
    'heating',
    'tv',
    'music',
    'gamepad',
    'book',
    'newspaper',
  ],
  Transportation: [
    'car',
    'bike',
    'bus',
    'train',
    'plane',
    'ship',
    'walk',
    'map-pin',
    'navigation',
    'compass',
    'globe',
    'flag',
    'phone',
    'mail',
    'message-circle',
    'video',
  ],
  Health: [
    'heart-pulse',
    'stethoscope',
    'pill',
    'syringe',
    'bandage',
    'thermometer',
    'activity',
    'zap',
    'sun',
    'moon',
    'cloud',
    'umbrella',
    'droplets',
  ],
  Education: [
    'book-open',
    'graduation-cap',
    'school',
    'library',
    'pencil',
    'pen-tool',
    'camera',
    'video',
    'mic',
    'headphones',
    'speaker',
    'volume',
    'volume-x',
  ],
  Sports: [
    'dumbbell',
    'activity',
    'zap',
    'target',
    'flag',
    'trophy',
    'medal',
    'play',
    'pause',
    'stop',
    'skip-back',
    'skip-forward',
    'repeat',
  ],
  Others: [
    'help-circle',
    'info',
    'alert-circle',
    'alert-triangle',
    'check-circle',
    'clock',
    'calendar',
    'folder',
    'file',
    'image',
    'link',
    'share',
    'copy',
  ],
};

// Get all available Lucide icon names
const getAllLucideIconNames = () => {
  return Object.keys(LucideIcons).filter(
    (key) =>
      typeof LucideIcons[key as keyof typeof LucideIcons] === 'function' &&
      key !== 'createLucideIcon' &&
      key !== 'LucideIcon'
  );
};

// Convert PascalCase to kebab-case
const pascalToKebab = (str: string) => {
  return str.replace(/([a-z0-9]|(?=[A-Z]))([A-Z])/g, '$1-$2').toLowerCase();
};

// Convert kebab-case to PascalCase
const kebabToPascal = (str: string) => {
  return str
    .split('-')
    .map((word) => word.charAt(0).toUpperCase() + word.slice(1))
    .join('');
};

export interface IconSelectorProps {
  value?: string;
  onChange: (iconName: string) => void;
  onClose?: () => void;
  placeholder?: string;
  className?: string;
}

export const IconSelector: React.FC<IconSelectorProps> = ({
  value,
  onChange,
  onClose,
  placeholder = 'Select icon...',
  className = '',
}) => {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Common');
  const [isOpen, setIsOpen] = useState(false);

  // Get all icon names
  const allIconNames = useMemo(() => getAllLucideIconNames(), []);

  // Filter icons
  const filteredIcons = useMemo(() => {
    const searchLower = searchTerm.toLowerCase();
    const categoryIcons =
      iconCategories[selectedCategory as keyof typeof iconCategories] || [];

    if (searchTerm) {
      // Search in all icons
      return allIconNames.filter(
        (name) =>
          pascalToKebab(name).includes(searchLower) ||
          name.toLowerCase().includes(searchLower)
      );
    }

    return categoryIcons;
  }, [searchTerm, selectedCategory, allIconNames]);

  // Get icon component
  const getIconComponent = (iconName: string) => {
    const pascalName = kebabToPascal(iconName);
    return (LucideIcons as any)[pascalName] || LucideIcons.HelpCircle;
  };

  // Handle icon selection
  const handleIconSelect = (iconName: string) => {
    onChange(iconName);
    setIsOpen(false);
    setSearchTerm('');
  };

  // Handle input click
  const handleInputClick = () => {
    setIsOpen(true);
  };

  // Handle close
  const handleClose = () => {
    setIsOpen(false);
    setSearchTerm('');
    onClose?.();
  };

  return (
    <div className={`relative ${className}`}>
      {/* Input field */}
      <div
        className='flex items-center justify-between w-full px-3 py-2 border border-gray-300 rounded-md focus-within:ring-2 focus-within:ring-admin-500 focus-within:border-admin-500 cursor-pointer'
        onClick={handleInputClick}
      >
        <div className='flex items-center gap-2 flex-1'>
          {value ? (
            <>
              {React.createElement(getIconComponent(value), {
                className: 'h-4 w-4 text-gray-600',
              })}
              <span className='text-gray-900'>{value}</span>
            </>
          ) : (
            <span className='text-gray-500'>{placeholder}</span>
          )}
        </div>
        <div className='flex items-center gap-1'>
          {value && (
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                onChange('');
              }}
              className='p-1 hover:bg-gray-100 rounded'
            >
              <X className='h-3 w-3 text-gray-400' />
            </button>
          )}
        </div>
      </div>

      {/* Dropdown panel */}
      {isOpen && (
        <div
          className='absolute top-full left-0 right-0 mt-1 bg-white border border-gray-300 rounded-md shadow-lg z-50 max-h-96 overflow-hidden'
          onClick={(e) => e.stopPropagation()}
        >
          {/* Search bar */}
          <div className='p-3 border-b border-gray-200'>
            <div className='relative'>
              <Search className='absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4' />
              <input
                type='text'
                placeholder='Search icons...'
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                onClick={(e) => e.stopPropagation()}
                className='w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-admin-500 focus:border-admin-500'
                autoFocus
              />
            </div>
          </div>

          {/* Category tags */}
          {!searchTerm && (
            <div className='p-3 border-b border-gray-200'>
              <div className='wrap'>
                {Object.keys(iconCategories).map((category) => (
                  <button
                    key={category}
                    type='button'
                    onClick={(e) => {
                      e.stopPropagation();
                      setSelectedCategory(category);
                    }}
                    className={`px-3 py-1 text-xs rounded-full transition-colors ${selectedCategory === category
                        ? 'bg-admin-100 text-admin-700'
                        : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                      }`}
                  >
                    {category}
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Icon grid */}
          <div className='p-3 max-h-64 overflow-y-auto'>
            {filteredIcons.length === 0 ? (
              <div className='text-center py-8 text-gray-500'>
                <Search className='h-8 w-8 mx-auto mb-2 text-gray-300' />
                <p>No matching icons found</p>
              </div>
            ) : (
              <div className='grid grid-cols-8 gap-2'>
                {filteredIcons.map((iconName) => {
                  const IconComponent = getIconComponent(iconName);
                  const isSelected = value === iconName;

                  return (
                    <button
                      key={iconName}
                      type='button'
                      onClick={(e) => {
                        e.stopPropagation();
                        handleIconSelect(iconName);
                      }}
                      className={`p-2 rounded-md border transition-colors ${isSelected
                          ? 'border-admin-500 bg-admin-50 text-admin-700'
                          : 'border-gray-200 hover:border-gray-300 hover:bg-gray-50'
                        }`}
                      title={iconName}
                    >
                      <IconComponent className='h-5 w-5' />
                    </button>
                  );
                })}
              </div>
            )}
          </div>

          {/* Close button */}
          <div className='p-3 border-t border-gray-200'>
            <button
              type='button'
              onClick={(e) => {
                e.stopPropagation();
                handleClose();
              }}
              className='w-full px-4 py-2 text-sm font-medium text-gray-700 bg-gray-100 border border-gray-300 rounded-md hover:bg-gray-200'
            >
              Close
            </button>
          </div>
        </div>
      )}

      {/* Overlay */}
      {isOpen && <div className='fixed inset-0 z-40' onClick={handleClose} />}
    </div>
  );
};
