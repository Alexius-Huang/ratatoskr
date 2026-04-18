// @vitest-environment jsdom
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import { NotFound } from './NotFound';

function renderNotFound(props: { title?: string; description?: string } = {}, path = '/some/bad/path') {
  return render(
    <MemoryRouter initialEntries={[path]}>
      <NotFound {...props} />
    </MemoryRouter>,
  );
}

describe('NotFound', () => {
  it('should render the 404 heading and default copy', () => {
    renderNotFound();
    expect(screen.getByRole('heading', { name: '404' })).toBeInTheDocument();
    expect(screen.getByText('Page not found')).toBeInTheDocument();
    expect(screen.getByText('The page you requested does not exist.')).toBeInTheDocument();
  });

  it('should render the attempted path from the current location', () => {
    renderNotFound({}, '/some/bad/path');
    expect(screen.getByText('/some/bad/path')).toBeInTheDocument();
  });

  it('should render a custom title and description when provided', () => {
    renderNotFound({ title: 'Project not found', description: 'No such project exists.' });
    expect(screen.getByText('Project not found')).toBeInTheDocument();
    expect(screen.getByText('No such project exists.')).toBeInTheDocument();
    expect(screen.queryByText('Page not found')).not.toBeInTheDocument();
  });

  it('should render a link to the workspace root', () => {
    renderNotFound();
    const link = screen.getByRole('link', { name: /back to workspace/i });
    expect(link).toBeInTheDocument();
    expect(link).toHaveAttribute('href', '/');
  });
});
