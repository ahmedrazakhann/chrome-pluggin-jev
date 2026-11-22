import Link from 'next/link';

const NotFoundPage = () => {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-6 py-16 text-center">
      <p className="text-sm font-semibold uppercase tracking-[0.3em] text-portal-red">404 error</p>
      <h1 className="mt-4 text-4xl font-bold text-gray-900">Page not found</h1>
      <Link
        href="/"
        className="mt-8 inline-flex items-center justify-center rounded-sm bg-portal-ink px-6 py-3 text-sm font-semibold text-white transition hover:bg-black"
      >
        Go home
      </Link>
    </div>
  );
};

export default NotFoundPage;
