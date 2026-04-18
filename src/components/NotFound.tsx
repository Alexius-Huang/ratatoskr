import { Link, useLocation } from 'react-router-dom';

interface NotFoundProps {
  title?: string;
  description?: string;
}

export function NotFound({ title, description }: NotFoundProps) {
  const { pathname } = useLocation();

  return (
    <div className="flex-1 flex flex-col items-center justify-center p-8 text-center">
      <h1 className="text-6xl font-bold text-nord-9 mb-4">404</h1>
      <p className="text-xl text-nord-6 mb-2">{title ?? 'Page not found'}</p>
      <p className="text-sm text-nord-4 mb-6 max-w-md">
        {description ?? 'The page you requested does not exist.'}
      </p>
      <code className="text-xs text-nord-4 bg-nord-2 px-3 py-1 rounded mb-6 font-mono">
        {pathname}
      </code>
      <Link
        to="/"
        className="bg-nord-9 hover:bg-nord-8 text-nord-0 font-semibold px-4 py-2 rounded transition-colors"
      >
        Back to workspace
      </Link>
    </div>
  );
}
