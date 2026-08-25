type Props = {
  complete: boolean;
  active: boolean;
  onFinish: () => void;
};

const MARK_RINGS = [0, 1, 2, 3, 4];
const MARK_PERIOD_SECONDS = 7.5;

export function StartupScreen({ complete, active, onFinish }: Props) {
  return (
    <div
      className="startup-screen"
      data-complete={complete ? "true" : "false"}
      aria-hidden={!active}
      onTransitionEnd={(event) => {
        if (
          complete
          && event.target === event.currentTarget
          && event.propertyName === "opacity"
        ) onFinish();
      }}
    >
      <div className="startup-screen__content">
        <div className="startup-screen__mark" aria-hidden="true">
          {MARK_RINGS.map((ring) => (
            <span
              key={ring}
              style={{
                animationDelay:
                  `${(ring * -MARK_PERIOD_SECONDS) / MARK_RINGS.length}s`,
              }}
            />
          ))}
        </div>

        <p className="startup-screen__label" role="status">Loading...</p>
      </div>
    </div>
  );
}
