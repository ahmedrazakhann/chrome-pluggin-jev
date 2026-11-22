import { Fragment } from 'react';
import { StepperProps } from '@app-types/ui';

// Numbered circles joined by a line; reached steps are red and can be clicked to go back.
const Stepper: React.FC<StepperProps> = ({ steps, current, furthest, onStepClick }) => (
  <ol className="mb-6 flex items-start px-1 md:px-6">
    {steps.map((step, index) => {
      const reached = index <= furthest;
      return (
        <Fragment key={step}>
          {index > 0 ? (
            <li aria-hidden="true" className={`mt-4 h-[3px] flex-1 md:mt-5 ${index <= furthest ? 'bg-portal-red' : 'bg-gray-300'}`} />
          ) : null}
          <li className="flex w-16 shrink-0 flex-col items-center md:w-36">
            <button
              type="button"
              onClick={() => onStepClick(index)}
              disabled={!reached}
              aria-current={index === current ? 'step' : undefined}
              aria-label={`Step ${index + 1}: ${step}`}
              className={`flex h-9 w-9 items-center justify-center rounded-full border-[3px] bg-white text-base font-semibold transition md:h-11 md:w-11 md:text-xl ${
                reached ? 'border-portal-red text-portal-red' : 'border-gray-300 text-gray-400'
              } ${index === current ? 'ring-4 ring-portal-red/15' : ''} disabled:cursor-default`}
            >
              {index + 1}
            </button>
            <span
              className={`mt-1.5 text-center text-[10px] leading-tight md:text-[12px] ${reached ? 'text-portal-red' : 'text-gray-400'}`}
            >
              {step}
            </span>
          </li>
        </Fragment>
      );
    })}
  </ol>
);

export default Stepper;
