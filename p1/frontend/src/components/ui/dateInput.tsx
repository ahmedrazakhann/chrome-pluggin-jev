'use client';
import { useRef } from 'react';
import { CalendarDays } from 'lucide-react';
import { DateInputProps } from '@app-types/ui';
import FieldRow from '@components/ui/fieldRow';
import { ICON_BUTTON_CLASS, INPUT_CLASS, INPUT_ERROR_CLASS } from '@constants/styles';
import { fieldError } from '@utils/form';
import { toDisplayDate, toIsoDate } from '@utils/declaration';

// Text date in DD-MM-YYYY (as the portal shows it) with a calendar button that opens the browser's picker.
const DateInput: React.FC<DateInputProps> = ({ formik, name, label, required, info, disabled, className, hint }) => {
  const pickerRef = useRef<HTMLInputElement>(null);
  const error = fieldError(formik, name);
  const value: string = formik.values[name] ?? '';

  const openPicker = () => {
    const picker = pickerRef.current;
    if (!picker) return;
    try {
      picker.showPicker();
    } catch {
      picker.focus();
    }
  };

  return (
    <FieldRow label={label} htmlFor={name} required={required} info={info} error={error} className={className}>
      <div className="relative flex gap-1.5">
        <input
          id={name}
          name={name}
          type="text"
          inputMode="numeric"
          placeholder="DD-MM-YYYY"
          maxLength={10}
          value={value}
          onChange={event => formik.setFieldValue(name, event.target.value)}
          onBlur={formik.handleBlur}
          disabled={disabled}
          required={required}
          aria-invalid={!!error}
          className={`${INPUT_CLASS} ${error ? INPUT_ERROR_CLASS : ''}`}
        />
        <button
          type="button"
          onClick={openPicker}
          disabled={disabled}
          aria-label={`Choose ${label} from calendar`}
          className={`${ICON_BUTTON_CLASS} bg-portal-ink hover:bg-black`}
        >
          <CalendarDays size={16} />
        </button>
        <input
          ref={pickerRef}
          type="date"
          tabIndex={-1}
          aria-hidden="true"
          value={toIsoDate(value)}
          onChange={event => {
            formik.setFieldValue(name, toDisplayDate(event.target.value));
            formik.setFieldTouched(name, true, false);
          }}
          className="pointer-events-none absolute bottom-0 right-0 h-0 w-0 opacity-0"
        />
      </div>
      {hint && !error ? <p className="mt-1 text-[11px] text-gray-500">{hint}</p> : null}
    </FieldRow>
  );
};

export default DateInput;
