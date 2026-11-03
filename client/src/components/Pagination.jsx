import { ChevronLeft, ChevronRight } from 'lucide-react';

export function Pagination({ meta, onPageChange }) {
  if (!meta || meta.totalPages <= 1) return null;

  const { page, totalPages } = meta;
  const pages = [];
  const start = Math.max(1, Math.min(page - 1, totalPages - 2));
  const end = Math.min(totalPages, start + 2);

  for (let index = start; index <= end; index += 1) pages.push(index);

  return (
    <div className="pagination">
      <div className="pagination__controls">
        <button
          type="button"
          className="icon-button icon-button--border"
          onClick={() => onPageChange(page - 1)}
          disabled={page <= 1}
          aria-label="Previous page"
        >
          <ChevronLeft size={17} />
        </button>
        {start > 1 && (
          <>
            <button type="button" className="page-button" onClick={() => onPageChange(1)}>
              1
            </button>
            {start > 2 && <span className="page-ellipsis">…</span>}
          </>
        )}
        {pages.map((pageNumber) => (
          <button
            type="button"
            key={pageNumber}
            className={`page-button ${pageNumber === page ? 'page-button--active' : ''}`}
            onClick={() => onPageChange(pageNumber)}
            aria-current={pageNumber === page ? 'page' : undefined}
          >
            {pageNumber}
          </button>
        ))}
        {end < totalPages && (
          <>
            {end < totalPages - 1 && <span className="page-ellipsis">…</span>}
            <button
              type="button"
              className="page-button"
              onClick={() => onPageChange(totalPages)}
            >
              {totalPages}
            </button>
          </>
        )}
        <button
          type="button"
          className="icon-button icon-button--border"
          onClick={() => onPageChange(page + 1)}
          disabled={page >= totalPages}
          aria-label="Next page"
        >
          <ChevronRight size={17} />
        </button>
      </div>
    </div>
  );
}
