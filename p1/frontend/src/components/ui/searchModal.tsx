'use client';
import { Fragment, useState } from 'react';
import { ChevronLeft, ChevronRight, MousePointerClick, RotateCcw, Search, X } from 'lucide-react';
import { SearchModalProps } from '@app-types/ui';
import Modal from '@components/ui/modal';
import PortalButton from '@components/ui/portalButton';
import { INPUT_CLASS } from '@constants/styles';

const PAGE_SIZE = 10;

// Lookup popup: filter fields ("— OR —" between them), Search / Reset, results table with a select action.
// The body mounts fresh on every open, so each search starts empty.
function SearchModal<T>(props: SearchModalProps<T>) {
  return props.open ? <SearchModalBody {...props} /> : null;
}

function SearchModalBody<T>({ open, title, filters, columns, rows, rowKey, matches, onSelect, onClose }: SearchModalProps<T>) {
  const emptyValues = () => Object.fromEntries(filters.map(filter => [filter.name, '']));
  const [values, setValues] = useState<Record<string, string>>(emptyValues);
  const [results, setResults] = useState<T[] | null>(null);
  const [page, setPage] = useState(0);
  const [message, setMessage] = useState('');

  const runSearch = () => {
    const active = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, value.trim()]));
    if (!Object.values(active).some(Boolean)) {
      setMessage('Enter at least one search value.');
      setResults(null);
      return;
    }
    setMessage('');
    setPage(0);
    setResults(rows.filter(row => matches(row, active)));
  };

  const reset = () => {
    setValues(emptyValues());
    setResults(null);
    setMessage('');
  };

  const pageCount = results ? Math.max(1, Math.ceil(results.length / PAGE_SIZE)) : 1;
  const pageRows = results ? results.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE) : [];

  return (
    <Modal
      open={open}
      title={title}
      onClose={onClose}
      size="xl"
      footer={
        <PortalButton onClick={onClose} startIcon={<X size={14} />}>
          Close
        </PortalButton>
      }
    >
      <form
        className="p-4"
        onSubmit={event => {
          event.preventDefault();
          runSearch();
        }}
      >
        <h3 className="mb-3 text-[13px] font-bold text-portal-red">Search</h3>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-center">
          {filters.map((filter, index) => (
            <Fragment key={filter.name}>
              {index > 0 ? <span className="text-center text-[12px] text-gray-500">— OR —</span> : null}
              <label className="flex flex-1 flex-col gap-1 md:flex-row md:items-center md:gap-2">
                <span className="text-[12px] text-portal-label md:whitespace-nowrap">{filter.label}:</span>
                {filter.type === 'select' ? (
                  <select
                    name={`search-${filter.name}`}
                    value={values[filter.name] ?? ''}
                    onChange={event => setValues({ ...values, [filter.name]: event.target.value })}
                    className={INPUT_CLASS}
                  >
                    <option value="">[Please Select]</option>
                    {filter.options?.map(option => (
                      <option key={option.value} value={option.value}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                ) : (
                  <input
                    name={`search-${filter.name}`}
                    type="text"
                    autoFocus={index === 0}
                    value={values[filter.name] ?? ''}
                    onChange={event => setValues({ ...values, [filter.name]: event.target.value })}
                    className={INPUT_CLASS}
                  />
                )}
              </label>
            </Fragment>
          ))}
        </div>
        <div className="mt-3 flex justify-center gap-2">
          <PortalButton type="submit" variant={results ? 'orange' : 'dark'} startIcon={<Search size={14} />} className="min-w-28">
            Search
          </PortalButton>
          <PortalButton onClick={reset} startIcon={<RotateCcw size={14} />} className="min-w-28">
            Reset
          </PortalButton>
        </div>
        {message ? (
          <p role="alert" className="mt-3 text-center text-[12px] text-portal-red">
            {message}
          </p>
        ) : null}
      </form>

      {results ? (
        <div className="border-t border-portal-line px-4 pb-4 pt-3">
          <h3 className="mb-2 text-[13px] font-bold text-portal-red">Results</h3>
          {results.length === 0 ? (
            <p className="py-6 text-center text-[13px] text-gray-500">No records found. Try a different search.</p>
          ) : (
            <>
              <div className="overflow-x-auto">
                <table className="w-full min-w-[520px] text-left text-[12px]">
                  <thead>
                    <tr className="bg-gray-100 text-gray-700">
                      {columns.map(column => (
                        <th key={column.key} className="px-3 py-2 font-semibold">
                          {column.label}
                        </th>
                      ))}
                      <th className="px-3 py-2 font-semibold">Action</th>
                    </tr>
                  </thead>
                  <tbody>
                    {pageRows.map(row => (
                      <tr key={rowKey(row)} className="border-b border-gray-100 hover:bg-orange-50/60">
                        {columns.map(column => (
                          <td key={column.key} className="px-3 py-2 text-gray-800">
                            {column.render(row)}
                          </td>
                        ))}
                        <td className="px-3 py-1.5">
                          <button
                            type="button"
                            onClick={() => onSelect(row)}
                            aria-label={`Select ${rowKey(row)}`}
                            title="Select"
                            className="inline-flex h-7 w-7 items-center justify-center rounded-sm bg-portal-ink text-white hover:bg-portal-orange"
                          >
                            <MousePointerClick size={14} />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="mt-3 flex items-center justify-between text-[12px] text-gray-600">
                <span>
                  {results.length} record{results.length === 1 ? '' : 's'} found
                </span>
                {pageCount > 1 ? (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setPage(page - 1)}
                      disabled={page === 0}
                      aria-label="Previous page"
                      className="rounded-sm p-1 ring-1 ring-portal-line disabled:opacity-40"
                    >
                      <ChevronLeft size={14} />
                    </button>
                    <span>
                      Page {page + 1} of {pageCount}
                    </span>
                    <button
                      type="button"
                      onClick={() => setPage(page + 1)}
                      disabled={page >= pageCount - 1}
                      aria-label="Next page"
                      className="rounded-sm p-1 ring-1 ring-portal-line disabled:opacity-40"
                    >
                      <ChevronRight size={14} />
                    </button>
                  </div>
                ) : null}
              </div>
            </>
          )}
        </div>
      ) : null}
    </Modal>
  );
}

export default SearchModal;
