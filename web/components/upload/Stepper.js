import { Fragment } from 'react';
import { Check } from 'lucide-react';

export default function Stepper({ steps, current }) {
  return (
    <ol className="stepper" aria-label="Upload progress" style={{ listStyle: 'none', margin: 0 }}>
      {steps.map((s, i) => (
        <Fragment key={s}>
          {i > 0 && <li aria-hidden="true" className={`step-line ${i <= current ? 'done' : ''}`} />}
          <li className={`step ${i < current ? 'done' : i === current ? 'current' : ''}`} aria-current={i === current ? 'step' : undefined}>
            <span className="step-n">{i < current ? <Check aria-hidden="true" /> : i + 1}</span>
            <span>{s}</span>
          </li>
        </Fragment>
      ))}
    </ol>
  );
}
