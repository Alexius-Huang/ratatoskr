// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { EPIC_PALETTE } from '../lib/epicColor';
import { EpicColorSwatchButton } from './EpicColorSwatchButton';

describe('EpicColorSwatchButton', () => {
  it('should render a filled circle when a color is set', () => {
    const { container } = render(
      <EpicColorSwatchButton epicNumber={1} color="#A3BE8C" onChange={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    expect(btn.style.backgroundColor).toBe('rgb(163, 190, 140)');
  });

  it('should reflect the deterministic default color when no explicit color is set', () => {
    const { container } = render(
      <EpicColorSwatchButton epicNumber={1} onChange={vi.fn()} />,
    );
    const btn = container.querySelector('button') as HTMLButtonElement;
    // Should be filled (not transparent)
    expect(btn.style.backgroundColor).not.toBe('transparent');
    expect(btn.style.backgroundColor).not.toBe('');
  });

  it('should open the palette popover on click', async () => {
    const user = userEvent.setup();
    render(<EpicColorSwatchButton epicNumber={1} onChange={vi.fn()} />);
    const btn = screen.getByRole('button');
    await user.click(btn);
    // All 12 palette swatches are visible
    for (const hex of EPIC_PALETTE) {
      expect(screen.getByLabelText(hex)).toBeDefined();
    }
    expect(screen.getByText('Reset to default')).toBeDefined();
  });

  it('should call onChange with the selected hex when a swatch is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicColorSwatchButton epicNumber={1} onChange={onChange} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByLabelText('#BF616A'));
    expect(onChange).toHaveBeenCalledWith('#BF616A');
  });

  it('should call onChange(null) when Reset to default is clicked', async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    render(<EpicColorSwatchButton epicNumber={1} color="#A3BE8C" onChange={onChange} />);
    await user.click(screen.getByRole('button'));
    await user.click(screen.getByText('Reset to default'));
    expect(onChange).toHaveBeenCalledWith(null);
  });

  it('should stop click propagation to prevent triggering row onClick', async () => {
    const user = userEvent.setup();
    const rowClick = vi.fn();
    render(
      <div role="button" onClick={rowClick}>
        <EpicColorSwatchButton epicNumber={1} onChange={vi.fn()} />
      </div>,
    );
    await user.click(screen.getByRole('button', { name: /epic color/i }));
    expect(rowClick).not.toHaveBeenCalled();
  });
});
