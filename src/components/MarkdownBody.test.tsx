// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { describe, it, expect } from 'vitest';
import { MarkdownBody } from './MarkdownBody';

describe('MarkdownBody', () => {
  it('should render pipe-syntax tables as semantic <table> with header and body cells', () => {
    const source = `| Col A | Col B |\n|-------|-------|\n| one   | two   |\n| three | four  |`;
    render(<MarkdownBody source={source} />);

    expect(document.querySelector('table')).not.toBeNull();
    expect(document.querySelector('thead')).not.toBeNull();

    const headers = screen.getAllByRole('columnheader');
    expect(headers).toHaveLength(2);
    expect(headers[0]).toHaveTextContent('Col A');
    expect(headers[1]).toHaveTextContent('Col B');

    const cells = screen.getAllByRole('cell');
    expect(cells).toHaveLength(4);
    expect(cells[0]).toHaveTextContent('one');
    expect(cells[1]).toHaveTextContent('two');
    expect(cells[2]).toHaveTextContent('three');
    expect(cells[3]).toHaveTextContent('four');
  });

  it('should render strikethrough as <del>', () => {
    render(<MarkdownBody source="~~gone~~" />);
    const el = screen.getByText('gone');
    expect(el.tagName).toBe('DEL');
  });

  it('should render bare URLs as autolinks opening in a new tab', () => {
    render(<MarkdownBody source="Visit https://example.com" />);
    const link = screen.getByRole('link', { name: 'https://example.com' });
    expect(link).toHaveAttribute('href', 'https://example.com');
    expect(link).toHaveAttribute('target', '_blank');
    expect(link).toHaveAttribute('rel', 'noreferrer');
  });

  it('should still render headings with the existing Nord classes', () => {
    render(<MarkdownBody source="# Hello" />);
    const heading = screen.getByRole('heading', { level: 1 });
    expect(heading.className).toContain('text-lg');
    expect(heading.className).toContain('font-semibold');
    expect(heading.className).toContain('text-nord-6');
  });
});
