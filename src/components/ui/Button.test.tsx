// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, it, expect, vi } from 'vitest';
import { Button } from './Button';

describe('Button', () => {
  it('should render children inside a button', () => {
    render(<Button variant="primary">Click me</Button>);
    expect(screen.getByRole('button', { name: 'Click me' })).toBeInTheDocument();
  });

  it('should call onClick when clicked', async () => {
    const user = userEvent.setup();
    const onClick = vi.fn();
    render(<Button variant="primary" onClick={onClick}>Click</Button>);
    await user.click(screen.getByRole('button'));
    expect(onClick).toHaveBeenCalledOnce();
  });

  it('should forward the disabled attribute', () => {
    render(<Button variant="primary" disabled>Save</Button>);
    expect(screen.getByRole('button')).toBeDisabled();
  });

  it('should default type to "button"', () => {
    render(<Button variant="primary">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'button');
  });

  it('should honor an explicit type="submit"', () => {
    render(<Button variant="primary" type="submit">Submit</Button>);
    expect(screen.getByRole('button')).toHaveAttribute('type', 'submit');
  });

  it('should apply primary variant classes', () => {
    render(<Button variant="primary">Primary</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-nord-10');
    expect(btn).toHaveClass('text-nord-6');
  });

  it('should apply sm size classes by default', () => {
    render(<Button variant="primary">Small</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-3', 'py-1.5', 'text-sm');
  });

  it('should apply md size classes when size="md"', () => {
    render(<Button variant="primary" size="md">Medium</Button>);
    expect(screen.getByRole('button')).toHaveClass('px-4', 'py-2', 'text-sm');
  });

  it('should apply tertiary variant classes when variant="tertiary"', () => {
    render(<Button variant="tertiary">Archive</Button>);
    const btn = screen.getByRole('button');
    expect(btn).toHaveClass('bg-nord-3');
    expect(btn).toHaveClass('text-nord-4');
  });

  it('should forward additional button attributes like title and aria-label', () => {
    render(
      <Button variant="secondary" title="Cancel action" aria-label="Cancel">
        Cancel
      </Button>,
    );
    const btn = screen.getByRole('button');
    expect(btn).toHaveAttribute('title', 'Cancel action');
    expect(btn).toHaveAttribute('aria-label', 'Cancel');
  });
});
