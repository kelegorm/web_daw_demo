interface Props {
  currentStep: number;
  stepCount?: number;
}

export default function SequencerDisplay({ currentStep, stepCount = 8 }: Props) {
  return (
    <div
      className="sequencer-display"
      style={{ display: 'flex', gap: 8, alignItems: 'center' }}
    >
      {Array.from({ length: stepCount }, (_, i) => (
        <div
          key={i}
          data-step={i}
          className={`sequencer-step${currentStep === i ? ' step-active' : ''}`}
          style={{
            width: 32,
            height: 32,
            borderRadius: 4,
            background: currentStep === i ? '#2a7' : '#444',
            border: '1px solid #666',
            transition: 'background 0.05s',
          }}
        />
      ))}
    </div>
  );
}
